(ns metabase.automagic-dashboards.combination
  (:require
    [clojure.math.combinatorics :as math.combo]
    [clojure.string :as str]
    [clojure.walk :as walk]
    [medley.core :as m]
    [metabase.automagic-dashboards.dashboard-templates :as dashboard-templates]
    [metabase.automagic-dashboards.interesting :as interesting]
    [metabase.automagic-dashboards.schema :as ads]
    [metabase.automagic-dashboards.util :as magic.util]
    [metabase.automagic-dashboards.visualization-macros :as visualization]
    [metabase.query-processor.util :as qp.util]
    [metabase.util :as u]
    [metabase.util.i18n :as i18n]
    [metabase.util.malli :as mu]))

(defn add-breakouts
  "Add breakouts to a query based on the breakout fields"
  [query breakout-fields]
  (assoc query
    :breakout (mapv (partial interesting/->reference :mbql) breakout-fields)))

(mu/defn add-breakout-combinations
  "From a grounded metric, produce additional metrics that have potential dimensions
   mixed in based on the provided ground dimensions and semantic affinity sets."
  [ground-dimensions :- ads/dimension-bindings
   {default-affinities :default :as semantic-affinity-sets} ;:- [:map-of ads/semantic-affinity-set sequential?]
   {grounded-metric-fields :grounded-metric-fields :as metric}]
  (let [grounded-field-ids (set (map :id grounded-metric-fields))
        ;; We won't add dimensions to a metric where the dimension is already
        ;; contributing to the fields already grounded in the metric definition itself.
        ;; Note that one potential issue here is rate metrics. Churn rate will need to
        ;; compute churn over time and may use one of its own dimensions as the breakout
        ;; axis. IDK that our current system handles this either.
        {grounded  true
         available false} (->> ground-dimensions
                               (mapcat (fn [[dim-name {:keys [matches] :as dim+matches}]]
                                         (let [dim (-> dim+matches
                                                       (dissoc :matches)
                                                       (assoc :dimension-name dim-name))]
                                           (map
                                             (fn [matching-field]
                                               (assoc matching-field :dimension dim))
                                             matches))))
                               (group-by (comp boolean grounded-field-ids :id)))
        groundable-fields  (group-by magic.util/field-type available)]
    (->> (keys (semantic-affinity-sets grounded-metric-fields default-affinities))
         (mapcat (fn [dimensions-set]
                   (->> (map groundable-fields dimensions-set)
                        (apply math.combo/cartesian-product)
                        (map (partial zipmap dimensions-set)))))
         (map (fn [ground-dimension-fields]
                (-> metric
                    (assoc
                      :grounded-metric-fields grounded
                      :dimension-type->field ground-dimension-fields
                      :dimension-name->field (into
                                               (zipmap
                                                 (map (comp :dimension-name :dimension) grounded)
                                                 grounded)
                                               (zipmap
                                                 (map (comp :dimension-name :dimension) (vals ground-dimension-fields))
                                                 (vals ground-dimension-fields)))
                      :dimension-field-types (set (keys ground-dimension-fields)))
                    (update :metric-definition add-breakouts (vals ground-dimension-fields))))))))

(mu/defn interesting-combinations
  "Expand simple ground metrics in to ground metrics with dimensions
   mixed in based on potential semantic affinity sets."
  [ground-dimensions :- ads/dimension-bindings
   semantic-affinity-sets                                   ;:- [:map-of ads/semantic-affinity-set sequential?]
   grounded-metrics]
  (mapcat (partial add-breakout-combinations ground-dimensions semantic-affinity-sets)
          grounded-metrics))

(defn- instantiate-visualization
  [[k v] dimensions metrics]
  (let [dimension->name (comp vector :name dimensions)
        metric->name    (comp vector first :metric metrics)]
    [k (-> v
           (m/update-existing :map.latitude_column dimension->name)
           (m/update-existing :map.longitude_column dimension->name)
           (m/update-existing :graph.metrics metric->name)
           (m/update-existing :graph.dimensions dimension->name))]))

(defn capitalize-first
  "Capitalize only the first letter in a given string."
  [s]
  (let [s (str s)]
    (str (u/upper-case-en (subs s 0 1)) (subs s 1))))

(defn- fill-templates
  [template-type {:keys [root tables]} bindings s]
  (let [binding-fn (some-fn (merge {"this" (-> root
                                               :entity
                                               (assoc :full-name (:full-name root)))}
                                   bindings)
                            (comp first #(magic.util/filter-tables % tables) dashboard-templates/->entity)
                            identity)]
    (str/replace s #"\[\[(\w+)(?:\.([\w\-]+))?\]\]"
                 (fn [[_ identifier attribute]]
                   (let [entity    (binding-fn identifier)
                         attribute (some-> attribute qp.util/normalize-token)]
                     (str (or (and (ifn? entity) (entity attribute))
                              (root attribute)
                              (interesting/->reference template-type entity))))))))

(defn- instantiate-metadata
  [x context available-metrics bindings]
  (-> (walk/postwalk
        (fn [form]
          (if (i18n/localized-string? form)
            (let [s     (str form)
                  new-s (fill-templates :string context bindings s)]
              (if (not= new-s s)
                (capitalize-first new-s)
                s))
            form))
        x)
      (m/update-existing :visualization #(instantiate-visualization % bindings available-metrics))))

(defn add-dataset-query
  "Add the `:dataset_query` key to this metric. Requires both the current metric-definition (from the grounded metric)
  and the database and table ids (from the source object)."
  [{:keys [metric-definition] :as ground-metric-with-dimensions}
   {:keys [db_id id]}]
  (assoc ground-metric-with-dimensions
    :dataset_query {:database db_id
                    :type     :query
                    :query    (assoc metric-definition
                                :source-table id)}))

(defn items->str
  "Convert a seq of items to a string. If more than two items are present, they are separated by commas, including the
  oxford comma on the final pairing."
  [[f s :as items]]
  (condp = (count items)
    0 ""
    1 (str f)
    2 (format "%s and %s" f s)
    (format "%s, and %s" (str/join ", " (butlast items)) (last items))))

(def dim-name (some-fn :display_name :name))

(defn ground-metric->card
  "Convert a grounded metric to a card. This includes adding any special breakout aggregations specified in the card
  definitions then removing most of the metric fields that aren't relevant to cards."
  [{{:keys [source]} :root
    :as              base-context}
   {:keys [dimension-type->field metric-name dimension-name->field] :as grounded-metric}
   {:keys [semantic-dimensions] :as card}]
  ;; This updates the query to contain the specializations contained in the card template (basically the aggregate definitions)
  (when (= (count dimension-type->field)
           (count semantic-dimensions))
    (let [dims (merge-with into dimension-type->field semantic-dimensions)
          card (visualization/expand-visualization
                 card
                 (vals dimension-name->field)
                 nil)]
      (-> grounded-metric
          (update :metric-definition add-breakouts (vals dims))
          (add-dataset-query source)
          (into card)
          (instantiate-metadata base-context {} dimension-name->field)
          (assoc
            :id (gensym)
            :title (if (pos? (count dimension-type->field))
                     (format "%s by %s"
                             metric-name
                             (items->str (map dim-name (vals dimension-type->field))))
                     metric-name))
          (dissoc
            :dimension-type->field
            :metric-definition
            :grounded-metric-fields
            :dimension-name->field
            :dimensions
            ;:nominal-dimensions
            :semantic-dimensions
            :card-name
            :metric-name
            :metric-title
            :metrics
            ;:visualization
            ;:score
            ;:title
            )))))

(defn ground-metric->cards
  "Convert a single ground metric to a seq of cards. Each potential card is defined in the templates contained within
  the affinity-set->cards map."
  [base-context affinity-set->cards {:keys [metric-field-types dimension-field-types] :as grounded-metric}]
  (->> (or
         (get-in affinity-set->cards [metric-field-types dimension-field-types :cards])
         (get-in affinity-set->cards [:default dimension-field-types :cards]))
       (map (partial ground-metric->card base-context grounded-metric))
       (filter identity)
       (map-indexed (fn [i card]
                      (assoc card :position i)))))

(defn combinations->cards
  "Convert a seq of metrics to a seq of cards. Each metric contains an affinity set, which is matched to a seq of card
  templates. This pairing is expanded to create a card seq."
  [base-context affinity-set->cards ground-metrics]
  (mapcat (partial ground-metric->cards base-context affinity-set->cards)
          ground-metrics))
