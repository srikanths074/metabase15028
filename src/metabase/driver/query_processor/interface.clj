(ns metabase.driver.query-processor.interface
  "Definitions of `Field`, `Value`, and other record types present in an expanded query.
   This namespace should just contain definitions of various protocols and record types; associated logic
   should go in `metabase.driver.query-processor.expand`."
  (:require [schema.core :as s]
            [metabase.models.field :as field]
            [metabase.util :as u])
  (:import clojure.lang.Keyword
           java.sql.Timestamp))

(def ^:dynamic *driver*
  nil)

;; Expansion Happens in a Few Stages:
;; 1. A query dict is parsed via pattern-matching code in the Query Expander.
;;    field IDs and values are replaced with FieldPlaceholders and ValuePlaceholders, respectively.
;; 2. Relevant Fields and Tables are fetched from the DB, and the placeholder objects are "resolved"
;;    and replaced with objects like Field, Value, etc.

;;; # ------------------------------------------------------------ JOINING OBJECTS ------------------------------------------------------------

;; These are just used by the QueryExpander to record information about how joins should occur.

(s/defrecord JoinTableField [field-id   :- s/Int
                             field-name :- s/Str])

(s/defrecord JoinTable [source-field :- JoinTableField
                        pk-field     :- JoinTableField
                        table-id     :- s/Int
                        table-name   :- s/Str])

;;; # ------------------------------------------------------------ PROTOCOLS ------------------------------------------------------------

(defprotocol IField
  "Methods specific to the Query Expander `Field` record type."
  (qualified-name-components [this]
    "Return a vector of name components of the form `[table-name parent-names... field-name]`"))


;;; # ------------------------------------------------------------ "RESOLVED" TYPES: FIELD + VALUE ------------------------------------------------------------

;; Field is the expansion of a Field ID in the standard QL
(s/defrecord Field [field-id           :- s/Int
                    field-name         :- s/Str
                    field-display-name :- s/Str
                    base-type          :- (apply s/enum field/base-types)
                    special-type       :- (s/maybe (apply s/enum field/special-types))
                    table-id           :- s/Int
                    schema-name        :- (s/maybe s/Str)
                    table-name         :- s/Str
                    position           :- (s/maybe s/Int)
                    description        :- (s/maybe s/Str)
                    parent-id          :- (s/maybe s/Int)
                    ;; Field once its resolved; FieldPlaceholder before that
                    parent             :- s/Any]
  IField
  (qualified-name-components [this]
    (conj (if parent
            (qualified-name-components parent)
            [table-name])
          field-name)))


(def ^:const datetime-field-units
  "Valid units for a `DateTimeField`."
  #{:default :minute :minute-of-hour :hour :hour-of-day :day :day-of-week :day-of-month :day-of-year
    :week :week-of-year :month :month-of-year :quarter :quarter-of-year :year})

(def ^:const relative-datetime-value-units
  "Valid units for a `RelativeDateTimeValue`."
  #{:minute :hour :day :week :month :quarter :year})

(def DatetimeFieldUnit (s/named (apply s/enum datetime-field-units)          "Valid datetime unit for a field"))
(def DatetimeValueUnit (s/named (apply s/enum relative-datetime-value-units) "Valid datetime unit for a relative datetime"))

(defn datetime-field-unit? [unit]
  (contains? datetime-field-units (keyword unit)))

(defn relative-datetime-value-unit? [unit]
  (contains? relative-datetime-value-units (keyword unit)))


;; wrapper around Field
(s/defrecord DateTimeField [field :- Field
                            unit  :- DatetimeFieldUnit])

;; Value is the expansion of a value within a QL clause
;; Information about the associated Field is included for convenience
(s/defrecord Value [value   :- (s/maybe (s/cond-pre s/Bool s/Num s/Str))
                    field   :- Field])

;; e.g. an absolute point in time (literal)
(s/defrecord DateTimeValue [value :- Timestamp
                            field :- DateTimeField])

(s/defrecord RelativeDateTimeValue [amount :- s/Int
                                    unit   :- DatetimeValueUnit
                                    field  :- DateTimeField])


;;; # ------------------------------------------------------------ PLACEHOLDER TYPES: FIELDPLACEHOLDER + VALUEPLACEHOLDER ------------------------------------------------------------

;; Replace Field IDs with these during first pass
(s/defrecord FieldPlaceholder [field-id      :- s/Int
                               fk-field-id   :- (s/maybe s/Int)
                               datetime-unit :- (s/maybe (apply s/enum datetime-field-units))])

(s/defrecord AgFieldRef [index :- s/Int]) ; e.g. 0

(def FieldPlaceholderOrAgRef (s/named (s/cond-pre FieldPlaceholder AgFieldRef) "Valid field (field ID or aggregate field reference)"))


(s/defrecord RelativeDatetime [amount :- s/Int
                               unit   :- (s/maybe DatetimeValueUnit)])

(def LiteralDatetimeString (s/constrained s/Str u/date-string? "ISO-8601 datetime string literal"))
(def LiteralDatetime       (s/named (s/cond-pre java.sql.Date LiteralDatetimeString)   "Datetime literal (ISO-8601 string or java.sql.Date)"))
(def Datetime              (s/named (s/cond-pre RelativeDatetime LiteralDatetime)      "Valid datetime (ISO-8601 string literal or relative-datetime form)"))
(def OrderableValue        (s/named (s/cond-pre s/Num Datetime)                        "Orderable value (number or datetime)"))
(def AnyValue              (s/named (s/maybe (s/cond-pre s/Bool s/Str OrderableValue)) "Valid value (nil, boolean, number, string, or relative-datetime form)"))

;; Replace values with these during first pass over Query.
;; Include associated Field ID so appropriate the info can be found during Field resolution
(s/defrecord ValuePlaceholder [field-placeholder :- FieldPlaceholder
                               value             :- AnyValue])

(def OrderableValuePlaceholder (s/both ValuePlaceholder {:field-placeholder s/Any, :value OrderableValue}))
(def StringValuePlaceholder    (s/both ValuePlaceholder {:field-placeholder s/Any, :value s/Str}))

;; (def FieldOrAnyValue       (s/named (s/cond-pre FieldPlaceholder ValuePlaceholder)          "Field or value"))
;; (def FieldOrOrderableValue (s/named (s/cond-pre FieldPlaceholder OrderableValuePlaceholder) "Field or orderable value (number or datetime)"))
;; (def FieldOrStringValue    (s/named (s/cond-pre FieldPlaceholder StringValuePlaceholder)    "Field or string literal"))


;;; # ------------------------------------------------------------ CLAUSE SCHEMAS ------------------------------------------------------------

(def CountAggregation {:aggregation-type       (s/eq :count)
                       (s/optional-key :field) FieldPlaceholder})

(def OtherAggregation {:aggregation-type (s/named (s/enum :avg :cumulative-sum :distinct :stddev :sum) "Valid aggregation type")
                       :field            FieldPlaceholder})

(def Aggregation (s/named (s/if #(= (get % :aggregation-type) :count)
                            CountAggregation
                            OtherAggregation)
                          "Valid aggregation clause"))


(s/defrecord EqualityFilter [filter-type :- (s/enum := :!=)
                             field       :- FieldPlaceholder
                             value       :- ValuePlaceholder])

(s/defrecord ComparisonFilter [filter-type :- (s/enum :< :<= :> :>=)
                               field       :- FieldPlaceholder
                               value       :- OrderableValuePlaceholder])

(s/defrecord BetweenFilter [filter-type  :- (s/eq :between)
                            min-val      :- OrderableValuePlaceholder
                            field        :- FieldPlaceholder
                            max-val      :- OrderableValuePlaceholder])

(s/defrecord StringFilter [filter-type :- (s/enum :starts-with :contains :ends-with)
                           field       :- FieldPlaceholder
                           value       :- StringValuePlaceholder])

(def SimpleFilter (s/cond-pre EqualityFilter ComparisonFilter BetweenFilter StringFilter))

(s/defrecord CompoundFilter [compound-type :- (s/enum :and :or)
                             subclauses    :- [(s/named (s/cond-pre SimpleFilter CompoundFilter) "Valid filter subclause in compound (and/or) filter")]])

(def Filter (s/named (s/cond-pre SimpleFilter CompoundFilter) "Valid filter clause"))


(def OrderBy (s/named {:field     FieldPlaceholderOrAgRef
                       :direction (s/named (s/enum :ascending :descending) "Valid order-by direction")}
                      "Valid order-by subclause"))


(def Page (s/named {:page  s/Int
                    :items s/Int}
                   "Valid page clause"))


(def Query
  {(s/optional-key :aggregation) Aggregation
   (s/optional-key :breakout)    [FieldPlaceholder]
   (s/optional-key :fields)      [FieldPlaceholderOrAgRef]
   (s/optional-key :filter)      Filter
   (s/optional-key :limit)       s/Int
   (s/optional-key :order-by)    [OrderBy]
   (s/optional-key :page)        Page
   :source-table                 s/Int})
