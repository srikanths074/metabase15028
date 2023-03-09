(ns metabase-enterprise.serialization.v2.ingest
  "Ingestion is the first step in deserialization - reading from the export format (eg. a tree of YAML files) and
  producing Clojure maps with `:serdes/meta` keys.

  See the detailed description of the (de)serialization processes in [[metabase.models.serialization.base]]."
  (:require
   [clojure.java.io :as io]
   [clojure.string :as str]
   [medley.core :as m]
   [metabase.models.serialization :as serdes]
   [metabase.util.date-2 :as u.date]
   [potemkin.types :as p]
   [yaml.core :as yaml]
   [yaml.reader :as y.reader])
  (:import (java.io File)
           (java.time.temporal Temporal)))

(set! *warn-on-reflection* true)

(p/defprotocol+ Ingestable
  ;; Represents a data source for deserializing previously-exported appdb content into this Metabase instance.
  ;; This is written as a protocol since overriding it with [[reify]] is useful for testing.
  (ingest-list
    [this]
    "Return a reducible stream of `:serdes/meta`-style abstract paths, one for each entity in the dump.
    See the description of these abstract paths in [[metabase.models.serialization.base]].
    Each path is ordered from the root to the leaf.

    The order of the whole list is not specified and should not be relied upon!")

  (ingest-one
    [this path]
    "Given one of the `:serdes/meta` abstract paths returned by [[ingest-list]], read in and return the entire
    corresponding entity."))

(extend-type Temporal y.reader/YAMLReader
             (decode [data]
               (u.date/parse data)))

(defn- read-timestamps [entity]
  (->> (keys entity)
       (filter #(or (#{:last_analyzed} %)
                    (.endsWith (name %) "_at")))
       (reduce #(update %1 %2 u.date/parse) entity)))

(defn- map-ish?
  [x]
  (or (map? x) (isa? x flatland.ordered.map.OrderedMap)))

(defn- parse-keys
  "Convert suitable string keys to clojure keywords, ignoring keys with whitespace, etc."
  [obj]
  (cond
    (map-ish? obj)    (m/map-kv (fn [k v]
                                  [(if (re-matches #"^[0-9a-zA-Z_\./\-]+$" k)
                                     (apply keyword (str/split k #"/"))
                                     k)
                                   (parse-keys v)])
                                obj)
    (sequential? obj) (mapv parse-keys obj)
    :else             obj))

(defn- strip-labels
  [hierarchy]
  (mapv #(dissoc % :label) hierarchy))

(defn- ingest-file
  "Reads an entity YAML file and clean it up (eg. parsing timestamps)
  The returned entity is in \"extracted\" form, ready to be passed to the `load` step."
  [file]
  (-> file
      (yaml/from-file false)
      parse-keys
      read-timestamps))

(def ^:private legal-top-level-paths
  #{"actions" "collections" "databases" "snippets"}) ; But return the hierarchy without labels.

(defn- ingest-all [^File root-dir]
  ;; This returns a map {unlabeled-hierarchy [original-hierarchy File]}.
  (into {} (for [^File file (file-seq root-dir)
                 :when      (and (.isFile file)
                                 (let [rel (.relativize (.toPath root-dir) (.toPath file))]
                                   (-> rel (.subpath 0 1) (.toString) legal-top-level-paths)))
                 ;; TODO: only load YAML once.
                 :let [hierarchy (serdes/path (ingest-file file))]]
             [(strip-labels hierarchy) [hierarchy file]])))

(deftype YamlIngestion [^File root-dir settings cache]
  Ingestable
  (ingest-list [_]
    (->> (or @cache
             (reset! cache (ingest-all root-dir)))
         vals
         (map first)))

  (ingest-one [_ abs-path]
    (when-not @cache
      (reset! cache (ingest-all root-dir)))
    (let [{:keys [id]} (first abs-path)
          kw-id        (keyword id)]
      (if (= ["Setting"] (mapv :model abs-path))
        {:serdes/meta abs-path :key kw-id :value (get settings kw-id)}
        (->> abs-path
             strip-labels
             (get @cache)
             second
             ingest-file)))))

(defn ingest-yaml
  "Creates a new Ingestable on a directory of YAML files, as created by
  [[metabase-enterprise.serialization.v2.storage.yaml]]."
  [root-dir]
  (->YamlIngestion (io/file root-dir) (yaml/from-file (io/file root-dir "settings.yaml")) (atom nil)))
