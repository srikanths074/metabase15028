(ns metabase.models.segment-test
  (:require
   [clojure.test :refer :all]
   [metabase.models.database :refer [Database]]
   [metabase.models.revision :as revision]
   [metabase.models.segment :as segment :refer [Segment]]
   [metabase.models.serialization.hash :as serdes.hash]
   [metabase.models.table :refer [Table]]
   [metabase.test :as mt]
   [toucan.db :as db])
  (:import
   (java.time LocalDateTime)))

(set! *warn-on-reflection* true)

(deftest update-test
  (testing "Updating"
    (mt/with-temp Segment [{:keys [id]} {:creator_id (mt/user->id :rasta)}]
      (testing "you should not be able to change the creator_id of a Segment"
        (is (thrown-with-msg?
             Exception
             #"You cannot update the creator_id of a Segment"
             (db/update! Segment id {:creator_id (mt/user->id :crowberto)}))))

      (testing "you shouldn't be able to set it to `nil` either"
        (is (thrown-with-msg?
             Exception
             #"You cannot update the creator_id of a Segment"
             (db/update! Segment id {:creator_id nil}))))

      (testing "calling `update!` with a value that is the same as the current value shouldn't throw an Exception"
        (is (= true
               (db/update! Segment id {:creator_id (mt/user->id :rasta)})))))))

(deftest serialize-segment-test
  (mt/with-temp* [Database [{database-id :id}]
                  Table    [{table-id :id} {:db_id database-id}]
                  Segment  [segment        {:table_id   table-id
                                            :definition {:filter [:and [:> [:field 4 nil] "2014-10-19"]]}}]]
    (is (= {:id                      true
            :table_id                true
            :creator_id              (mt/user->id :rasta)
            :name                    "Toucans in the rainforest"
            :description             "Lookin' for a blueberry"
            :show_in_getting_started false
            :caveats                 nil
            :points_of_interest      nil
            :entity_id               (:entity_id segment)
            :definition              {:filter [:> [:field 4 nil] "2014-10-19"]}
            :archived                false}
           (into {} (-> (revision/serialize-instance Segment (:id segment) segment)
                        (update :id boolean)
                        (update :table_id boolean)))))))

(deftest diff-segments-test
  (mt/with-temp* [Database [{database-id :id}]
                  Table    [{table-id :id} {:db_id database-id}]
                  Segment  [segment        {:table_id   table-id
                                            :definition {:filter [:and [:> [:field 4 nil] "2014-10-19"]]}}]]
    (is (= {:definition  {:before {:filter [:> [:field 4 nil] "2014-10-19"]}
                          :after  {:filter [:between [:field 4 nil] "2014-07-01" "2014-10-19"]}}
            :description {:before "Lookin' for a blueberry"
                          :after  "BBB"}
            :name        {:before "Toucans in the rainforest"
                          :after  "Something else"}}
           (revision/diff-map
            Segment
            segment
            (assoc segment
                   :name        "Something else"
                   :description "BBB"
                   :definition  {:filter [:between [:field 4 nil] "2014-07-01" "2014-10-19"]})))))

  (testing "test case where definition doesn't change"
    (is (= {:name {:before "A"
                   :after  "B"}}
           (revision/diff-map
            Segment
            {:name        "A"
             :description "Unchanged"
             :definition  {:filter [:and [:> [:field 4 nil] "2014-10-19"]]}}
            {:name        "B"
             :description "Unchanged"
             :definition  {:filter [:and [:> [:field 4 nil] "2014-10-19"]]}}))))

  (testing "first version so comparing against nil"
    (is (= {:name        {:after "A"}
            :description {:after "Unchanged"}
            :definition  {:after {:filter [:and [:> [:field 4 nil] "2014-10-19"]]}}}
           (revision/diff-map
            Segment
            nil
            {:name        "A"
             :description "Unchanged"
             :definition  {:filter [:and [:> [:field 4 nil] "2014-10-19"]]}}))))

  (testing "removals only"
    (is (= {:definition {:before {:filter [:and [:> [:field 4 nil] "2014-10-19"] [:= 5 "yes"]]}
                         :after  {:filter [:and [:> [:field 4 nil] "2014-10-19"]]}}}
           (revision/diff-map
            Segment
            {:name        "A"
             :description "Unchanged"
             :definition  {:filter [:and [:> [:field 4 nil] "2014-10-19"] [:= 5 "yes"]]}}
            {:name        "A"
             :description "Unchanged"
             :definition  {:filter [:and [:> [:field 4 nil] "2014-10-19"]]}})))))

(deftest identity-hash-test
  (testing "Segment hashes are composed of the segment name and table identity-hash"
    (let [now (LocalDateTime/of 2022 9 1 12 34 56)]
      (mt/with-temp* [Database [db      {:name "field-db" :engine :h2}]
                      Table    [table   {:schema "PUBLIC" :name "widget" :db_id (:id db)}]
                      Segment  [segment {:name "big customers" :table_id (:id table) :created_at now}]]
        (is (= "be199b7c"
               (serdes.hash/raw-hash ["big customers" (serdes.hash/identity-hash table) now])
               (serdes.hash/identity-hash segment)))))))
