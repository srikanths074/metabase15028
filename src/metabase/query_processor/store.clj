(ns metabase.query-processor.store
  "The Query Processor Store caches resolved Tables and Fields for the duration of a query execution. Certain middleware
  handles resolving things like the query's source Table and any Fields that are referenced in a query, and saves the
  referenced objects in the store; other middleware and driver-specific query processor implementations use functions
  in the store to fetch those objects as needed.

  For example, a driver might be converting a Field ID clause (e.g. `[:field-id 10]`) to its native query language. It
  can fetch the underlying Metabase FieldInstance by calling `field`:

    (qp.store/field 10) ;; get Field 10

   Of course, it would be entirely possible to call `(t2/select-one Field :id 10)` every time you needed information about that Field,
  but fetching all Fields in a single pass and storing them for reuse is dramatically more efficient than fetching
  those Fields potentially dozens of times in a single query execution."
  (:require
   [metabase.lib :as lib]
   [metabase.lib.metadata.jvm :as lib.metadata.jvm]
   [metabase.lib.metadata.protocols :as lib.metadata.protocols]
   [metabase.lib.schema.id :as lib.schema.id]
   [metabase.util :as u]
   [metabase.util.i18n :refer [tru]]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]
   [pretty.core :as pretty]
   [toucan2.core :as t2]))

(set! *warn-on-reflection* true)

;;; ---------------------------------------------- Setting up the Store ----------------------------------------------

(def ^:private uninitialized-store
  (reify
    clojure.lang.IDeref
    (deref [_this]
      (throw (ex-info (tru "Error: Query Processor store is not initialized.") {})))))

(def ^:private ^:dynamic *store*
  "Dynamic var used as the QP store for a given query execution."
  uninitialized-store)

(defn initialized?
  "Is the QP store currently initialized?"
  []
  (not (identical? *store* uninitialized-store)))

(defn do-with-store
  "Execute `f` with an initialized `*store*` if one is not already bound."
  [f]
  (if (initialized?)
    (f)
    (binding [*store* (atom {})]
      (f))))

(defmacro with-store
  "Execute `body` with an initialized QP `*store*`. The `store` middleware takes care of setting up a store as needed
  for each query execution; you should have no need to use this macro yourself outside of that namespace."
  {:style/indent 0}
  [& body]
  `(do-with-store (fn [] ~@body)))

(def ^:private database-columns-to-fetch
  "Columns you should fetch for the Database referenced by the query before stashing in the store."
  [:id
   :engine
   :name
   :dbms_version
   :details
   :settings
   :is_audit])

(def ^:private DatabaseInstanceWithRequiredStoreKeys
  [:map
   [:id       ::lib.schema.id/database]
   [:engine   :keyword]
   [:name     ms/NonBlankString]
   [:details  :map]
   [:settings [:maybe :map]]])

(def ^:private table-columns-to-fetch
  "Columns you should fetch for any Table you want to stash in the Store."
  [:id
   :name
   :display_name
   :schema])

(def ^:private TableInstanceWithRequiredStoreKeys
  [:map
   [:schema [:maybe :string]]
   [:name   ms/NonBlankString]])

(def ^:private field-columns-to-fetch
  "Columns to fetch for and Field you want to stash in the Store. These get returned as part of the `:cols` metadata in
  query results. Try to keep this set pared down to just what's needed by the QP and frontend, since it has to be done
  for every MBQL query."
  [:base_type
   :coercion_strategy
   :database_type
   :description
   :display_name
   :effective_type
   :fingerprint
   :id
   :name
   :nfc_path
   :parent_id
   :semantic_type
   :settings
   :table_id
   :visibility_type])

(def ^:private FieldInstanceWithRequiredStorekeys
  [:map
   [:name          ms/NonBlankString]
   [:table_id      ms/PositiveInt]
   [:display_name  ms/NonBlankString]
   [:description   [:maybe :string]]
   [:database_type ms/NonBlankString]
   [:base_type     ms/FieldType]
   [:semantic_type [:maybe ms/FieldSemanticOrRelationType]]
   [:fingerprint   [:maybe :map]]
   [:parent_id     [:maybe ms/PositiveInt]]
   [:nfc_path      [:maybe [:sequential ms/NonBlankString]]]
   ;; there's a tension as we sometimes store fields from the db, and sometimes store computed fields. ideally we
   ;; would make everything just use base_type.
   [:effective_type    {:optional true} [:maybe ms/FieldType]]
   [:coercion_strategy {:optional true} [:maybe ms/CoercionStrategy]]])


;;; ------------------------------------------ Saving objects in the Store -------------------------------------------

(mu/defn store-database!
  "Store the Database referenced by this query for the duration of the current query execution. Throws an Exception if
  database is invalid or doesn't have all the required keys."
  [database :- DatabaseInstanceWithRequiredStoreKeys]
  (swap! *store* assoc :database database))

;; TODO ­ I think these can be made private

(mu/defn store-table!
  "Store a `table` in the QP Store for the duration of the current query execution. Throws an Exception if table is
  invalid or doesn't have all required keys."
  [table :- TableInstanceWithRequiredStoreKeys]
  (swap! *store* assoc-in [:tables (u/the-id table)] table))

(mu/defn store-field!
  "Store a `field` in the QP Store for the duration of the current query execution. Throws an Exception if field is
  invalid or doesn't have all required keys."
  [field :- FieldInstanceWithRequiredStorekeys]
  (swap! *store* assoc-in [:fields (u/the-id field)] field))


;;; ----------------------- Fetching objects from application DB, and saving them in the store -----------------------

(mu/defn ^:private db-id :- ms/PositiveInt
  []
  (or (get-in @*store* [:database :id])
      (throw (Exception. (tru "Cannot store Tables or Fields before Database is stored.")))))

(mu/defn fetch-and-store-database!
  "Fetch the Database this query will run against from the application database, and store it in the QP Store for the
  duration of the current query execution. If Database has already been fetched, this function will no-op. Throws an
  Exception if Table does not exist."
  [database-id :- ms/PositiveInt]
  (if-let [existing-db-id (get-in @*store* [:database :id])]
    ;; if there's already a DB in the Store, double-check it has the same ID as the one that we were asked to fetch
    (when-not (= existing-db-id database-id)
      (throw (ex-info (tru "Attempting to fetch second Database. Queries can only reference one Database.")
               {:existing-id existing-db-id, :attempted-to-fetch database-id})))
    ;; if there's no DB, fetch + save
    (store-database!
     (or (t2/select-one (into [:model/Database] database-columns-to-fetch) :id database-id)
         (throw (ex-info (tru "Database {0} does not exist." (str database-id))
                  {:database database-id}))))))

(def ^:private IDs
  [:maybe
   [:or
    [:set ms/PositiveInt]
    [:sequential ms/PositiveInt]]])

(mu/defn fetch-and-store-tables!
  "Fetch Table(s) from the application database, and store them in the QP Store for the duration of the current query
  execution. If Table(s) have already been fetched, this function will no-op. Throws an Exception if Table(s) do not
  exist."
  [table-ids :- IDs]
  ;; remove any IDs for Tables that have already been fetched
  (when-let [ids-to-fetch (seq (remove (set (keys (:tables @*store*))) table-ids))]
    (let [fetched-tables (t2/select (into [:model/Table] table-columns-to-fetch)
                           :id    [:in (set ids-to-fetch)]
                           :db_id (db-id))
          fetched-ids    (set (map :id fetched-tables))]
      ;; make sure all Tables in table-ids were fetched, or throw an Exception
      (doseq [id ids-to-fetch]
        (when-not (fetched-ids id)
          (throw
           (ex-info (tru "Failed to fetch Table {0}: Table does not exist, or belongs to a different Database." id)
             {:table id, :database (db-id)}))))
      ;; ok, now store them all in the Store
      (doseq [table fetched-tables]
        (store-table! table)))))

(mu/defn fetch-and-store-fields!
  "Fetch Field(s) from the application database, and store them in the QP Store for the duration of the current query
  execution. If Field(s) have already been fetched, this function will no-op. Throws an Exception if Field(s) do not
  exist."
  [field-ids :- IDs]
  ;; remove any IDs for Fields that have already been fetched
  (when-let [ids-to-fetch (seq (remove (set (keys (:fields @*store*))) field-ids))]
    (let [fetched-fields (t2/select
                          :model/Field
                          {:select    (for [column-kw field-columns-to-fetch]
                                        [(keyword (str "field." (name column-kw)))
                                         column-kw])
                           :from      [[:metabase_field :field]]
                           :left-join [[:metabase_table :table] [:= :field.table_id :table.id]]
                           :where     [:and
                                       [:in :field.id (set ids-to-fetch)]
                                       [:= :table.db_id (db-id)]]})
          fetched-ids    (set (map :id fetched-fields))]
      ;; make sure all Fields in field-ids were fetched, or throw an Exception
      (doseq [id ids-to-fetch]
        (when-not (fetched-ids id)
          (throw
           (ex-info (tru "Failed to fetch Field {0}: Field does not exist, or belongs to a different Database." id)
                    {:field id, :database (db-id)}))))
      ;; ok, now store them all in the Store
      (doseq [field fetched-fields]
        (store-field! field)))))


;;; ---------------------------------------- Fetching objects from the Store -----------------------------------------

(mu/defn database :- DatabaseInstanceWithRequiredStoreKeys
  "Fetch the Database referenced by the current query from the QP Store. Throws an Exception if valid item is not
  returned."
  []
  (or (:database @*store*)
      (throw (Exception. (tru "Error: Database is not present in the Query Processor Store.")))))

(defn- default-table
  "Default implementation of [[table]]."
  [table-id]
  (or (get-in @*store* [:tables table-id])
      (throw (Exception. (tru "Error: Table {0} is not present in the Query Processor Store." table-id)))))

(def ^:dynamic *table*
  "Implementation of [[table]]. Dynamic so this can be overridden as needed by tests."
  default-table)

(mu/defn table :- TableInstanceWithRequiredStoreKeys
  "Fetch Table with `table-id` from the QP Store. Throws an Exception if valid item is not returned."
  [table-id :- ms/PositiveInt]
  (*table* table-id))

(defn- default-field
  "Default implementation of [[field]]."
  [field-id]
  (or (get-in @*store* [:fields field-id])
      (throw (Exception. (tru "Error: Field {0} is not present in the Query Processor Store." field-id)))))

(def ^:dynamic *field*
  "Implementation of [[field]]. Dynamic so this can be overridden as needed by tests."
  default-field)

(mu/defn field :- FieldInstanceWithRequiredStorekeys
  "Fetch Field with `field-id` from the QP Store. Throws an Exception if valid item is not returned."
  [field-id :- ms/PositiveInt]
  (*field* field-id))


;;; ------------------------------------------ Caching Miscellaneous Values ------------------------------------------

(mu/defn store-miscellaneous-value!
  "Store a miscellaneous value in a the cache. Persists for the life of this QP invocation, including for recursive
  calls."
  [ks v]
  (swap! *store* assoc-in (cons :misc ks) v))

(mu/defn miscellaneous-value
  "Fetch a miscellaneous value from the cache. Unlike other Store functions, does not throw if value is not found."
  ([ks]
   (miscellaneous-value ks nil))

  ([ks not-found]
   (get-in @*store* (cons :misc ks) not-found)))

(defn cached-fn
  "Attempt to fetch a miscellaneous value from the cache using key sequence `ks`; if not found, runs `thunk` to get the
  value, stores it in the cache, and returns the value. You can use this to ensure a given function is only ran once
  during the duration of a QP execution.

  See also `cached` macro."
  {:style/indent 1}
  [ks thunk]
  (let [cached-value (miscellaneous-value ks ::not-found)]
    (if-not (= cached-value ::not-found)
      cached-value
      (let [v (thunk)]
        (store-miscellaneous-value! ks v)
        v))))

(defmacro cached
  "Cache the value of `body` for key(s) for the duration of this QP execution. (Body is only evaluated the once per QP
  run; subsequent calls return the cached result.)

  Note that each use of `cached` generates its own unique first key for cache keyseq; thus while it is not possible to
  share values between multiple `cached` forms, you do not need to worry about conflicts with other places using this
  macro.

    ;; cache lookups of Card.dataset_query
    (qp.store/cached card-id
      (t2/select-one-fn :dataset_query Card :id card-id))"
  {:style/indent 1}
  [k-or-ks & body]
  ;; for the unique key use a gensym prefixed by the namespace to make for easier store debugging if needed
  (let [ks (into [(list 'quote (gensym (str (name (ns-name *ns*)) "/misc-cache-")))] (u/one-or-many k-or-ks))]
    `(cached-fn ~ks (fn [] ~@body))))

(defn- base-metadata-provider []
  (reify
    lib.metadata.protocols/MetadataProvider
    (database [_this]
      (some-> (database) (update-keys u/->kebab-case-en) (assoc :lib/type :metadata/database)))

    (table [_this table-id]
      (some-> (table table-id) (update-keys u/->kebab-case-en) (assoc :lib/type :metadata/table)))

    (field [_this field-id]
      (some-> (field field-id) (update-keys u/->kebab-case-en) (assoc :lib/type :metadata/column)))

    (card [_this _card-id] nil)
    (metric [_this _metric-id] nil)
    (segment [_this _segment-id] nil)
    (tables [_metadata-provider] nil)
    (fields [_metadata-provider _table-id] nil)
    (metrics [_metadata-provider _table-id] nil)

    pretty/PrettyPrintable
    (pretty [_this]
      `metadata-provider)))

(defn metadata-provider
  "Create a new MLv2 metadata provider that uses the QP store."
  []
  (cached ::metadata-provider
    (lib/composed-metadata-provider
     (base-metadata-provider)
     (lib.metadata.jvm/application-database-metadata-provider (:id (database))))))
