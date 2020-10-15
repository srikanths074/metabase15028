(ns metabase.query-processor.streaming.xlsx
  (:require [cheshire.core :as json]
            [dk.ative.docjure.spreadsheet :as spreadsheet]
            [java-time :as t]
            [metabase.query-processor.streaming.interface :as i]
            [metabase.util
             [date-2 :as u.date]
             [i18n :refer [tru]]])
  (:import java.io.OutputStream
           [org.apache.poi.ss.usermodel Cell CellType]
           org.apache.poi.xssf.streaming.SXSSFWorkbook))

(defmethod i/stream-options :xlsx
  [_]
  {:content-type              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
   :write-keepalive-newlines? false
   :headers                   {"Content-Disposition" (format "attachment; filename=\"query_result_%s.xlsx\""
                                                             (u.date/format (t/zoned-date-time)))}})

(defprotocol ExcelFormatValue
  "Protocol for specifying how objects of various classes in QP result rows should be formatted for Excel
  exports. The generic version in `common/FormatValue` does not work for Excel due to date/time formats."
  (excel-format-value [this]
    "Format this value in a QP result row appropriately for a results download to Excel."))

;; this version of the protocol resolves #10803 by not converting datetimes to ISO8601 (which Excel cannot parse)
;; Docjure can handle java.util.Date instances, but not the new Java 8 Time instances, so we convert everything
;; to java.util.Date.
(extend-protocol ExcelFormatValue
  nil
  (excel-format-value [_] nil)

  Object
  (excel-format-value [this] this)

  java.time.temporal.Temporal
  (excel-format-value [this]
    (t/java-date this))

  java.time.LocalDateTime
  (excel-format-value [this]
    ;; this is a sticky one - LocalDateTime where? Using the server's timezone for the conversion.
    (t/java-date (t/zoned-date-time this (t/zone-id))))

  java.time.OffsetDateTime
  (excel-format-value [this]
     (t/java-date this))

  java.time.ZonedDateTime
  (excel-format-value [this]
    (t/java-date this)))

;; add a generic implementation for the method that writes values to XLSX cells that just piggybacks off the
;; implementations we've already defined for encoding things as JSON. These implementations live in
;; `metabase.middleware`.
(defmethod spreadsheet/set-cell! Object [^Cell cell, value]
  (when (= (.getCellType cell) CellType/FORMULA)
    (.setCellType cell CellType/STRING))
  ;; stick the object in a JSON map and encode it, which will force conversion to a string. Then unparse that JSON and
  ;; use the resulting value as the cell's new String value.  There might be some more efficient way of doing this but
  ;; I'm not sure what it is.
  (.setCellValue cell (str (-> (json/generate-string {:v value})
                               (json/parse-string keyword)
                               :v))))

;; TODO -- this is obviously not streaming! SAD!
(defmethod i/streaming-results-writer :xlsx
  [_ ^OutputStream os]
  (let [workbook (SXSSFWorkbook.)
        sheet    (spreadsheet/add-sheet! workbook (tru "Query result"))]
    (reify i/StreamingResultsWriter
      (begin! [_ {{:keys [cols]} :data}]
        (spreadsheet/add-row! sheet (map (some-fn :display_name :name) cols)))

      (write-row! [_ row _]
        (spreadsheet/add-row! sheet (map excel-format-value row)))

      (finish! [_ _]
        (spreadsheet/save-workbook-into-stream! os workbook)
        (.dispose workbook)
        (.close os)))))
