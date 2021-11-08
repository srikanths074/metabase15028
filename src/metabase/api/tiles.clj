(ns metabase.api.tiles
  "`/api/tiles` endpoints."
  (:require [cheshire.core :as json]
            [clojure.set :as set]
            [compojure.core :refer [GET]]
            [metabase.api.common :as api]
            [metabase.mbql.normalize :as normalize]
            [metabase.mbql.util :as mbql.u]
            [metabase.query-processor :as qp]
            [metabase.util :as u]
            [metabase.util.i18n :refer [tru]]
            [metabase.util.schema :as su]
            [schema.core :as s])
  (:import java.awt.Color
           java.awt.image.BufferedImage
           [java.io ByteArrayInputStream ByteArrayOutputStream]
           javax.imageio.ImageIO))

;;; --------------------------------------------------- CONSTANTS ----------------------------------------------------

(def ^:private ^:const tile-size             256.0)
(def ^:private ^:const pixel-origin          (float (/ tile-size 2)))
(def ^:private ^:const pin-size              6)
(def ^:private ^:const pixels-per-lon-degree (float (/ tile-size 360)))
(def ^:private ^:const pixels-per-lon-radian (float (/ tile-size (* 2 Math/PI))))


;;; ---------------------------------------------------- UTIL FNS ----------------------------------------------------

(defn- degrees->radians ^double [^double degrees]
  (* degrees (/ Math/PI 180.0)))

(defn- radians->degrees ^double [^double radians]
  (/ radians (/ Math/PI 180.0)))


;;; --------------------------------------------------- QUERY FNS ----------------------------------------------------

(defn- x+y+zoom->lat-lon
  "Get the latitude & longitude of the upper left corner of a given tile."
  [^double x, ^double y, ^long zoom]
  (let [num-tiles   (bit-shift-left 1 zoom)
        corner-x    (/ (* x tile-size) num-tiles)
        corner-y    (/ (* y tile-size) num-tiles)
        lon         (/ (- corner-x pixel-origin) pixels-per-lon-degree)
        lat-radians (/ (- corner-y pixel-origin) (* pixels-per-lon-radian -1))
        lat         (radians->degrees (- (* 2 (Math/atan (Math/exp lat-radians)))
                                         (/ Math/PI 2)))]
    {:lat lat, :lon lon}))

(defn- query-with-inside-filter
  "Add an `INSIDE` filter to the given query to restrict results to a bounding box. The fields passed in can be either
  integer field ids or string field names. When a field name, the `base-type` will be set to `:type/Float`."
  [details lat-field lon-field x y zoom]
  (let [top-left      (x+y+zoom->lat-lon      x       y  zoom)
        bottom-right  (x+y+zoom->lat-lon (inc x) (inc y) zoom)
        inside-filter [:inside
                       lat-field
                       lon-field
                       (top-left :lat)
                       (top-left :lon)
                       (bottom-right :lat)
                       (bottom-right :lon)]]
    (update details :filter mbql.u/combine-filter-clauses inside-filter)))


;;; --------------------------------------------------- RENDERING ----------------------------------------------------

(defn- ^BufferedImage create-tile [zoom points]
  (let [num-tiles (bit-shift-left 1 zoom)
        tile      (BufferedImage. tile-size tile-size (BufferedImage/TYPE_INT_ARGB))
        graphics  (.getGraphics tile)
        color-blue (new Color 76 157 230)
        color-white (Color/white)]
    (try
      (doseq [[^double lat, ^double lon] points]
        (let [sin-y      (-> (Math/sin (degrees->radians lat))
                             (Math/max -0.9999)                           ; bound sin-y between -0.9999 and 0.9999 (why ?))
                             (Math/min 0.9999))
              point      {:x (+ pixel-origin
                                (* lon pixels-per-lon-degree))
                          :y (+ pixel-origin
                                (* 0.5
                                   (Math/log (/ (+ 1 sin-y)
                                                (- 1 sin-y)))
                                   (* pixels-per-lon-radian -1.0)))}      ; huh?
              map-pixel  {:x (int (Math/floor (* (point :x) num-tiles)))
                          :y (int (Math/floor (* (point :y) num-tiles)))}
              tile-pixel {:x (mod (map-pixel :x) tile-size)
                          :y (mod (map-pixel :y) tile-size)}]
          ;; now draw a "pin" at the given tile pixel location
          (.setColor graphics color-white)
          (.fillRect graphics (tile-pixel :x) (tile-pixel :y) pin-size pin-size)
          (.setColor graphics color-blue)
          (.fillRect graphics (inc (tile-pixel :x)) (inc (tile-pixel :y)) (- pin-size 2) (- pin-size 2))))
      (catch Throwable e
        (.printStackTrace e))
      (finally
        (.dispose graphics)))
    tile))

(defn- tile->byte-array ^bytes [^BufferedImage tile]
  (let [output-stream (ByteArrayOutputStream.)]
    (try
      (when-not (ImageIO/write tile "png" output-stream) ; returns `true` if successful -- see JavaDoc
        (throw (Exception. (tru "No appropriate image writer found!"))))
      (.flush output-stream)
      (.toByteArray output-stream)
      (catch Throwable e
        (byte-array 0)) ; return empty byte array if we fail for some reason
      (finally
        (u/ignore-exceptions
          (.close output-stream))))))

(defn- native->source-query
  "Adjust native queries to be an mbql from a source query so we can add the filter clause."
  [query]
  (if (contains? query :native)
    (let [native (set/rename-keys (:native query) {:query :native})]
      {:database (:database query)
       :type     :query
       :query    {:source-query native}})
    query))


;;; ---------------------------------------------------- ENDPOINT ----------------------------------------------------

(defn- int-or-string
  "Parse a string into an integer if it can be otherwise return the string. Intended to determine whether something is a
  field id or a field name."
  [x]
  (if (re-matches #"\d+" x)
    (Integer/parseInt x)
    x))

(defn- field-ref
  "Makes a field reference for `id-or-name`. If id, the type information can be determined, if a string, must be
  provided. Since we deal exclusively with lat/long fields, assumed to be a float."
  [id-or-name]
  (let [id-or-name' (int-or-string id-or-name)]
    [:field id-or-name' (when (string? id-or-name') {:base-type :type/Float})]))

(defn query->tiles-query [query {:keys [zoom x y lat-field lon-field]}]
  (let [lat-ref (field-ref lat-field)
        lon-ref (field-ref lon-field)]
    (-> query
        native->source-query
        (update :query query-with-inside-filter
                lat-ref lon-ref
                x y zoom)
        (assoc-in [:query :fields] [lat-ref lon-ref])
        (assoc :async? false))))

;; TODO - this can be reworked to be `defendpoint-async` instead
;;
;; TODO - this should reduce results from the QP in a streaming fashion instead of requiring them all to be in memory
;; at the same time
(api/defendpoint GET "/:zoom/:x/:y/:lat-field/:lon-field"
  "This endpoints provides an image with the appropriate pins rendered given a MBQL `query` (passed as a GET query
  string param). We evaluate the query and find the set of lat/lon pairs which are relevant and then render the
  appropriate ones. It's expected that to render a full map view several calls will be made to this endpoint in
  parallel."
  [zoom x y lat-field lon-field query]
  {zoom        su/IntString
   x           su/IntString
   y           su/IntString
   lat-field   s/Str
   lon-field   s/Str
   query       su/JSONString}
  (let [zoom        (Integer/parseInt zoom)
        x           (Integer/parseInt x)
        y           (Integer/parseInt y)

        query
        (normalize/normalize (json/parse-string query keyword))

        updated-query (query->tiles-query query {:zoom zoom :x x :y y
                                                 :lat-field lat-field
                                                 :lon-field lon-field})

        {:keys [status], {:keys [rows]} :data, :as result}
        (qp/process-query-and-save-execution! updated-query
                                              {:executed-by api/*current-user-id*
                                               :context     :map-tiles})]
    ;; manual ring response here.  we simply create an inputstream from the byte[] of our image
    (if (= status :completed)
      {:status  200
       :headers {"Content-Type" "image/png"}
       :body    (ByteArrayInputStream. (tile->byte-array (create-tile zoom rows)))}
      (throw (ex-info (tru "Query failed")
                      ;; `result` might be a `core.async` channel or something we're not expecting
                      (assoc (when (map? result) result) :status-code 400))))))

(api/define-routes)
