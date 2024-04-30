(ns metabase.lib.metadata.composed-provider
  (:require
   #?(:clj [pretty.core :as pretty])
   [clojure.core.protocols]
   [clojure.datafy :as datafy]
   [clojure.set :as set]
   [medley.core :as m]
   [metabase.lib.metadata.protocols :as metadata.protocols]))

(defn- metadatas-for-f [f providers metadata-type ids]
  (loop [[provider & more-providers] providers, unfetched-ids (set ids), fetched []]
    (cond
      (empty? unfetched-ids)
      fetched

      (not provider)
      fetched

      :else
      (let [newly-fetched     (f provider metadata-type unfetched-ids)
            newly-fetched-ids (into #{} (map :id) newly-fetched)
            unfetched-ids     (set/difference unfetched-ids newly-fetched-ids)]
        (recur more-providers
               unfetched-ids
               (into fetched newly-fetched))))))

(defn- metadatas [providers metadata-type ids]
  (metadatas-for-f metadata.protocols/metadatas providers metadata-type ids))

(defn- cached-metadatas [providers metadata-type ids]
  (metadatas-for-f metadata.protocols/cached-metadatas providers metadata-type ids))

(defn- store-metadata! [metadata-providers metadata]
  ;; [[metadata.protocols/store-metadata!]] should return truthy if the metadata provider stored it, i.e. if it has a
  ;; cache, so try with each metadata provider until one of them stores it.
  (some (fn [metadata-provider]
          (metadata.protocols/store-metadata! metadata-provider metadata))
        metadata-providers))

(defn- tables [metadata-providers]
  (m/distinct-by :id (mapcat metadata.protocols/tables metadata-providers)))

(defn- metadatas-for-table [metadata-type table-id metadata-providers]
  (into []
        (comp
         (mapcat (fn [provider]
                   (metadata.protocols/metadatas-for-table provider metadata-type table-id)))
         (m/distinct-by :id))
        metadata-providers))

(defn- setting [metadata-providers setting-key]
  (some (fn [provider]
          (metadata.protocols/setting provider setting-key))
        metadata-providers))

(deftype ComposedMetadataProvider [metadata-providers]
  metadata.protocols/MetadataProvider
  (database [_this]
    (some metadata.protocols/database metadata-providers))
  (metadatas [_this metadata-type ids]
    (metadatas metadata-providers metadata-type ids))
  (cached-metadatas [_this metadata-type metadata-ids]
    (cached-metadatas metadata-providers metadata-type metadata-ids))
  (store-metadata! [_this metadata]
    (store-metadata! metadata-providers metadata))
  (tables [_this]
    (tables metadata-providers))
  (metadatas-for-table [_this metadata-type table-id]
    (metadatas-for-table metadata-type table-id metadata-providers))
  (setting [_this setting-key]
    (setting metadata-providers setting-key))

  #?(:clj Object :cljs IEquiv)
  (#?(:clj equals :cljs -equiv) [_this another]
    (and (instance? ComposedMetadataProvider another)
         (= metadata-providers
            (.-metadata-providers ^ComposedMetadataProvider another))))

  clojure.core.protocols/Datafiable
  (datafy [_this]
    (cons `composed-metadata-provider (map datafy/datafy metadata-providers)))

  #?@(:clj
      [pretty/PrettyPrintable
       (pretty [_this]
               (list* `composed-metadata-provider metadata-providers))]))

(defn composed-metadata-provider
  "A metadata provider composed of several different `metadata-providers`. Methods try each constituent provider in
  turn from left to right until one returns a truthy result."
  [& metadata-providers]
  (->ComposedMetadataProvider metadata-providers))
