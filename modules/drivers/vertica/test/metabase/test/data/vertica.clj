(ns metabase.test.data.vertica
  "Code for creating / destroying a Vertica database from a `DatabaseDefinition`."
  (:require
   [clojure.data.csv :as csv]
   [clojure.java.jdbc :as jdbc]
   [clojure.string :as str]
   [clojure.test :refer :all]
   [java-time.api :as t]
   [medley.core :as m]
   [metabase.driver.sql-jdbc.connection :as sql-jdbc.conn]
   [metabase.driver.sql-jdbc.execute :as sql-jdbc.execute]
   [metabase.lib.schema.common :as lib.schema.common]
   [metabase.test :as mt]
   [metabase.test.data.dataset-definitions]
   [metabase.test.data.interface :as tx]
   [metabase.test.data.sql :as sql.tx]
   [metabase.test.data.sql-jdbc :as sql-jdbc.tx]
   [metabase.test.data.sql-jdbc.execute :as execute]
   [metabase.test.data.sql-jdbc.load-data :as load-data]
   [metabase.util :as u]
   [metabase.util.files :as u.files]
   [metabase.util.malli :as mu]
   [metabase.util.malli.registry :as mr]
   [metabase.util.random :as u.random]))

(set! *warn-on-reflection* true)

(sql-jdbc.tx/add-test-extensions! :vertica)

;; In ORDER BY clause, nulls come last for FLOAT, STRING, and BOOLEAN columns, and first otherwise
;; https://www.vertica.com/docs/9.2.x/HTML/Content/Authoring/AnalyzingData/Optimizations/NULLPlacementByAnalyticFunctions.htm#2
(defmethod tx/sorts-nil-first? :vertica [_ base-type]
  (not (contains? #{:type/Text :type/Boolean :type/Float}
                  base-type)))

(doseq [[base-type sql-type] {:type/BigInteger     "BIGINT"
                              :type/Boolean        "BOOLEAN"
                              :type/Char           "VARCHAR(254)"
                              :type/Date           "DATE"
                              :type/DateTime       "TIMESTAMP"
                              :type/DateTimeWithTZ "TIMESTAMP WITH TIME ZONE"
                              :type/Decimal        "NUMERIC"
                              :type/Float          "FLOAT"
                              :type/Integer        "INTEGER"
                              :type/Text           "VARCHAR(1024)"
                              :type/Time           "TIME"
                              :type/TimeWithTZ     "TIMETZ"}]
  (defmethod sql.tx/field-base-type->sql-type [:vertica base-type] [_ _] sql-type))

(mu/defn- db-name :- :string
  []
  (tx/db-test-env-var-or-throw :vertica :db "VMart"))

(def ^:private db-connection-details
  (delay {:host     (tx/db-test-env-var-or-throw :vertica :host "localhost")
          :port     (Integer/parseInt (tx/db-test-env-var-or-throw :vertica :port "5433"))
          :user     (tx/db-test-env-var :vertica :user "dbadmin")
          :password (tx/db-test-env-var :vertica :password)
          :db       (db-name)
          :timezone :America/Los_Angeles}))

(defmethod tx/dbdef->connection-details :vertica [& _] @db-connection-details)

(mu/defmethod sql.tx/qualified-name-components :vertica
  ([_driver _db-name]
   [(db-name)])

  ([_driver
    db-name    :- :string
    table-name :- :string]
   ["public" (tx/db-qualified-table-name db-name table-name)])

  ([_driver
    db-name    :- :string
    table-name :- :string
    field-name :- :string]
   ["public" (tx/db-qualified-table-name db-name table-name) field-name]))

(defmethod sql.tx/create-db-sql         :vertica [& _] nil)
(defmethod sql.tx/drop-db-if-exists-sql :vertica [& _] nil)

(defmethod sql.tx/drop-table-if-exists-sql :vertica
  [& args]
  (apply sql.tx/drop-table-if-exists-cascade-sql args))

(defn- dbspec []
  (sql-jdbc.conn/connection-details->spec :vertica @db-connection-details))

;; TODO = explain...

(defmulti ^:private value->csv
  {:arglists '([value])}
  class)

(defmethod value->csv :default
  [v]
  (str v))

(defmethod value->csv java.time.ZonedDateTime
  [t]
  (value->csv (t/offset-date-time t)))

(defmethod value->csv String
  [s]
  ;; escape commas
  (str/escape s {\, "\\,"}))

(defmethod value->csv clojure.lang.IPersistentVector
  [xs]
  (throw (ex-info (if (keyword? (first xs))
                    "Cannot insert rows containing HoneySQL calls: insert the appropriate raw value instead"
                    "Don't know how to convert a vector to CSV")
                  {:value xs})))

(defn- dump-table-rows-to-csv!
  "Dump a sequence of rows (as vectors) to a CSV file."
  [{:keys [field-definitions rows]} ^String filename]
  (try
    (let [has-custom-pk? (when-let [pk (not-empty (sql.tx/fielddefs->pk-field-names field-definitions))]
                           (not= ["id"] pk))
          column-names   (cond->> (mapv :field-name field-definitions)
                           (not has-custom-pk?)
                           (cons "id"))
          rows-with-id (for [[i row] (m/indexed rows)]
                         (cond->> (for [v row]
                                    (value->csv v))
                           (not has-custom-pk?)
                           (cons (inc i))))

          csv-rows     (cons column-names rows-with-id)]
      (try
        (with-open [writer (java.io.FileWriter. (java.io.File. filename))]
          (csv/write-csv writer csv-rows :quote? (constantly false)))
        (catch Throwable e
          (throw (ex-info "Error writing rows to CSV" {:rows (take 10 csv-rows)} e)))))
    (catch Throwable e
      (throw (ex-info "Error dumping rows to CSV" {:filename filename} e)))))

(deftest dump-row-with-commas-to-csv-test
  (testing "Values with commas in them should get escaped correctly"
    (let [table-def     {:table-name        "products"
                         :field-definitions [{:field-name "vendor"
                                              :base-type  :type/Text}]
                         :rows              [["Pouros, Nitzsche and Mayer"]]}
          temp-filename (str (u.files/get-path (System/getProperty "java.io.tmpdir") "vertica-csv-test.csv"))]
      (dump-table-rows-to-csv! table-def temp-filename)
      (is (= ["id,vendor"
              "1,Pouros\\, Nitzsche and Mayer"]
             (str/split-lines (slurp temp-filename)))))))

(mu/defn- load-rows-from-csv!
  "Load rows from a CSV file into a Table."
  [driver                                   :- :keyword
   conn                                     :- (lib.schema.common/instance-of-class java.sql.Connection)
   {:keys [database-name], :as _dbdef}      :- [:map [:database-name :string]]
   {:keys [table-name rows], :as _tabledef} :- [:map [:table-name :string]]
   filename                                 :- :string]
  (let [table-identifier (sql.tx/qualify-and-quote driver database-name table-name)]
    (letfn [(execute! [sql]
              (try
                (jdbc/execute! {:connection conn} sql)
                (catch Throwable e
                  (throw (ex-info "Error executing SQL" {:sql sql, :spec (dbspec)} e)))))
            (actual-rows []
              (u/ignore-exceptions
                (jdbc/query {:connection conn}
                            (format "SELECT * FROM %s ORDER BY id ASC;" table-identifier))))]
      (try
        ;; make sure the Table is empty
        (execute! (format "TRUNCATE TABLE %s" table-identifier))
        ;; load the rows from the CSV file
        (let [[num-rows-inserted] (execute! (format "COPY %s FROM LOCAL '%s' DELIMITER ','"
                                                    table-identifier
                                                    filename))]
          ;; it should return the number of rows inserted; make sure this matches what we expected
          (when-not (= num-rows-inserted (count rows))
            (throw (ex-info (format "Expected %d rows to be inserted, but only %d were" (count rows) num-rows-inserted)
                            {:inserted-rows (take 100 (actual-rows))}))))
        ;; make sure SELECT COUNT(*) matches as well
        (let [[{actual-num-rows :count}] (jdbc/query {:connection conn}
                                                     (format "SELECT count(*) FROM %s;" table-identifier))]
          (when-not (= actual-num-rows (count rows))
            (throw (ex-info (format "Expected count(*) to return %d, but only got %d" (count rows) actual-num-rows)
                            {:inserted-rows (take 100 (actual-rows))}))))
        ;; success!
        :ok
        (catch Throwable e
          (throw (ex-info "Error loading rows from CSV file"
                          {:filename filename
                           :rows     (take 10 (str/split-lines (slurp filename)))}
                          e)))))))

(mr/def ::load-data-chunk-info
  [:map
   [::dbdef    [:map [:database-name :string]]]
   [::tabledef [:map [:table-name :string]]]
   [::filename :string]])

(mu/defmethod load-data/do-insert! :vertica
  [driver            :- :keyword
   conn              :- (lib.schema.common/instance-of-class java.sql.Connection)
   _table-identifier
   chunk-info        :- ::load-data-chunk-info]
  (try
    (load-rows-from-csv! driver conn (::dbdef chunk-info) (::tabledef chunk-info) (::filename chunk-info))
    (catch Throwable e
      (throw (ex-info (format "Error loading rows: %s" (ex-message e))
                      {:info chunk-info}
                      e)))))

(defmethod load-data/chunk-size :vertica
  [_driver _dbdef _tabledef]
  nil)

(defmethod load-data/chunk-xform :vertica
  [_driver dbdef tabledef]
  (map (fn [_chunk]
         (let [filename (str (u.files/get-path (System/getProperty "java.io.tmpdir") (u.random/random-name)))]
           (dump-table-rows-to-csv! tabledef filename)
           {::dbdef    dbdef
            ::tabledef tabledef
            ::filename filename}))))

(deftest load-data-from-csv-test
  (testing "Make sure the dump-data-to-CSV stuff actually works as expected"
    (mt/test-driver :vertica
      (let [dbdef    (tx/get-dataset-definition metabase.test.data.dataset-definitions/test-data)
            tabledef (m/find-first
                      #(= (:table-name %) "categories")
                      (:table-definitions dbdef))
            chunks   (into [] (#'load-data/reducible-chunks :vertica dbdef tabledef))]
        (is (malli= [:sequential {:min 1, :max 1} ::load-data-chunk-info]
                    chunks))
        (let [filename (::filename (first chunks))]
          (is (= [["id" "name"]
                  ["1" "African"]
                  ["2" "American"]]
                 (take 3 (csv/read-csv (slurp filename))))))))))

(defmethod sql.tx/pk-sql-type :vertica [& _] "INTEGER")

(defmethod execute/execute-sql! :vertica [& args]
  (apply execute/sequentially-execute-sql! args))

(defmethod tx/before-run :vertica
  [_]
  ;; Close all existing sessions connected to our test DB
  (jdbc/query (dbspec) "SELECT CLOSE_ALL_SESSIONS();")
  ;; Increase the connection limit; the default is 5 or so which causes tests to fail when too many connections are made
  (jdbc/execute! (dbspec) (format "ALTER DATABASE \"%s\" SET MaxClientSessions = 1000;" (db-name))))

(defmethod tx/aggregate-column-info :vertica
  ([driver ag-type]
   (merge
    ((get-method tx/aggregate-column-info ::tx/test-extensions) driver ag-type)
    (when (#{:count :cum-count} ag-type)
      {:base_type :type/Integer})))

  ([driver ag-type field]
   (merge
    ((get-method tx/aggregate-column-info ::tx/test-extensions) driver ag-type field)
    (when (#{:count :cum-count} ag-type)
      {:base_type :type/Integer}))))

(defmethod tx/dataset-already-loaded? :vertica
  [driver dbdef]
  ;; check and make sure the first table in the dbdef has been created.
  (let [tabledef       (first (:table-definitions dbdef))
        ;; table-name should be something like test_data_venues
        table-name     (tx/db-qualified-table-name (:database-name dbdef) (:table-name tabledef))]
    (sql-jdbc.execute/do-with-connection-with-options
     driver
     (sql-jdbc.conn/connection-details->spec driver @db-connection-details)
     {:write? false}
     (fn [^java.sql.Connection conn]
       (with-open [rset (.getTables (.getMetaData conn)
                                    #_catalog        (db-name)
                                    #_schema-pattern "public"
                                    #_table-pattern  table-name
                                    #_types          (into-array String ["TABLE"]))]
         ;; if the ResultSet returns anything we know the table is already loaded.
         (.next rset))))))
