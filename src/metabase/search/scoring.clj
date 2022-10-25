(ns metabase.search.scoring
  (:require [cheshire.core :as json]
            [clojure.core.memoize :as memoize]
            [clojure.string :as str]
            [java-time :as t]
            [metabase.mbql.normalize :as mbql.normalize]
            [metabase.public-settings.premium-features :refer [defenterprise]]
            [metabase.search.config :as search-config]
            [metabase.util :as u]
            [schema.core :as s]))

;;; Utility functions

(s/defn normalize :- s/Str
  "Normalize a `query` to lower-case."
  [query :- s/Str]
  (str/lower-case query))

(s/defn tokenize :- [s/Str]
  "Break a search `query` into its constituent tokens"
  [query :- s/Str]
  (filter seq
          (str/split query #"\s+")))

(def ^:private largest-common-subseq-length
  (memoize/fifo
   (fn
     ([eq xs ys]
      (largest-common-subseq-length eq xs ys 0))
     ([eq xs ys tally]
      (if (or (zero? (count xs))
              (zero? (count ys)))
        tally
        (max
         (if (eq (first xs)
                 (first ys))
           (largest-common-subseq-length eq (rest xs) (rest ys) (inc tally))
           tally)
         (largest-common-subseq-length eq xs (rest ys) 0)
         (largest-common-subseq-length eq (rest xs) ys 0)))))
   ;; Uses O(n*m) space (the lengths of the two lists) with k≤2, so napkin math suggests this gives us caching for at
   ;; least a 31*31 search (or 50*20, etc) which sounds like more than enough. Memory is cheap and the items are
   ;; small, so we may as well skew high.
   ;; As a precaution, the scorer that uses this limits the number of tokens (see the `take` call below)
   :fifo/threshold 2000))

;;; Scoring

(defn- matches?
  [search-token match-token]
  (str/includes? match-token search-token))

(defn- matches-in?
  [search-token match-tokens]
  (some #(matches? search-token %) match-tokens))

(defn- tokens->string
  [tokens abbreviate?]
  (let [->string (partial str/join " ")
        context  search-config/surrounding-match-context]
    (if (or (not abbreviate?)
            (<= (count tokens) (* 2 context)))
      (->string tokens)
      (str
       (->string (take context tokens))
       "…"
       (->string (take-last context tokens))))))

(defn- match-context
  "Breaks the matched-text into match/no-match chunks and returns a seq of them in order. Each chunk is a map with keys
  `is_match` (true/false) and `text`"
  [query-tokens match-tokens]
  (->> match-tokens
       (map (fn [match-token]
              {:text match-token
               :is_match (boolean (some #(matches? % match-token) query-tokens))}))
       (partition-by :is_match)
       (map (fn [matches-or-misses-maps]
              (let [is-match    (:is_match (first matches-or-misses-maps))
                    text-tokens (map :text matches-or-misses-maps)]
                {:is_match is-match
                 :text     (tokens->string text-tokens (not is-match))})))))

(defn- text-scores-with
  "Scores a search result. Returns a map with the score and other info about the text match,
   if there is one. If there is no match, the score is 0."
  [weighted-scorers query-tokens search-result]
  ;; TODO is pmap over search-result worth it?
  (let [scores       (for [column      (search-config/searchable-columns-for-model (:model search-result))
                           {:keys [scorer name weight]
                            :as   _ws} weighted-scorers
                           :let        [matched-text (-> search-result
                                                         (get column)
                                                         (search-config/column->string (:model search-result) column))
                                        match-tokens (some-> matched-text normalize tokenize)
                                        raw-score (scorer query-tokens match-tokens)]
                           :when       (and matched-text (pos? raw-score))]
                       {:score               raw-score
                        :name                (str "text-" name)
                        :weight              weight
                        :match               matched-text
                        :match-context-thunk #(match-context query-tokens match-tokens)
                        :column              column})]
    (if (seq scores)
      (vec scores)
      [{:score 0}])))

(defn- consecutivity-scorer
  [query-tokens match-tokens]
  (/ (largest-common-subseq-length
      matches?
      ;; See comment on largest-common-subseq-length re. its cache. This is a little conservative, but better to under- than over-estimate
      (take 30 query-tokens)
      (take 30 match-tokens))
     (count query-tokens)))

(defn- occurrences
  [query-tokens match-tokens token-matches?]
  (reduce (fn [tally token]
            (if (token-matches? token match-tokens)
              (inc tally)
              tally))
          0
          query-tokens))

(defn- total-occurrences-scorer
  "How many search tokens show up in the result?"
  [query-tokens match-tokens]
  (/ (occurrences query-tokens match-tokens matches-in?)
     (count query-tokens)))

(defn- exact-match-scorer
  "How many search tokens are exact matches (perfect string match, not `includes?`) in the result?"
  [query-tokens match-tokens]
  (/ (occurrences query-tokens match-tokens #(some (partial = %1) %2))
     (count query-tokens)))

(defn fullness-scorer
  "How much of the result is covered by the search query?"
  [query-tokens match-tokens]
  (let [match-token-count (count match-tokens)]
    (if (zero? match-token-count)
      0
      (/ (occurrences query-tokens match-tokens matches-in?)
         match-token-count))))

(defn- prefix-counter
  [query-string item-string]
  (reduce
   (fn [cnt [a b]]
     (if (= a b) (inc cnt) (reduced cnt)))
   0
   (map vector query-string item-string)))

(defn- count-token-chars
  "Tokens is a seq of strings, like [\"abc\" \"def\"]"
  [tokens]
  (reduce
   (fn [cnt x] (+ cnt (count x)))
   0
   tokens))

(defn prefix-scorer
  "How much does the search query match the beginning of the result? "
  [query-tokens match-tokens]
  (let [query (str/lower-case (str/join " " query-tokens))
        match (str/lower-case (str/join " " match-tokens))]
    (/ (prefix-counter query match)
       (count-token-chars query-tokens))))

(def ^:private match-based-scorers
  [{:scorer exact-match-scorer :name "exact-match" :weight 4}
   {:scorer consecutivity-scorer :name "consecutivity" :weight 2}
   {:scorer total-occurrences-scorer :name "total-occurrences" :weight 2}
   {:scorer fullness-scorer :name "fullness" :weight 1}
   {:scorer prefix-scorer :name "prefix" :weight 1}])

(def ^:private model->sort-position
  (zipmap (reverse search-config/all-models) (range)))

(defn- model-score
  [{:keys [model]}]
  (/ (or (model->sort-position model) 0)
     (count model->sort-position)))

(defn- text-scores-with-match
  [raw-search-string result]
  (if (seq raw-search-string)
    (text-scores-with match-based-scorers
                      (tokenize (normalize raw-search-string))
                      result)
    [{:score 0 :weight 1 :match ""}]))

(defn- pinned-score
  [{:keys [model collection_position]}]
  ;; We experimented with favoring lower collection positions, but it wasn't good
  ;; So instead, just give a bonus for items that are pinned at all
  (if (and (#{"card" "dashboard" "pulse"} model)
           ((fnil pos? 0) collection_position))
    1
    0))

(defn- bookmarked-score
  [{:keys [model bookmark]}]
  (if (and (#{"card" "collection" "dashboard"} model)
           bookmark)
    1
    0))

(defn- dashboard-count-score
  [{:keys [model dashboardcard_count]}]
  (if (= model "card")
    (min (/ dashboardcard_count
            search-config/dashboard-count-ceiling)
         1)
    0))

(defn- recency-score
  [{:keys [updated_at]}]
  (let [stale-time search-config/stale-time-in-days
        days-ago (if updated_at
                   (t/time-between updated_at
                                   (t/offset-date-time)
                                   :days)
                   stale-time)]
    (/
     (max (- stale-time days-ago) 0)
     stale-time)))



(defn- serialize
  "Massage the raw result from the DB and match data into something more useful for the client"
  [result all-scores relevant-scores]
  (let [{:keys [name display_name collection_id collection_name collection_authority_level collection_app_id]} result
        column              (first (keep :column relevant-scores))
        match-context-thunk (first (keep :match-context-thunk relevant-scores))]
    (-> result
        (assoc
         :name           (if (or (= column :name) (nil? display_name))
                           name
                           display_name)
         :context        (when (and (not (contains? search-config/displayed-columns column))
                                    match-context-thunk)
                           (match-context-thunk))
         :collection     {:id              collection_id
                          :name            collection_name
                          :authority_level collection_authority_level
                          :app_id          collection_app_id}
         :scores          all-scores)
        (update :dataset_query #(some-> % json/parse-string mbql.normalize/normalize))
        (dissoc
         :collection_id
         :collection_name
         :collection_app_id
         :display_name))))

(defn weights-and-scores
  "Default weights and scores for a given result."
  [result]
  [{:weight 2 :score (pinned-score result) :name "pinned"}
   {:weight 2 :score (bookmarked-score result) :name "bookmarked"}
   {:weight 3/2 :score (recency-score result) :name "recency"}
   {:weight 1 :score (dashboard-count-score result) :name "dashboard"}
   {:weight 1/2 :score (model-score result) :name "model"}])

(defenterprise score-result
  "Score a result, returning a collection of maps with score and weight. Should not include the text scoring, done
   separately. Should return a sequence of maps with

    {:weight number,
     :score  number,
     :name   string}"
   metabase-enterprise.search.scoring
   [result]
   (weights-and-scores result))

(defn- compute-normalized-score [scores]
  (let [weight-sum (reduce + (map #(or (:weight %) 0) scores))
        score-sum (reduce
                   (fn [acc {:keys [weight score] :or {weight 0 score 0}}] (+ acc (* score weight)))
                   0
                   scores)]
    (if (zero? weight-sum)
      0
      (/ score-sum weight-sum))))

(defn force-weight [scores total]
  (let [total-found (reduce + (map :weight scores))]
    (mapv #(update % :weight (fn [weight]
                               (if (zero? total-found)
                                 0
                                 (* total (/ weight total-found))))) scores)))

(defn score-and-result
  "Returns a map with the normalized, combined score from relevant-scores as `:score` and `:result`."
  [raw-search-string result]
  (let [text-matches     (force-weight (text-scores-with-match raw-search-string result) 10)
        all-scores       (vec (concat (score-result result) text-matches))
        relevant-scores  (remove #(= 0 (:score %)) all-scores)
        total-score      (compute-normalized-score all-scores)]
    ;; Searches with a blank search string mean "show me everything, ranked";
    ;; see https://github.com/metabase/metabase/pull/15604 for archived search.
    ;; If the search string is non-blank, results with no text match have a score of zero.
    (if (or (str/blank? raw-search-string)
            (pos? (reduce + (map :score text-matches))))
      {:score total-score
       :result (serialize result all-scores relevant-scores)}
      {:score 0})))

(defn compare-score
  "Compare maps of scores and results. Must return -1, 0, or 1. The score is assumed to be a vector, and will be
  compared in order."
  [{score-1 :score} {score-2 :score}]
  (compare score-1 score-2))

(defn top-results
  "Given a reducible collection (i.e., from `jdbc/reducible-query`) and a transforming function for it, applies the
  transformation and returns a seq of the results sorted by score. The transforming function is expected to output
  maps with `:score` and `:result` keys."
  [reducible-results max-results xf]
  (->> reducible-results
       (transduce xf (u/sorted-take max-results compare-score))
       rseq
       (map :result)))
