(ns metabase.api.geojson
  (:require [clojure.java.io :as io]
            [compojure.core :refer [GET]]
            [metabase.api.common :as api]
            [metabase.models.setting :as setting :refer [defsetting]]
            [metabase.util.i18n :as ui18n :refer [deferred-tru tru]]
            [metabase.util.schema :as su]
            [ring.util.response :as rr]
            [schema.core :as s])
  (:import java.net.URL
           org.apache.commons.io.input.ReaderInputStream
           java.net.InetAddress))

(def ^:private CustomGeoJSON
  {s/Keyword {:name                     su/NonBlankString
              :url                      su/NonBlankString
              :region_key               (s/maybe s/Str)
              :region_name              (s/maybe s/Str)
              (s/optional-key :builtin) s/Bool}})

(def ^:private ^:const builtin-geojson
  {:us_states       {:name        "United States"
                     :url         "app/assets/geojson/us-states.json"
                     :region_key  "STATE"
                     :region_name "NAME"
                     :builtin     true}
   :world_countries {:name        "World"
                     :url         "app/assets/geojson/world.json"
                     :region_key  "ISO_A2"
                     :region_name "NAME"
                     :builtin     true}})

(defn-  invalid-location-msg []
  (str (tru "Invalid GeoJSON file location: must either start with http:// or https:// or be a relative path to a file on the classpath.")
       " "
       (tru "URLs referring to hosts that supply internal hosting metadata are prohibited.")))

(def ^:private invalid-hosts
  #{"metadata.google.internal"}) ; internal metadata for GCP

(defn- valid-host?
  [^URL url]
  (let [host (.getHost url)
        host->url (fn [host] (URL. (str "http://" host)))
        base-url  (host->url (.getHost url))]
    (and (not-any? (fn [invalid-url] (.equals base-url invalid-url))
                   (map host->url invalid-hosts))
         (not (.isLinkLocalAddress (InetAddress/getByName host))))))

(defn- valid-protocol?
  [^URL url]
  (#{"http" "https"} (.getProtocol url)))

(defn- valid-url?
  [url-string]
  (try
    (let [url (URL. url-string)]
      (and (valid-protocol? url)
           (valid-host? url)))
    (catch Throwable e
      (throw (ex-info (invalid-location-msg) {:status-code 400, :url url-string} e)))))

(defn- valid-geojson-url?
  [geojson]
  (every? (fn [[_ {:keys [url]}]]
            (or
             (io/resource url)
             (valid-url? url)))
          geojson))

(defn- validate-geojson
  "Throws a 400 if the supplied `geojson` is poorly structured or has an illegal URL/path"
  [geojson]
  (try
    (s/validate CustomGeoJSON geojson)
    (catch Throwable e
      (throw (ex-info (tru "Invalid custom GeoJSON.") {:status-code 400} e))))
  (or (valid-geojson-url? geojson)
      (throw (ex-info (invalid-location-msg) {:status-code 400}))))

(defsetting custom-geojson
  (deferred-tru "JSON containing information about custom GeoJSON files for use in map visualizations instead of the default US State or World GeoJSON.")
  :type    :json
  :default {}
  :getter  (fn [] (merge (setting/get-json :custom-geojson) builtin-geojson))
  :setter  (fn [new-value]
             (when new-value
               (validate-geojson new-value))
             (setting/set-json! :custom-geojson new-value))
  :visibility :public)


(api/defendpoint-async GET "/:key"
  "Fetch a custom GeoJSON file as defined in the `custom-geojson` setting. (This just acts as a simple proxy for the
  file specified for `key`)."
  [{{:keys [key]} :params} respond raise]
  {key su/NonBlankString}
  (if-let [url (get-in (custom-geojson) [(keyword key) :url])]
    (with-open [reader (io/reader (or (io/resource url)
                                      url))
                is     (ReaderInputStream. reader)]
      (respond (-> (rr/response is)
                   (rr/content-type "application/json"))))
    (raise (ex-info (tru "Invalid custom GeoJSON key: {0}" key)
             {:status-code 400}))))

(api/define-routes)
