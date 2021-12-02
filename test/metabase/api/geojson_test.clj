(ns metabase.api.geojson-test
  (:require [clojure.test :refer :all]
            [metabase.api.geojson :as geojson-api]
            [metabase.http-client :as client]
            [metabase.server.middleware.security :as mw.security]
            [metabase.test :as mt]
            [metabase.util :as u]
            [schema.core :as s]))

(def ^:private ^String test-geojson-url
  "URL of a GeoJSON file used for test purposes."
  "https://raw.githubusercontent.com/metabase/metabase/master/test_resources/test.geojson")

(def ^:private test-custom-geojson
  {:middle-earth {:name        "Middle Earth"
                  :url         test-geojson-url
                  :builtin     true
                  :region_key  nil
                  :region_name nil}})

(def ^:private test-geojson-value
  {:type "FeatureCollection"
   :features [{:type "Feature"
               :geometry {:type "Point",
                          :coordinates [55.948609737988384
                                        -3.1919722001105044]}
               :properties []}]})

(deftest geojson-schema-test
  (is (= true
         (boolean (s/validate @#'geojson-api/CustomGeoJSON test-custom-geojson)))))

(deftest validate-geojson-test
  (testing "It validates URLs and files appropriately"
    (let [examples {;; Internal metadata for GCP
                    "metadata.google.internal"                 false
                    "https://metadata.google.internal"         false
                    "//metadata.google.internal"               false
                    ;; Link-local addresses (internal metadata for AWS, OpenStack, and Azure)
                    "http://169.254.0.0"                       false
                    "http://fe80::"                            false
                    "169.254.169.254"                          false
                    "http://169.254.169.254/secret-stuff.json" false
                    ;; alternate IPv4 encodings (hex, octal, integer)
                    "http://0xa9fea9fe"                        false
                    "https://0xa9fea9fe"                       false
                    "http://0xA9FEA9FE"                        false
                    "http://0xa9.0xfe.0xa9.0xfe"               false
                    "http://0XA9.0XFE.0xA9.0XFE"               false
                    "http://0xa9fea9fe/secret-stuff.json"      false
                    "http://025177524776"                      false
                    "http://0251.0376.0251.0376"               false
                    "http://2852039166"                        false
                    ;; Prohibited protocols
                    "ftp://example.com/rivendell.json"         false
                    "example.com/rivendell.json"               false
                    "jar:file:test.jar!/test.json"             false
                    ;; Acceptable URLs
                    "http://example.com/"                      true
                    "https://example.com/"                     true
                    "http://example.com/rivendell.json"        true
                    "http://192.0.2.0"                         true
                    "http://0xc0000200"                        true
                    ;; Resources (files on classpath) are valid
                    "c3p0.properties"                          true
                    ;; Other files are not
                    "./README.md"                              false
                    "file:///tmp"                              false
                    ;; Nonsense is invalid
                    "rasta@metabase.com"                       false
                    ""                                         false
                    "Tom Bombadil"                             false}
          valid?   #'geojson-api/validate-geojson]
      (doseq [[url should-pass?] examples]
        (let [geojson {:deadb33f {:name        "Rivendell"
                                   :url         url
                                   :region_key  nil
                                  :region_name nil}}]
          (if should-pass?
            (is (valid? geojson) url)
            (is (thrown? clojure.lang.ExceptionInfo (valid? geojson)) url)))))))

(deftest update-endpoint-test
  (testing "PUT /api/setting/custom-geojson"
    (testing "test that we can set the value of geojson-api/custom-geojson via the normal routes"
      (is (= (merge @#'geojson-api/builtin-geojson test-custom-geojson)
             ;; try this up to 3 times since Circle's outbound connections likes to randomly stop working
             (u/auto-retry 3
               ;; bind a temporary value so it will get set back to its old value here after the API calls are done
               ;; stomping all over it
               (mt/with-temporary-setting-values [custom-geojson nil]
                 ((mt/user->client :crowberto) :put 204 "setting/custom-geojson" {:value test-custom-geojson})
                 ((mt/user->client :crowberto) :get 200 "setting/custom-geojson"))))))
    (testing "passing in an invalid URL" ; see above validation test
      (is (= (str "Invalid GeoJSON file location: must either start with http:// or https:// or be a relative path to a file on the classpath. "
                  "URLs referring to hosts that supply internal hosting metadata are prohibited.")
             ((mt/user->client :crowberto) :put 400 "setting/custom-geojson"
              {:value {:mordor (assoc (first (vals test-custom-geojson))
                                      :url "ftp://example.com")}}))))
    (testing "it accepts resources"
      (let [resource-geojson {(first (keys test-custom-geojson))
                              (assoc (first (vals test-custom-geojson))
                                     :url "c3p0.properties")}]
        (is (= (merge @#'geojson-api/builtin-geojson resource-geojson)
               (u/auto-retry 3
                 (mt/with-temporary-setting-values [custom-geojson nil]
                   ((mt/user->client :crowberto) :put 204 "setting/custom-geojson"
                    {:value resource-geojson})
                   ((mt/user->client :crowberto) :get 200 "setting/custom-geojson")))))))))

(deftest proxy-endpoint-test
  (testing "GET /api/geojson/:key"
    (mt/with-temporary-setting-values [custom-geojson test-custom-geojson]
      (testing "test the endpoint that acts as a proxy for JSON files"
        (is (= {:type        "Point"
                :coordinates [37.77986 -122.429]}
               ((mt/user->client :rasta) :get 200 "geojson/middle-earth"))))
      (testing "response should not include the usual cache-busting headers"
        (is (= (#'mw.security/cache-far-future-headers)
               (select-keys (:headers (client/client-full-response :get 200 "geojson/middle-earth"))
                            (keys (#'mw.security/cache-prevention-headers))))))
      (testing "should be able to fetch the GeoJSON even if you aren't logged in"
        (is (= {:type        "Point"
                :coordinates [37.77986 -122.429]}
               (client/client :get 200 "geojson/middle-earth"))))
      (testing "error conditions"
        (testing "try fetching an invalid key; should fail"
          (is (= "Invalid custom GeoJSON key: invalid-key"
                 ((mt/user->client :rasta) :get 400 "geojson/invalid-key"))))))))
