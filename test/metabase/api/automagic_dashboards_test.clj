(ns metabase.api.automagic-dashboards-test
  (:require
   [clojure.string :as str]
   [clojure.test :refer :all]
   [metabase.api.automagic-dashboards :as api.magic]
   [metabase.automagic-dashboards.util :as magic.util]
   [metabase.models
    :refer [Card Collection Dashboard Metric ModelIndex ModelIndexValue Segment]]
   [metabase.models.model-index :as model-index]
   [metabase.models.permissions :as perms]
   [metabase.models.permissions-group :as perms-group]
   [metabase.query-processor :as qp]
   [metabase.test :as mt]
   [metabase.test.automagic-dashboards :refer [with-dashboard-cleanup]]
   [metabase.test.domain-entities :as test.de]
   [metabase.test.fixtures :as fixtures]
   [metabase.test.transforms :as transforms.test]
   [metabase.transforms.core :as tf]
   [metabase.transforms.materialize :as tf.materialize]
   [metabase.transforms.specs :as tf.specs]
   [metabase.util :as u]
   [toucan2.core :as t2]
   [toucan2.tools.with-temp :as t2.with-temp]))

(use-fixtures :once (fixtures/initialize :db :web-server :test-users :test-users-personal-collections))

(defn- dashcards-schema-check
  [dashcards]
  (testing "check if all cards in dashcards contain the required fields"
    (doseq [card dashcards]
      (is (malli= [:map
                   [:id                     [:or :string :int]]
                   [:dashboard_tab_id       [:maybe :int]]
                   [:row                    :int]
                   [:col                    :int]
                   [:size_x                 :int]
                   [:size_y                 :int]
                   [:visualization_settings [:maybe :map]]]
                  card)))))

(defn- api-call
  ([template args]
   (api-call template args (constantly true)))

  ([template args revoke-fn]
   (api-call template args revoke-fn some?))

  ([template args revoke-fn validation-fn]
   (mt/with-test-user :rasta
     (with-dashboard-cleanup
       (let [api-endpoint (apply format (str "automagic-dashboards/" template) args)
             resp         (mt/user-http-request :rasta :get 200 api-endpoint)
             _            (dashcards-schema-check (:dashcards resp))
             result       (validation-fn resp)]
         (when (and result
                    (try
                      (testing "Endpoint should return 403 if user does not have permissions"
                        (perms/revoke-data-perms! (perms-group/all-users) (mt/id))
                        (revoke-fn)
                        (let [result (mt/user-http-request :rasta :get 403 api-endpoint)]
                          (is (= "You don't have permissions to do that."
                                 result))))
                      (finally
                        (perms/grant-permissions! (perms-group/all-users) (perms/data-perms-path (mt/id))))))
           result))))))

;;; ------------------- X-ray  -------------------

(deftest table-xray-test
  (testing "GET /api/automagic-dashboards/table/:id"
    (is (some? (api-call "table/%s" [(mt/id :venues)]))))

  (testing "GET /api/automagic-dashboards/table/:id/rule/example/indepth"
    (is (some? (api-call "table/%s/rule/example/indepth" [(mt/id :venues)])))))

(deftest save-table-xray-dashboard-test
  (testing "Should be able to save a Dashboard generated by X-Rays"
    (mt/dataset test-data
      (mt/with-model-cleanup [Collection Card Dashboard]
        (let [generated-dashboard (mt/user-http-request :crowberto :get 200 (format "automagic-dashboards/table/%d" (mt/id :orders)))]
          (is (=? {:description "Some metrics we found about transactions."}
                  generated-dashboard))
          (testing "Save the generated Dashboard"
            (let [saved-dashboard (mt/user-http-request :crowberto :post 200 "dashboard/save" generated-dashboard)]
              (is (=? {:name "A look at Orders"}
                      saved-dashboard))
              (testing "Fetch the saved Dashboard"
                (is (=? {:id (u/the-id saved-dashboard)}
                        (mt/user-http-request :crowberto :get 200 (format "dashboard/%d" (u/the-id saved-dashboard)))))))))))))

(deftest metric-xray-test
  (testing "GET /api/automagic-dashboards/metric/:id"
    (t2.with-temp/with-temp [Metric {metric-id :id} {:table_id   (mt/id :venues)
                                                     :definition {:query {:aggregation ["count"]}}}]
      (is (some? (api-call "metric/%s" [metric-id]))))))

(deftest segment-xray-test
  (t2.with-temp/with-temp [Segment {segment-id :id} {:table_id   (mt/id :venues)
                                                     :definition {:filter [:> [:field (mt/id :venues :price) nil] 10]}}]
    (testing "GET /api/automagic-dashboards/segment/:id"
      (is (some? (api-call "segment/%s" [segment-id]))))

    (testing "GET /api/automagic-dashboards/segment/:id/rule/example/indepth"
      (is (some? (api-call "segment/%s/rule/example/indepth" [segment-id]))))))


(deftest field-xray-test
  (testing "GET /api/automagic-dashboards/field/:id"
    (is (some? (api-call "field/%s" [(mt/id :venues :price)])))))

(defn- revoke-collection-permissions!
  [collection-id]
  (perms/revoke-collection-permissions! (perms-group/all-users) collection-id))

(deftest question-xray-test
  (mt/with-non-admin-groups-no-root-collection-perms
    (let [cell-query (magic.util/encode-base64-json [:> [:field (mt/id :venues :price) nil] 5])]
      (doseq [test-fn
              [(fn [collection-id card-id]
                 (testing "GET /api/automagic-dashboards/question/:id"
                   (is (some? (api-call "question/%s" [card-id] #(revoke-collection-permissions! collection-id))))))

               (fn [collection-id card-id]
                 (testing "GET /api/automagic-dashboards/question/:id/cell/:cell-query"
                   (is (some? (api-call "question/%s/cell/%s"
                                        [card-id cell-query]
                                        #(revoke-collection-permissions! collection-id))))))

               (fn [collection-id card-id]
                 (testing "GET /api/automagic-dashboards/question/:id/cell/:cell-query/rule/example/indepth"
                   (is (some? (api-call "question/%s/cell/%s/rule/example/indepth"
                                        [card-id cell-query]
                                        #(revoke-collection-permissions! collection-id))))))]]
        (t2.with-temp/with-temp [Collection {collection-id :id} {}
                                 Card       {card-id :id}       {:table_id      (mt/id :venues)
                                                                 :collection_id collection-id
                                                                 :dataset_query (mt/mbql-query venues
                                                                                  {:filter [:> $price 10]})}]
          (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
          (test-fn collection-id card-id))))))


(deftest model-xray-test
  (testing "The API surface of a model (dataset = true) is very much like that of a question,
  even though the underlying API will assert that dataset is true and the returned dashboard will be different."
    (mt/with-non-admin-groups-no-root-collection-perms
      (let [cell-query (magic.util/encode-base64-json [:> [:field (mt/id :venues :price) nil] 5])]
        (doseq [test-fn
                [(fn [collection-id card-id]
                   (testing "GET /api/automagic-dashboards/model/:id"
                     (is (some? (api-call "model/%s" [card-id] #(revoke-collection-permissions! collection-id))))))

                 (fn [collection-id card-id]
                   (testing "GET /api/automagic-dashboards/model/:id/cell/:cell-query"
                     (is (some? (api-call "model/%s/cell/%s"
                                          [card-id cell-query]
                                          #(revoke-collection-permissions! collection-id))))))

                 (fn [collection-id card-id]
                   (testing "GET /api/automagic-dashboards/model/:id/cell/:cell-query/rule/example/indepth"
                     (is (some? (api-call "model/%s/cell/%s/rule/example/indepth"
                                          [card-id cell-query]
                                          #(revoke-collection-permissions! collection-id))))))]]
          (t2.with-temp/with-temp [Collection {collection-id :id} {}
                                   Card       {card-id :id}       {:table_id      (mt/id :venues)
                                                                   :collection_id collection-id
                                                                   :dataset_query (mt/mbql-query venues
                                                                                    {:filter [:> $price 10]})
                                                                   :dataset       true}]
            (perms/grant-collection-readwrite-permissions! (perms-group/all-users) collection-id)
            (test-fn collection-id card-id)))))))

(deftest adhoc-query-xray-test
  (let [query (magic.util/encode-base64-json
               (mt/mbql-query venues
                 {:filter [:> $price 10]}))
        cell-query (magic.util/encode-base64-json
                    [:> [:field (mt/id :venues :price) nil] 5])]
    (testing "GET /api/automagic-dashboards/adhoc/:query"
      (is (some? (api-call "adhoc/%s" [query]))))

    (testing "GET /api/automagic-dashboards/adhoc/:query/cell/:cell-query"
      (is (some? (api-call "adhoc/%s/cell/%s" [query cell-query]))))

    (testing "GET /api/automagic-dashboards/adhoc/:query/cell/:cell-query/rule/example/indepth"
      (is (some? (api-call "adhoc/%s/cell/%s/rule/example/indepth" [query cell-query]))))))


;;; ------------------- Comparisons -------------------

(def ^:private segment
  (delay
    {:table_id   (mt/id :venues)
     :definition {:filter [:> [:field (mt/id :venues :price) nil] 10]}}))

(deftest comparisons-test
  (t2.with-temp/with-temp [Segment {segment-id :id} @segment]
    (testing "GET /api/automagic-dashboards/table/:id/compare/segment/:segment-id"
      (is (some?
           (api-call "table/%s/compare/segment/%s"
                     [(mt/id :venues) segment-id]))))

    (testing "GET /api/automagic-dashboards/table/:id/rule/example/indepth/compare/segment/:segment-id"
      (is (some?
           (api-call "table/%s/rule/example/indepth/compare/segment/%s"
                     [(mt/id :venues) segment-id]))))

    (testing "GET /api/automagic-dashboards/adhoc/:id/cell/:cell-query/compare/segment/:segment-id"
      (is (some?
           (api-call "adhoc/%s/cell/%s/compare/segment/%s"
                     [(->> (mt/mbql-query venues
                             {:filter [:> $price 10]})
                           (magic.util/encode-base64-json))
                      (->> [:= [:field (mt/id :venues :price) nil] 15]
                           (magic.util/encode-base64-json))
                      segment-id]))))))

(deftest compare-nested-query-test
  (testing "Ad-hoc X-Rays should work for queries have Card source queries (#15655)"
    (mt/dataset test-data
      (let [card-query      (mt/native-query {:query "select * from people"})
            result-metadata (get-in (qp/process-query card-query) [:data :results_metadata :columns])]
        (mt/with-temp [Collection {collection-id :id} {}
                       Card       {card-id :id} {:name            "15655_Q1"
                                                 :collection_id   collection-id
                                                 :dataset_query   card-query
                                                 :result_metadata result-metadata}]
          (let [query      {:database (mt/id)
                            :type     :query
                            :query    {:source-table (format "card__%d" card-id)
                                       :breakout     [[:field "SOURCE" {:base-type :type/Text}]]
                                       :aggregation  [[:count]]}}
                cell-query [:= [:field "SOURCE" {:base-type :type/Text}] "Affiliate"]]
            (testing "X-Ray"
              (is (some? (api-call "adhoc/%s/cell/%s"
                                   (map magic.util/encode-base64-json [query cell-query])
                                   #(revoke-collection-permissions! collection-id)))))
            (perms/grant-collection-read-permissions! (perms-group/all-users) collection-id)
            (testing "Compare"
              (is (some? (api-call "adhoc/%s/cell/%s/compare/table/%s"
                                   (concat (map magic.util/encode-base64-json [query cell-query])
                                           [(format "card__%d" card-id)])
                                   #(revoke-collection-permissions! collection-id)))))))))))


;;; ------------------- Transforms -------------------

(deftest transforms-test
  (testing "GET /api/automagic-dashboards/transform/:id"
    (mt/with-full-data-perms-for-all-users!
      (mt/with-test-user :rasta
        (transforms.test/with-test-transform-specs
          (test.de/with-test-domain-entity-specs
            (mt/with-model-cleanup [Card Collection]
              (tf/apply-transform! (mt/id) "PUBLIC" (first @tf.specs/transform-specs))
              (is (= [[1 "Red Medicine" 4 10.065 -165.374 3 1.5 4 3 2 1]
                      [2 "Stout Burgers & Beers" 11 34.1 -118.329 2 1.1 11 2 1 1]
                      [3 "The Apple Pan" 11 34.041 -118.428 2 1.1 11 2 1 1]]
                     (mt/formatted-rows [int str int 3.0 3.0 int 1.0 int int int int]
                       (api-call "transform/%s" ["Test transform"]
                                 #(revoke-collection-permissions!
                                   (tf.materialize/get-collection "Test transform"))
                                 (fn [dashboard]
                                   (->> dashboard
                                        :dashcards
                                        (sort-by (juxt :row :col))
                                        last
                                        :card
                                        :dataset_query
                                        qp/process-query)))))))))))))

;;; ------------------- Index Entities Xrays -------------------

(deftest add-source-model-link-auto-width-test
  (testing "An empty set of input cards will return a default card of width 4"
    (let [[{:keys [size_x]}] (#'api.magic/add-source-model-link {} nil)]
      (is (= 4 size_x))))
  (testing "The source model card has a width of at least 4, even if the included content is narrower"
    (let [[{:keys [size_x]}] (#'api.magic/add-source-model-link {} [{:col 1 :size_x 1}])]
      (is (= 4 size_x))))
  (testing "The source model card is as wide as the widest card in the sequence"
    (let [[{:keys [size_x]}] (#'api.magic/add-source-model-link {} [{:col 1 :size_x 1}
                                                                    {:col 10 :size_x 10}])]
      (is (= 20 size_x)))))

(defn- do-with-testing-model
  [{:keys [query pk-ref value-ref]} f]
  (t2.with-temp/with-temp [Card model {:dataset       true
                                       :dataset_query query}]
    (mt/with-model-cleanup [ModelIndex]
      (let [model-index (model-index/create {:model-id   (:id model)
                                             :pk-ref     pk-ref
                                             :value-ref  value-ref
                                             :creator-id (mt/user->id :crowberto)})]
        (model-index/add-values! model-index)
        (f {:model             model
            :model-index       (t2/select-one ModelIndex :id (:id model-index))
            :model-index-value (t2/select-one ModelIndexValue
                                              :model_index_id (:id model-index)
                                              :model_pk 1)})))))

(defmacro with-indexed-model
  "Creates a model based on `query-info`, which is indexed.

  `query-info` is a map with keys:
  - query: a dataset_query for the model
  - pk-ref: a field_ref for the model's pk
  - value-ref: a field_ref for the model's label."
  [[bindings query-info] & body]
  `(do-with-testing-model ~query-info
                          (fn [~bindings] ~@body)))

(def Tab-Id-Schema
  "Schema for tab-ids. Must be integers for the front-end, but negative so we know they do not (yet) exist in the db."
  [:fn neg-int?])

(defn- expected-filters
  [{:keys [model-index-value] :as info}]
  (let [linked-tables (api.magic/linked-entities info)]
    (into #{} (map (fn [{fk-id :linked-field-id}]
                     [:= [:field fk-id nil] (:model_pk model-index-value)]))
          linked-tables)))

(defn- cards-have-filters?
  "Ensure that each of the `dashcards` which has a query includes one of the expected `filters`. Filters will be of the
  form `[:= [:field <fk-id> nil] <pk-value>]`."
  [dashcards filters]
  (doseq [dashcard dashcards
          :let [query (-> dashcard :card :dataset_query :query)]
          :when query
          :let [filter-tree (into #{} (tree-seq sequential? seq (:filter query)))]]
    (is (some filters filter-tree)
        (str "Card: " (-> dashcard :card :name)
             "\nwith filter: " (-> dashcard :card :dataset_query :query :filter)
             "\nis missing one of " filters))))

(deftest create-linked-dashboard-test-no-linked
  (testing "If there are no linked-tables, create a default view explaining the situation."
    (is (=? {:dashcards [{:visualization_settings {:virtual_card {:display "link", :archived false}
                                                   :link         {:entity {:model   "dataset"
                                                                           :display "table"}}}}
                         {:visualization_settings {:text                "# Unfortunately, there's not much else to show right now...",
                                                   :virtual_card        {:display :text},
                                                   :dashcard.background false,
                                                   :text.align_vertical :bottom}}]}
            (#'api.magic/create-linked-dashboard {:model             nil
                                                  :linked-tables     ()
                                                  :model-index       nil
                                                  :model-index-value nil})))))

(deftest create-linked-dashboard-test-regular-queries
  (mt/dataset test-data
    (testing "x-ray an mbql model"
      (with-indexed-model [{:keys [model model-index model-index-value]}
                           {:query     (mt/mbql-query products)
                            :pk-ref    (mt/$ids :products $id)
                            :value-ref (mt/$ids :products $title)}]
        (let [dash (#'api.magic/create-linked-dashboard
                    {:model             model
                     :model-index       model-index
                     :model-index-value model-index-value
                     :linked-tables     (mt/$ids [{:linked-table-id $$reviews
                                                   :linked-field-id %reviews.product_id}
                                                  {:linked-table-id $$orders
                                                   :linked-field-id %orders.product_id}])})]
          (is (=? [{:id   (mt/malli=? Tab-Id-Schema)
                    :name "A look at Reviews" :position 0}
                   {:id   (mt/malli=? Tab-Id-Schema)
                    :name "A look at Orders" :position 1}]
                  (:tabs dash)))
          (testing "The first card for each tab is a linked model card to the source model"
            (is (=? (repeat
                     (count (:tabs dash))
                     {:visualization_settings
                      {:virtual_card {:display "link", :archived false}
                       :link         {:entity {:id      (:id model)
                                               :name    (:name model)
                                               :model   "dataset"
                                               :display "table"}}}})
                    (->> (:dashcards dash)
                         (group-by :dashboard_tab_id)
                         vals
                         (map first)))))
          (testing "The generated dashboard has a meaningful name and description"
            (is (true?
                 (and
                  (str/includes? (:name dash) (:name model))
                  (str/includes? (:name dash) (:name model-index-value)))))
            (is (true? (str/includes? (:description dash) (:name model-index-value)))))
          (testing "All query cards have the correct filters"
            (let [pk-filters (expected-filters {:model             model
                                                :model-index       model-index
                                                :model-index-value model-index-value})]
              (cards-have-filters? (:dashcards dash) pk-filters))))))
    (testing "X-ray a native model"
      (letfn [(lower [x] (u/lower-case-en x))
              (by-id [cols col-name] (or (some (fn [col]
                                                 (when (= (lower (:name col)) (lower col-name))
                                                   col))
                                               cols)
                                         (throw (ex-info (str "could not find column " col-name)
                                                         {:name    col-name
                                                          :present (map :name cols)}))))
              (annotating [cols ref f]
                (map (fn [{:keys [field_ref] :as col}]
                       (if (= ref field_ref) (f col) col))
                     cols))]
        (let [query           (mt/native-query {:query "select * from products"})
              results-meta    (->> (qp/process-userland-query query)
                                   :data :results_metadata :columns)
              id-field-ref    (:field_ref (by-id results-meta "id"))
              title-field-ref (:field_ref (by-id results-meta "title"))
              id-field-id     (mt/id :products :id)]
          (with-indexed-model [{:keys [model model-index model-index-value]}
                               {:query     (mt/native-query {:query "select * from products"})
                                :pk-ref    id-field-ref
                                :value-ref title-field-ref}]
            ;; need user metadata edits to find linked tables to an otherwise opaque native query
            (t2/update! :model/Card (:id model)
                        {:result_metadata (annotating results-meta id-field-ref
                                                      #(assoc % :id id-field-id))})
            (assert (= (-> (t2/select-one-fn :result_metadata :model/Card
                                             :id (:id model))
                           (by-id "id") :id)
                       id-field-id)
                    "Metadata not updated with the mapping to the database column")
            (let [model (t2/select-one 'Card :id (:id model))
                  dash  (#'api.magic/create-linked-dashboard
                         {:model             model
                          :model-index       model-index
                          :model-index-value model-index-value
                          :linked-tables     (mt/$ids [{:linked-table-id $$reviews
                                                        :linked-field-id %reviews.product_id}
                                                       {:linked-table-id $$orders
                                                        :linked-field-id %orders.product_id}])})]
              (is (=? [{:id   (mt/malli=? Tab-Id-Schema)
                        :name "A look at Reviews" :position 0}
                       {:id   (mt/malli=? Tab-Id-Schema)
                        :name "A look at Orders" :position 1}]
                      (:tabs dash)))
              (testing "All query cards have the correct filters"
                (let [pk-filters (expected-filters {:model             model
                                                    :model-index       model-index
                                                    :model-index-value model-index-value})]
                  (cards-have-filters? (:dashcards dash) pk-filters))))))))))

(deftest create-linked-dashboard-test-single-link
  (mt/dataset test-data
    (testing "with only single linked table"
      (with-indexed-model [{:keys [model model-index model-index-value]}
                           {:query     (mt/mbql-query people)
                            :pk-ref    (mt/$ids :people $id)
                            :value-ref (mt/$ids :people $email)}]
        (let [dash (#'api.magic/create-linked-dashboard
                    {:model             model
                     :model-index       model-index
                     :model-index-value model-index-value
                     :linked-tables     (mt/$ids [{:linked-table-id $$orders
                                                   :linked-field-id %orders.user_id}])})]
          ;; FE has a bug where it doesn't fire off queries for cards if there's only a single tab. So we hack around
          ;; that by not creating tabs if there would only be one.
          (testing "Has no tabs"
            (is (empty? (:tabs dash))))
          (testing "The first card for each tab is a linked model card to the source model"
            (is (=? {:visualization_settings
                     {:virtual_card {:display "link", :archived false}
                      :link         {:entity {:id      (:id model)
                                              :name    (:name model)
                                              :model   "dataset"
                                              :display "table"}}}}
                    (->> dash :dashcards first))))
          (testing "The generated dashboard has a meaningful name and description"
            (is (true?
                 (and
                  (str/includes? (:name dash) (:name model))
                  (str/includes? (:name dash) (:name model-index-value)))))
            (is (true? (str/includes? (:description dash) (:name model-index-value)))))
          (testing "All query cards have the correct filters"
            (let [pk-filters (expected-filters {:model             model
                                                :model-index       model-index
                                                :model-index-value model-index-value})]
              (cards-have-filters? (:dashcards dash) pk-filters))))))))

;; ------------------------------------------------ `show` limit test  -------------------------------------------------
;; Historically, the used params are `nil` and "all", so this tests the integer case.

(defn- card-count-check
  "Create a dashboard via API twice, once with a limit and once without, and return the results."
  [limit template args]
  (mt/with-test-user :rasta
    (with-dashboard-cleanup
      (let [api-endpoint  (apply format (str "automagic-dashboards/" template) args)
            resp          (mt/user-http-request :rasta :get 200 api-endpoint)
            slimmed       (mt/user-http-request :rasta :get 200 api-endpoint :show limit)
            card-count-fn (fn [dashboard] (count (keep :card (:dashcards dashboard))))]
        {:base-count (card-count-fn resp)
         :show-count (card-count-fn slimmed)}))))

(deftest table-show-param-test
  (testing "x-ray of a table with show set reduces the number of returned cards"
    (let [show-limit 1
          {:keys [base-count show-count]} (card-count-check show-limit "table/%s" [(mt/id :venues)])]
      (testing "The non-slimmed dashboard isn't already at \"limit\" cards"
        (is (< show-count base-count)))
      (testing "Only \"limit\" cards are produced"
        (is (= show-limit show-count))))))

(deftest metric-xray-show-param-test
  (testing "x-ray of a metric with show set reduces the number of returned cards"
    (t2.with-temp/with-temp [Metric {metric-id :id} {:table_id   (mt/id :venues)
                                                     :definition {:query {:aggregation ["count"]}}}]
      (let [show-limit 1
            {:keys [base-count show-count]} (card-count-check show-limit "metric/%s" [metric-id])]
        (testing "The non-slimmed dashboard isn't already at \"limit\" cards"
          (is (< show-count base-count)))
        (testing "Only \"limit\" cards are produced"
          (is (= show-limit show-count)))))))

(deftest segment-xray-show-param-test
  (testing "x-ray of a segment with show set reduces the number of returned cards"
    (t2.with-temp/with-temp [Segment {segment-id :id} {:table_id   (mt/id :venues)
                                                       :definition {:filter [:> [:field (mt/id :venues :price) nil] 10]}}]
      (let [show-limit 1
            {:keys [base-count show-count]} (card-count-check show-limit "segment/%s" [segment-id])]
        (testing "The non-slimmed dashboard isn't already at \"limit\" cards"
          (is (< show-count base-count)))
        (testing "Only \"limit\" cards are produced"
          (is (= show-limit show-count)))))))

(deftest field-xray-show-param-test
  (testing "x-ray of a field with show set reduces the number of returned cards"
    (let [show-limit 1
          {:keys [base-count show-count]} (card-count-check show-limit "field/%s" [(mt/id :venues :price)])]
      (testing "The non-slimmed dashboard isn't already at \"limit\" cards"
        (is (< show-count base-count)))
      (testing "Only \"limit\" cards are produced"
        (is (= show-limit show-count))))))

(deftest cell-query-xray-show-param-test
  (testing "x-ray of a cell-query with show set reduces the number of returned cards"
    (t2.with-temp/with-temp [Card {card-id :id} {:table_id      (mt/id :venues)
                                                 :dataset_query (mt/mbql-query venues
                                                                  {:filter [:> $price 10]})}]
      (let [cell-query (magic.util/encode-base64-json [:> [:field (mt/id :venues :price) nil] 5])
            show-limit 2
            {:keys [base-count show-count]} (card-count-check show-limit "question/%s/cell/%s" [card-id cell-query])]
        (testing "The non-slimmed dashboard isn't already at \"limit\" cards"
          (is (< show-count base-count)))
        (testing "Only \"limit\" cards are produced"
          (is (= show-limit show-count)))))))

(deftest comparison-xray-show-param-test
  (testing "x-ray of a comparison with show set reduces the number of returned cards"
    (t2.with-temp/with-temp [Segment {segment-id :id} @segment]
      (let [show-limit 1
            {:keys [base-count show-count]} (card-count-check show-limit
                                                              "adhoc/%s/cell/%s/compare/segment/%s"
                                                              [(->> (mt/mbql-query venues
                                                                      {:filter [:> $price 10]})
                                                                    (magic.util/encode-base64-json))
                                                               (->> [:= [:field (mt/id :venues :price) nil] 15]
                                                                    (magic.util/encode-base64-json))
                                                               segment-id])]
        (testing "The slimmed dashboard produces less than the base dashboard"
          ;;NOTE - Comparisons produce multiple dashboards and merge the results, so you don't get exactly `show-limit` cards
          (is (< show-count base-count)))))))
