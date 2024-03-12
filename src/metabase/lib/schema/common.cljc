(ns metabase.lib.schema.common
  (:require
   [clojure.string :as str]
   [metabase.types]
   [metabase.util.malli.registry :as mr]))

(comment metabase.types/keep-me)

(defn normalize-keyword
  "Base normalization behavior for something that should be a keyword: calls [[clojure.core/keyword]] on it if it is a
  string. This is preferable to using [[clojure.core/keyword]] directly, because that will be tried on things that
  should not get converted to keywords, like numbers."
  [x]
  (cond-> x
    (string? x) keyword))

(defn normalize-map
  "Base normalization behavior for a pMBQL map: keywordize keys and keywordize `:lib/type`."
  [m]
  (if-not (map? m)
    m
    (let [m (update-keys m keyword)]
      (cond-> m
        (:lib/type m) (update :lib/type normalize-keyword)))))

;;; Schema for a string that cannot be blank.
(mr/def ::non-blank-string
  [:and
   [:string {:min 1}]
   [:fn
    {:error/message "non-blank string"}
    (complement str/blank?)]])

;;; Schema representing an integer than must also be greater than or equal to zero.
(mr/def ::int-greater-than-or-equal-to-zero
  [:int {:min 0}])

(mr/def ::positive-number
  [:fn
   {:error/message "positive number"}
   (every-pred number? pos?)])

(mr/def ::uuid
  [:string
   {:decode/normalize (fn [x]
                        (cond-> x
                          (uuid? x) str))
    ;; TODO -- should this be stricter?
    :min 36
    :max 36}])

(defn- semantic-type? [x]
  (isa? x :Semantic/*))

(mr/def ::semantic-type
  [:fn
   {:decode/normalize normalize-keyword
    :error/message    "valid semantic type"
    :error/fn         (fn [{:keys [value]} _]
                        (str "Not a valid semantic type: " (pr-str value)))}
   semantic-type?])

(defn- relation-type? [x]
  (isa? x :Relation/*))

(mr/def ::relation-type
  [:fn
   {:decode/normalize normalize-keyword
    :error/message    "valid relation type"
    :error/fn         (fn [{:keys [value]} _]
                        (str "Not a valid relation type: " (pr-str value)))}
   relation-type?])

(mr/def ::semantic-or-relation-type
  [:or
   {:decode/normalize normalize-keyword}
   [:ref ::semantic-type]
   [:ref ::relation-type]])

(defn- base-type? [x]
  (isa? x :type/*))

(mr/def ::base-type
  [:fn
   {:decode/normalize normalize-keyword
    :error/message    "valid base type"
    :error/fn         (fn [{:keys [value]} _]
                        (str "Not a valid base type: " (pr-str value)))}
   base-type?])

(mr/def ::options
  [:map
   {:decode/normalize normalize-map}
   [:lib/uuid ::uuid]
   ;; these options aren't required for any clause in particular, but if they're present they must follow these schemas.
   [:base-type      {:optional true} [:maybe ::base-type]]
   [:effective-type {:optional true} [:maybe ::base-type]]
   ;; these two different types are currently both stored under one key, but maybe one day we can fix this.
   [:semantic-type  {:optional true} [:maybe ::semantic-or-relation-type]]
   [:database-type  {:optional true} [:maybe ::non-blank-string]]
   [:name           {:optional true} [:maybe ::non-blank-string]]
   [:display-name   {:optional true} [:maybe ::non-blank-string]]])

(mr/def ::external-op
  [:map
   [:lib/type [:= :lib/external-op]]
   [:operator [:or :string :keyword]]
   [:args     [:sequential :any]]
   [:options {:optional true} ::options]])
