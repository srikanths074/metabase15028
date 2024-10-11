(ns metabase.util.json
  "Functions for encoding and decoding JSON that abstract away the underlying implementation."
  (:require [jsonista.core :as jsonista])
  (:import com.fasterxml.jackson.core.JsonGenerator))

(defn- byte-array-encoder
  "For binary arrays ([B), hex-encode their first four bytes, e.g. \"0xC42360D7\"."
  [arr ^JsonGenerator generator]
  (.writeString generator ^String (apply format "0x%02X%02X%02X%02X" (take 4 arr))))

;; Always fall back to `.toString` instead of barfing. In some cases we should be able to improve upon this behavior;
;; `.toString` may just return the Class and address, e.g. `some.Class@72a8b25e`
;; The following are known few classes where `.toString` is the optimal behavior:
;; *  `org.postgresql.jdbc4.Jdbc4Array` (Postgres arrays)
;; *  `org.bson.types.ObjectId`         (Mongo BSON IDs)
;; *  `java.sql.Date`                   (SQL Dates -- .toString returns YYYY-MM-DD)
(defn- fallback-object-encoder [obj ^JsonGenerator generator]
  (.writeString generator (str obj)))

(def ^:private encoders
  (atom {(Class/forName "[B") byte-array-encoder
         ;; Object               fallback-object-encoder
         }))

(defn- make-mapper [key-fn]
  (jsonista/object-mapper (cond-> {:encoders @encoders}
                            key-fn (assoc :decode-key-fn key-fn))))

(def ^:private global-mapper
  "Jsonista doesn't have a concept of a \"global\" object mapper like Cheshire does, so we simulate it here. The object
  mapper defined in this namespace must be used for all encoding and decoding work around Metabase, and hence, the
  functions from this namespace should be used everywhere instead of jsonista.core functions."
  (atom (make-mapper nil)))

(def ^:private global-mapper-keywordize-keys
  (atom (make-mapper true)))

(defn add-encoder
  "Register `encoder` for `class` in `global-mapper`."
  [class encoder]
  (swap! encoders assoc class encoder)
  (reset! global-mapper (make-mapper nil))
  (reset! global-mapper-keywordize-keys (make-mapper true)))

(defn encode
  "Return a JSON-encoding String for the given object. Uses `global-mapper`."
  [obj]
  (jsonista/write-value-as-string obj @global-mapper))

(defn decode
  "Decode a value from a JSON from anything that satisfies Jsonista's ReadValue protocol. By default, File, URL, String,
  Reader and InputStream are supported. Uses `global-mapper`."
  [source]
  (jsonista/read-value source @global-mapper))

(defn decode+kw
  "Decode a value from a JSON from anything that satisfies Jsonista's ReadValue protocol, keywordizing the map keys. By
  default, File, URL, String, Reader and InputStream are supported. Uses `global-mapper-keywordize-keys`."
  [source]
  (jsonista/read-value source @global-mapper-keywordize-keys))
