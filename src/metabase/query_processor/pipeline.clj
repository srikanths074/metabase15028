(ns metabase.query-processor.pipeline
  (:require
   [clojure.core.async :as a]
   [metabase.config :as config]
   [metabase.driver :as driver]
   [metabase.query-processor.error-type :as qp.error-type]
   [metabase.util :as u]
   [metabase.util.i18n :as i18n]
   [metabase.util.log :as log]))

(def ^:dynamic ^clojure.core.async.impl.channels.ManyToManyChannel *canceled-chan*
  "If this channel is bound, you can send it a message to cancel the query. You can check if it has received a message
  to see if the query has been canceled.

  This should be bound to a [[clojure.core.async/promise-chan]] so it can be polled freely without messages being
  consumed."
  nil)

(defn canceled?
  "Whether the current query execution has been canceled."
  []
  (some-> *canceled-chan* a/poll!))

(defn ^:dynamic *result*
  "Called exactly once with the final result, which is the result of either [[reducef]] or [[raisef]]."
  [result]
  (if (instance? Throwable result)
    (throw result)
    result))

(defn ^:dynamic *execute*
  "Called by [[*run*]] to have driver run query. By default, [[metabase.driver/execute-reducible-query]]. `respond` is a
  callback with the signature:

    (respond results-metadata reducible-rows)

  The implementation of [[executef]] should call `respond` with this information once it is available. The result of
  this function is ignored."
  [driver query respond]
  (when-not (canceled?)
    (let [context {:canceled-chan *canceled-chan*}]
      (driver/execute-reducible-query driver query context respond))))

(defn ^:dynamic *reduce*
  "Called by [[*run*]] (inside the `respond` callback provided by it) to reduce results of query. Reduces results, then
  calls [[*result*]] with the reduced results. results."
  [rff metadata reducible-rows]
  (when-not (canceled?)
    (let [[status rf-or-e] (try
                             [::ready-to-reduce (rff metadata)]
                             (catch Throwable e
                               [::error (ex-info (i18n/tru "Error building query results reducing function: {0}" (ex-message e))
                                                 {:type qp.error-type/qp, :rff rff}
                                                 e)]))
          [status result]  (case status
                             ::ready-to-reduce
                             (try
                               [::success (transduce identity rf-or-e reducible-rows)]
                               (catch Throwable e
                                 [::error (ex-info (i18n/tru "Error reducing result rows: {0}" (ex-message e))
                                                   {:type qp.error-type/qp}
                                                   e)]))

                             ::error
                             [status rf-or-e])]
      (case status
        ::success (*result* result)
        ::error   (throw result)))))

(defn ^:dynamic *run*
  "Function for running the query. Calls [[*execute*]], then [[*reduce*]] on the results."
  [query rff]
  (when-not (canceled?)
    (letfn [(respond [metadata reducible-rows]
              (*reduce* rff metadata reducible-rows))]
      (try
        (*execute* driver/*driver* query respond)
        (catch InterruptedException e
          (log/tracef e "Caught InterruptedException when executing query, this means the query was canceled. Ignoring exception.")
          ::cancel)))))

(def ^:dynamic ^Long *query-timeout-ms*
  "Maximum amount of time query is allowed to run, in ms."
  ;; I don't know if these numbers make sense, but my thinking is we want to enable (somewhat) long-running queries on
  ;; prod but for test and dev purposes we want to fail faster because it usually means I broke something in the QP
  ;; code
  (u/minutes->ms
   (if config/is-prod?
     20
     3)))
