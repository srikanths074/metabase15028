(ns metabase.driver.mongo.query-processor-test
  (:require [clojure.set :as set]
            [clojure.test :refer :all]
            [java-time :as t]
            [metabase.driver :as driver]
            [metabase.driver.mongo.query-processor :as mongo.qp]
            [metabase.models :refer [Field Table]]
            [metabase.query-processor :as qp]
            [metabase.query-processor-test.date-time-zone-functions-test :as qp.datetime-test]
            [metabase.query-processor.timezone :as qp.timezone]
            [metabase.test :as mt]
            [metabase.util :as u]
            [schema.core :as s]
            [toucan.db :as db]))

(deftest query->collection-name-test
  (testing "query->collection-name"
    (testing "should be able to extract :collection from :source-query")
    (is (= "checkins"
           (#'mongo.qp/query->collection-name {:query {:source-query
                                                       {:collection "checkins"
                                                        :native     []}}})))
    (testing "should work for nested-nested queries"
      (is (= "checkins"
             (#'mongo.qp/query->collection-name {:query {:source-query {:source-query
                                                                        {:collection "checkins"
                                                                         :native     []}}}}))))

    (testing "should ignore :joins"
      (is (= nil
             (#'mongo.qp/query->collection-name {:query {:source-query
                                                         {:native []}
                                                         :joins [{:source-query "wow"}]}}))))))

(deftest relative-datetime-test
  (mt/test-driver :mongo
    (testing "Make sure relative datetimes are compiled sensibly"
      (mt/with-clock #t "2021-02-17T10:36:00-08:00[US/Pacific]"
        (mt/dataset attempted-murders
          (is (= {:projections ["count"]
                  :query       [{"$match"
                                 {"$and"
                                  [{:$expr {"$gte" ["$datetime" {:$dateFromString {:dateString "2021-01-01T00:00Z"}}]}}
                                   {:$expr {"$lt" ["$datetime" {:$dateFromString {:dateString "2021-02-01T00:00Z"}}]}}]}}
                                {"$group" {"_id" nil, "count" {"$sum" 1}}}
                                {"$sort" {"_id" 1}}
                                {"$project" {"_id" false, "count" true}}]
                  :collection  "attempts"
                  :mbql?       true}
                 (qp/compile
                  (mt/mbql-query attempts
                    {:aggregation [[:count]]
                     :filter      [:time-interval $datetime :last :month]})))))))))

(deftest absolute-datetime-test
  (mt/test-driver :mongo
    (testing "Make sure absolute-datetime are compiled correctly"
      (doseq [[expected date]
              [["2014-01-01"        (t/local-date "2014-01-01")]
               ["10:00"             (t/local-time "10:00:00")]
               ["2014-01-01T10:00"  (t/local-date-time "2014-01-01T10:00")]
               ["03:00Z"            (t/offset-time "10:00:00+07:00")]
               ["2014-01-01T03:00Z" (t/offset-date-time "2014-01-01T10:00+07:00")]
               ["2014-01-01T00:00Z" (t/zoned-date-time "2014-01-01T07:00:00+07:00[Asia/Ho_Chi_Minh]")]]]
        (testing (format "with %s" (type date))
          (is (= {:$expr {"$lt" ["$date-field" {:$dateFromString {:dateString expected}}]}}
                 (mongo.qp/compile-filter [:<
                                           [:field "date-field"]
                                           [:absolute-datetime date]]))))))))

(deftest no-initial-projection-test
  (mt/test-driver :mongo
    (testing "Don't need to create initial projections anymore (#4216)"
      (testing "Don't create an initial projection for datetime-fields that use `:default` bucketing (#14838)"
        (mt/with-clock #t "2021-02-15T17:33:00-08:00[US/Pacific]"
          (mt/dataset attempted-murders
            (is (= {:projections ["count"]
                    :query       [{"$match"
                                   {"$and"
                                    [{:$expr {"$gte" ["$datetime" {:$dateFromString {:dateString "2021-01-01T00:00Z"}}]}}
                                     {:$expr {"$lt" ["$datetime" {:$dateFromString {:dateString "2021-02-01T00:00Z"}}]}}]}}
                                  {"$group" {"_id" nil, "count" {"$sum" 1}}}
                                  {"$sort" {"_id" 1}}
                                  {"$project" {"_id" false, "count" true}}]
                    :collection  "attempts"
                    :mbql?       true}
                   (qp/compile
                    (mt/mbql-query attempts
                      {:aggregation [[:count]]
                       :filter      [:time-interval $datetime :last :month]}))))

            (testing "should still work even with bucketing bucketing"
              (let [query (mt/with-everything-store
                            (qp/compile
                             (mt/mbql-query attempts
                               {:aggregation [[:count]]
                                :breakout    [[:field %datetime {:temporal-unit :month}]
                                              [:field %datetime {:temporal-unit :day}]]
                                :filter      [:= [:field %datetime {:temporal-unit :month}] [:relative-datetime -1 :month]]})))]
                (is (= {:projections ["datetime~~~month" "datetime~~~day" "count"]
                        :query       [{"$match"
                                       {"$and"
                                        [{:$expr {"$gte" ["$datetime" {:$dateFromString {:dateString "2021-01-01T00:00Z"}}]}}
                                         {:$expr {"$lt" ["$datetime" {:$dateFromString {:dateString "2021-02-01T00:00Z"}}]}}]}}
                                      {"$group" {"_id"   {"datetime~~~month" {:$let {:vars {:parts {:$dateToParts {:date "$datetime"
                                                                                                                   :timezone (qp.timezone/results-timezone-id :mongo mt/db)}}}
                                                                                     :in   {:$dateFromParts {:year  "$$parts.year"
                                                                                                             :month "$$parts.month"
                                                                                                             :timezone (qp.timezone/results-timezone-id :mongo mt/db)}}}},
                                                          "datetime~~~day"   {:$let {:vars {:parts {:$dateToParts {:date "$datetime"
                                                                                                                   :timezone (qp.timezone/results-timezone-id :mongo mt/db)}}}
                                                                                     :in   {:$dateFromParts {:year  "$$parts.year"
                                                                                                             :month "$$parts.month"
                                                                                                             :day   "$$parts.day"
                                                                                                             :timezone (qp.timezone/results-timezone-id :mongo mt/db)}}}}}
                                                 "count" {"$sum" 1}}}
                                      {"$sort" {"_id" 1}}
                                      {"$project" {"_id"              false
                                                   "datetime~~~month" "$_id.datetime~~~month"
                                                   "datetime~~~day"   "$_id.datetime~~~day"
                                                   "count"            true}}
                                      {"$sort" {"datetime~~~month" 1}}]
                        :collection  "attempts"
                        :mbql?       true}
                       query))
                (testing "Make sure we can actually run the query"
                  (is (schema= {:status   (s/eq :completed)
                                s/Keyword s/Any}
                               (qp/process-query (mt/native-query query)))))))))))))

(deftest field-filter-relative-time-native-test
  (mt/test-driver :mongo
    (testing "Field filters with relative temporal constraints should work with native queries (#15945)"
      (mt/with-clock #t "2014-10-03T18:08:00Z"
        (let [query {:database (mt/id)
                     :native
                     {:collection "users"
                      :template-tags
                      {:date
                       {:id "2d7ce56a-2a66-5845-e9b9-e243c16965b8"
                        :name "last_login"
                        :display-name "Last Login"
                        :type "dimension"
                        :dimension ["field" (mt/id :users :last_login) nil]
                        :required true}}
                      :query "[{\"$match\": {{date}} },
                               {\"$project\": {\"name\": 1, \"last_login\": 1, \"_id\": 0} }]"}
                     :type "native"
                     :parameters
                     [{:type "date/all-options"
                       :value "past2hours"
                       :target ["dimension" ["template-tag" "date"]]
                       :id "2d7ce56a-2a66-5845-e9b9-e243c16965b8"}]
                     :middleware {:js-int-to-string? true}}]
          (is (= [["Quentin Sören" "2014-10-03T17:30:00Z"]]
                 (mt/rows (qp/process-query query)))))))))

(deftest grouping-with-timezone-test
  (mt/test-driver :mongo
    (testing "Result timezone is respected when grouping by hour (#11149)"
      (mt/dataset attempted-murders
        (testing "Querying in UTC works"
          (mt/with-system-timezone-id "UTC"
            (is (= [["2019-11-20T20:00:00Z" 1]
                    ["2019-11-19T00:00:00Z" 1]
                    ["2019-11-18T20:00:00Z" 1]
                    ["2019-11-17T14:00:00Z" 1]]
                   (mt/rows (mt/run-mbql-query attempts
                              {:aggregation [[:count]]
                               :breakout [[:field %datetime {:temporal-unit :hour}]]
                               :order-by [[:desc [:field %datetime {:temporal-unit :hour}]]]
                               :limit 4}))))))
        (testing "Querying in Kathmandu works"
          (mt/with-system-timezone-id "Asia/Kathmandu"
            (is (= [["2019-11-21T01:00:00+05:45" 1]
                    ["2019-11-19T06:00:00+05:45" 1]
                    ["2019-11-19T02:00:00+05:45" 1]
                    ["2019-11-17T19:00:00+05:45" 1]]
                   (mt/rows (mt/run-mbql-query attempts
                              {:aggregation [[:count]]
                               :breakout [[:field %datetime {:temporal-unit :hour}]]
                               :order-by [[:desc [:field %datetime {:temporal-unit :hour}]]]
                               :limit 4}))))))))))

(deftest nested-columns-test
  (mt/test-driver :mongo
    (testing "Should generate correct queries against nested columns"
      (mt/dataset geographical-tips
        (mt/with-everything-store
          (is (= {:projections ["count"]
                  :query       [{"$match" {"source.username" "tupac"}}
                                {"$group" {"_id" nil, "count" {"$sum" 1}}}
                                {"$sort" {"_id" 1}}
                                {"$project" {"_id" false, "count" true}}],
                  :collection  "tips",
                  :mbql?       true}
                 (qp/compile
                  (mt/mbql-query tips
                    {:aggregation [[:count]]
                     :filter      [:= $tips.source.username "tupac"]}))))

          (is (= {:projections ["source.username" "count"]
                  :query       [{"$group" {"_id"   {"source" {"username" "$source.username"}}
                                           "count" {"$sum" 1}}}
                                {"$sort" {"_id" 1}}
                                ;; Or should this be {"source" {"username" "$_id.source.username"}} ?
                                {"$project" {"_id" false, "source.username" "$_id.source.username", "count" true}}
                                {"$sort" {"source.username" 1}}]
                  :collection  "tips"
                  :mbql?       true}
                 (qp/compile
                  (mt/mbql-query tips
                    {:aggregation [[:count]]
                     :breakout    [$tips.source.username]}))))
          (testing "Parent fields are removed from projections when child fields are included (#19135)"
            (let [table       (db/select-one Table :db_id (mt/id))
                  fields      (db/select Field :table_id (u/the-id table))
                  projections (-> (mongo.qp/mbql->native
                                    (mt/mbql-query tips {:fields (mapv (fn [f]
                                                                         [:field (u/the-id f) nil])
                                                                       fields)}))
                                  :projections
                                  set)]
              ;; the "source", "url", and "venue" fields should NOT have been chosen as projections, since they have
              ;; at least one child field selected as a projection, which is not allowed as of MongoDB 4.4
              ;; see docstring on mongo.qp/remove-parent-fields for full details
              (is (empty? (set/intersection projections #{"source" "url" "venue"}))))))))))

(deftest multiple-distinct-count-test
  (mt/test-driver :mongo
    (testing "Should generate correct queries for multiple `:distinct` count aggregations (#13097)"
      (is (= {:projections ["count" "count_2"]
              :query
              [{"$group" {"_id" nil, "count" {"$addToSet" "$name"}, "count_2" {"$addToSet" "$price"}}}
               {"$sort" {"_id" 1}}
               {"$project" {"_id" false, "count" {"$size" "$count"}, "count_2" {"$size" "$count_2"}}}
               {"$limit" 5}],
              :collection  "venues"
              :mbql?       true}
             (qp/compile
              (mt/mbql-query venues
                {:aggregation [[:distinct $name]
                               [:distinct $price]]
                 :limit       5})))))))

(defn- extract-projections [projections q]
  (select-keys (get-in q [:query 0 "$project"]) projections))

(deftest expressions-test
  (mt/test-driver :mongo
    (testing "Should be able to deal with expressions (#9382 is for BQ but we're doing it for mongo too)"
      (is (= {"bob" "$latitude", "cobb" "$name"}
             (extract-projections
               ["bob" "cobb"]
               (qp/compile
                 (mt/mbql-query venues
                                {:fields      [[:expression "bob"] [:expression "cobb"]]
                                 :expressions {:bob   [:field $latitude nil]
                                               :cobb [:field $name nil]}
                                 :limit       5}))))))
    (testing "Should be able to deal with 1-arity functions"
      (is (= {"cobb" {"$toUpper" "$name"},
              "bob" {"$abs" "$latitude"}}
             (extract-projections
               ["bob" "cobb"]
               (qp/compile
                 (mt/mbql-query venues
                                {:filters     [[:expression "bob"] [:expression "cobb"]]
                                 :expressions {:bob   [:abs $latitude]
                                               :cobb [:upper $name]}
                                 :limit       5}))))))
    (testing "Should be able to deal with 2-arity functions"
      (is (= {"bob" {"$add" ["$price" 300]}}
             (extract-projections
               ["bob"]
               (qp/compile
                 (mt/mbql-query venues
                                {:filters     [[:expression "bob"]]
                                 :expressions {:bob   [:+ $price 300]}
                                 :limit       5}))))))
    (testing "Should be able to deal with a little indirection"
      (is (= {"bob" {"$abs" {"$subtract" ["$price" 300]}}}
             (extract-projections
               ["bob"]
               (qp/compile
                 (mt/mbql-query venues
                                {:filters     [[:expression "bob"]]
                                 :expressions {:bob   [:abs [:- $price 300]]}
                                 :limit       5}))))))
    (testing "Should be able to deal with a little indirection, with an expression in"
      (is (= {"bob" {"$abs" "$latitude"},
              "cobb" {"$ceil" {"$abs" "$latitude"}}}
             (extract-projections
               ["bob" "cobb"]
               (qp/compile
                 (mt/mbql-query venues
                                {:filters     [[:expression "bob"] [:expression "cobb"]]
                                 :expressions {:bob  [:abs $latitude]
                                               :cobb [:ceil [:expression "bob"]]}
                                 :limit       5}))))))
    (testing "Should be able to deal with coalescing"
      (is (= {"bob" {"$ifNull" ["$latitude" "$price"]}}
             (extract-projections
               ["bob"]
               (qp/compile
                 (mt/mbql-query venues
                                {:expressions {:bob [:coalesce [:field $latitude nil] [:field $price nil]]}
                                 :limit       5}))))))

    (testing "Should be able to deal with group by expressions"
      (is (= {:collection "venues",
              :mbql? true,
              :projections ["asdf" "count"],
              :query [{"$project"
                       {"_id" "$_id",
                        "name" "$name",
                        "category_id" "$category_id",
                        "latitude" "$latitude",
                        "longitude" "$longitude",
                        "price" "$price",
                        "asdf" "$price"}}
                      {"$group" {"_id" {"asdf" "$asdf"}, "count" {"$sum" 1}}}
                      {"$sort" {"_id" 1}}
                      {"$project" {"_id" false, "asdf" "$_id.asdf", "count" true}}
                      {"$sort" {"asdf" 1}}]}
             (qp/compile
               (mt/mbql-query venues
                              {:expressions {:asdf ["field" $price nil]},
                               :aggregation [["count"]],
                               :breakout [["expression" "asdf"]]})))))))

(deftest compile-time-interval-test
  (mt/test-driver :mongo
    (testing "Make sure time-intervals work the way they're supposed to."
      (mt/with-clock #t "2021-02-17T10:36:00-08:00[US/Pacific]"
        (testing "[:time-interval $date -4 :month] should give us something like Oct 01 2020 - Feb 01 2021 if today is Feb 17 2021"
          (is (= [{"$match"
                   {"$and"
                    [{:$expr {"$gte" ["$date" {:$dateFromString {:dateString "2020-10-01T00:00Z"}}]}}
                     {:$expr {"$lt" ["$date" {:$dateFromString {:dateString "2021-02-01T00:00Z"}}]}}]}}
                  {"$group"
                   {"_id"
                    {"date~~~day"
                     {:$let
                      {:vars {:parts {:$dateToParts {:date "$date"
                                                     :timezone (qp.timezone/results-timezone-id :mongo mt/db)}}},
                       :in   {:$dateFromParts {:year "$$parts.year", :month "$$parts.month", :day "$$parts.day"
                                               :timezone (qp.timezone/results-timezone-id :mongo mt/db)}}}}}}}
                  {"$sort" {"_id" 1}}
                  {"$project" {"_id" false, "date~~~day" "$_id.date~~~day"}}
                  {"$sort" {"date~~~day" 1}}
                  {"$limit" 1048575}]
                 (:query
                  (qp/compile
                   (mt/mbql-query checkins
                     {:filter   [:time-interval $date -4 :month]
                      :breakout [!day.date]}))))))))))

(deftest temporal-arithmetic-test
  (testing "Mixed integer and date arithmetic works with Mongo 5+"
    (with-redefs [mongo.qp/get-mongo-version (constantly {:version "5.2.13", :semantic-version [5 2 13]})]
      (mt/with-clock #t "2022-06-21T15:36:00+02:00[Europe/Berlin]"
        (is (= {:$expr
                {"$lt"
                 [{"$dateAdd"
                   {:startDate {"$add" [{"$dateAdd" {:startDate "$date-field"
                                                     :unit :year
                                                     :amount 1}}
                                        3600000]}
                    :unit :month
                    :amount -1}}
                  {"$subtract"
                   [{"$dateSubtract" {:startDate {:$dateFromString {:dateString "2008-05-31"}}
                                      :unit :week
                                      :amount -1}}
                    86400000]}]}}
               (mongo.qp/compile-filter [:<
                                         [:+
                                          [:interval 1 :year]
                                          [:field "date-field"]
                                          3600000
                                          [:interval -1 :month]]
                                         [:-
                                          [:absolute-datetime (t/local-date "2008-05-31")]
                                          [:interval -1 :week]
                                          86400000]]))))))
  (testing "Date arithmetic fails with Mongo 4-"
    (with-redefs [mongo.qp/get-mongo-version (constantly {:version "4", :semantic-version [4]})]
      (is (thrown-with-msg? clojure.lang.ExceptionInfo  #"Date arithmetic not supported in versions before 5"
                            (mongo.qp/compile-filter [:<
                                                      [:+
                                                       [:interval 1 :year]
                                                       [:field "date-field"]]
                                                      [:absolute-datetime (t/local-date "2008-05-31")]]))))))

(mt/defdataset mongo-times-mixed
  [["times" [{:field-name "index"
              :base-type :type/Integer}
             {:field-name "dt"
              :base-type :type/DateTime}
             {:field-name "dt_tz"
              :base-type  :type/DateTimeWithTZ}
             {:field-name "d"
              :base-type :type/Date}
             {:field-name "as_dt"
              :base-type :type/Text
              :effective-type :type/DateTime
              :coercion-strategy :Coercion/ISO8601->DateTime}]
    (for [[idx t]
          (map-indexed vector [#t "2004-03-19 09:19:09+07:00[Asia/Ho_Chi_Minh]"
                               #t "2008-06-20 10:20:10+07:00[Asia/Ho_Chi_Minh]"
                               #t "2012-11-21 11:21:11+07:00[Asia/Ho_Chi_Minh]"
                               #t "2012-11-21 11:21:11+07:00[Asia/Ho_Chi_Minh]"])]
      [(inc idx)
       (t/local-date-time t)                                     ; dt
       (t/with-zone-same-instant t "Asia/Ho_Chi_Minh")           ; dt_tz
       (t/local-date t)                                          ; d
       (t/format "yyyy-MM-dd HH:mm:ss" (t/local-date-time t))])] ; as_dt
   ["weeks" [{:field-name "index"
              :base-type :type/Integer}
             {:field-name "description"
              :base-type :type/Text}
             {:field-name "d"
              :base-type :type/Date}]
    [[1 "1st saturday"   #t "2000-01-01"]
     [2 "1st sunday"     #t "2000-01-02"]
     [3 "1st monday"     #t "2000-01-03"]
     [4 "1st wednesday"  #t "2000-01-04"]
     [5 "1st tuesday"    #t "2000-01-05"]
     [6 "1st thursday"   #t "2000-01-06"]
     [7 "1st friday"     #t "2000-01-07"]
     [8 "2nd saturday"   #t "2000-01-08"]
     [9 "2nd sunday"     #t "2000-01-09"]
     [10 "2005 saturday" #t "2005-01-01"]]]])

(deftest datetime-math-tests
  (mt/test-driver :mongo
    (mt/dataset mongo-times-mixed
      ;; date arithmetic doesn't supports until mongo 5+
      (when (driver/database-supports? :mongo :date-arithmetics (mt/db))
        (testing "date arithmetic with datetime columns"
          (doseq [[col-type field-id] [[:datetime (mt/id :times :dt)]
                                       [:text-as-datetime (mt/id :times :as_dt)]]
                  op                  [:datetime-add :datetime-subtract]
                  unit                [:year :quarter :month :day :hour :minute :second :millisecond]
                  {:keys [expected query]}
                  [{:expected [(qp.datetime-test/datetime-math op #t "2004-03-19 09:19:09" 2 unit col-type)
                               (qp.datetime-test/datetime-math op #t "2008-06-20 10:20:10" 2 unit col-type)
                               (qp.datetime-test/datetime-math op #t "2012-11-21 11:21:11" 2 unit col-type)
                               (qp.datetime-test/datetime-math op #t "2012-11-21 11:21:11" 2 unit col-type)]
                    :query    {:expressions {"expr" [op [:field field-id nil] 2 unit]}
                               :fields      [[:expression "expr"]]}}
                   {:expected (into [] (frequencies
                                        [(qp.datetime-test/datetime-math op #t "2004-03-19 09:19:09" 2 unit col-type)
                                         (qp.datetime-test/datetime-math op #t "2008-06-20 10:20:10" 2 unit col-type)
                                         (qp.datetime-test/datetime-math op #t "2012-11-21 11:21:11" 2 unit col-type)
                                         (qp.datetime-test/datetime-math op #t "2012-11-21 11:21:11" 2 unit col-type)]))
                    :query    {:expressions {"expr" [op [:field field-id nil] 2 unit]}
                               :aggregation [[:count]]
                               :breakout    [[:expression "expr"]]}}]]
            (testing (format "%s %s function works as expected on %s column for driver %s" op unit col-type driver/*driver*)
              (is (= (set expected) (set (qp.datetime-test/test-datetime-math query)))))))

        (testing "date arithmetic with date columns"
          (let [[col-type field-id] [:date (mt/id :times :d)]]
            (doseq [op               [:datetime-add :datetime-subtract]
                    unit             [:year :quarter :month :day]
                    {:keys [expected query]}
                    [{:expected [(qp.datetime-test/datetime-math op #t "2004-03-19 00:00:00" 2 unit col-type)
                                 (qp.datetime-test/datetime-math op #t "2008-06-20 00:00:00" 2 unit col-type)
                                 (qp.datetime-test/datetime-math op #t "2012-11-21 00:00:00" 2 unit col-type)
                                 (qp.datetime-test/datetime-math op #t "2012-11-21 00:00:00" 2 unit col-type)]
                      :query   {:expressions {"expr" [op [:field field-id nil] 2 unit]}
                                :fields      [[:expression "expr"]]}}
                     {:expected (into [] (frequencies
                                          [(qp.datetime-test/datetime-math op #t "2004-03-19 00:00:00" 2 unit col-type)
                                           (qp.datetime-test/datetime-math op #t "2008-06-20 00:00:00" 2 unit col-type)
                                           (qp.datetime-test/datetime-math op #t "2012-11-21 00:00:00" 2 unit col-type)
                                           (qp.datetime-test/datetime-math op #t "2012-11-21 00:00:00" 2 unit col-type)]))
                      :query    {:expressions {"expr" [op [:field field-id nil] 2 unit]}
                                 :aggregation [[:count]]
                                 :breakout    [[:expression "expr"]]}}]]
              (testing (format "%s %s function works as expected on %s column for driver %s" op unit col-type driver/*driver*)
                (is (= (set expected) (set (qp.datetime-test/test-datetime-math query))))))))))))

(deftest extraction-function-tests
  (mt/test-driver :mongo
    (mt/dataset mongo-times-mixed
      (testing "with datetime columns"
        (doseq [[col-type field-id] [[:datetime (mt/id :times :dt)] [:text-as-datetime (mt/id :times :as_dt)]]
                op                  [:get-year :get-quarter :get-month :get-day
                                     :get-day-of-week :get-hour :get-minute :get-second]
                {:keys [expected-fn query-fn]}
                qp.datetime-test/extraction-test-cases]
          (testing (format "extract %s function works as expected on %s column for driver %s" op col-type driver/*driver*)
            (is (= (set (expected-fn op)) (set (qp.datetime-test/test-temporal-extract (query-fn op field-id))))))))

      (testing "works with literal value"
        (let [ops [:get-year :get-quarter :get-month :get-day
                   :get-day-of-week :get-hour :get-minute :get-second]]
          (is (= {:get-day         3
                  :get-day-of-week 2
                  :get-hour        7
                  :get-minute      10
                  :get-month       10
                  :get-quarter     4
                  :get-second      20
                  :get-year        2022}
                 (->> (mt/run-mbql-query times
                        {:expressions (into {} (for [op ops]
                                                 [(name op) [op "2022-10-03T07:10:20"]]))
                         :fields      (into [] (for [op ops] [:expression (name op)]))})
                      (mt/formatted-rows (repeat int))
                      first
                      (zipmap ops))))))

      (testing "with timestamptz columns"
        (mt/with-report-timezone-id "Asia/Kabul"
          (is (= (if (or (= driver/*driver* :sqlserver)
                         (driver/supports? driver/*driver* :set-timezone))
                   {:get-year        2004,
                    :get-quarter     1,
                    :get-month       1,
                    :get-day         1,
                    :get-day-of-week 5,
                    ;; TIMEZONE FIXME these drivers are returning the extracted hours in
                    ;; the timezone that they were inserted in
                    ;; maybe they need explicit convert-timezone to the report-tz before extraction?
                    :get-hour        (case driver/*driver*
                                       (:sqlserver :presto :presto-jdbc :snowflake :oracle) 5
                                       2),
                    :get-minute      (case driver/*driver*
                                       (:sqlserver :presto :presto-jdbc :snowflake :oracle) 19
                                       49),
                    :get-second      9}
                   {:get-year        2003,
                    :get-quarter     4,
                    :get-month       12,
                    :get-day         31,
                    :get-day-of-week 4,
                    :get-hour        22,
                    :get-minute      19,
                    :get-second      9})
                 (let [ops [:get-year :get-quarter :get-month :get-day
                            :get-day-of-week :get-hour :get-minute :get-second]]
                   (->> (mt/mbql-query times {:expressions (into {"shifted-day"  [:datetime-subtract $dt_tz 78 :day]
                                                                  ;; the idea is to extract a column with value = 2004-01-01 02:49:09 +04:30
                                                                  ;; this way the UTC value is 2003-12-31 22:19:09 +00:00 which will make sure
                                                                  ;; the year, quarter, month, day, week is extracted correctly
                                                                  ;; TODO: it's better to use a literal for this, but the function is not working properly
                                                                  ;; with OffsetDatetime for all drivers, so we'll go wit this for now
                                                                  "shifted-hour" [:datetime-subtract [:expression "shifted-day"] 4 :hour]}
                                                                 (for [op ops]
                                                                   [(name op) [op [:expression "shifted-hour"]]]))
                                              :fields      (into [] (for [op ops] [:expression (name op)]))
                                              :filter      [:= $index 1]
                                              :limit       1})
                        mt/process-query
                        (mt/formatted-rows (repeat int))
                        first
                        (zipmap ops))))))))))

(deftest temporal-extraction-with-filter-expresion-tests
  (mt/test-driver :mongo
    (mt/dataset mongo-times-mixed
      (doseq [{:keys [title expected query]}
              [{:title    "Nested expression"
                :expected [2004]
                :query    {:expressions {"expr" [:abs [:get-year [:field (mt/id :times :dt) nil]]]}
                           :filter      [:= [:field (mt/id :times :index) nil] 1]
                           :fields      [[:expression "expr"]]}}

               {:title     "Nested with arithmetic"
                :expected  [4008]
                :query     {:expressions {"expr" [:* [:get-year [:field (mt/id :times :dt) nil]] 2]}
                            :filter      [:= [:field (mt/id :times :index) nil] 1]
                            :fields      [[:expression "expr"]]}}

               {:title    "Filter using the extracted result - equality"
                :expected [1]
                :query    {:filter [:= [:get-year [:field (mt/id :times :dt) nil]] 2004]
                           :fields [[:field (mt/id :times :index) nil]]}}

               {:title    "Filter using the extracted result - comparable"
                :expected [1]
                :query    {:filter [:< [:get-year [:field (mt/id :times :dt) nil]] 2005]
                           :fields [[:field (mt/id :times :index) nil]]}}

               {:title    "Nested expression in fitler"
                :expected [1]
                :query    {:filter [:= [:* [:get-year [:field (mt/id :times :dt) nil]] 2] 4008]
                           :fields [[:field (mt/id :times :index) nil]]}}]]
        (testing title
          (is (= expected (qp.datetime-test/test-temporal-extract query))))))))

(deftest temporal-extraction-with-datetime-arithmetic-expression-tests
  (mt/test-driver :mongo
    (mt/dataset mongo-times-mixed
      (doseq [{:keys [title expected query]}
              [{:title    "Nested interval addition expression"
                :expected [2005]
                :query    {:expressions {"expr" [:abs [:get-year [:+ [:field (mt/id :times :dt) nil] [:interval 1 :year]]]]}
                           :filter      [:= [:field (mt/id :times :index) nil] 1]
                           :fields      [[:expression "expr"]]}}

               {:title    "Interval addition nested in numeric addition"
                :expected [2006]
                :query    {:expressions {"expr" [:+ [:get-year [:+ [:field (mt/id :times :dt) nil] [:interval 1 :year]]] 1]}
                           :filter      [:= [:field (mt/id :times :index) nil] 1]
                           :fields      [[:expression "expr"]]}}]]
        (testing title
          (is (= expected (qp.datetime-test/test-temporal-extract query))))))))

(deftest expr-test
  (mt/test-driver
    :mongo
    (testing "Should use $expr for simple comparisons and ops for others"
      (are [x y] (partial= {:query [{"$match" x}]}
                           (mt/compile (mt/mbql-query venues {:filter y})))
        {"price" 100}
        [:= $price 100]

        {"price" {"$ne" 100}}
        [:!= $price 100]

        {"price" {"$gt" 100}}
        [:> $price 100]

        {"price" {"$gte" 100}}
        [:>= $price 100]

        {"price" {"$lt" 100}}
        [:< $price 100]

        {"price" {"$lte" 100}}
        [:<= $price 100]

        {"name" {"$regex" "hello"}}
        [:contains $name "hello"]

        {"name" {"$regex" "^hello"}}
        [:starts-with $name "hello"]

        {"$and" [{:$expr {"$eq" ["$price" {"$add" ["$price" 1]}]}} {"name" "hello"}]}
        [:and [:= $price [:+ $price 1]] [:= $name "hello"]]

        {:$expr {"$eq" ["$price" "$price"]}}
        [:= $price $price]

        {:$expr {"$eq" [{"$add" ["$price" 1]} 100]}}
        [:= [:+ $price 1] 100]

        {:$expr {"$eq" ["$price" {"$add" [{"$subtract" ["$price" 5]} 100]}]}}
        [:= $price [:+ [:- $price 5] 100]]))))
