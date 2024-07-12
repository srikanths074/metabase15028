(ns metabase.task.backfill-query-fields-test
  (:require
   [clojure.set :as set]
   [clojure.test :refer :all]
   [metabase.lib.core :as lib]
   [metabase.lib.metadata :as lib.metadata]
   [metabase.lib.metadata.jvm :as lib.metadata.jvm]
   [metabase.models :refer [Card]]
   [metabase.query-analysis :as query-analysis]
   [metabase.task.backfill-query-fields :as backfill]
   [metabase.test :as mt]
   [metabase.util :as u]
   [metabase.util.queue :as queue]
   [toucan2.core :as t2]))

(deftest backfill-query-field-test
  (let [metadata-provider (lib.metadata.jvm/application-database-metadata-provider (mt/id))
        venues            (lib.metadata/table metadata-provider (mt/id :venues))
        venues-name       (lib.metadata/field metadata-provider (mt/id :venues :name))
        mlv2-query        (-> (lib/query metadata-provider venues)
                              (lib/aggregate (lib/distinct venues-name)))]
    (mt/with-temp [Card c1   {:query_type    "native"
                              :dataset_query (mt/native-query {:query "SELECT id FROM venues"})}
                   Card c2   {:query_type    "native"
                              :dataset_query (mt/native-query {:query         "SELECT id FROM venues WHERE name = {{ name }}"
                                                               :template-tags {"name" {:id           "_name_"
                                                                                       :type         :text
                                                                                       :display-name "name"
                                                                                       :default      "qwe"}}})}
                   Card c3   {:query_type    "query"
                              :dataset_query (mt/mbql-query venues {:aggregation [[:distinct $name]]})}
                   Card c4   {:query_type    "query"
                              :dataset_query mlv2-query}
                   Card arch {:archived      true
                              :query_type    "native"
                              :dataset_query (mt/native-query {:query "SELECT id FROM venues"})}]

      (t2/delete! :model/QueryField :card_id [:in (map :id [c1 c2 c3 c4 arch])])
      (queue/clear! @#'query-analysis/queue)

      (#'backfill/backfill-query-fields!)

      (let [queued-ids   (atom #{})
            relevant-ids (into #{} (map :id) [c1 c2 c3 c4 arch])
            expected-ids (into #{} (map :id [c1 c2 c3 c4]))]
        (try
          (u/with-timeout 10
            (while true (swap! queued-ids conj (query-analysis/next-card-id!))))
          (catch Exception _))
        (is (= expected-ids (set/intersection @queued-ids relevant-ids)))))))
