(ns metabase.lib.core
  "Currently this is mostly a convenience namespace for REPL and test usage. We'll probably have a slightly different
  version of this for namespace for QB and QP usage in the future -- TBD."
  (:refer-clojure :exclude [filter remove replace and or not = < <= > ->> >= not-empty case count distinct max min
                            + - * / coalesce time abs concat replace])
  (:require
   [metabase.lib.aggregation :as lib.aggregation]
   [metabase.lib.dev :as lib.dev]
   [metabase.lib.expression :as lib.expression]
   [metabase.lib.field :as lib.field]
   [metabase.lib.filter :as lib.filter]
   [metabase.lib.join :as lib.join]
   [metabase.lib.order-by :as lib.order-by]
   [metabase.lib.query :as lib.query]
   [metabase.lib.temporal-bucket :as lib.temporal-bucket]
   [metabase.shared.util.namespaces :as shared.ns]))

(comment lib.dev/keep-me
         lib.field/keep-me
         lib.filter/keep-me
         lib.join/keep-me
         lib.order-by/keep-me
         lib.query/keep-me
         lib.temporal-bucket/keep-me)

(shared.ns/import-fns
  [lib.aggregation
   aggregate
   count
   avg
   count-where
   distinct
   max
   median
   min
   percentile
   share
   stddev
   sum
   sum-where]
  [lib.dev
   field
   query-for-table-name]
  [lib.expression
   +
   -
   *
   /
   case
   coalesce
   abs
   log
   exp
   sqrt
   ceil
   floor
   round
   power
   interval
   relative-datetime
   time
   absolute-datetime
   now
   convert-timezone
   get-week
   get-year
   get-month
   get-day
   get-hour
   get-minute
   get-second
   get-quarter
   datetime-add
   datetime-subtract
   concat
   substring
   replace
   regexextract
   length
   trim
   ltrim
   rtrim
   upper
   lower]
  [lib.field
   with-join-alias]
  [lib.filter
  filter
  and
  or
  not
  = !=
  < <=
  > >=
  between
  inside
  is-null not-null
  is-empty not-empty
  starts-with ends-with
  contains does-not-contain
  time-interval
  segment
  ->and
  ->or
  ->not
  ->= ->!=
  ->< -><=
  ->> ->>=
  ->between
  ->inside
  ->is-null ->not-null
  ->is-empty ->not-empty
  ->starts-with ->ends-with
  ->contains ->does-not-contain
  ->time-interval
  ->segment]
  [lib.join
   join
   join-clause
   joins]
  [lib.order-by
   order-by
   order-by-clause
   order-bys]
  [lib.query
   native-query
   query
   saved-question-query]
  [lib.temporal-bucket
   temporal-bucket])
