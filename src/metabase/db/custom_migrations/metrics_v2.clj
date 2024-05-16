(ns metabase.db.custom-migrations.metrics-v2
  (:require
   [cheshire.core :as json]
   [metabase.util :as u]
   [toucan2.core :as t2])
  (:import (java.time Instant)))

(set! *warn-on-reflection* true)

(defn- get-or-create-metric-migration-collection-id!
  "Get the collection used to store the questions created from the v1 metrics.
  If and only if the collection doesn't exists and the option `create?` is truthy,
  the collection is created."
  ([]
   (get-or-create-metric-migration-collection-id! nil))
  ([{:keys [create?]}]
   (let [coll-name "Migrated Metrics v1"
         slug "migrated_metrics_v1"
         desc "This collection and the metrics in it were automatically generated by the migration to v50."]
     (or (t2/select-one-pk :collection :name coll-name :slug slug :description desc)
         (when create?
           (let [collection-id (t2/insert-returning-pk!
                                :collection
                                {:name coll-name, :slug slug, :description desc})]
             (let [all-users-group-id (t2/select-one-fn :id :permissions_group :name "All Users")]
               (t2/insert! :permissions {:object   (format "/collection/%s/read/" collection-id)
                                         :group_id all-users-group-id}))
             collection-id))))))

(defn- add-metric-id
  "Add `id` (the ID of the metric being migrated) to `description`.
  This ID is parsed from the description during rollback. See [[split-metric-id]]."
  [description id]
  (str description " (Migrated from metric " id ".)"))

(defn- convert-metric-v2
  "Convert a metric v2 question from `metric-v1` defined on a table in the
  database with ID `db-id`.
  The :collection_id property is not set and the question is not persisted."
  [metric-v1 db-id]
  (let [definition (json/parse-string (:definition metric-v1) true)
        dataset-query {:type :query
                       :database db-id
                       :query definition}]
    (-> metric-v1
        (select-keys [:archived :created_at :creator_id :database_id
                      :description :name :table_id])
        (update :description add-metric-id (:id metric-v1))
        (assoc :dataset_query (json/generate-string dataset-query)
               :enable_embedding false
               :query_type "query"
               :type "metric"
               :parameters "[]"
               :parameter_mappings "[]"
               :visualization_settings "{}"
               :display "line"))))

(defn- create-metric-v2!
  "Create and persist a metric v2 question from `metric-v1` in
  the collection with ID `metric-v2-coll-id`."
  [metric-v1 metric-v2-coll-id]
  (let [db-id (t2/select-one-fn :db-id :metabase_table (:table_id metric-v1))
        card (-> metric-v1
                 (convert-metric-v2 db-id)
                 (assoc :collection_id metric-v2-coll-id
                        :updated_at (Instant/now)))]
    (t2/insert-returning-instance! :report_card card)))

(defn- metric-ref->id
  "If `expr` is a metric reference expression, return the ID of the referenced metric.
  Returns nil otherwise."
  [expr]
  (when (and (vector? expr)
             (= (u/lower-case-en (get expr 0)) "metric"))
    (let [id (get expr 1)]
      ;; GA metrics with string references are ignored
      (when (int? id)
        id))))

(defn- replace-metric-refs
  "Replaces the IDs in metric references contained in `expr` with the :id properties
  of the corresponding entities in `id->entity`.
  `expr` is an MBQL aggregation expression or a part of it.
  The mapping is from metric IDs to v2 metric cards."
  [expr id->entity]
  (if-not (vector? expr)
    expr
    (if-let [id (metric-ref->id expr)]
      (assoc expr 1 (-> id id->entity :id))
      (mapv #(replace-metric-refs % id->entity) expr))))

(defn- rewrite-metric-consuming-query
  [query metric-id->metric-card]
  (if (contains? query :source-query)
    (update query :source-query rewrite-metric-consuming-query metric-id->metric-card)
    (let [aggregation (:aggregation query)
          rewritten (replace-metric-refs aggregation metric-id->metric-card)]
      (cond-> query
        (not= rewritten aggregation) (assoc :aggregation rewritten)))))

(defn- rewrite-metric-consuming-card
  "Rewrite the question `card` replacing references to v1 metrics with references
  to the corresponding v2 metric question as specified by the mapping `metric-id->metric-card`."
  [card metric-id->metric-card]
  (let [dataset-query (json/parse-string (:dataset_query card) true)
        inner-query (:query dataset-query)
        rewritten (rewrite-metric-consuming-query inner-query metric-id->metric-card)]
    (when (not= rewritten inner-query)
      (-> card
          (assoc :dataset_query (-> dataset-query
                                    (assoc :query rewritten)
                                    json/generate-string))
          (dissoc :updated_at)))))

(defn migrate-up!
  "Migrate metrics and the cards consuming them to metrics v2. This involves
  1. creating the migration collection,
  2. creating a v2 metric card for each v1 metric in the migration collection,
  3. making a backup copy of the dataset_query of each metric consuming card,
  4. rewriting the metric consuming cards to use the migrated v2 metric cards."
  []
  (when (t2/exists? :metric)
    (let [metric-v2-coll-id (get-or-create-metric-migration-collection-id! {:create? true})
          metric-id->metric-card (into {}
                                       (map (juxt :id #(create-metric-v2! % metric-v2-coll-id)))
                                       (t2/query {:select [:m.* [:t.db_id :database_id]]
                                                  :from [[:metric :m]]
                                                  :left-join [[:metabase_table :t] [:= :t.id :m.table_id]]}))
          metric-consuming-cards (t2/select :report_card {:where [:like [:lower :dataset_query] "%[\"metric\",%"]})]
      (doseq [card metric-consuming-cards
              :let [rewritten (rewrite-metric-consuming-card card metric-id->metric-card)]
              :when (and rewritten (not= card rewritten))]
        (t2/update! :report_card
                    (:id card)
                    (-> rewritten
                        (assoc :dataset_query_metrics_v2_migration_backup (:dataset_query card)
                               :updated_at (Instant/now))))))))

(defn migrate-down!
  "Revert the migration to v2 metrics. This involves
  1. restoring the metric consuming cards from the backup,
  2. deleting the (metric) cards in the migration collection,
  3. deleting the metric migration collection."
  []
  (when-let [metric-v2-coll-id (get-or-create-metric-migration-collection-id!)]
    (doseq [{:keys [id dataset_query_metrics_v2_migration_backup]}
            (t2/select :report_card {:where [:!= :dataset_query_metrics_v2_migration_backup nil]})]
      (t2/update! :report_card id {:dataset_query dataset_query_metrics_v2_migration_backup}))
    (t2/delete! :report_card :collection_id metric-v2-coll-id)
    (t2/delete! :collection metric-v2-coll-id)))
