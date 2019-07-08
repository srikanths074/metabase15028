(ns metabase.driver.sql.query-processor
  "The Query Processor is responsible for translating the Metabase Query Language into HoneySQL SQL forms."
  (:require [clojure.string :as str]
            [clojure.tools.logging :as log]
            [honeysql
             [core :as hsql]
             [format :as hformat]
             [helpers :as h]]
            [metabase
             [driver :as driver]
             [util :as u]]
            [metabase.mbql
             [schema :as mbql.s]
             [util :as mbql.u]]
            [metabase.models
             [field :as field :refer [Field]]
             [table :refer [Table]]]
            [metabase.query-processor
             [interface :as i]
             [store :as qp.store]]
            [metabase.query-processor.middleware.annotate :as annotate]
            [metabase.util
             [honeysql-extensions :as hx]
             [i18n :refer [tru]]
             [schema :as su]]
            [schema.core :as s])
  (:import metabase.util.honeysql_extensions.Identifier))

;; TODO - yet another `*query*` dynamic var. We should really consolidate them all so we only need a single one.
(def ^:dynamic *query*
  "The outer query currently being processed.
  (This is only used to power `[:aggregation <index>]` and expression references, because they need to be able to find
  the corresponding clauses outside of where they're being processed.)"
  nil)

(def ^:dynamic *nested-query-level*
  "How many levels deep are we into nested queries? (0 = top level.) We keep track of this so we know what level to
  find referenced aggregations (otherwise something like [:aggregation 0] could be ambiguous in a nested query).
  Each nested query increments this counter by 1."
  0)

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                            Interface (Multimethods)                                            |
;;; +----------------------------------------------------------------------------------------------------------------+

(defmulti current-datetime-fn
  "HoneySQL form that should be used to get the current `datetime` (or equivalent). Defaults to `:%now`."
  {:arglists '([driver])}
  driver/dispatch-on-initialized-driver
  :hierarchy #'driver/hierarchy)

(defmethod current-datetime-fn :sql [_] :%now)


(defmulti date
  "Return a HoneySQL form for truncating a date or timestamp field or value to a given resolution, or extracting a date
  component."
  {:arglists '([driver unit field-or-value])}
  (fn [driver unit _] [(driver/dispatch-on-initialized-driver driver) unit])
  :hierarchy #'driver/hierarchy)

;; default implementation for `:default` bucketing returns expression as-is
(defmethod date [:sql :default] [_ _ expr] expr)


(defmulti field->identifier
  "Return a HoneySQL form that should be used as the identifier for `field`, an instance of the Field model. The default
  implementation returns a keyword generated by from the components returned by `field/qualified-name-components`.
  Other drivers like BigQuery need to do additional qualification, e.g. the dataset name as well. (At the time of this
  writing, this is only used by the SQL parameters implementation; in the future it will probably be used in more
  places as well.)"
  {:arglists '([driver field])}
  driver/dispatch-on-initialized-driver
  :hierarchy #'driver/hierarchy)

(defmethod field->identifier :sql [_ field]
  (apply hsql/qualify (field/qualified-name-components field)))


(defmulti ^String field->alias
  "Return the string alias that should be used to for `field`, an instance of the Field model, i.e. in an `AS` clause.
  The default implementation calls `:name`, which returns the *unqualified* name of the Field.

  Return `nil` to prevent `field` from being aliased."
  {:arglists '([driver field])}
  driver/dispatch-on-initialized-driver
  :hierarchy #'driver/hierarchy)

(defmethod field->alias :sql [_ field]
  (:name field))


(defmulti quote-style
  "Return the quoting style that should be used by [HoneySQL](https://github.com/jkk/honeysql) when building a SQL
  statement. Defaults to `:ansi`, but other valid options are `:mysql`, `:sqlserver`, `:oracle`, and `:h2` (added in
  `metabase.util.honeysql-extensions`; like `:ansi`, but uppercases the result).

    (hsql/format ... :quoting (quote-style driver), :allow-dashed-names? true)"
  {:arglists '([driver])}
  driver/dispatch-on-initialized-driver
  :hierarchy #'driver/hierarchy)

(defmethod quote-style :sql [_] :ansi)


(defmulti unix-timestamp->timestamp
  "Return a HoneySQL form appropriate for converting a Unix timestamp integer field or value to an proper SQL Timestamp.
  `seconds-or-milliseconds` refers to the resolution of the int in question and with be either `:seconds` or
  `:milliseconds`.

  There is a default implementation for `:milliseconds` the recursively calls with `:seconds` and `(expr / 1000)`."
  {:arglists '([driver seconds-or-milliseconds field-or-value])}
  (fn [driver seconds-or-milliseconds _] [(driver/dispatch-on-initialized-driver driver) seconds-or-milliseconds])
  :hierarchy #'driver/hierarchy)

(defmethod unix-timestamp->timestamp [:sql :milliseconds] [driver _ expr]
  (unix-timestamp->timestamp driver :seconds (hx// expr 1000)))


(defmulti apply-top-level-clause
  "Implementations of this methods define how the SQL Query Processor handles various top-level MBQL clauses. Each
  method is called when a matching clause is present in `query`, and should return an appropriately modified version
  of `honeysql-form`. Most drivers can use the default implementations for all of these methods, but some may need to
  override one or more (e.g. SQL Server needs to override this method for the `:limit` clause, since T-SQL uses `TOP`
  instead of `LIMIT`)."
  {:arglists '([driver top-level-clause honeysql-form query]), :style/indent 2}
  (fn [driver top-level-clause _ _]
    [(driver/dispatch-on-initialized-driver driver) top-level-clause])
  :hierarchy #'driver/hierarchy)

(defmethod apply-top-level-clause :default [_ _ honeysql-form _]
  honeysql-form)

;; this is the primary way to override behavior for a specific clause or object class.

(defmulti ->honeysql
  "Return an appropriate HoneySQL form for an object. Dispatches off both driver and either clause name or object class
  making this easy to override in any places needed for a given driver."
  {:arglists '([driver x]), :style/indent 1}
  (fn [driver x]
    [(driver/dispatch-on-initialized-driver driver) (mbql.u/dispatch-by-clause-name-or-class x)])
  :hierarchy #'driver/hierarchy)


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                           Low-Level ->honeysql impls                                           |
;;; +----------------------------------------------------------------------------------------------------------------+

(defmethod ->honeysql [:sql nil]    [_ _]    nil)
(defmethod ->honeysql [:sql Object] [_ this] this)

(defmethod ->honeysql [:sql :value] [driver [_ value]] (->honeysql driver value))

(defmethod ->honeysql [:sql :expression]
  [driver [_ expression-name]]
  ;; Unfortunately you can't just refer to the expression by name in other clauses like filter, but have to use the
  ;; original formula.
  (->honeysql driver (mbql.u/expression-with-name *query* expression-name)))

(defn cast-unix-timestamp-field-if-needed
  "Wrap a `field-identifier` in appropriate HoneySQL expressions if it refers to a UNIX timestamp Field."
  [driver field field-identifier]
  (condp #(isa? %2 %1) (:special_type field)
    :type/UNIXTimestampSeconds      (unix-timestamp->timestamp driver :seconds      field-identifier)
    :type/UNIXTimestampMilliseconds (unix-timestamp->timestamp driver :milliseconds field-identifier)
    field-identifier))

;; default implmentation is a no-op; other drivers can override it as needed
(defmethod ->honeysql [:sql Identifier]
  [_ identifier]
  identifier)

(def ^:dynamic *table-alias*
  "The alias, if any, that should be used to qualify Fields when building the HoneySQL form, instead of defaulting to
  schema + Table name. Used to implement things like `:joined-field`s."
  nil)

(defmethod ->honeysql [:sql (class Field)]
  [driver {field-name :name, table-id :table_id, :as field}]
  ;; `indentifer` will automatically unnest nested calls to `identifier`
  (let [qualifiers (if *table-alias*
                     [*table-alias*]
                     (let [{schema :schema, table-name :name} (qp.store/table table-id)]
                       [schema table-name]))
        identifier (->honeysql driver (apply hx/identifier :field (concat qualifiers [field-name])))]
    (cast-unix-timestamp-field-if-needed driver field identifier)))

(defmethod ->honeysql [:sql :field-id]
  [driver [_ field-id]]
  (->honeysql driver (qp.store/field field-id)))

(defmethod ->honeysql [:sql :field-literal]
  [driver [_ field-name]]
  (->honeysql driver (hx/identifier :field *table-alias* field-name)))

(defmethod ->honeysql [:sql :joined-field]
  [driver [_ alias field]]
  (binding [*table-alias* alias]
    (->honeysql driver field)))

(defmethod ->honeysql [:sql :datetime-field]
  [driver [_ field unit]]
  (date driver unit (->honeysql driver field)))

(defmethod ->honeysql [:sql :binning-strategy]
  [driver [_ field _ _ {:keys [bin-width min-value max-value]}]]
  (let [honeysql-field-form (->honeysql driver field)]
    ;;
    ;; Equation is | (value - min) |
    ;;             | ------------- | * bin-width + min-value
    ;;             |_  bin-width  _|
    ;;
    (-> honeysql-field-form
        (hx/- min-value)
        (hx// bin-width)
        hx/floor
        (hx/* bin-width)
        (hx/+ min-value))))


(defmethod ->honeysql [:sql :count] [driver [_ field]]
  (if field
    (hsql/call :count (->honeysql driver field))
    :%count.*))

(defmethod ->honeysql [:sql :avg]      [driver [_ field]] (hsql/call :avg            (->honeysql driver field)))
(defmethod ->honeysql [:sql :distinct] [driver [_ field]] (hsql/call :distinct-count (->honeysql driver field)))
(defmethod ->honeysql [:sql :stddev]   [driver [_ field]] (hsql/call :stddev         (->honeysql driver field)))
(defmethod ->honeysql [:sql :sum]      [driver [_ field]] (hsql/call :sum            (->honeysql driver field)))
(defmethod ->honeysql [:sql :min]      [driver [_ field]] (hsql/call :min            (->honeysql driver field)))
(defmethod ->honeysql [:sql :max]      [driver [_ field]] (hsql/call :max            (->honeysql driver field)))

(defmethod ->honeysql [:sql :+] [driver [_ & args]]
  (if (mbql.u/datetime-arithmetics? args)
    (let [[field & intervals] args]
      (reduce (fn [result [_ amount unit]]
                (driver/date-add driver result amount unit))
              (->honeysql driver field)
              intervals))
    (apply hsql/call :+ (map (partial ->honeysql driver) args))))

(defmethod ->honeysql [:sql :-] [driver [_ & args]] (apply hsql/call :- (map (partial ->honeysql driver) args)))
(defmethod ->honeysql [:sql :*] [driver [_ & args]] (apply hsql/call :* (map (partial ->honeysql driver) args)))

;; for division we want to go ahead and convert any integer args to floats, because something like field / 2 will do
;; integer division and give us something like 1.0 where we would rather see something like 1.5
;;
;; also, we want to gracefully handle situations where the column is ZERO and just swap it out with NULL instead, so
;; we don't get divide by zero errors. SQL DBs always return NULL when dividing by NULL (AFAIK)
(defmethod ->honeysql [:sql :/]
  [driver [_ & args]]
  (let [args (for [arg args]
               (->honeysql driver (if (integer? arg)
                                    (double arg)
                                    arg)))]
    (apply hsql/call :/ (first args) (for [arg (rest args)]
                                       (hsql/call :case
                                         (hsql/call := arg 0) nil
                                         :else                arg)))))

(defmethod ->honeysql [:sql :sum-where]
  [driver [_ arg pred]]
  (hsql/call :sum (hsql/call :case
                    (->honeysql driver pred) (->honeysql driver arg)
                    :else                    0.0)))

(defmethod ->honeysql [:sql :count-where]
  [driver [_ pred]]
  (->honeysql driver [:sum-where 1 pred]))

(defmethod ->honeysql [:sql :share]
  [driver [_ pred]]
  (hsql/call :/ (->honeysql driver [:count-where pred]) :%count.*))

;; actual handling of the name is done in the top-level clause handler for aggregations
(defmethod ->honeysql [:sql :named] [driver [_ ag ag-name]]
  (->honeysql driver ag))

;;  aggregation REFERENCE e.g. the ["aggregation" 0] fields we allow in order-by
(defmethod ->honeysql [:sql :aggregation]
  [driver [_ index]]
  (mbql.u/match-one (mbql.u/aggregation-at-index *query* index *nested-query-level*)
    [:named _ ag-name & _]
    (->honeysql driver (hx/identifier :field-alias ag-name))

    ;; For some arcane reason we name the results of a distinct aggregation "count", everything else is named the
    ;; same as the aggregation
    :distinct
    (->honeysql driver (hx/identifier :field-alias :count))

    #{:+ :- :* :/}
    (->honeysql driver &match)

    ;; for everything else just use the name of the aggregation as an identifer, e.g. `:sum`
    ;; TODO - this obviously doesn't work right for multiple aggregations of the same type
    [ag-type & _]
    (->honeysql driver (hx/identifier :field-alias ag-type))))

(defmethod ->honeysql [:sql :absolute-datetime]
  [driver [_ timestamp unit]]
  (date driver unit (->honeysql driver timestamp)))

(defmethod ->honeysql [:sql :time]
  [driver [_ value unit]]
  (date driver unit (->honeysql driver value)))

(defmethod ->honeysql [:sql :relative-datetime]
  [driver [_ amount unit]]
  (date driver unit (if (zero? amount)
                      (current-datetime-fn driver)
                      (driver/date-add driver (current-datetime-fn driver) unit amount))))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                            Field Aliases (AS Forms)                                            |
;;; +----------------------------------------------------------------------------------------------------------------+

(s/defn field-clause->alias
  "Generate HoneySQL for an approriate alias (e.g., for use with SQL `AN`) for a Field clause of any type, or `nil` if
  the Field should not be aliased (e.g. if `field->alias` returns `nil`).

  Optionally pass a state-maintaining `unique-name-fn`, such as `mbql.u/unique-name-generator`, to guarantee that each
  alias generated is unique when generating a sequence of aliases, such as for a `SELECT` clause."
  ([driver field-clause]
   (field-clause->alias driver field-clause identity))

  ([driver, field-clause :- mbql.s/Field, unique-name-fn :- (s/pred fn?)]
   (when-let [alias (mbql.u/match-one field-clause
                      [:expression expression-name] expression-name
                      [:field-literal field-name _] field-name
                      [:field-id id]                (field->alias driver (qp.store/field id)))]
     (->honeysql driver (hx/identifier :field-alias (unique-name-fn alias))))))

(defn as
  "Generate HoneySQL for an `AS` form (e.g. `<form> AS <field>`) using the name information of a `field-clause`. The
  HoneySQL representation of on `AS` clause is a tuple like `[<form> <alias>]`.

  In some cases where the alias would be redundant, such as unwrapped field literals, this returns the form as-is.

    (as [:field-literal \"x\" :type/Text])
    ;; -> <compiled-form>
    ;; -> SELECT \"x\"

    (as [:datetime-field [:field-literal \"x\" :type/Text] :month])
    ;; -> [<compiled-form> :x]
    ;; -> SELECT date_extract(\"x\", 'month') AS \"x\"

  As with `field-clause->alias`, you can pass a `unique-name-fn` to generate unique names for a sequence of aliases,
  such as for a `SELECT` clause."
  ([driver field-clause]
   (as driver field-clause identity))

  ([driver field-clause unique-name-fn]
   (let [honeysql-form (->honeysql driver field-clause)]
     (if-let [alias (field-clause->alias driver field-clause unique-name-fn)]
       [honeysql-form alias]
       honeysql-form))))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                Clause Handlers                                                 |
;;; +----------------------------------------------------------------------------------------------------------------+

;;; -------------------------------------------------- aggregation ---------------------------------------------------

(defmethod apply-top-level-clause [:sql :aggregation]
  [driver _ honeysql-form {aggregations :aggregation}]
  (let [honeysql-ags (for [ag aggregations]
                       [(->honeysql driver ag)
                        (->honeysql driver (hx/identifier
                                            :field-alias
                                            (driver/format-custom-field-name driver (annotate/aggregation-name ag))))])]
    (reduce h/merge-select honeysql-form honeysql-ags)))

;;; ----------------------------------------------- breakout & fields ------------------------------------------------

(defmethod apply-top-level-clause [:sql :breakout]
  [driver _ honeysql-form {breakout-fields :breakout, fields-fields :fields :as query}]
  (as-> honeysql-form new-hsql
    (apply h/merge-select new-hsql (for [field-clause breakout-fields
                                         :when        (not (contains? (set fields-fields) field-clause))]
                                     (as driver field-clause)))
    (apply h/group new-hsql (map (partial ->honeysql driver) breakout-fields))))

(defmethod apply-top-level-clause [:sql :fields]
  [driver _ honeysql-form {fields :fields}]
  (let [unique-name-fn (mbql.u/unique-name-generator)]
    (apply h/merge-select honeysql-form (for [field-clause fields]
                                          (as driver field-clause unique-name-fn)))))


;;; ----------------------------------------------------- filter -----------------------------------------------------

(defn- like-clause
  "Generate a SQL `LIKE` clause. `value` is assumed to be a `Value` object (a record type with a key `:value` as well as
  some sort of type info) or similar as opposed to a raw value literal."
  [driver field value options]
  ;; TODO - don't we need to escape underscores and percent signs in the pattern, since they have special meanings in
  ;; LIKE clauses? That's what we're doing with Druid...
  ;;
  ;; TODO - Postgres supports `ILIKE`. Does that make a big enough difference performance-wise that we should do a
  ;; custom implementation?
  (if (get options :case-sensitive true)
    [:like field                    (->honeysql driver value)]
    [:like (hsql/call :lower field) (->honeysql driver (update value 1 str/lower-case))]))

(s/defn ^:private update-string-value :- mbql.s/value
  [value :- (s/constrained mbql.s/value #(string? (second %)) "string value"), f]
  (update value 1 f))

(defmethod ->honeysql [:sql :starts-with] [driver [_ field value options]]
  (like-clause driver (->honeysql driver field) (update-string-value value #(str % \%)) options))

(defmethod ->honeysql [:sql :contains] [driver [_ field value options]]
  (like-clause driver (->honeysql driver field) (update-string-value value #(str \% % \%)) options))

(defmethod ->honeysql [:sql :ends-with] [driver [_ field value options]]
  (like-clause driver (->honeysql driver field) (update-string-value value #(str \% %)) options))

(defmethod ->honeysql [:sql :between] [driver [_ field min-val max-val]]
  [:between (->honeysql driver field) (->honeysql driver min-val) (->honeysql driver max-val)])


(defmethod ->honeysql [:sql :>] [driver [_ field value]]
  [:> (->honeysql driver field) (->honeysql driver value)])

(defmethod ->honeysql [:sql :<] [driver [_ field value]]
  [:< (->honeysql driver field) (->honeysql driver value)])

(defmethod ->honeysql [:sql :>=] [driver [_ field value]]
  [:>= (->honeysql driver field) (->honeysql driver value)])

(defmethod ->honeysql [:sql :<=] [driver [_ field value]]
  [:<= (->honeysql driver field) (->honeysql driver value)])

(defmethod ->honeysql [:sql :=] [driver [_ field value]]
  [:= (->honeysql driver field) (->honeysql driver value)])

(defmethod ->honeysql [:sql :!=] [driver [_ field value]]
  [:not= (->honeysql driver field) (->honeysql driver value)])


(defmethod ->honeysql [:sql :and] [driver [_ & subclauses]]
  (apply vector :and (map (partial ->honeysql driver) subclauses)))

(defmethod ->honeysql [:sql :or] [driver [_ & subclauses]]
  (apply vector :or (map (partial ->honeysql driver) subclauses)))

(defmethod ->honeysql [:sql :not] [driver [_ subclause]]
  [:not (->honeysql driver subclause)])

(defmethod apply-top-level-clause [:sql :filter]
  [driver _ honeysql-form {clause :filter}]
  (h/where honeysql-form (->honeysql driver clause)))


;;; -------------------------------------------------- join tables ---------------------------------------------------

(declare build-honeysql-form)

(defmulti join->honeysql
  "Compile a single MBQL `join` to HoneySQL."
  {:arglists '([driver join]), :style/indent 1}
  driver/dispatch-on-initialized-driver
  :hierarchy #'driver/hierarchy)

(defmulti join-source
  "Generate HoneySQL for a table or query to be joined."
  {:arglists '([driver join]), :style/indent 1}
  driver/dispatch-on-initialized-driver
  :hierarchy #'driver/hierarchy)

(defmethod join-source :sql
  [driver {:keys [source-table source-query]}]
  (binding [*table-alias* nil]
    (if source-query
      (build-honeysql-form driver {:query source-query})
      (->honeysql driver (qp.store/table source-table)))))

(def ^:private HoneySQLJoin
  "Schema for HoneySQL for a single JOIN. Used to validate that our join-handling code generates correct clauses."
  [(s/one
    [(s/one (s/pred some?) "join source")
     (s/one (s/pred some?) "join alias")]
    "join source and alias")
   (s/one (s/pred sequential?) "join condition")])

(s/defmethod join->honeysql :sql :- HoneySQLJoin
  [driver, {:keys [condition alias], :as join} :- mbql.s/Join]
  [[(join-source driver join)
    (->honeysql driver (hx/identifier :table-alias alias))]
   (->honeysql driver condition)])

(def ^:private join-strategy->merge-fn
  {:left-join  h/merge-left-join
   :right-join h/merge-right-join
   :inner-join h/merge-join
   :full-join  h/merge-full-join})

(defmethod apply-top-level-clause [:sql :joins]
  [driver _ honeysql-form {:keys [joins]}]
  (reduce
   (fn [honeysql-form {:keys [strategy], :as join}]
     (apply (join-strategy->merge-fn strategy) honeysql-form (join->honeysql driver join)))
   honeysql-form
   joins))


;;; ---------------------------------------------------- order-by ----------------------------------------------------

(defmethod ->honeysql [:sql :asc]
  [driver [direction field]]
  [(->honeysql driver field) direction])

(defmethod ->honeysql [:sql :desc]
  [driver [direction field]]
  [(->honeysql driver field) direction])

(defmethod apply-top-level-clause [:sql :order-by]
  [driver _ honeysql-form {subclauses :order-by}]
  (reduce h/merge-order-by honeysql-form (map (partial ->honeysql driver)
                                              subclauses)))

;;; -------------------------------------------------- limit & page --------------------------------------------------

(defmethod apply-top-level-clause [:sql :limit]
  [_ _ honeysql-form {value :limit}]
  (h/limit honeysql-form value))

(defmethod apply-top-level-clause [:sql :page]
  [_ _ honeysql-form {{:keys [items page]} :page}]
  (-> honeysql-form
      (h/limit items)
      (h/offset (* items (dec page)))))


;;; -------------------------------------------------- source-table --------------------------------------------------

(defmethod ->honeysql [:sql (class Table)]
  [driver table]
  (let [{table-name :name, schema :schema} table]
    (->honeysql driver (hx/identifier :table schema table-name))))

(defmethod apply-top-level-clause [:sql :source-table]
  [driver _ honeysql-form {source-table-id :source-table}]
  (h/from honeysql-form (->honeysql driver (qp.store/table source-table-id))))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                           Building the HoneySQL Form                                           |
;;; +----------------------------------------------------------------------------------------------------------------+

(def ^:private top-level-clause-application-order
  "Order to apply top-level clauses in. This is important because we build things like the `SELECT` clause progressively
  and MBQL requires us to return results with `:breakout` columns before `:aggregation`, etc.

  Map of clause -> index, e.g.

    {:source-table 0, :breakout 1, ...}"
  (into {} (map-indexed
            #(vector %2 %1)
            [:source-table :breakout :aggregation :fields :filter :joins :order-by :page :limit])))

(defn- query->keys-in-application-order
  "Return the keys present in an MBQL `inner-query` in the order they should be processed."
  [inner-query]
  ;; sort first by any known top-level clauses according to the `top-level-application-clause-order` defined above,
  ;; then sort any unknown clauses by name.
  (sort-by (fn [clause] [(get top-level-clause-application-order clause Integer/MAX_VALUE) clause])
           (keys inner-query)))

(defn- format-honeysql [driver honeysql-form]
  (try
    (binding [hformat/*subquery?* false]
      (hsql/format honeysql-form
        :quoting             (quote-style driver)
        :allow-dashed-names? true))
    (catch Throwable e
      (try
        (log/error (u/format-color 'red
                       (str (tru "Invalid HoneySQL form:")
                            "\n"
                            (u/pprint-to-str honeysql-form))))
        (finally
          (throw e))))))

(defn- add-default-select
  "Add `SELECT *` to `honeysql-form` if no `:select` clause is present."
  [driver {:keys [select], [from] :from, :as honeysql-form}]
  ;; TODO - this is hacky -- we should ideally never need to add `SELECT *`, because we should know what fields to
  ;; expect from the source query, and middleware should be handling that for us
  (cond-> honeysql-form
    (empty? select) (assoc :select (let [table-identifier (if (sequential? from)
                                                            (second from)
                                                            from)
                                         [raw-identifier] (format-honeysql driver table-identifier)]
                                     (if (seq raw-identifier)
                                       [(hsql/raw (format "%s.*" raw-identifier))]
                                       [:*])))))

(defn- apply-top-level-clauses
  "`apply-top-level-clause` for all of the top-level clauses in `inner-query`, progressively building a HoneySQL form.
  Clauses are applied according to the order in `top-level-clause-application-order`."
  [driver honeysql-form inner-query]
  (->> (reduce
        (fn [honeysql-form k]
          (apply-top-level-clause driver k honeysql-form inner-query))
        honeysql-form
        (query->keys-in-application-order inner-query))
       (add-default-select driver)))


;;; -------------------------------------------- Handling source queries ---------------------------------------------

(declare apply-clauses)

;; TODO - it seems to me like we could actually properly handle nested nested queries by giving each level of nesting
;; a different alias
(def source-query-alias
  "Alias to use for source queries, e.g.:

    SELECT source.*
    FROM ( SELECT * FROM some_table ) source"
  :source)

(defn- apply-source-query
  "Handle a `:source-query` clause by adding a recursive `SELECT` or native query. At the time of this writing, all
  source queries are aliased as `source`."
  [driver honeysql-form {{:keys [native], :as source-query} :source-query}]
  (assoc honeysql-form
    :from [[(if native
              (hsql/raw (str "(" (str/replace native #";+\s*$" "") ")")) ; strip off any trailing slashes
              (binding [*nested-query-level* (inc *nested-query-level*)]
                (apply-clauses driver {} source-query)))
            (->honeysql driver (hx/identifier :table-alias source-query-alias))]]))

(defn- apply-clauses-with-aliased-source-query-table
  "For queries that have a source query that is a normal MBQL query with a source table, temporarily swap the name of
  that table to the `source` alias and handle other clauses. This is done so `field-id` references and the like
  referring to Fields belonging to the Table in the source query work normally."
  [driver honeysql-form {:keys [source-query], :as inner-query}]
  (binding [*table-alias* source-query-alias]
    (apply-top-level-clauses driver honeysql-form (dissoc inner-query :source-query))))


;;; -------------------------------------------- putting it all togetrher --------------------------------------------

(defn- apply-clauses
  "Like `apply-top-level-clauses`, but handles `source-query` as well, which needs to be handled in a special way
  because it is aliased."
  [driver honeysql-form {:keys [source-query], :as inner-query}]
  (if source-query
    (apply-clauses-with-aliased-source-query-table
     driver
     (apply-source-query driver honeysql-form inner-query)
     inner-query)
    (apply-top-level-clauses driver honeysql-form inner-query)))

(s/defn build-honeysql-form
  "Build the HoneySQL form we will compile to SQL and execute."
  [driver, {inner-query :query} :- su/Map]
  (u/prog1 (apply-clauses driver {} inner-query)
    (when-not i/*disable-qp-logging*
      (log/debug (tru "HoneySQL Form:") (u/emoji "🍯") "\n" (u/pprint-to-str 'cyan <>)))))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                 MBQL -> Native                                                 |
;;; +----------------------------------------------------------------------------------------------------------------+

(s/defn honeysql-form->sql+args
  "Convert `honeysql-form` to a vector of SQL string and params, like you'd pass to JDBC."
  {:style/indent 1}
  [driver, honeysql-form :- su/Map]
  (let [[sql & args] (format-honeysql driver honeysql-form)]
    (into [sql] args)))

(defn- mbql->honeysql [driver outer-query]
  (binding [*query* outer-query]
    (build-honeysql-form driver outer-query)))

(defn mbql->native
  "Transpile MBQL query into a native SQL statement."
  [driver {inner-query :query, database :database, :as outer-query}]
  (let [honeysql-form (mbql->honeysql driver outer-query)
        [sql & args]  (honeysql-form->sql+args driver honeysql-form)]
    {:query  sql
     :params args}))
