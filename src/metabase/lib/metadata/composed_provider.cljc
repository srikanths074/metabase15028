(ns metabase.lib.metadata.composed-provider
  (:require
   [clojure.core.protocols]
   [clojure.datafy :as datafy]
   [medley.core :as m]
   [metabase.lib.metadata.protocols :as metadata.protocols]))

(defn- cached-providers [providers]
  (filter #(satisfies? metadata.protocols/CachedMetadataProvider %)
          providers))

(defn composed-metadata-provider
  "A metadata provider composed of several different `metadata-providers`. Methods try each constituent provider in
  turn from left to right until one returns a truthy result."
  [& metadata-providers]
  (reify
    metadata.protocols/MetadataProvider
    (database [_this]            (some metadata.protocols/database                metadata-providers))
    (table    [_this table-id]   (some #(metadata.protocols/table   % table-id)   metadata-providers))
    (field    [_this field-id]   (some #(metadata.protocols/field   % field-id)   metadata-providers))
    (card     [_this card-id]    (some #(metadata.protocols/card    % card-id)    metadata-providers))
    (metric   [_this metric-id]  (some #(metadata.protocols/metric  % metric-id)  metadata-providers))
    (segment  [_this segment-id] (some #(metadata.protocols/segment % segment-id) metadata-providers))
    (tables   [_this]            (m/distinct-by :id (mapcat metadata.protocols/tables               metadata-providers)))
    (fields   [_this table-id]   (m/distinct-by :id (mapcat #(metadata.protocols/fields % table-id) metadata-providers)))

    metadata.protocols/CachedMetadataProvider
    (cached-database [_this]
      (some metadata.protocols/cached-database
            (cached-providers metadata-providers)))
    (cached-metadata [_this metadata-type id]
      (some #(metadata.protocols/cached-metadata % metadata-type id)
            (cached-providers metadata-providers)))
    (store-database! [_this database-metadata]
      (when-first [provider (cached-providers metadata-providers)]
        (metadata.protocols/store-database! provider database-metadata)))
    (store-metadata! [_this metadata-type id metadata]
      (when-first [provider (cached-providers metadata-providers)]
        (metadata.protocols/store-metadata! provider metadata-type id metadata)))

    clojure.core.protocols/Datafiable
    (datafy [_this]
      (cons `composed-metadata-provider (map datafy/datafy metadata-providers)))))
