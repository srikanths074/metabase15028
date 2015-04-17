(ns metabase.driver.mongo.query-processor
  (:refer-clojure :exclude [find sort])
  (:require [clojure.core.match :refer [match]]
            [colorize.core :as color]
            (monger [collection :as mc]
                    [core :as mg]
                    [db :as mdb]
                    [operators :refer :all]
                    [query :refer :all])
            [metabase.db :refer :all]
            [metabase.driver :as driver]
            [metabase.driver.query-processor :refer [*query* preprocess]]
            [metabase.driver.mongo.util :refer [with-db-connection *db-connection*]]
            (metabase.models [database :refer [Database]]
                             [field :refer [Field]]
                             [table :refer [Table]])))

(declare apply-clause
         annotate-results
         field-id->kw
         process-structured
         process-and-run-structured)


(defmethod driver/process-and-run :mongo [{query-type :type database-id :database :as query}]
  (binding [*query* query]
    (let [{{connection-string :conn_str} :details} (sel :one Database :id database-id)
          query (preprocess query)]
      (with-db-connection [db connection-string]
        (case (keyword query-type)
          :query (let [generated-query (process-structured (:query query))]
                   ;; ; TODO - log/debug
                   (println (color/magenta "\n******************** Generated Monger Query: ********************\n"
                                           (with-out-str (clojure.pprint/pprint generated-query))
                                           "*****************************************************************\n"))
                   (->> (eval generated-query)
                        (annotate-results (:query query))))
          :native :TODO)))))



(defn process-structured [{:keys [source_table aggregation] :as query}]
  (let [collection-name (sel :one :field [Table :name] :id source_table)
        constraints (when-let [filter-clause (:filter query)]
                      (apply-clause [:filter filter-clause]))
        query (dissoc query :filter)]
    (match aggregation
      ["rows"] `(doall (with-collection *db-connection* ~collection-name
                         ~@(when constraints
                             `[(find ~constraints)])
                         ~@(doall (mapcat apply-clause query))))
      ["count"] `[{:count (mc/count *db-connection* ~collection-name
                                    ~constraints)}]
      [field-aggregation field-id] (let [field-kw (field-id->kw field-id)
                                         $field (format "$%s" (name field-kw))
                                         aggregate (fn [& forms]
                                                     `(mc/aggregate *db-connection* ~collection-name  [~@(when constraints
                                                                                                           [{$match constraints}])
                                                                                                       ~@forms
                                                                                                       {$limit 1}]))]
                                     (case field-aggregation
                                       "avg"      (aggregate {$group {"_id" nil
                                                                      "avg" {$avg $field}}}
                                                             {$project {"_id" false, "avg" true}})
                                       "count"    (aggregate {$match {field-kw {$exists true}}}
                                                             {$group {"_id" nil
                                                                      "count" {$sum 1}}}
                                                             {$project {"_id" false, "count" true}})
                                       "distinct" (aggregate {$group {"_id" $field}}
                                                             {$group {"_id" nil
                                                                      "count" {$sum 1}}}
                                                             {$project {"_id" false, "count" true}})
                                       "stddev"   nil           ; TODO
                                       "sum"      (aggregate {$group {"_id" nil ; TODO - I don't think this works for _id
                                                                      "sum" {$sum $field}}}
                                                             {$project {"_id" false, "sum" true}})
                                       "cum_sum"  nil           ; TODO
                                       )))))

;; ## ANNOTATION

(defn annotate-results [{:keys [source_table] :as query} results]
  {:pre [(integer? source_table)]}
  (let [field-name->id (sel :many :field->id [Field :name] :table_id source_table)
        column-names (keys (first results))]
    {:row_count (count results)
     :status :completed
     :data {:columns column-names
            :cols (map (fn [column-name]
                         {:name column-name
                          :id (field-name->id (name column-name))
                          :table_id source_table
                          :description nil
                          :base_type :UnknownField
                          :special_type nil
                          :extra_info {}})
                       column-names)
            :rows (map #(map % column-names)
                       results)}}))

;; ## TESTING

(defn x []
  (driver/process-and-run {:database 44,
                           :type "query",
                           :query
                           {:source_table 59,
                            :aggregation ["count"],
                            :breakout [nil],
                            :limit 10,
                            :filter ["<" 307 1000]}}))

(defn y []
  (driver/process-and-run {:database 44,
                           :type "query",
                           :query
                           {:source_table 59,
                            :filter ["<" 307 1000]
                            :aggregation ["count" 309],
                            :breakout [nil],
                            :limit 25}}))

(defn y2 []
  (with-db-connection [db "mongodb://localhost/test"]
    (doall (with-collection db "zips"
             (limit 10)))))

;; Total count for each state
(defn z []
  (with-db-connection [db "mongodb://localhost/test"]
    (doall
     (with-collection db "zips"
       (fields [:city])
       (limit 10)
       (sort (array-map :city -1))))))

(defn z2 []
  (with-db-connection [db "mongodb://localhost/test"]
    (mc/aggregate db "zips" [{$match {:pop {$lt 100, $gt 50}}}
                             {$group {"_id" nil
                                      "pops" {$push "$pop" }}}
                             {$project {"sum" "$sum(pops)"}}])))



(defn field-id->kw [field-id]
  (keyword (sel :one :field [Field :name] :id field-id)))


;; ## CLAUSE APPLICATION

(defmulti apply-clause (fn [[clause-kw _]]
                         clause-kw))

(defmacro defclause [clause-kw [value-binding] & body]
  `(defmethod apply-clause ~clause-kw [[_ ~value-binding]]
     (try
       ~@body
       (catch Throwable e#
         (println (color/red ~(format "Failed to apply clause '%s': " clause-kw) (.getMessage e#))))))) ; TODO - log/error

;; TODO - this should throw an Exception once QP is finished
(defmethod apply-clause :default [[clause-kw value]]
  (println "TODO: Don't know how to apply-clause" clause-kw "with value:" value))

;; ### aggregation
(defclause :aggregation [aggregation]
  nil) ; nothing to do here since this is handled by process-structured above

;; ### breakout (TODO)
(defclause :breakout [field-ids]
  (when (seq field-ids)
    nil))

;; TODO - this still returns _id, even if we don't ask for it :/
(defclause :fields [field-ids]
  (when (seq field-ids)
    `[(fields ~(mapv field-id->kw field-ids))]))

(defn apply-filter-subclause [subclause]
  (match subclause
    ["INSIDE" lat-field-id lon-field-id lat-max lon-min lat-min lon-max] (let [lat-field (field-id->kw lat-field-id)
                                                                               lon-field (field-id->kw lon-field-id)]
                                                                           {$and [{lat-field {$gte lat-min, $lte lat-max}}
                                                                                  {lon-field {$gte lon-min, $lte lon-max}}]})
    [_ field-id & _] {(field-id->kw field-id)
                      (match subclause
                        ["NOT_NULL" _]        {$exists true}
                        ["IS_NULL"]           {$exists false}
                        ["BETWEEN" _ min max] {$gt min, $lt max} ; TODO - is this supposed to be inclusive, or not ?
                        ["="  _ value]        value
                        ["!=" _ value]        {$ne value}
                        ["<"  _ value]        {$lt value}
                        [">"  _ value]        {$gt value}
                        ["<=" _ value]        {$lte value}
                        [">=" _ value]        {$gte value})}))

;; ### filter
;; !!! SPECIAL CASE - since this is used in a different way by the different aggregation options
;; we just return a "constraints" map
(defclause :filter [filter-clause]
  (match filter-clause
    ["AND"]              nil
    ["AND" & subclauses] {$and (mapv apply-filter-subclause subclauses)}
    ["OR"  & subclauses] {$or  (mapv apply-filter-subclause subclauses)}
    subclause            (apply-filter-subclause subclause)))

;; ### limit
(defclause :limit [value]
  `[(limit ~value)])

;; ### order_by
(defclause :order_by [field-dir-pairs]
  (let [sort-options (mapcat (fn [[field-id direction]]
                               [(field-id->kw field-id) (case (keyword direction)
                                                          :ascending 1
                                                          :descending -1)])
                             field-dir-pairs)]
    (when (seq sort-options)
      `[(sort (array-map ~@sort-options))])))

;; ### page
(defclause :page [{page-num :page items-per-page :items}]
  (let [num-to-skip (* (dec page-num) items-per-page)]
    `[(skip ~num-to-skip)
      (limit ~items-per-page)]))

;; ### source_table
;; Don't need to do anything here since `process-structured` takes care of the `with-collection` bit
(defclause :source_table [value]
  nil)
