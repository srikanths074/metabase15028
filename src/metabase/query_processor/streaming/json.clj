(ns metabase.query-processor.streaming.json
  "Impls for JSON-based QP streaming response types. `:json` streams a simple array of maps as opposed to the full
  response with all the metadata for `:api`."
  (:require
   [cheshire.core :as json]
   [java-time.api :as t]
   [medley.core :as m]
   [metabase.formatter :as formatter]
   [metabase.query-processor.pivot.postprocess :as qp.pivot.postprocess]
   [metabase.query-processor.streaming.common :as common]
   [metabase.query-processor.streaming.interface :as qp.si]
   [metabase.shared.models.visualization-settings :as mb.viz]
   [metabase.util.date-2 :as u.date])
  (:import
   (java.io BufferedWriter OutputStream OutputStreamWriter)
   (java.nio.charset StandardCharsets)))

(set! *warn-on-reflection* true)

(defmethod qp.si/stream-options :json
  ([_]
   (qp.si/stream-options :json "query_result"))
  ([_ filename-prefix]
   {:content-type "application/json; charset=utf-8"
    :status       200
    :headers      {"Content-Disposition" (format "attachment; filename=\"%s_%s.json\""
                                                 (or filename-prefix "query_result")
                                                 (u.date/format (t/zoned-date-time)))}}))

(defmethod qp.si/streaming-results-writer :json
  [_ ^OutputStream os]
  (let [writer             (BufferedWriter. (OutputStreamWriter. os StandardCharsets/UTF_8))
        col-names          (volatile! nil)
        ordered-formatters (volatile! nil)
        ;; if we're processing results from a pivot query, there will be a column 'pivot-grouping' that we don't want to include
        ;; in the final results, so we get the idx into the row in order to remove it
        pivot-grouping-idx (volatile! nil)]
    (reify qp.si/StreamingResultsWriter
      (begin! [_ {{:keys [ordered-cols results_timezone format-rows?]
                   :or   {format-rows? true}} :data} viz-settings]
        ;; TODO -- wouldn't it make more sense if the JSON downloads used `:name` preferentially? Seeing how JSON is
        ;; probably going to be parsed programmatically
        (let [cols           (common/column-titles ordered-cols (::mb.viz/column-settings viz-settings) format-rows?)
              pivot-grouping (qp.pivot.postprocess/pivot-grouping-key cols)]
          (when pivot-grouping (vreset! pivot-grouping-idx pivot-grouping))
          (let [names (cond->> cols
                        pivot-grouping (m/remove-nth pivot-grouping))]
            (vreset! col-names names))
          (vreset! ordered-formatters
                   (if format-rows?
                     (mapv #(formatter/create-formatter results_timezone % viz-settings) ordered-cols)
                     (vec (repeat (count ordered-cols) identity))))
          (.write writer "[\n")))

      (write-row! [_ row row-num _ {:keys [output-order]}]
        (let [ordered-row        (vec
                                  (if output-order
                                    (let [row-v (into [] row)]
                                      (for [i output-order] (row-v i)))
                                    row))
              pivot-grouping-key @pivot-grouping-idx
              group              (get ordered-row pivot-grouping-key)
              cleaned-row        (cond->> ordered-row
                                   pivot-grouping-key (m/remove-nth pivot-grouping-key))]
          ;; when a pivot-grouping col exists, we check its group number. When it's zero,
          ;; we keep it, otherwise don't include it in the results as it's a row representing a subtotal of some kind
          (when (or (= qp.pivot.postprocess/NON_PIVOT_ROW_GROUP group)
                    (not group))
            (when-not (zero? row-num)
              (.write writer ",\n"))
            (json/generate-stream
             (zipmap
              @col-names
              (map (fn [formatter r]
                     ;; NOTE: Stringification of formatted values ensures consistency with what is shown in the
                     ;; Metabase UI, especially numbers (e.g. percents, currencies, and rounding). However, this
                     ;; does mean that all JSON values are strings. Any other strategy requires some level of
                     ;; inference to know if we should or should not parse a string (or not stringify an object).
                     (let [res (formatter (common/format-value r))]
                       (if-some [num-str (:num-str res)]
                         num-str
                         res)))
                   @ordered-formatters cleaned-row))
             writer)
            (.flush writer))))

      (finish! [_ _]
        (.write writer "\n]")
        (.flush writer)
        (.flush os)
        (.close writer)))))

(defmethod qp.si/stream-options :api
  ([_]   (qp.si/stream-options :api nil))
  ([_ _] {:content-type "application/json; charset=utf-8"}))

(defn- map->serialized-json-kvs
  "{:a 100, :b 200} ; -> \"a\":100,\"b\":200"
  ^String [m]
  (when (seq m)
    (let [s (json/generate-string m)]
      (.substring s 1 (dec (count s))))))

(defmethod qp.si/streaming-results-writer :api
  [_ ^OutputStream os]
  (let [writer (BufferedWriter. (OutputStreamWriter. os StandardCharsets/UTF_8))]
    (reify qp.si/StreamingResultsWriter
      (begin! [_ _ _]
        (.write writer "{\"data\":{\"rows\":[\n"))

      (write-row! [_ row row-num _ _]
        (when-not (zero? row-num)
          (.write writer ",\n"))
        (json/generate-stream row writer)
        (.flush writer))

      (finish! [_ {:keys [data], :as metadata}]
        (let [data-kvs-str           (map->serialized-json-kvs data)
              other-metadata-kvs-str (map->serialized-json-kvs (dissoc metadata :data))]
          ;; close data.rows
          (.write writer "\n]")
          ;; write any remaining keys in data
          (when (seq data-kvs-str)
            (.write writer ",\n")
            (.write writer data-kvs-str))
          ;; close data
          (.write writer "}")
          ;; write any remaining top-level keys
          (when (seq other-metadata-kvs-str)
            (.write writer ",\n")
            (.write writer other-metadata-kvs-str))
          ;; close top-level map
          (.write writer "}"))
        (.flush writer)
        (.flush os)
        (.close writer)))))
