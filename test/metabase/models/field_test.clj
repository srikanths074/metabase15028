(ns metabase.models.field-test
  "Tests for specific behavior related to the Field model."
  (:require
   [clojure.test :refer :all]
   [metabase.models.database :refer [Database]]
   [metabase.models.field :refer [Field]]
   [metabase.models.serialization.hash :as serdes.hash]
   [metabase.models.table :refer [Table]]
   [metabase.test :as mt]
   [metabase.util :as u]
   [metabase.util.honeysql-extensions :as hx]
   [toucan.db :as db]))

(deftest nfc-field->parent-identifier-test
  (testing "It replaces the last identifier member"
    (let [nfc-identifier (hx/identifier :field "boop" "beep" "boop -> deep")
          new-identifier (#'metabase.models.field/nfc-field->parent-identifier
                           nfc-identifier
                           {:nfc_path ["something" "boppity"]})]
      (is (= (hx/identifier :field "boop" "beep" "something") new-identifier)))))

(deftest unknown-types-test
  (doseq [{:keys [column unknown-type fallback-type]} [{:column        :base_type
                                                        :unknown-type  :type/Amazing
                                                        :fallback-type :type/*}
                                                       {:column        :effective_type
                                                        :unknown-type  :type/Amazing
                                                        :fallback-type :type/*}
                                                       {:column        :semantic_type
                                                        :unknown-type  :type/Amazing
                                                        :fallback-type nil}
                                                       {:column        :coercion_strategy
                                                        :unknown-type  :Coercion/Amazing
                                                        :fallback-type nil}]]
    (testing (format "Field with unknown %s in DB should fall back to %s" column fallback-type)
      (mt/with-temp Field [field]
        (db/execute! {:update Field
                      :set    {column (u/qualified-name unknown-type)}
                      :where  [:= :id (u/the-id field)]})
        (is (= fallback-type
               (db/select-one-field column Field :id (u/the-id field))))))
    (testing (format "Should throw an Exception if you attempt to save a Field with an invalid %s" column)
      (is (thrown-with-msg?
           clojure.lang.ExceptionInfo
           (re-pattern (format "Invalid value for Field column %s: %s is not a descendant of any of these types:"
                               column unknown-type))
           (mt/with-temp Field [field {column unknown-type}]
             field))))))

(deftest identity-hash-test
  (testing "Field hashes are composed of the name and the table's identity-hash"
    (mt/with-temp* [Database [db    {:name "field-db" :engine :h2}]
                    Table    [table {:schema "PUBLIC" :name "widget" :db_id (:id db)}]
                    Field    [field {:name "sku" :table_id (:id table)}]]
      (let [table-hash (serdes.hash/identity-hash table)]
        (is (= "dfd77225"
               (serdes.hash/raw-hash ["sku" table-hash])
               (serdes.hash/identity-hash field)))))))
