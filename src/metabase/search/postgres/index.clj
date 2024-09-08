(ns metabase.search.postgres.index
  (:require
   [honey.sql :as sql]
   [honey.sql.helpers :as sql.helpers]
   [toucan2.core :as t2]))

(def ^:private active-table :search_index)

(def ^:private pending-table :search_index_next)

(def ^:private retired-table :search_index_retired)

(defonce ^:private initialized? (atom false))

(defonce ^:private reindexing? (atom false))

(def ^:private tsv-language "english")

(defn- exists? [table-name]
  (t2/exists? :information_schema.tables :table_name (name table-name)))

(defn- drop-table! [table-name]
  (boolean
   (when (exists? table-name)
     (t2/query (sql.helpers/drop-table table-name)))))

(defn- rename-table! [old new]
  (when (and (exists? old) (not (exists? new)))
    (-> (sql.helpers/alter-table old)
        (sql.helpers/rename-table new)
        t2/query)))

(defn create-pending!
  "Create a non-active search index table."
  []
  (when (not @reindexing?)
    (when-not (exists? pending-table)
      (-> (sql.helpers/create-table pending-table)
          (sql.helpers/with-columns
            [[:id :bigint [:primary-key] [:raw "GENERATED BY DEFAULT AS IDENTITY"]]
             ;; entity
             [:model_id :int :not-null]
             [:model [:varchar 254] :not-null] ;; TODO find the right size
             ;; search
             [:search_vector :tsvector :not-null]
             ;; scoring related
             [:model_rank :int :not-null]
             ;; permission related entities
             [:collection_id :int]
             [:database_id :int]
             [:table_id :int]
             ;; filter related
             [:archived :boolean]])
          t2/query))
    (reset! reindexing? true)))

(defn activate-pending!
  "Make the pending index active, if it exists. Returns true if it did so."
  []
  ;; ... just in case it wasn't cleaned up last time.
  (drop-table! retired-table)
  (when (exists? pending-table)
    (t2/with-transaction [_conn]
      (rename-table! active-table retired-table)
      (rename-table! pending-table active-table))
    (reset! reindexing? false)
    (drop-table! retired-table)
    true))

(defn update!
  "Create or update the given search index trny"
  [entity]
  (let [entry (-> entity
                  (select-keys
                   [:model
                    :model_rank
                    :collection_id
                    :database_id
                    :table_id
                    :archived])
                  (assoc
                   :model_id      (:id entity)
                   :search_vector [:to_tsvector
                                   [:inline tsv-language]
                                   [:cast
                                    (:searchable_text entity)
                                    :text]]))]
    (when @initialized?
      (t2/insert! active-table entry))
    (when @reindexing?
      (t2/insert! pending-table entry))))

(def ^:private ts-query
  [:raw
   "search_vector @@ websearch_to_tsquery('"
   tsv-language "', "
   [:param :search-term] ")"])

(def search-query
  "Query fragment for all models corresponding to a query paramter `:search-term`."
  {:select [:model_id :model]
   :from   [active-table]
   :where  ts-query})

(defn search
  "Use the index table to search for records."
  [search-term]
  (map (juxt :model_id :model)
       (t2/query (sql/format search-query {:params {:search-term search-term}}))))

(defn reset-index!
  "Ensure we have a blank slate, in case the table schema or stored data format has changed."
  []
  (reset! reindexing? false)
  (drop-table! pending-table)
  (create-pending!)
  (activate-pending!)
  (reset! initialized? true))
