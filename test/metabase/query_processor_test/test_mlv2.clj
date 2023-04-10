(ns metabase.query-processor-test.test-mlv2
  (:require
   [clojure.test :as t :refer :all]
   [malli.core :as mc]
   [malli.error :as me]
   [metabase.lib.convert :as lib.convert]
   [metabase.lib.schema :as lib.schema]
   [metabase.mbql.util :as mbql.u]
   [metabase.util :as u]))

(set! *warn-on-reflection* true)

(defn- do-with-legacy-query-testing-context [query thunk]
  (testing (format "\nlegacy query =\n%s\n" (u/pprint-to-str query))
    (thunk)))

(defn- do-with-pMBQL-query-testing-context [pMBQL thunk]
  (testing (format "\npMBQL =\n%s\n" (u/pprint-to-str pMBQL))
    (thunk)))

(defn- skip-conversion-tests?
  "Whether to skip conversion tests against a `legacy-query`."
  [legacy-query]
  (or
   ;; #29745: missing schema for `:var`
   (mbql.u/match-one legacy-query
     :var
     "#29745")
   ;; #29747: schema for `:relative-datetime` current without a unit is broken
   (mbql.u/match-one legacy-query
     [:relative-datetime :current]
     "#29747")
   ;; #29898: `:joins` with `:fields` other than `:all` or `:none` are not normalized correctly.
   (mbql.u/match-one legacy-query
     {:joins joins}
     (mbql.u/match-one joins
       {:fields fields}
       (mbql.u/match-one fields
         :field
         "#29898")))
   ;; #29897: `:datetime-diff` is not handled correctly.
   (mbql.u/match-one legacy-query
     :datetime-diff
     "#29897")
   ;; #29904: `:fields` in `:joins` are supposed to be returned even if `:fields` is specified.
   (mbql.u/match-one legacy-query
     {:fields fields, :joins joins}
     (mbql.u/match-one joins
       {:fields (join-fields :guard (partial not= :none))}
       "#29904"))
   ;; #29895: `:value` is not supported
   (mbql.u/match-one legacy-query
     :value
     "#29895")
   ;; #29908: native queries do not round trip correctly
   (when (:native legacy-query)
     "#29908")
   ;; #29909: these clauses are not implemented yet.
   (mbql.u/match-one legacy-query
     #{:get-year :get-quarter :get-month :get-day :get-day-of-week :get-hour :get-minute :get-second}
     "#29909")
   ;; #29770: `:absolute-datetime` does not work correctly
   (mbql.u/match-one legacy-query
     :absolute-datetime
     "#29770")
   ;; #29938: conversion for `:case` with default value does not work correctly
   (mbql.u/match-one legacy-query
     :case
     (mbql.u/match-one &match
       {:default _default}
       "#29938"))
   ;; #29942: missing schema for `:cum-sum` and `:cum-count` aggregations
   (mbql.u/match-one legacy-query
     #{:cum-sum :cum-count}
     "#29942")
   ;; #29946: nested arithmetic expressions wrapping a `:field` clause
   (mbql.u/match-one legacy-query
     #{:+ :- :*}
     (mbql.u/match-one &match
       #{:+ :- :*}
       (mbql.u/match-one &match
         :field
         "#29946")))
   ;; #29948: `:substring` is broken
   (mbql.u/match-one legacy-query
     :substring
     "#29948")
   ;; #29949: missing schema
   (mbql.u/match-one legacy-query
     :regex-match-first
     "#29949")
   ;; #29950: string filter clauses with options like `:case-sensitive` option not handled correctly
   (mbql.u/match-one legacy-query
     {:case-sensitive _case-sensitive?}
     "#29950")
   ;; #29953: `:aggregation` and `:expression` refs with `nil` options
   (mbql.u/match-one legacy-query
     [:aggregation _index nil] "#29953"
     [:expression _name nil]   "#29953")))

(defn- test-mlv2-conversion [query]
  (when-not (skip-conversion-tests? query)
    (do-with-legacy-query-testing-context
     query
     (^:once fn* []
      (let [pMBQL (-> query lib.convert/->pMBQL)]
        (do-with-pMBQL-query-testing-context
         pMBQL
         (^:once fn* []
          (testing "Legacy MBQL queries should round trip to pMBQL and back"
            (is (= query
                   (-> pMBQL lib.convert/->legacy-MBQL))))
          (testing "converted pMBQL query should validate against the pMBQL schema"
            (is (not (me/humanize (mc/explain ::lib.schema/query pMBQL))))))))))))

(defn around-middleware
  "Tests only: save the original legacy MBQL query immediately after normalization to `::original-query`."
  [qp]
  (fn [query rff context]
    ;; there seems to be a issue in Hawk JUnit output if it encounters a test assertion when [[t/*testing-vars*]] is
    ;; empty, which can be the case if the assertion happens inside of a fixture before a test is ran (e.g. queries ran
    ;; as the result of syncing a database happening inside a test fixture); in this case we still want to run our
    ;; tests, so create some fake test var context so it doesn't fail.
    (if (empty? t/*testing-vars*)
      (binding [t/*testing-vars* [#'test-mlv2-conversion]]
        (test-mlv2-conversion query))
      (test-mlv2-conversion query))
    (qp query rff context)))
