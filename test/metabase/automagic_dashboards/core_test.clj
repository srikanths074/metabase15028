(ns ^:mb/once metabase.automagic-dashboards.core-test
  (:require
   [cheshire.core :as json]
   [clojure.core.async :as a]
   [clojure.test :refer :all]
   [java-time :as t]
   [metabase.api.common :as api]
   [metabase.automagic-dashboards.core :as magic]
   [metabase.automagic-dashboards.rules :as rules]
   [metabase.mbql.schema :as mbql.s]
   [metabase.models :refer [Card Collection Database Field Metric Table]]
   [metabase.models.interface :as mi]
   [metabase.models.permissions :as perms]
   [metabase.models.permissions-group :as perms-group]
   [metabase.models.query :as query :refer [Query]]
   [metabase.query-processor.async :as qp.async]
   [metabase.sync :as sync]
   [metabase.test :as mt]
   [metabase.test.automagic-dashboards :as automagic-dashboards.test]
   [metabase.util :as u]
   [metabase.util.date-2 :as u.date]
   [metabase.util.i18n :refer [tru]]
   [ring.util.codec :as codec]
   [schema.core :as s]
   [toucan.db :as db]))

(set! *warn-on-reflection* true)

;;; ------------------- `->reference` -------------------

(deftest ->reference-test
  (is (= [:field 1 nil]
         (->> (assoc (mi/instance Field) :id 1)
              (#'magic/->reference :mbql))))

  (is (= [:field 2 {:source-field 1}]
         (->> (assoc (mi/instance Field) :id 1 :fk_target_field_id 2)
              (#'magic/->reference :mbql))))

  (is (= 42
         (->> 42
              (#'magic/->reference :mbql)))))


;;; ------------------- Rule matching  -------------------

(deftest rule-matching-test
  (is (= [:entity/UserTable :entity/GenericTable :entity/*]
         (->> (mt/id :users)
              (db/select-one Table :id)
              (#'magic/->root)
              (#'magic/matching-rules (rules/get-rules ["table"]))
              (map (comp first :applies_to)))))

  (testing "Test fallback to GenericTable"
    (is (= [:entity/GenericTable :entity/*]
           (->> (-> (db/select-one Table :id (mt/id :users))
                    (assoc :entity_type nil)
                    (#'magic/->root))
                (#'magic/matching-rules (rules/get-rules ["table"]))
                (map (comp first :applies_to)))))))


;;; ------------------- `automagic-anaysis` -------------------

(defn- test-automagic-analysis
  ([entity card-count] (test-automagic-analysis entity nil card-count))
  ([entity cell-query card-count]
   ;; We want to both generate as many cards as we can to catch all aberrations, but also make sure
   ;; that size limiting works.
   (testing (u/pprint-to-str (list 'automagic-analysis entity {:cell-query cell-query, :show :all}))
     (automagic-dashboards.test/test-dashboard-is-valid (magic/automagic-analysis entity {:cell-query cell-query, :show :all}) card-count))
   (when (or (and (not (mi/instance-of? Query entity))
                  (not (mi/instance-of? Card entity)))
             (#'magic/table-like? entity))
     (testing (u/pprint-to-str (list 'automagic-analysis entity {:cell-query cell-query, :show 1}))
       ;; 1 for the actual card returned + 1 for the visual display card = 2
       (automagic-dashboards.test/test-dashboard-is-valid (magic/automagic-analysis entity {:cell-query cell-query, :show 1}) 2)))))

;; These test names were named by staring at them for a while, so they may be misleading

(deftest automagic-analysis-test
  (mt/with-test-user :rasta
    (automagic-dashboards.test/with-dashboard-cleanup
      (doseq [[table cardinality] (map vector
                                       (db/select Table :db_id (mt/id) {:order-by [[:id :asc]]})
                                       [7 5 8 2])]
        (test-automagic-analysis table cardinality)))

    (automagic-dashboards.test/with-dashboard-cleanup
      (is (= 1
             (->> (magic/automagic-analysis (db/select-one Table :id (mt/id :venues)) {:show 1})
                  :ordered_cards
                  (filter :card)
                  count))))))

(deftest weird-characters-in-names-test
  (mt/with-test-user :rasta
    (automagic-dashboards.test/with-dashboard-cleanup
      (-> (db/select-one Table :id (mt/id :venues))
          (assoc :display_name "%Venues")
          (test-automagic-analysis 7)))))

;; Cardinality of cards genned from fields is much more labile than anything else
;; Not just with respect to drivers, but all sorts of other stuff that makes it chaotic
(deftest mass-field-test
    (mt/with-test-user :rasta
      (automagic-dashboards.test/with-dashboard-cleanup
        (doseq [field (db/select Field
                                 :table_id [:in (db/select-field :id Table :db_id (mt/id))]
                                 :visibility_type "normal"
                                 {:order-by [[:id :asc]]})]
          (is (pos? (count (:ordered_cards (magic/automagic-analysis field {})))))))))

(deftest metric-test
  (mt/with-temp Metric [metric {:table_id (mt/id :venues)
                                :definition {:aggregation [[:count]]}}]
    (mt/with-test-user :rasta
      (automagic-dashboards.test/with-dashboard-cleanup
        (test-automagic-analysis metric 8)))))

(deftest complicated-card-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (mt/with-temp* [Collection [{collection-id :id}]
                    Card [{card-id :id} {:table_id      (mt/id :venues)
                                         :collection_id collection-id
                                         :dataset_query {:query    {:filter [:> [:field (mt/id :venues :price) nil] 10]
                                                                    :source-table (mt/id :venues)}
                                                         :type     :query
                                                         :database (mt/id)}}]]
      (mt/with-test-user :rasta
        (automagic-dashboards.test/with-dashboard-cleanup
          (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
          (test-automagic-analysis (db/select-one Card :id card-id) 7))))))

(deftest query-breakout-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (mt/with-temp* [Collection [{collection-id :id}]
                    Card [{card-id :id} {:table_id      (mt/id :venues)
                                         :collection_id collection-id
                                         :dataset_query {:query {:aggregation [[:count]]
                                                                 :breakout [[:field (mt/id :venues :category_id) nil]]
                                                                 :source-table (mt/id :venues)}
                                                         :type :query
                                                         :database (mt/id)}}]]
      (mt/with-test-user :rasta
        (automagic-dashboards.test/with-dashboard-cleanup
          (test-automagic-analysis (db/select-one Card :id card-id) 17))))))

(deftest native-query-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (mt/with-temp* [Collection [{collection-id :id}]
                    Card [{card-id :id} {:table_id      nil
                                         :collection_id collection-id
                                         :dataset_query {:native {:query "select * from users"}
                                                         :type :native
                                                         :database (mt/id)}}]]
      (mt/with-test-user :rasta
        (automagic-dashboards.test/with-dashboard-cleanup
          (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
          (test-automagic-analysis (db/select-one Card :id card-id) 2))))))

(defn- result-metadata-for-query [query]
  (first
   (a/alts!!
    [(qp.async/result-metadata-for-query-async query)
     (a/timeout 1000)])))

(deftest explicit-filter-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (let [source-query {:query    {:source-table (mt/id :venues)}
                        :type     :query
                        :database (mt/id)}]
      (mt/with-temp* [Collection [{collection-id :id}]
                      Card [{source-id :id} {:table_id        (mt/id :venues)
                                             :collection_id   collection-id
                                             :dataset_query   source-query
                                             :result_metadata (mt/with-test-user :rasta (result-metadata-for-query source-query))}]
                      Card [{card-id :id} {:table_id      (mt/id :venues)
                                           :collection_id collection-id
                                           :dataset_query {:query    {:filter       [:> [:field "PRICE" {:base-type "type/Number"}] 10]
                                                                      :source-table (str "card__" source-id)}
                                                           :type     :query
                                                           :database mbql.s/saved-questions-virtual-database-id}}]]
        (mt/with-test-user :rasta
          (automagic-dashboards.test/with-dashboard-cleanup
            (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
            (test-automagic-analysis (db/select-one Card :id card-id) 7)))))))

(deftest native-query-with-cards-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (let [source-query {:native   {:query "select * from venues"}
                        :type     :native
                        :database (mt/id)}]
      (mt/with-temp* [Collection [{collection-id :id}]
                      Card [{source-id :id} {:table_id        nil
                                             :collection_id   collection-id
                                             :dataset_query   source-query
                                             :result_metadata (mt/with-test-user :rasta (result-metadata-for-query source-query))}]
                      Card [{card-id :id} {:table_id      nil
                                           :collection_id collection-id
                                           :dataset_query {:query    {:filter       [:> [:field "PRICE" {:base-type "type/Number"}] 10]
                                                                      :source-table (str "card__" source-id)}
                                                           :type     :query
                                                           :database mbql.s/saved-questions-virtual-database-id}}]]
        (mt/with-test-user :rasta
          (automagic-dashboards.test/with-dashboard-cleanup
            (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
            (test-automagic-analysis (db/select-one Card :id card-id) 8)))))))

(defn- ensure-card-sourcing
  "Ensure that destination data is only derived from source data.
  This is a check against a card being generated that presents results unavailable to it with respect to its source data."
  [{source-card-id     :id
    source-database-id :database_id
    source-table-id    :table_id
    source-meta        :result_metadata
    :as                _source-card}
   {magic-card-table-id    :table_id
    magic-card-database-id :database_id
    magic-card-query       :dataset_query
    :as                    _magic-card}]
  (let [valid-source-ids (set (map (fn [{:keys [name id]}] (or id name)) source-meta))
        {query-db-id  :database
         query-actual :query} magic-card-query
        {source-table :source-table
         breakout     :breakout} query-actual]
    (is (= source-database-id magic-card-database-id))
    (is (= source-database-id query-db-id))
    (is (= source-table-id magic-card-table-id))
    (is (= (format "card__%s" source-card-id) source-table))
    (is (= true (every? (fn [[_ id]] (valid-source-ids id)) breakout)))))

(defn- ensure-dashboard-sourcing [source-card dashboard]
  (doseq [magic-card (->> dashboard
                          :ordered_cards
                          (filter :card)
                          (map :card))]
    (ensure-card-sourcing source-card magic-card)))

(defn- ensure-single-table-sourced
  "Check that the related table from the x-ray is the table we are sourcing from.
  This is applicable for a query/card/etc/ that is sourced directly from one table only."
  [table-id dashboard]
  (is (=
       (format "/auto/dashboard/table/%s" table-id)
       (-> dashboard :related :zoom-out first :url))))

(deftest basic-root-model-test
  ;; These test scenarios consist of a single model sourced from one table.
  ;; Key elements being tested:
  ;; - The dashboard should only present data visible to the model
  ;; (don't show non-selected fields from within the model or its parent)
  ;; - The dashboard should reference its source as a :related field
  (testing "Simple model with a price dimension"
    (mt/dataset sample-dataset
      (mt/with-non-admin-groups-no-root-collection-perms
        (let [source-query {:database (mt/id)
                            :query    {:source-table (mt/id :products)
                                       :fields       [[:field (mt/id :products :category) nil]
                                                      [:field (mt/id :products :price) nil]]},
                            :type     :query}]
          (mt/with-temp* [Collection [{collection-id :id}]
                          Card [card {:table_id        (mt/id :products)
                                      :collection_id   collection-id
                                      :dataset_query   source-query
                                      :result_metadata (mt/with-test-user
                                                         :rasta
                                                         (result-metadata-for-query
                                                          source-query))
                                      :dataset         true}]]
            (let [dashboard (mt/with-test-user :rasta (magic/automagic-analysis card nil))
                  binned-field-id (mt/id :products :price)]
              (ensure-single-table-sourced (mt/id :products) dashboard)
              ;; Count of records
              ;; Distributions:
              ;; - Binned price
              ;; - Binned by category
              (is (= 3 (->> dashboard :ordered_cards (filter :card) count)))
              (ensure-dashboard-sourcing card dashboard)
              ;; This ensures we get a card that does binning on price
              (is (= binned-field-id
                     (first
                      (for [card (:ordered_cards dashboard)
                            :let [fields (get-in card [:card :dataset_query :query :breakout])]
                            [_ field-id m] fields
                            :when (:binning m)]
                        field-id))))))))))
  (testing "Simple model with a temporal dimension detected"
    ;; Same as above, but the code should detect the time dimension of the model and present
    ;; cards with a time axis.
    (mt/dataset sample-dataset
      (mt/with-non-admin-groups-no-root-collection-perms
        (let [temporal-field-id (mt/id :products :created_at)
              source-query {:database (mt/id)
                            :query    {:source-table (mt/id :products)
                                       :fields       [[:field (mt/id :products :category) nil]
                                                      [:field (mt/id :products :price) nil]
                                                      [:field temporal-field-id nil]]},
                            :type     :query}]
          (mt/with-temp* [Collection [{collection-id :id}]
                          Card [card {:table_id        (mt/id :products)
                                      :collection_id   collection-id
                                      :dataset_query   source-query
                                      :result_metadata (mt/with-test-user
                                                         :rasta
                                                         (result-metadata-for-query
                                                          source-query))
                                      :dataset         true}]]
            (let [dashboard (mt/with-test-user :rasta (magic/automagic-analysis card nil))
                  temporal-field-ids (for [card (:ordered_cards dashboard)
                                           :let [fields (get-in card [:card :dataset_query :query :breakout])]
                                           [_ field-id m] fields
                                           :when (:temporal-unit m)]
                                       field-id)]
              (ensure-single-table-sourced (mt/id :products) dashboard)
              (ensure-dashboard-sourcing card dashboard)
              ;; We want to produce at least one temporal axis card
              (is (pos? (count temporal-field-ids)))
              ;; We only have one temporal field, so ensure that's what's used for the temporal cards
              (is (every? #{temporal-field-id} temporal-field-ids))))))))
  (testing "A simple model with longitude and latitude dimensions should generate a card with a map."
    (mt/dataset sample-dataset
      (mt/with-non-admin-groups-no-root-collection-perms
        (let [source-query {:database (mt/id)
                            :query    {:source-table (mt/id :people)
                                       :fields       [[:field (mt/id :people :longitude) nil]
                                                      [:field (mt/id :people :latitude) nil]]},
                            :type     :query}]
          (mt/with-temp* [Collection [{collection-id :id}]
                          Card [card {:table_id        (mt/id :people)
                                      :collection_id   collection-id
                                      :dataset_query   source-query
                                      :result_metadata (mt/with-test-user
                                                         :rasta
                                                         (result-metadata-for-query
                                                          source-query))
                                      :dataset         true}]]
            (let [{:keys [ordered_cards] :as dashboard} (mt/with-test-user :rasta (magic/automagic-analysis card nil))
                  temporal-field-ids (for [card (:ordered_cards dashboard)
                                           :let [fields (get-in card [:card :dataset_query :query :breakout])]
                                           [_ field-id m] fields
                                           :when (:temporal-unit m)]
                                       field-id)]
              (ensure-single-table-sourced (mt/id :people) dashboard)
              (ensure-dashboard-sourcing card dashboard)
              ;; We should generate two cards - locations and total values
              (is (= #{(format "%s by coordinates" (:name card))
                       (format "Total %s" (:name card))}
                     (set
                      (for [{:keys [card]} ordered_cards
                            :let [{:keys [name]} card]
                            :when name]
                        name)))))))))))

(mt/dataset sample-dataset
  (mt/with-non-admin-groups-no-root-collection-perms
    (let [source-query {:database (mt/id)
                        :query    {:source-table (mt/id :products)
                                   :fields       [[:field (mt/id :products :category) nil]
                                                  [:field (mt/id :products :price) nil]]},
                        :type     :query}]
      (mt/with-temp* [Collection [{collection-id :id}]
                      Card [card {:table_id        (mt/id :products)
                                  :collection_id   collection-id
                                  :dataset_query   source-query
                                  :result_metadata (mt/with-test-user
                                                     :rasta
                                                     (result-metadata-for-query
                                                      source-query))
                                  :dataset         true}]]
        (let [dashboard (mt/with-test-user :rasta (magic/automagic-analysis card nil))
              binned-field-id (mt/id :products :price)]
          (ensure-single-table-sourced (mt/id :products) dashboard)
          ;; Count of records
          ;; Distributions:
          ;; - Binned price
          ;; - Binned by category
          (is (= 3 (->> dashboard :ordered_cards (filter :card) count)))
          (ensure-dashboard-sourcing card dashboard)
          ;; This ensures we get a card that does binning on price
          (is (= binned-field-id
                 (first
                  (for [card (:ordered_cards dashboard)
                        :let [fields (get-in card [:card :dataset_query :query :breakout])]
                        [_ field-id m] fields
                        :when (:binning m)]
                    field-id)))))))))

(deftest card-breakout-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (mt/with-temp* [Collection [{collection-id :id}]
                    Card [{card-id :id} {:table_id      (mt/id :venues)
                                         :collection_id collection-id
                                         :dataset_query {:query    {:aggregation  [[:count]]
                                                                    :breakout     [[:field (mt/id :venues :category_id) nil]]
                                                                    :source-table (mt/id :venues)}
                                                         :type     :query
                                                         :database (mt/id)}}]]
      (mt/with-test-user :rasta
        (automagic-dashboards.test/with-dashboard-cleanup
          (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
          (test-automagic-analysis (db/select-one Card :id card-id) 17))))))

(deftest figure-out-table-id-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (mt/with-temp* [Collection [{collection-id :id}]
                    Card [{card-id :id} {:table_id      nil
                                         :collection_id collection-id
                                         :dataset_query {:native   {:query "select * from users"}
                                                         :type     :native
                                                         :database (mt/id)}}]]
      (mt/with-test-user :rasta
        (automagic-dashboards.test/with-dashboard-cleanup
          (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
          (test-automagic-analysis (db/select-one Card :id card-id) 2))))))

(deftest card-cell-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (mt/with-temp* [Collection [{collection-id :id}]
                    Card [{card-id :id} {:table_id      (mt/id :venues)
                                         :collection_id collection-id
                                         :dataset_query {:query    {:filter       [:> [:field (mt/id :venues :price) nil] 10]
                                                                    :source-table (mt/id :venues)}
                                                         :type     :query
                                                         :database (mt/id)}}]]
      (mt/with-test-user :rasta
        (automagic-dashboards.test/with-dashboard-cleanup
          (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
          (-> (db/select-one Card :id card-id)
              (test-automagic-analysis [:= [:field (mt/id :venues :category_id) nil] 2] 7)))))))


(deftest complicated-card-cell-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (mt/with-temp* [Collection [{collection-id :id}]
                    Card [{card-id :id} {:table_id      (mt/id :venues)
                                         :collection_id collection-id
                                         :dataset_query {:query    {:filter       [:> [:field (mt/id :venues :price) nil] 10]
                                                                    :source-table (mt/id :venues)}
                                                         :type     :query
                                                         :database (mt/id)}}]]
      (mt/with-test-user :rasta
        (automagic-dashboards.test/with-dashboard-cleanup
          (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
          (-> (db/select-one Card :id card-id)
              (test-automagic-analysis [:= [:field (mt/id :venues :category_id) nil] 2] 7)))))))


(deftest adhoc-filter-test
  (mt/with-test-user :rasta
    (automagic-dashboards.test/with-dashboard-cleanup
      (let [q (query/adhoc-query {:query {:filter [:> [:field (mt/id :venues :price) nil] 10]
                                          :source-table (mt/id :venues)}
                                  :type :query
                                  :database (mt/id)})]
        (test-automagic-analysis q 7)))))

(deftest adhoc-count-test
  (mt/with-test-user :rasta
    (automagic-dashboards.test/with-dashboard-cleanup
      (let [q (query/adhoc-query {:query {:aggregation [[:count]]
                                          :breakout [[:field (mt/id :venues :category_id) nil]]
                                          :source-table (mt/id :venues)}
                                  :type :query
                                  :database (mt/id)})]
        (test-automagic-analysis q 17)))))

(deftest adhoc-fk-breakout-test
  (mt/with-test-user :rasta
    (automagic-dashboards.test/with-dashboard-cleanup
      (let [q (query/adhoc-query {:query {:aggregation [[:count]]
                                          :breakout [[:field (mt/id :venues :category_id) {:source-field (mt/id :checkins)}]]
                                          :source-table (mt/id :checkins)}
                                  :type :query
                                  :database (mt/id)})]
        (test-automagic-analysis q 17)))))

(deftest adhoc-filter-cell-test
  (mt/with-test-user :rasta
    (automagic-dashboards.test/with-dashboard-cleanup
      (let [q (query/adhoc-query {:query {:filter [:> [:field (mt/id :venues :price) nil] 10]
                                          :source-table (mt/id :venues)}
                                  :type :query
                                  :database (mt/id)})]
        (test-automagic-analysis q [:= [:field (mt/id :venues :category_id) nil] 2] 7)))))

(deftest join-splicing-test
  (mt/with-test-user :rasta
    (automagic-dashboards.test/with-dashboard-cleanup
      (let [join-vec    [{:source-table (mt/id :categories)
                          :condition    [:= [:field (mt/id :categories :id) nil] 1]
                          :strategy     :left-join
                          :alias        "Dealios"}]
            q           (query/adhoc-query {:query {:source-table (mt/id :venues)
                                                    :joins join-vec
                                                    :aggregation [[:sum [:field (mt/id :categories :id) {:join-alias "Dealios"}]]]}
                                            :type :query
                                            :database (mt/id)})
            res         (magic/automagic-analysis q {})
            cards       (vec (:ordered_cards res))
            join-member (get-in cards [2 :card :dataset_query :query :joins])]
        (is (= join-vec join-member))))))


;;; ------------------- /candidates -------------------

(deftest candidates-test
  (testing "/candidates"
    (testing "should work with the normal test-data DB"
      (mt/with-test-user :rasta
        (is (schema= [(s/one {:tables   (s/constrained [s/Any] #(= (count %) 4))
                              s/Keyword s/Any}
                             "first result")
                      s/Any]
                     (magic/candidate-tables (mt/db))))))

    (testing "should work with unanalyzed tables"
      (mt/with-test-user :rasta
        (mt/with-temp* [Database [{db-id :id}]
                        Table    [{table-id :id} {:db_id db-id}]
                        Field    [_ {:table_id table-id}]
                        Field    [_ {:table_id table-id}]]
          (automagic-dashboards.test/with-dashboard-cleanup
            (is (schema= [(s/one {:tables   [(s/one {:table    {:id       (s/eq table-id)
                                                                s/Keyword s/Any}
                                                     s/Keyword s/Any}
                                                    "first Table")]
                                  s/Keyword s/Any}
                                 "first result")]
                         (magic/candidate-tables (db/select-one Database :id db-id))))))))))

(deftest call-count-test
  (mt/with-temp* [Database [{db-id :id}]
                  Table    [{table-id :id} {:db_id db-id}]
                  Field    [_ {:table_id table-id}]
                  Field    [_ {:table_id table-id}]]
    (mt/with-test-user :rasta
      ;; make sure the current user permissions set is already fetched so it's not included in the DB call count below
      @api/*current-user-permissions-set*
      (automagic-dashboards.test/with-dashboard-cleanup
        (let [database (db/select-one Database :id db-id)]
          (db/with-call-counting [call-count]
            (magic/candidate-tables database)
            (is (= 4
                   (call-count)))))))))

(deftest empty-table-test
  (testing "candidate-tables should work with an empty Table (no Fields)"
    (mt/with-temp* [Database [db]
                    Table    [_ {:db_id (:id db)}]]
      (mt/with-test-user :rasta
        (is (= []
               (magic/candidate-tables db)))))))

(deftest enhance-table-stats-test
  (mt/with-temp* [Database [{db-id :id}]
                  Table    [{table-id :id} {:db_id db-id}]
                  Field    [_ {:table_id table-id :semantic_type :type/PK}]
                  Field    [_ {:table_id table-id}]]
    (mt/with-test-user :rasta
      (automagic-dashboards.test/with-dashboard-cleanup
        (is (= {:list-like?  true
                :link-table? false
                :num-fields 2}
               (-> (#'magic/enhance-table-stats [(db/select-one Table :id table-id)])
                   first
                   :stats)))))))

(deftest enhance-table-stats-fk-test
  (mt/with-temp* [Database [{db-id :id}]
                  Table    [{table-id :id} {:db_id db-id}]
                  Field    [_ {:table_id table-id :semantic_type :type/PK}]
                  Field    [_ {:table_id table-id :semantic_type :type/FK}]
                  Field    [_ {:table_id table-id :semantic_type :type/FK}]]
    (mt/with-test-user :rasta
      (automagic-dashboards.test/with-dashboard-cleanup
        (is (= {:list-like?  false
                :link-table? true
                :num-fields 3}
               (-> (#'magic/enhance-table-stats [(db/select-one Table :id table-id)])
                   first
                   :stats)))))))


;;; ------------------- Definition overloading -------------------

(deftest most-specific-definition-test
  (testing "Identity"
    (is (= :d1
           (-> [{:d1 {:field_type [:type/Category] :score 100}}]
               (#'magic/most-specific-definition)
               first
               key)))))

(deftest ancestors-definition-test
  (testing "Base case: more ancestors"
    (is (= :d2
           (-> [{:d1 {:field_type [:type/Category] :score 100}}
                {:d2 {:field_type [:type/State] :score 100}}]
               (#'magic/most-specific-definition)
               first
               key)))))

(deftest definition-tiebreak-test
  (testing "Break ties based on the number of additional filters"
    (is (= :d3
           (-> [{:d1 {:field_type [:type/Category] :score 100}}
                {:d2 {:field_type [:type/State] :score 100}}
                {:d3 {:field_type [:type/State]
                      :named      "foo"
                      :score      100}}]
               (#'magic/most-specific-definition)
               first
               key)))))

(deftest definition-tiebreak-score-test
  (testing "Break ties on score"
    (is (= :d2
           (-> [{:d1 {:field_type [:type/Category] :score 100}}
                {:d2 {:field_type [:type/State] :score 100}}
                {:d3 {:field_type [:type/State] :score 90}}]
               (#'magic/most-specific-definition)
               first
               key)))))

(deftest definition-tiebreak-precedence-test
  (testing "Number of additional filters has precedence over score"
    (is (= :d3
           (-> [{:d1 {:field_type [:type/Category] :score 100}}
                {:d2 {:field_type [:type/State] :score 100}}
                {:d3 {:field_type [:type/State]
                      :named      "foo"
                      :score      0}}]
               (#'magic/most-specific-definition)
               first
               key)))))


;;; ------------------- Datetime resolution inference -------------------

(deftest optimal-datetime-resolution-test
  (doseq [[m expected] [[{:earliest "2015"
                          :latest   "2017"}
                         :month]
                        [{:earliest "2017-01-01"
                          :latest   "2017-03-04"}
                         :day]
                        [{:earliest "2005"
                          :latest   "2017"}
                         :year]
                        [{:earliest "2017-01-01"
                          :latest   "2017-01-02"}
                         :hour]
                        [{:earliest "2017-01-01T00:00:00"
                          :latest   "2017-01-01T00:02:00"}
                         :minute]]
          :let         [fingerprint {:type {:type/DateTime m}}]]
    (testing (format "fingerprint = %s" (pr-str fingerprint))
      (is (= expected
             (#'magic/optimal-datetime-resolution {:fingerprint fingerprint}))))))


;;; ------------------- Datetime humanization (for chart and dashboard titles) -------------------

(deftest temporal-humanization-test
  (let [dt    #t "1990-09-09T12:30"
        t-str "1990-09-09T12:30:00"]
    (doseq [[unit expected] {:minute          (tru "at {0}" (t/format "h:mm a, MMMM d, YYYY" dt))
                             :hour            (tru "at {0}" (t/format "h a, MMMM d, YYYY" dt))
                             :day             (tru "on {0}" (t/format "MMMM d, YYYY" dt))
                             :week            (tru "in {0} week - {1}" (#'magic/pluralize (u.date/extract dt :week-of-year)) (str (u.date/extract dt :year)))
                             :month           (tru "in {0}" (t/format "MMMM YYYY" dt))
                             :quarter         (tru "in Q{0} - {1}" (u.date/extract dt :quarter-of-year) (str (u.date/extract dt :year)))
                             :year            (t/format "YYYY" dt)
                             :day-of-week     (t/format "EEEE" dt)
                             :hour-of-day     (tru "at {0}" (t/format "h a" dt))
                             :month-of-year   (t/format "MMMM" dt)
                             :quarter-of-year (tru "Q{0}" (u.date/extract dt :quarter-of-year))
                             :minute-of-hour  (u.date/extract dt :minute-of-hour)
                             :day-of-month    (u.date/extract dt :day-of-month)
                             :week-of-year    (u.date/extract dt :week-of-year)}]
      (testing (format "unit = %s" unit)
        (is (= (str expected)
               (str (#'magic/humanize-datetime t-str unit))))))))

(deftest pluralize-test
  (are [expected n] (= (str expected)
                       (str (#'magic/pluralize n)))
    (tru "{0}st" 1)   1
    (tru "{0}nd" 22)  22
    (tru "{0}rd" 303) 303
    (tru "{0}th" 0)   0
    (tru "{0}th" 8)   8))

(deftest handlers-test
  (testing "Make sure we have handlers for all the units available"
    (doseq [unit (disj (set (concat u.date/extract-units u.date/truncate-units))
                       :iso-day-of-year :second-of-minute :millisecond)]
      (testing unit
        (is (some? (#'magic/humanize-datetime "1990-09-09T12:30:00" unit)))))))

;;; ------------------- Cell titles -------------------
(deftest cell-title-test
  (mt/$ids venues
    (let [query (query/adhoc-query {:query    {:source-table (mt/id :venues)
                                               :aggregation  [:count]}
                                    :type     :query
                                    :database (mt/id)})
          root  (magic/->root query)]
      (testing "Should humanize equal filter"
        (is (= "number of Venues where Name is Test"
               ;; Test specifically the un-normalized form (metabase#15737)
               (magic/cell-title root ["=" ["field" %name nil] "Test"]))))
      (testing "Should humanize and filter"
        (is (= "number of Venues where Name is Test and Price is 0"
               (magic/cell-title root ["and"
                                       ["=" $name "Test"]
                                       ["=" $price 0]]))))
      (testing "Should humanize between filter"
        (is (= "number of Venues where Name is between A and J"
               (magic/cell-title root ["between" $name "A", "J"]))))
      (testing "Should humanize inside filter"
        (is (= "number of Venues where Longitude is between 2 and 4; and Latitude is between 3 and 1"
               (magic/cell-title root ["inside" (mt/$ids venues $latitude) (mt/$ids venues $longitude) 1 2 3 4])))))))


;;; -------------------- Filters --------------------

(deftest filter-referenced-fields-test
  (testing "X-Ray should work if there's a filter in the question (#19241)"
    (mt/dataset sample-dataset
      (let [query (mi/instance
                   Query
                   {:database-id   (mt/id)
                    :table-id      (mt/id :products)
                    :dataset_query {:database (mt/id)
                                    :type     :query
                                    :query    {:source-table (mt/id :products)
                                               :aggregation  [[:count]]
                                               :breakout     [[:field (mt/id :products :created_at) {:temporal-unit :year}]]
                                               :filter       [:=
                                                              [:field (mt/id :products :category) nil]
                                                              "Doohickey"]}}})]
        (testing `magic/filter-referenced-fields
          (is (= {(mt/id :products :category)   (db/select-one Field :id (mt/id :products :category))
                  (mt/id :products :created_at) (db/select-one Field :id (mt/id :products :created_at))}
                 (#'magic/filter-referenced-fields
                  {:source   (db/select-one Table :id (mt/id :products))
                   :database (mt/id)
                   :entity   query}
                  [:and
                   [:=
                    [:field (mt/id :products :created_at) {:temporal-unit :year}]
                    "2017-01-01T00:00:00Z"]
                   [:=
                    [:field (mt/id :products :category) nil]
                    "Doohickey"]]))))

        (testing "end-to-end"
          ;; VERY IMPORTANT! Make sure the Table is FULLY synced (so it gets classified correctly), otherwise the
          ;; automagic Dashboards won't work (the normal quick sync we do for tests doesn't include everything that's
          ;; needed)
          (sync/sync-table! (db/select-one Table :id (mt/id :products)))
          (let [query     {:database (mt/id)
                           :type     :query
                           :query    {:source-table (mt/id :products)
                                      :filter       [:= [:field (mt/id :products :category) nil] "Doohickey"]
                                      :aggregation  [[:count]]
                                      :breakout     [[:field (mt/id :products :created_at) {:temporal-unit "year"}]]}}
                cell      [:=
                           [:field (mt/id :products :created_at) {:temporal-unit "year"}]
                           "2017-01-01T00:00:00Z"]
                ->base-64 (fn [x]
                            (codec/base64-encode (.getBytes (json/generate-string x) "UTF-8")))]
            (is (schema= {:description (s/eq "A closer look at the metrics and dimensions used in this saved question.")
                          s/Keyword    s/Any}
                         (mt/user-http-request
                          :crowberto :get 200
                          (format "automagic-dashboards/adhoc/%s/cell/%s" (->base-64 query) (->base-64 cell)))))))))))
