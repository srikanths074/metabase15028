(ns metabase.driver.drill
  (:require [clojure.java.jdbc :as jdbc]
            (clojure [set :as set]
                     [string :as s])
            (honeysql [core :as hsql]
                      [helpers :as h])
            [metabase.db.spec :as dbspec]
            [metabase.driver :as driver]
            [metabase.driver.generic-sql :as sql]
            [metabase.driver.hive-like :as hive-like]
            [metabase.driver.bigquery :as bigquery]
            [metabase.util :as u]
            [metabase.util.honeysql-extensions :as hx]
            [metabase.query-processor.util :as qputil])
  (:import
   (java.util Collections Date)
   (metabase.query_processor.interface DateTimeValue Value)))

(def ^:const column->base-type
  "Map of Drill column types -> Field base types.
   Add more mappings here as you come across them."
  {;; Numeric types
   :BIGINT :type/BigInteger
   :BINARY :type/*
   :BOOLEAN :type/Boolean
   :DATE :type/Date
   :DECIMAL :type/Decimal
   :DEC :type/Decimal
   :NUMERIC :type/Decimal
   :FLOAT :type/Float
   :DOUBLE :type/Float
   (keyword "DOUBLE PRECISION") :type/Float
   :INTEGER :type/Integer
   :INT :type/Integer
   :INTERVAL :type/*
   :SMALLINT :type/Integer
   :TIME :type/Time
   :TIMESTAMP :type/DateTime
   (keyword "CHARACTER VARYING") :type/Text
   (keyword "CHARACTER") :type/Text
   (keyword "CHAR") :type/Text
   :VARCHAR :type/Text})

(defn drill
  "Create a database specification for a Drill cluster. Opts should include
  :drill-connect."
  [{:keys [drill-connect]
    :or {drill-connect "drillbit=localhost"}
    :as opts}]
  (merge {:classname "org.apache.drill.jdbc.Driver" ; must be in classpath
          :subprotocol "drill"
          :subname drill-connect}
         (dissoc opts :drill-connect)))

(defn- connection-details->spec [details]
  (-> details
      drill
      (sql/handle-additional-options details)))

(defn- can-connect? [details]
  (let [connection (connection-details->spec details)]
    (= 1 (first (vals (first (jdbc/query connection ["SELECT 1 FROM (VALUES(1)) LIMIT 1"])))))))

(defn- date-format [format-str expr]
  (hsql/call :to_char expr (hx/literal format-str)))

(defn- str-to-date [format-str expr]
  (hsql/call :to_timestamp expr (hx/literal format-str)))

(defn- trunc-with-format [format-str expr]
  (str-to-date format-str (date-format format-str expr)))

(defn date [unit expr]
  (case unit
    :default (hx/->timestamp expr)
    :minute (hsql/call :date_trunc_minute (hx/->timestamp expr))
    :minute-of-hour (hx/->integer (date-format "mm" expr))
    :hour (hsql/call :date_trunc_hour (hx/->timestamp expr))
    :hour-of-day (hsql/call :extract "hour" (hx/->timestamp expr))
    :day (hsql/call :date_trunc_day (hx/->timestamp expr))
    :day-of-week (hx/->integer (date-format "e"
                                            (hx/+ (hx/->timestamp expr)
                                                  (hsql/raw "interval '1' day"))))
    :day-of-month (hsql/call :extract "day" (hx/->timestamp expr))
    :day-of-year (hx/->integer (date-format "D" (hx/->timestamp expr)))
    :week (hx/- (hsql/call :date_trunc_week (hx/+ (hx/->timestamp expr)
                                                  (hsql/raw "interval '1' day")))
                (hsql/raw "interval '1' day"))
    :week-of-year (hx/->integer (date-format "ww" (hx/->timestamp expr)))
    :month (hsql/call :date_trunc_month (hx/->timestamp expr))
    :month-of-year (hx/->integer (date-format "MM" (hx/->timestamp expr)))
    :quarter (hx/+ (hsql/call :date_trunc_year (hx/->timestamp expr))
                   (hx/* (hx// (hx/- (hsql/call :extract "month" (hx/->timestamp expr))
                                     1)
                               3)
                         (hsql/raw "INTERVAL '3' MONTH")))
    ;; quarter gives incorrect results in Drill 1.10
    ;;:quarter (hsql/call :date_trunc_quarter (hx/->timestamp expr))
    :quarter-of-year (hx/->integer
                      (hsql/call :ceil
                                 (hx// (hsql/call :extract
                                                  "month"
                                                  (hx/->timestamp expr))
                                       3.0)))
    :year (hsql/call :extract "year" (hx/->timestamp expr))))

(defprotocol ^:private IDrillUnprepare
  (drill-unprepare-arg ^String [this]))

(extend-protocol IDrillUnprepare
  nil     (drill-unprepare-arg [this] "NULL")
  String  (drill-unprepare-arg [this] (str \' (s/replace this "'" "''") \')) ; escape single-quotes
  Boolean (drill-unprepare-arg [this] (if this "TRUE" "FALSE"))
  Number  (drill-unprepare-arg [this] (str this))
  Date    (drill-unprepare-arg [this] (first (hsql/format
                                                 (hsql/call :to_timestamp
                                                   (hx/literal (u/date->iso-8601 this))
                                                   (hx/literal "YYYY-MM-dd''T''HH:mm:ss.SSSZ"))))))

(defn- drill-unprepare
  "Convert a normal SQL `[statement & prepared-statement-args]` vector into a flat, non-prepared statement."
  ^String [[sql & args]]
  (loop [sql sql, [arg & more-args, :as args] args]
    (if-not (seq args)
      sql
      (recur (s/replace-first sql #"(?<!\?)\?(?!\?)" (drill-unprepare-arg arg))
             more-args))))

(defn execute-query
  "Process and run a native (raw SQL) QUERY."
  [driver {:keys [database settings], query :native, :as outer-query}]
  (let [query (-> (assoc query :remark (qputil/query->remark outer-query))
                  (assoc :query (if (seq (:params query))
                                  (drill-unprepare (cons (:query query) (:params query)))
                                  (:query query)))
                  (dissoc :params))]
    (hive-like/do-with-try-catch
     (fn []
       (let [db-connection (sql/db->jdbc-connection-spec database)]
         (hive-like/run-query-without-timezone driver settings db-connection query))))))

;; This provides an implementation of `prepare-value` that prevents HoneySQL from converting forms to prepared statement parameters (`?`)
;; TODO - Move this into `metabase.driver.generic-sql` and document it as an alternate implementation for `prepare-value` (?)
;;        Or perhaps investigate a lower-level way to disable the functionality in HoneySQL, perhaps by swapping out a function somewhere
(defprotocol ^:private IPrepareValue
  (^:private prepare-value [this]))
(extend-protocol IPrepareValue
  nil (prepare-value [_] nil)
  DateTimeValue (prepare-value [{:keys [value]}] (prepare-value value))
  Value (prepare-value [{:keys [value]}] (prepare-value value))
  String (prepare-value [this] (hx/literal this))
  Boolean (prepare-value [this] (hsql/raw (if this "TRUE" "FALSE")))
  Date (prepare-value [this] (hsql/call :to_timestamp
                                        (hx/literal (u/date->iso-8601 this))
                                        (hx/literal "YYYY-MM-dd''T''HH:mm:ss.SSSZ")))
  Number (prepare-value [this] this)
  Object (prepare-value [this] (throw (Exception. (format "Don't know how to prepare value %s %s" (class this) this)))))

(defn date-interval [unit amount]
  (hsql/raw (format "(NOW() + INTERVAL '%d' %s(%d))" (int amount) (name unit)
                    (count (str amount)))))

(defrecord DrillDriver []
  clojure.lang.Named
  (getName [_] "Drill"))

(u/strict-extend DrillDriver
                 driver/IDriver
                 (merge (sql/IDriverSQLDefaultsMixin)
                        {:can-connect? (u/drop-first-arg can-connect?)
                         :date-interval (u/drop-first-arg date-interval)
                         :describe-table-fks (constantly #{})
                         :details-fields (constantly [{:name "drill-connect"
                                                       :display-name "Drill connect string"
                                                       :default "drillbit=localhost or zk=localhost:2181/drill/cluster-id"}])
                         :execute-query execute-query
                         :features (constantly #{:basic-aggregations
                                                 :standard-deviation-aggregations
                                                 ;;:foreign-keys
                                                 :expressions
                                                 :expression-aggregations
                                                 :native-parameters})})
                 sql/ISQLDriver
                 (merge (sql/ISQLDriverDefaultsMixin)
                        {:apply-aggregation bigquery/apply-aggregation
                         :column->base-type (u/drop-first-arg column->base-type)
                         :connection-details->spec (u/drop-first-arg connection-details->spec)
                         :date (u/drop-first-arg date)
                         :field->identifier (u/drop-first-arg hive-like/field->identifier)
                         :prepare-value (u/drop-first-arg prepare-value)
                         :quote-style (constantly :mysql)
                         :current-datetime-fn (u/drop-first-arg (constantly hive-like/now))
                         :string-length-fn (u/drop-first-arg hive-like/string-length-fn)
                         :unix-timestamp->timestamp (u/drop-first-arg hive-like/unix-timestamp->timestamp)}))

(driver/register-driver! :drill (DrillDriver.))
