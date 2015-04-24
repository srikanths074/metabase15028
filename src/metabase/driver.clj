(ns metabase.driver
  (:require clojure.java.classpath
            [clojure.tools.logging :as log]
            [clojure.tools.namespace.find :as ns-find]
            [cheshire.core :as cheshire]
            [medley.core :refer :all]
            [metabase.db :refer [exists? ins sel upd]]
            (metabase.driver [result :as result])
            (metabase.models [database :refer [Database]]
                             [query-execution :refer [QueryExecution]])
            [metabase.util :as u]))

(declare -dataset-query query-fail query-complete save-query-execution)

;; TODO - look this up at runtime
(def ^:const available-drivers
  "DB drivers that are available (pairs of `[namespace user-facing-name]`)."
  [["h2" "H2"]
   ["postgres" "PostgreSQL"]])

(defprotocol IDriver
  ;; Connection
  (can-connect? [this database]
    "Check whether we can connect to DATABASE and perform a simple query.
     (To check whether we can connect to a database given only its details, use `can-connect-with-details?` instead).

       (can-connect? (sel :one Database :id 1))")

  (can-connect-with-details? [this details-map]
    "Check whether we can connect to a database and performa a simple query.
     Returns true if we can, otherwise returns false or throws an Exception.

       (can-connect-with-details? {:engine :postgres, :dbname \"book\", ...})")

  ;; Syncing
  (sync-database! [this database]
    "Sync DATABASE and all its Tables and Fields.")

  (sync-table! [this table]
    "Sync TABLE and all its Fields.")

  ;; Query Processing
  (process-query [this query]
    "Process a native or structured query."))


;; ## Driver Lookup

(def ^{:arglists '([engine])} engine->driver
  (memoize
   (fn [engine]
     (let [ns-symb (symbol (format "metabase.driver.%s" (name engine)))]
       (require ns-symb)
       (var-get (ns-resolve ns-symb 'driver))))))

;; Can the type of a DB change?
(def ^{:arglists '([database-id])} database-id->driver
  (memoize
   (fn [database-id]
     (engine->driver (sel :one :field [Database :engine] :id database-id)))))


;; ## Implementation-Agnostic Driver API

(defn driver-can-connect? [database]
  (can-connect? ^IDriver (engine->driver (:engine database)) database))

(defn driver-can-connect-with-details [details])

(defn driver-sync-database! [database]
  (sync-database! ^IDriver (engine->driver (:engine database)) database))

(defn driver-sync-table! [table]
  (sync-table! ^IDriver (database-id->driver (:db_id table)) table))

(defn driver-process-query [query]
  (process-query ^IDriver (database-id->driver (:database query)) query))

;; ## DEPRECATED API -- Pending Removal

(defn connection [database]
  nil)


;; ## Query Execution Stuff

(defn- execute-query
  "Process and run a query and return results."
  [{:keys [type] :as query}]
  (case (keyword type)
    :native (driver-process-query query)
    :query (driver-process-query query)
    :result (result/process-and-run query)))

(defn dataset-query
  "Process and run a json based dataset query and return results.

  Takes 2 arguments:

  1.  the json query as a dictionary
  2.  query execution options specified in a dictionary

  Depending on the database specified in the query this function will delegate to a driver specific implementation.
  For the purposes of tracking we record each call to this function as a QueryExecution in the database.

  Possible caller-options include:

    :executed_by [int]               (user_id of caller)
    :saved_query [{}]                (dictionary representing Query model)
    :synchronously [true|false]      (default true)
    :cache_result [true|false]       (default false)"
  {:arglists '([query caller-options])}
  [query {:keys [executed_by synchronously saved_query]
          :or {synchronously true}
          :as caller-options}]
  {:pre [(integer? executed_by)]}
  (let [options (merge {:cache_result false} caller-options)
        query-execution {:uuid (.toString (java.util.UUID/randomUUID))
                         :executor_id executed_by
                         :json_query query
                         :query_id (:id saved_query)
                         :version (get saved_query :version 0)
                         :status :starting
                         :error ""
                         :started_at (u/new-sql-timestamp)
                         :finished_at (u/new-sql-timestamp)
                         :running_time 0
                         :result_rows 0
                         :result_file ""
                         :result_data "{}"
                         :raw_query ""
                         :additional_info ""}]
    (if synchronously
      (-dataset-query query options query-execution)
      ;; TODO - this is untested/used.  determine proper way to place execution on background thread
      (let [query-execution (-> (save-query-execution query-execution)
                                ;; this is a bit lame, but to avoid having the delay fns in the dictionary we are
                                ;; trimming them right here.  maybe there is a better way?
                                (select-keys [:id :uuid :executor :query_id :version :status :started_at]))]
        ;; run the query, but do it on another thread
        (future (-dataset-query query options query-execution))
        ;; this ensures the currently saved query-execution is what gets returned
        query-execution))))

(defn -dataset-query
  "Execute a query and record the outcome.  Entire execution is wrapped in a try-catch to prevent Exceptions
  from leaking outside the function call."
  [query options query-execution]
  (let [query-execution (assoc query-execution :start_time_millis (System/currentTimeMillis))]
    (try
      (let [query-result (execute-query query)]
        (when-not (contains? query-result :status)
          (throw (Exception. "invalid response from database driver. no :status provided")))
        (when (= :failed (:status query-result))
          (throw (Exception. ^String (get query-result :error "general error"))))
        (query-complete query-execution query-result (:cache_result options)))
      (catch Exception ex
        (log/warn ex)
        (query-fail query-execution (.getMessage ex))))))


(defn query-fail
  "Save QueryExecution state and construct a failed query response"
  [query-execution error-message]
  (let [updates {:status :failed
                 :error error-message
                 :finished_at (u/new-sql-timestamp)
                 :running_time (- (System/currentTimeMillis) (:start_time_millis query-execution))}]
    ;; record our query execution and format response
    (-> query-execution
        (dissoc :start_time_millis)
        (merge updates)
        (save-query-execution)
        ;; this is just for the response for clien
        (assoc :error error-message
               :row_count 0
               :data {:rows []
                      :cols []
                      :columns []}))))

(defn query-complete
  "Save QueryExecution state and construct a completed (successful) query response"
  [query-execution query-result cache-result]
  ;; record our query execution and format response
  (-> (u/assoc* query-execution
                   :status :completed
                   :finished_at (u/new-sql-timestamp)
                   :running_time (- (System/currentTimeMillis) (:start_time_millis <>))
                   :result_rows (get query-result :row_count 0)
                   :result_data (if cache-result
                                  (cheshire/generate-string (:data query-result))
                                  "{}"))
      (dissoc :start_time_millis)
      (save-query-execution)
      ;; at this point we've saved and we just need to massage things into our final response format
      (select-keys [:id :uuid])
      (merge query-result)))


(defn save-query-execution
  [{:keys [id] :as query-execution}]
  (if id
    ;; execution has already been saved, so update it
    (do
      (mapply upd QueryExecution id query-execution)
      query-execution)
    ;; first time saving execution, so insert it
    (mapply ins QueryExecution query-execution)))
