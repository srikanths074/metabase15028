(ns metabase.driver.mongo.query-processor
  "Logic for translating MBQL queries into Mongo Aggregation Pipeline queries. See
  https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/ for more details."
  (:require [clojure.string :as str]
            [clojure.tools.logging :as log]
            [clojure.walk :as walk]
            [flatland.ordered.map :as ordered-map]
            [java-time :as t]
            [metabase.driver :as driver]
            [metabase.driver.common :as driver.common]
            [metabase.mbql.schema :as mbql.s]
            [metabase.mbql.util :as mbql.u]
            [metabase.models.field :refer [Field]]
            [metabase.query-processor.interface :as qp.i]
            [metabase.query-processor.middleware.annotate :as annotate]
            [metabase.query-processor.store :as qp.store]
            [metabase.query-processor.timezone :as qp.timezone]
            [metabase.util :as u]
            [metabase.util.date-2 :as u.date]
            [metabase.util.i18n :refer [tru]]
            [metabase.util.schema :as su]
            [monger.operators :refer [$add $addToSet $and $avg $cond $dayOfMonth $dayOfWeek $dayOfYear $divide $eq
                                      $group $gt $gte $hour $limit $lt $lte $match $max $min $minute $mod $month
                                      $multiply $ne $not $or $project $regex $size $skip $sort $strcasecmp $subtract
                                      $sum $toLower]]
            [schema.core :as s])
  (:import
   (org.bson.types ObjectId)))

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                     Schema                                                     |
;;; +----------------------------------------------------------------------------------------------------------------+

;; this is just a very limited schema to make sure we're generating valid queries. We should expand it more in the
;; future

(def ^:private $ProjectStage   {(s/eq $project)    {su/NonBlankString s/Any}})
(def ^:private $SortStage      {(s/eq $sort)       {su/NonBlankString (s/enum -1 1)}})
(def ^:private $MatchStage     {(s/eq $match)      {(s/constrained (s/cond-pre su/NonBlankString s/Keyword)
                                                                   #(not (#{:$not "$not"} %)))
                                                    s/Any}})
(def ^:private $GroupStage     {(s/eq $group)      {su/NonBlankString s/Any}})
(def ^:private $AddFieldsStage {(s/eq :$addFields) {su/NonBlankString s/Any}})
(def ^:private $LimitStage     {(s/eq $limit)      su/IntGreaterThanZero})
(def ^:private $SkipStage      {(s/eq $skip)       su/IntGreaterThanZero})

(defn- is-stage? [stage]
  (fn [m] (= (first (keys m)) stage)))

(def ^:private Stage
  (s/both
   (s/constrained su/Map #(= (count (keys %)) 1) "map with a single key")
   (s/conditional
    (is-stage? $project)    $ProjectStage
    (is-stage? $sort)       $SortStage
    (is-stage? $group)      $GroupStage
    (is-stage? :$addFields) $AddFieldsStage
    (is-stage? $match)      $MatchStage
    (is-stage? $limit)      $LimitStage
    (is-stage? $skip)       $SkipStage)))

(def ^:private Pipeline [Stage])

(def Projections
  "Schema for the `:projections` generated by the functions in this namespace. It is a sequence of the column names
  returned in an MBQL query. e.g.

    [\"_id\" \"date~~~default\" \"user_id\" \"venue_id\"]"
  [s/Str])


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                    QP Impl                                                     |
;;; +----------------------------------------------------------------------------------------------------------------+


;; TODO - We already have a *query* dynamic var in metabase.query-processor.interface. Do we need this one too?
(def ^:dynamic ^:private *query* nil)

(defmulti ^:private ->rvalue
  "Format this `Field` or value for use as the right hand value of an expression, e.g. by adding `$` to a `Field`'s
  name"
  {:arglists '([x])}
  mbql.u/dispatch-by-clause-name-or-class)

(defmulti ^:private ->lvalue
  "Return an escaped name that can be used as the name of a given Field."
  {:arglists '([field])}
  mbql.u/dispatch-by-clause-name-or-class)

(defn- field-name-components [field]
  (concat
   (when-let [parent-id (:parent_id field)]
     (field-name-components (qp.store/field parent-id)))
   [(:name field)]))

(defn field->name
  "Return a single string name for `field`. For nested fields, this creates a combined qualified name."
  [field separator]
  (str/join separator (field-name-components field)))

(defmacro ^:private mongo-let
  {:style/indent 1}
  [[field value] & body]
  {:$let {:vars {(keyword field) value}
          :in   `(let [~field ~(keyword (str "$$" (name field)))]
                   ~@body)}})

(defmethod ->lvalue (class Field)
  [field]
  (field->name field \.))

(defmethod ->lvalue :expression
  [[_ expression-name]]
  expression-name)

(defmethod ->rvalue :default
  [x]
  x)

(defmethod ->rvalue :expression
  [[_ expression-name]]
  (->rvalue (mbql.u/expression-with-name (:query *query*) expression-name)))

(defmethod ->rvalue (class Field)
  [{coercion :coercion_strategy, :as field}]
  (let [field-name (str \$ (field->name field "."))]
    (cond
      (isa? coercion :Coercion/UNIXMicroSeconds->DateTime)
      {:$dateFromParts {:millisecond {$divide [field-name 1000]}, :year 1970, :timezone "UTC"}}

      (isa? coercion :Coercion/UNIXMilliSeconds->DateTime)
      {:$dateFromParts {:millisecond field-name, :year 1970, :timezone "UTC"}}

      (isa? coercion :Coercion/UNIXSeconds->DateTime)
      {:$dateFromParts {:second field-name, :year 1970, :timezone "UTC"}}

      (isa? coercion :Coercion/YYYYMMDDHHMMSSString->Temporal)
      {"$dateFromString" {:dateString field-name
                          :format "%Y%m%d%H%M%S"
                          :onError field-name}}

      :else field-name)))

;; Don't think this needs to implement `->lvalue` because you can't assign something to an aggregation e.g.
;;
;;    aggregations[0] = 20
;;
(defmethod ->lvalue :aggregation
  [[_ index]]
  (annotate/aggregation-name (mbql.u/aggregation-at-index *query* index)))

(defn- with-lvalue-temporal-bucketing [field unit]
  (if (= unit :default)
    field
    (str field "~~~" (name unit))))

(defmethod ->lvalue :field
  [[_ id-or-name {:keys [temporal-unit]}]]
  (cond-> (if (integer? id-or-name)
            (->lvalue (qp.store/field id-or-name))
            (name id-or-name))
    temporal-unit (with-lvalue-temporal-bucketing temporal-unit)))

(defn- add-start-of-week-offset [expr offset]
  (cond
    (zero? offset) expr
    (neg? offset)  (recur expr (+ offset 7))
    :else          {$mod [{$add [expr offset]}
                          7]}))

(defn- day-of-week
  [column]
  (mongo-let [day_of_week (add-start-of-week-offset {$dayOfWeek column}
                                                    (driver.common/start-of-week-offset :mongo))]
    {$cond {:if   {$eq [day_of_week 0]}
            :then 7
            :else day_of_week}}))

(defn- week
  [column]
  {$subtract [column
              {$multiply [{$subtract [(day-of-week column)
                                      1]}
                          (* 24 60 60 1000)]}]})

(defn- truncate-to-resolution [column resolution]
  (mongo-let [parts {:$dateToParts {:timezone (qp.timezone/results-timezone-id)
                                    :date column}}]
    {:$dateFromParts (into {:timezone (qp.timezone/results-timezone-id)}
                           (for [part (concat (take-while (partial not= resolution)
                                                          [:year :month :day :hour :minute :second :millisecond])
                                              [resolution])]
                             [part (str (name parts) \. (name part))]))}))

(defn- with-rvalue-temporal-bucketing
  [field unit]
  (if (= unit :default)
    field
    (let [column field]
      (letfn [(truncate [unit]
                (truncate-to-resolution column unit))]
        (case unit
          :default        column
          :minute         (truncate :minute)
          :minute-of-hour {$minute column}
          :hour           (truncate :hour)
          :hour-of-day    {$hour column}
          :day            (truncate :day)
          :day-of-week    (day-of-week column)
          :day-of-month   {$dayOfMonth column}
          :day-of-year    {$dayOfYear column}
          :week           (truncate-to-resolution (week column) :day)
          :week-of-year   {:$ceil {$divide [{$dayOfYear (week column)}
                                            7.0]}}
          :month          (truncate :month)
          :month-of-year  {$month column}
          ;; For quarter we'll just subtract enough days from the current date to put it in the correct month and
          ;; stringify it as yyyy-MM Subtracting (($dayOfYear(column) % 91) - 3) days will put you in correct month.
          ;; Trust me.
          :quarter
          (mongo-let [#_:clj-kondo/ignore parts {:$dateToParts {:date column}}]
            {:$dateFromParts {:year  :$$parts.year
                              :month {$subtract [:$$parts.month
                                                 {$mod [{$add [:$$parts.month 2]}
                                                        3]}]}}})

          :quarter-of-year
          (mongo-let [month {$month column}]
            ;; TODO -- $floor ?
            {$divide [{$subtract [{$add [month 2]}
                                  {$mod [{$add [month 2]}
                                         3]}]}
                      3]})

          :year
          (truncate :year))))))

(defmethod ->rvalue :field
  [[_ id-or-name {:keys [temporal-unit]}]]
  (cond-> (if (integer? id-or-name)
            (->rvalue (qp.store/field id-or-name))
            (str \$ (name id-or-name)))
    temporal-unit (with-rvalue-temporal-bucketing temporal-unit)))

;; Values clauses below; they only need to implement `->rvalue`

(defmethod ->rvalue nil [_] nil)

(defmethod ->rvalue :value
  [[_ value {base-type :base_type}]]
  (if (and (isa? base-type :type/MongoBSONID)
           (some? value))
    ;; Passing nil or "" to the ObjectId constructor throws an exception
    ;; "invalid hexadecimal representation of an ObjectId: []" so, just treat it as nil
    (when (not= value "")
      (ObjectId. (str value)))
    value))

(defn- $date-from-string [s]
  {:$dateFromString {:dateString (str s)}})

(defmethod ->rvalue :absolute-datetime
  [[_ t unit]]
  (let [report-zone (t/zone-id (or (qp.timezone/report-timezone-id-if-supported :mongo)
                                   "UTC"))
        t           (condp = (class t)
                      java.time.LocalDate      t
                      java.time.LocalTime      t
                      java.time.LocalDateTime  t
                      java.time.OffsetTime     (t/with-offset-same-instant t report-zone)
                      java.time.OffsetDateTime (t/with-offset-same-instant t report-zone)
                      java.time.ZonedDateTime  (t/offset-date-time (t/with-zone-same-instant t report-zone)))]
    (letfn [(extract [unit]
              (u.date/extract t unit))
            (bucket [unit]
              ($date-from-string (u.date/bucket t unit)))]
      (case (or unit :default)
        :default         ($date-from-string t)
        :minute          (bucket :minute)
        :minute-of-hour  (extract :minute-of-hour)
        :hour            (bucket :hour)
        :hour-of-day     (extract :hour-of-day)
        :day             (bucket :day)
        :day-of-week     (extract :day-of-week)
        :day-of-month    (extract :day-of-month)
        :day-of-year     (extract :day-of-year)
        :week            (bucket :week)
        :week-of-year    (extract :week-of-year)
        :month           (bucket :month)
        :month-of-year   (extract :month-of-year)
        :quarter         (bucket :quarter)
        :quarter-of-year (extract :quarter-of-year)
        :year            (bucket :year)))))

(defmethod ->rvalue :relative-datetime
  [[_ amount unit]]
  (let [t (-> (t/zoned-date-time)
              (t/with-zone-same-instant (t/zone-id (or (qp.timezone/report-timezone-id-if-supported :mongo)
                                                       "UTC"))))]
    ($date-from-string
     (t/offset-date-time
      (if (= unit :default)
        t
        (-> t
            (u.date/add unit amount)
            (u.date/bucket unit)))))))

;;; ---------------------------------------------------- functions ---------------------------------------------------

;; It doesn't make 100% sense to have lvalues for all these but it's a formal requirement

(defmethod ->lvalue :avg       [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :stddev    [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :sum       [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :min       [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :max       [[_ inp]] (->lvalue inp))

(defmethod ->lvalue :floor     [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :ceil      [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :round     [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :abs       [[_ inp]] (->lvalue inp))

(defmethod ->lvalue :log       [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :exp       [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :sqrt      [[_ inp]] (->lvalue inp))

(defmethod ->lvalue :trim      [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :ltrim     [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :rtrim     [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :upper     [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :lower     [[_ inp]] (->lvalue inp))
(defmethod ->lvalue :length    [[_ inp]] (->lvalue inp))

(defmethod ->lvalue :power     [[_ & args]] (->lvalue (first args)))
(defmethod ->lvalue :replace   [[_ & args]] (->lvalue (first args)))
(defmethod ->lvalue :concat    [[_ & args]] (->lvalue (first args)))
(defmethod ->lvalue :substring [[_ & args]] (->lvalue (first args)))

(defmethod ->lvalue :+ [[_ & args]] (->lvalue (first args)))
(defmethod ->lvalue :- [[_ & args]] (->lvalue (first args)))
(defmethod ->lvalue :* [[_ & args]] (->lvalue (first args)))
(defmethod ->lvalue :/ [[_ & args]] (->lvalue (first args)))

(defmethod ->lvalue :coalesce [[_ & args]] (->lvalue (first args)))

(defmethod ->rvalue :avg       [[_ inp]] {"$avg" (->rvalue inp)})
(defmethod ->rvalue :stddev    [[_ inp]] {"$stdDevPop" (->rvalue inp)})
(defmethod ->rvalue :sum       [[_ inp]] {"$sum" (->rvalue inp)})
(defmethod ->rvalue :min       [[_ inp]] {"$min" (->rvalue inp)})
(defmethod ->rvalue :max       [[_ inp]] {"$max" (->rvalue inp)})

(defmethod ->rvalue :floor     [[_ inp]] {"$floor" (->rvalue inp)})
(defmethod ->rvalue :ceil      [[_ inp]] {"$ceil" (->rvalue inp)})
(defmethod ->rvalue :round     [[_ inp]] {"$round" (->rvalue inp)})
(defmethod ->rvalue :abs       [[_ inp]] {"$abs" (->rvalue inp)})

(defmethod ->rvalue :log       [[_ inp]] {"$log10" (->rvalue inp)})
(defmethod ->rvalue :exp       [[_ inp]] {"$exp" (->rvalue inp)})
(defmethod ->rvalue :sqrt      [[_ inp]] {"$sqrt" (->rvalue inp)})

(defmethod ->rvalue :trim      [[_ inp]] {"$trim" (->rvalue inp)})
(defmethod ->rvalue :ltrim     [[_ inp]] {"$ltrim" (->rvalue inp)})
(defmethod ->rvalue :rtrim     [[_ inp]] {"$rtrim" (->rvalue inp)})
(defmethod ->rvalue :upper     [[_ inp]] {"$toUpper" (->rvalue inp)})
(defmethod ->rvalue :lower     [[_ inp]] {"$toLower" (->rvalue inp)})
(defmethod ->rvalue :length    [[_ inp]] {"$strLenCP" (->rvalue inp)})

(defmethod ->rvalue :power     [[_ & args]] {"$pow" (mapv ->rvalue args)})
(defmethod ->rvalue :replace   [[_ & args]] {"$replaceAll" (mapv ->rvalue args)})
(defmethod ->rvalue :concat    [[_ & args]] {"$concat" (mapv ->rvalue args)})
(defmethod ->rvalue :substring [[_ & args]] {"$substrCP" (mapv ->rvalue args)})

;;; Intervals are not first class Mongo citizens, so they cannot be translated on their own.
;;; The only thing we can do with them is adding to or subtracting from a date valued expression.
;;; Also, date arithmetic with intervals was first implemented in version 5. (Before that only
;;; ordinary addition could be used: one of the operands of the addition could be a date, their
;;; rest of the operands had to be integers and would be treated as milliseconds.)
;;; Because of this, whenever we translate date arithmetic with intervals, we check the major
;;; version of the database and throw a nice exception if it's less than 5.

(defn- get-mongo-version []
  (:version (driver/describe-database :mongo (qp.store/database))))

(defn- get-major-version [version]
  (some-> version (str/split #"\.") first parse-long))

(defn- check-date-operations-supported []
  (let [mongo-version (get-mongo-version)
        major-version (get-major-version mongo-version)]
    (when (and major-version (< major-version 5))
      (throw (ex-info "Date arithmetic not supported in versions before 5"
                      {:database-version mongo-version})))))

(defn- interval? [expr]
  (and (vector? expr) (= (first expr) :interval)))

(defn- summarize-interval [op date-expr [_ amount unit]]
  {op {:startDate date-expr
       :unit unit
       :amount amount}})

(defn- summarize-num-or-interval [number-op date-op mongo-expr mbql-expr]
  (cond
    (interval? mbql-expr) (summarize-interval date-op mongo-expr mbql-expr)
    (contains? mongo-expr number-op) (update mongo-expr number-op conj (->rvalue mbql-expr))
    :else {number-op [mongo-expr (->rvalue mbql-expr)]}))

(def ^:private num-or-interval-reducer
  {:+ (partial summarize-num-or-interval "$add" "$dateAdd")
   :- (partial summarize-num-or-interval "$subtract" "$dateSubtract")})

(defmethod ->rvalue :+ [[_ & args]]
  ;; Addition is commutative and any but not all elements of `args` can be intervals.
  ;; We pick the first arg that is not an interval and add the rest of args to it.
  ;; (It's the callers responsibility to make sure that the first non-interval argument
  ;; represents a date and not an offset like an integer would.)
  ;; If none of the args is an interval, we shortcut with a simple addition.
  (if (some interval? args)
    (if-let [[arg others] (u/pick-first (complement interval?) args)]
      (do
        (check-date-operations-supported)
        (reduce (num-or-interval-reducer :+) (->rvalue arg) others))
      (throw (ex-info "Summing intervals is not supported" {:args args})))
    {"$add" (mapv ->rvalue args)}))

(defmethod ->rvalue :- [[_ & [arg & others :as args]]]
  ;; Subtraction is not commutative so `arg` cannot be an interval.
  ;; If none of the args is an interval, we shortcut with a simple subtraction.
  (if (some interval? others)
    (do
      (check-date-operations-supported)
      (reduce (num-or-interval-reducer :-) (->rvalue arg) others))
    {"$subtract" (mapv ->rvalue args)}))

(defmethod ->rvalue :* [[_ & args]] {"$multiply" (mapv ->rvalue args)})
(defmethod ->rvalue :/ [[_ & args]] {"$divide" (mapv ->rvalue args)})

(defmethod ->rvalue :coalesce [[_ & args]] {"$ifNull" (mapv ->rvalue args)})

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                               CLAUSE APPLICATION                                               |
;;; +----------------------------------------------------------------------------------------------------------------+

;;; ----------------------------------------------------- filter -----------------------------------------------------

(defmethod ->rvalue ::not [[_ value]]
  {$not (->rvalue value)})

(defmulti compile-filter
  "Compile an mbql filter clause to datastructures suitable to query mongo. Note this is not the whole query but just
  compiling the \"where\" clause equivalent."
  {:arglists '([clause])}
  mbql.u/dispatch-by-clause-name-or-class)

(defmethod compile-filter :between
  [[_ field min-val max-val]]
  (compile-filter [:and
                   [:>= field min-val]
                   [:<= field max-val]]))

(defn- str-match-pattern [options prefix value suffix]
  (if (mbql.u/is-clause? ::not value)
    {$not (str-match-pattern options prefix (second value) suffix)}
    (let [case-sensitive? (get options :case-sensitive true)]
      {$regex (str (when-not case-sensitive? "(?i)") prefix (->rvalue value) suffix)})))

;; these are changed to {field {$regex "regex"}} instead of {field #regex} for serialization purposes. When doing
;; native query substitution we need a string and the explicit regex form is better there
(defmethod compile-filter :contains    [[_ field v opts]] {(->lvalue field) (str-match-pattern opts nil v nil)})
(defmethod compile-filter :starts-with [[_ field v opts]] {(->lvalue field) (str-match-pattern opts \^  v nil)})
(defmethod compile-filter :ends-with   [[_ field v opts]] {(->lvalue field) (str-match-pattern opts nil v \$)})

(defn- rvalue-is-field? [rvalue]
  (and (string? rvalue)
       (str/starts-with? rvalue "$")))

(defn- rvalue-can-be-compared-directly?
  "Whether `rvalue` is something simple that can be compared directly e.g.

    {$match {$field {$eq rvalue}}}

  as opposed to

    {$match {$expr {$eq [$field rvalue]}}}"
  [rvalue]
  (or (rvalue-is-field? rvalue)
      (and (not (map? rvalue))
           (not (instance? java.util.regex.Pattern rvalue)))))

(defn- filter-expr [operator field value]
  (let [field-rvalue (->rvalue field)
        value-rvalue (->rvalue value)]
    (if (and (rvalue-is-field? field-rvalue)
             (not (rvalue-is-field? value-rvalue))
             (rvalue-can-be-compared-directly? value-rvalue))
      ;; if we don't need to do anything fancy with field we can generate a clause like
      ;;
      ;;    {field {$lte 100}}
      {(str/replace-first field-rvalue #"^\$" "")
       ;; for the $eq operator we actually don't need to do {field {$eq 100}}, we can just do {field 100}
       (if (= (name operator) "$eq")
         value-rvalue
         {operator value-rvalue})}
      ;; if we need to do something fancy then we have to use `$expr` e.g.
      ;;
      ;;    {$expr {$lte [{$add [$field 1]} 100]}}
      {:$expr {operator [field-rvalue value-rvalue]}})))

(defmethod compile-filter :=  [[_ field value]] (filter-expr $eq field value))
(defmethod compile-filter :!= [[_ field value]] (filter-expr $ne field value))
(defmethod compile-filter :<  [[_ field value]] (filter-expr $lt field value))
(defmethod compile-filter :>  [[_ field value]] (filter-expr $gt field value))
(defmethod compile-filter :<= [[_ field value]] (filter-expr $lte field value))
(defmethod compile-filter :>= [[_ field value]] (filter-expr $gte field value))

(defmethod compile-filter :and
  [[_ & args]]
  {$and (mapv compile-filter args)})

(defmethod compile-filter :or
  [[_ & args]]
  {$or (mapv compile-filter args)})


;; MongoDB doesn't support negating top-level filter clauses. So we can leverage the MBQL lib's `negate-filter-clause`
;; to negate everything, with the exception of the string filter clauses, which we will convert to a `{not <regex}`
;; clause (see `->rvalue` for `::not` above). `negate` below wraps the MBQL lib function
(defmulti ^:private negate mbql.u/dispatch-by-clause-name-or-class)

(defmethod negate :default [clause]
  (mbql.u/negate-filter-clause clause))

(defmethod negate :and [[_ & subclauses]] (apply vector :or  (map negate subclauses)))
(defmethod negate :or  [[_ & subclauses]] (apply vector :and (map negate subclauses)))

(defmethod negate :contains    [[_ field v opts]] [:contains field [::not v] opts])
(defmethod negate :starts-with [[_ field v opts]] [:starts-with field [::not v] opts])
(defmethod negate :ends-with   [[_ field v opts]] [:ends-with field [::not v] opts])

(defmethod compile-filter :not [[_ subclause]]
  (compile-filter (negate subclause)))

(defn- handle-filter [{filter-clause :filter} pipeline-ctx]
  (if-not filter-clause
    pipeline-ctx
    (update pipeline-ctx :query conj {$match (compile-filter filter-clause)})))

(defmulti ^:private compile-cond mbql.u/dispatch-by-clause-name-or-class)

(defmethod compile-cond :between [[_ field min-val max-val]]
  (compile-cond [:and [:>= field min-val] [:< field max-val]]))

(defn- index-of-code-point
  "See https://docs.mongodb.com/manual/reference/operator/aggregation/indexOfCP/"
  [source needle case-sensitive?]
  (let [source (if case-sensitive?
                 (->rvalue source)
                 {$toLower (->rvalue source)})
        needle (if case-sensitive?
                 (->rvalue needle)
                 {$toLower (->rvalue needle)})]
    {:$indexOfCP [source needle]}))

(defmethod compile-cond :contains
  [[_ field value opts]]
  {$ne [(index-of-code-point field value (get opts :case-sensitive true)) -1]})

(defmethod compile-cond :starts-with
  [[_ field value opts]]
  {$eq [(index-of-code-point field value (get opts :case-sensitive true)) 0]})

(defmethod compile-cond :ends-with
  [[_ field value opts]]
  (let [strcmp (fn [a b]
                 {$eq (if (get opts :case-sensitive true)
                        [a b]
                        [{$strcasecmp [a b]} 0])})]
    (strcmp {:$substrCP [(->rvalue field)
                         {$subtract [{:$strLenCP (->rvalue field)}
                                     {:$strLenCP (->rvalue value)}]}
                         {:$strLenCP (->rvalue value)}]}
            (->rvalue value))))

(defmethod compile-cond :=  [[_ field value]] {$eq [(->rvalue field) (->rvalue value)]})
(defmethod compile-cond :!= [[_ field value]] {$ne [(->rvalue field) (->rvalue value)]})
(defmethod compile-cond :<  [[_ field value]] {$lt [(->rvalue field) (->rvalue value)]})
(defmethod compile-cond :>  [[_ field value]] {$gt [(->rvalue field) (->rvalue value)]})
(defmethod compile-cond :<= [[_ field value]] {$lte [(->rvalue field) (->rvalue value)]})
(defmethod compile-cond :>= [[_ field value]] {$gte [(->rvalue field) (->rvalue value)]})

(defmethod compile-cond :and [[_ & args]] {$and (mapv compile-cond args)})
(defmethod compile-cond :or  [[_ & args]] {$or (mapv compile-cond args)})

(defmethod compile-cond :not [[_ subclause]]
  (compile-cond (negate subclause)))


;;; -------------------------------------------------- aggregation ---------------------------------------------------

(defmethod ->rvalue :case [[_ cases options]]
  {:$switch {:branches (for [[pred expr] cases]
                         {:case (compile-cond pred)
                          :then (->rvalue expr)})
             :default  (->rvalue (:default options))}})

(defn- aggregation->rvalue [ag]
  (mbql.u/match-one ag
    [:aggregation-options ag _]
    (recur ag)

    [:count]
    {$sum 1}

    [:count arg]
    {$sum {$cond {:if   (->rvalue arg)
                  :then 1
                  :else 0}}}
    [:avg arg]
    {$avg (->rvalue arg)}


    [:distinct arg]
    {$addToSet (->rvalue arg)}

    [:sum arg]
    {$sum (->rvalue arg)}

    [:min arg]
    {$min (->rvalue arg)}

    [:max arg]
    {$max (->rvalue arg)}

    [:sum-where arg pred]
    {$sum {$cond {:if   (compile-cond pred)
                  :then (->rvalue arg)
                  :else 0}}}

    [:count-where pred]
    (recur [:sum-where [:value 1] pred])

    :else
    (throw
     (ex-info (tru "Don''t know how to handle aggregation {0}" ag)
       {:type :invalid-query, :clause ag}))))

(defn- unwrap-named-ag [[ag-type arg :as ag]]
  (if (= ag-type :aggregation-options)
    (recur arg)
    ag))

(s/defn ^:private breakouts-and-ags->projected-fields :- [(s/pair su/NonBlankString "projected-field-name"
                                                                  s/Any             "source")]
  "Determine field projections for MBQL breakouts and aggregations. Returns a sequence of pairs like
  `[projected-field-name source]`."
  [breakout-fields aggregations]
  (concat
   (for [field-or-expr breakout-fields]
     [(->lvalue field-or-expr) (format "$_id.%s" (->lvalue field-or-expr))])
   (for [ag aggregations
         :let [ag-name (annotate/aggregation-name ag)]]
     [ag-name (if (mbql.u/is-clause? :distinct (unwrap-named-ag ag))
                {$size (str \$ ag-name)}
                true)])))

(defmulti ^:private expand-aggregation (comp first unwrap-named-ag))

(defmethod expand-aggregation :share
  [[_ pred :as ag]]
  (let [count-where-name (name (gensym "count-where"))
        count-name       (name (gensym "count-"))
        pred             (if (= (first pred) :share)
                           (second pred)
                           pred)]
    [[[count-where-name (aggregation->rvalue [:count-where pred])]
      [count-name (aggregation->rvalue [:count])]]
     [[(annotate/aggregation-name ag) {$divide [(str "$" count-where-name) (str "$" count-name)]}]]]))

(defmethod expand-aggregation :default
  [ag]
  [[[(annotate/aggregation-name ag) (aggregation->rvalue ag)]]])

(defn- group-and-post-aggregations
  "Mongo is picky about which top-level aggregations it allows with groups. Eg. even
   though [:/ [:count-if ...] [:count]] is a perfectly fine reduction, it's not allowed. Therefore
   more complex aggregations are split in two: the reductions are done in `$group` stage after which
   we do postprocessing in `$addFields` stage to arrive at the final result. The intermittent results
   accrued in `$group` stage are discarded in the final `$project` stage."
  [id aggregations]
  (let [expanded-ags (map expand-aggregation aggregations)
        group-ags    (mapcat first expanded-ags)
        post-ags     (mapcat second expanded-ags)]
    [{$group (into (ordered-map/ordered-map "_id" id) group-ags)}
     (when (not-empty post-ags)
       {:$addFields (into (ordered-map/ordered-map) post-ags)})]))

(defn- projection-group-map [fields]
  (reduce
   (fn [m field-clause]
     (assoc-in
      m
      (mbql.u/match-one field-clause
        [:field (field-id :guard integer?) _]
        (str/split (->lvalue field-clause) #"\.")

        [:field (field-name :guard string?) _]
        [field-name]

        [:expression expr-name]
        [expr-name])
      (->rvalue field-clause)))
   (ordered-map/ordered-map)
   fields))

(defn- breakouts-and-ags->pipeline-stages
  "Return a sequeunce of aggregation pipeline stages needed to implement MBQL breakouts and aggregations."
  [projected-fields breakout-fields aggregations]
  (mapcat
   (partial remove nil?)
   [;; create the $group clause
    (group-and-post-aggregations
     (when (seq breakout-fields)
       (projection-group-map breakout-fields))
     aggregations)
    [ ;; Sort by _id (group)
     {$sort {"_id" 1}}
     ;; now project back to the fields we expect
     {$project (into
                (ordered-map/ordered-map "_id" false)
                projected-fields)}]]))

(defn- handle-breakout+aggregation
  "Add projections, groupings, sortings, and other things needed to the Query pipeline context (`pipeline-ctx`) for
  MBQL `aggregations` and `breakout-fields`."
  [{breakout-fields :breakout, aggregations :aggregation} pipeline-ctx]
  (if-not (or (seq aggregations) (seq breakout-fields))
    ;; if both aggregations and breakouts are empty, there's nothing to do...
    pipeline-ctx
    ;; determine the projections we'll need. projected-fields is like [[projected-field-name source]]`
    (let [projected-fields (breakouts-and-ags->projected-fields breakout-fields aggregations)
          pipeline-stages  (breakouts-and-ags->pipeline-stages projected-fields breakout-fields aggregations)]
      (-> pipeline-ctx
          ;; add :projections key which is just a sequence of the names of projections from above
          (assoc :projections (vec (for [[field] projected-fields]
                                     field)))
          ;; now add additional clauses to the end of :query as applicable
          (update :query into pipeline-stages)))))


;;; ---------------------------------------------------- order-by ----------------------------------------------------

(s/defn ^:private order-by->$sort :- $SortStage
  [order-by :- [mbql.s/OrderBy]]
  {$sort (into
          (ordered-map/ordered-map)
          (for [[direction field] order-by]
            [(->lvalue field) (case direction
                                :asc   1
                                :desc -1)]))})

(defn- handle-order-by [{:keys [order-by]} pipeline-ctx]
  (cond-> pipeline-ctx
    (seq order-by) (update :query conj (order-by->$sort order-by))))

;;; ----------------------------------------------------- fields -----------------------------------------------------

(defn- remove-parent-fields
  "Removes any and all entries in `fields` that are parents of another field in `fields`. This is necessary because as
  of MongoDB 4.4, including both will result in an error (see:
  `https://docs.mongodb.com/manual/release-notes/4.4-compatibility/#path-collision-restrictions`).

  To preserve the previous behavior, we will include only the child fields (since the parent field always appears first
  in the projection/field order list, and that is the stated behavior according to the link above)."
  [fields]
  (let [parent->child-id (reduce (fn [acc [_ field-id & _]]
                                   (if (integer? field-id)
                                     (let [field (qp.store/field field-id)]
                                       (if-let [parent-id (:parent_id field)]
                                         (update acc parent-id conj (u/the-id field))
                                         acc))
                                     acc))
                                 {}
                                 fields)]
    (remove (fn [[_ field-id & _]]
              (and (integer? field-id) (contains? parent->child-id field-id)))
            fields)))

(defn- handle-fields [{:keys [fields]} pipeline-ctx]
  (if-not (seq fields)
    pipeline-ctx
    (let [new-projections (for [field (remove-parent-fields fields)]
                            [(->lvalue field) (->rvalue field)])]
      (-> pipeline-ctx
          (assoc :projections (map first new-projections))
          ;; add project _id = false to keep _id from getting automatically returned unless explicitly specified
          (update :query conj {$project (into
                                         (ordered-map/ordered-map "_id" false)
                                         new-projections)})))))

;;; ----------------------------------------------------- limit ------------------------------------------------------

(defn- handle-limit [{:keys [limit]} pipeline-ctx]
  (if-not limit
    pipeline-ctx
    (update pipeline-ctx :query conj {$limit limit})))


;;; ------------------------------------------------------ page ------------------------------------------------------

(defn- handle-page [{{page-num :page, items-per-page :items, :as page-clause} :page} pipeline-ctx]
  (if-not page-clause
    pipeline-ctx
    (update pipeline-ctx :query concat (filter some? [(let [offset (* items-per-page (dec page-num))]
                                                        (when-not (zero? offset)
                                                          {$skip offset}))
                                                      {$limit items-per-page}]))))

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                 Process & Run                                                  |
;;; +----------------------------------------------------------------------------------------------------------------+

(s/defn ^:private generate-aggregation-pipeline :- {:projections Projections, :query Pipeline}
  "Generate the aggregation pipeline. Returns a sequence of maps representing each stage."
  [inner-query :- mbql.s/MBQLQuery]
  (reduce (fn [pipeline-ctx f]
            (f inner-query pipeline-ctx))
          {:projections [], :query []}
          [handle-filter
           handle-breakout+aggregation
           handle-order-by
           handle-fields
           handle-limit
           handle-page]))

(defn- query->collection-name
  "Return `:collection` from a source query, if it exists."
  [query]
  (mbql.u/match-one query
    (_ :guard (every-pred map? :collection))
    ;; ignore source queries inside `:joins` or `:collection` outside of a `:source-query`
    (when (and (= (last &parents) :source-query)
               (not (contains? (set &parents) :joins)))
      (:collection &match))))

(defn- log-aggregation-pipeline [form]
  (when-not qp.i/*disable-qp-logging*
    (log/tracef "\nMongo aggregation pipeline:\n%s\n"
                (u/pprint-to-str 'green (walk/postwalk #(if (symbol? %) (symbol (name %)) %) form)))))

(defn mbql->native
  "Process and run an MBQL query."
  [query]
  (let [source-table-name (if-let [source-table-id (mbql.u/query->source-table-id query)]
                            (:name (qp.store/table source-table-id))
                            (query->collection-name query))]
    (binding [*query* query]
      (let [{proj :projections, generated-pipeline :query} (generate-aggregation-pipeline (:query query))]
        (log-aggregation-pipeline generated-pipeline)
        {:projections proj
         :query       generated-pipeline
         :collection  source-table-name
         :mbql?       true}))))
