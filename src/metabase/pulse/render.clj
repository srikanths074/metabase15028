(ns metabase.pulse.render
  (:require
   [hiccup.core :refer [h]]
   [metabase.formatter :as formatter]
   [metabase.models.dashboard-card :as dashboard-card]
   [metabase.pulse.markdown :as markdown]
   [metabase.pulse.render.body :as body]
   [metabase.pulse.render.image-bundle :as image-bundle]
   [metabase.pulse.render.png :as png]
   [metabase.pulse.render.style :as style]
   [metabase.util.i18n :refer [tru]]
   [metabase.util.log :as log]
   [metabase.util.malli :as mu]
   [metabase.util.urls :as urls]))

(def ^:dynamic *include-buttons*
  "Should the rendered pulse include buttons? (default: `false`)"
  false)

(def ^:dynamic *include-title*
  "Should the rendered pulse include a title? (default: `false`)"
  false)

(def ^:dynamic *include-description*
  "Should the rendered pulse include a card description? (default: `false`)"
  false)

(defn- card-href
  [card]
  (h (urls/card-url (:id card))))

(mu/defn- make-title-if-needed :- [:maybe formatter/RenderedPulseCard]
  [render-type card dashcard]
  (when *include-title*
    (let [card-name    (or (-> dashcard :visualization_settings :card.title)
                           (-> card :name))
          image-bundle (when *include-buttons*
                         (image-bundle/external-link-image-bundle render-type))]
      {:attachments (when image-bundle
                      (image-bundle/image-bundle->attachment image-bundle))
       :content     [:table {:style (style/style {:margin-bottom   :2px
                                                  :border-collapse :collapse
                                                  :width           :100%})}
                     [:tbody
                      [:tr
                       [:td {:style (style/style {:padding :0
                                                  :margin  :0})}
                        [:a {:style  (style/style (style/header-style))
                             :href   (card-href card)
                             :target "_blank"
                             :rel    "noopener noreferrer"}
                         (h card-name)]]
                       [:td {:style (style/style {:text-align :right})}
                        (when *include-buttons*
                          [:img {:style (style/style {:width :16px})
                                 :width 16
                                 :src   (:image-src image-bundle)}])]]]]})))

(mu/defn- make-description-if-needed :- [:maybe formatter/RenderedPulseCard]
  [dashcard card]
  (when *include-description*
    (when-let [description (or (get-in dashcard [:visualization_settings :card.description])
                               (:description card))]
      {:attachments {}
       :content [:div {:style (style/style {:color style/color-text-medium
                                            :font-size :12px
                                            :margin-bottom :8px})}
                 (markdown/process-markdown description :html)]})))

(defn detect-pulse-chart-type
  "Determine the pulse (visualization) type of a `card`, e.g. `:scalar` or `:bar`."
  [{display-type :display card-name :name} maybe-dashcard {:keys [cols rows] :as data}]
  (let [col-sample-count          (delay (count (take 3 cols)))
        row-sample-count          (delay (count (take 2 rows)))]
    (letfn [(chart-type [tyype reason & args]
              (log/tracef "Detected chart type %s for Card %s because %s"
                          tyype (pr-str card-name) (apply format reason args))
              tyype)]
      (cond
        (or (empty? rows)
            ;; Many aggregations result in [[nil]] if there are no rows to aggregate after filters
            (= [[nil]] (-> data :rows)))
        (chart-type :empty "there are no rows in results")

        (#{:pin_map :state :country} display-type)
        (chart-type nil "display-type is %s" display-type)

        (and (some? maybe-dashcard)
             (pos? (count (dashboard-card/dashcard->multi-cards maybe-dashcard))))
        (chart-type :javascript_visualization "result has multiple card semantics, a multiple chart")

        ;; for scalar/smartscalar, the display-type might actually be :line, so we can't have line above
        (and (not (contains? #{:progress :gauge} display-type))
             (= @col-sample-count @row-sample-count 1))
        (chart-type :scalar "result has one row and one column")

        (#{:scalar
           :row
           :progress
           :gauge
           :table
           :funnel} display-type)
        (chart-type display-type "display-type is %s" display-type)

        (#{:smartscalar
           :treemap
           :sankey
           :scalar
           :pie
           :scatter
           :waterfall
           :line
           :area
           :bar
           :combo} display-type)
        (chart-type :javascript_visualization "display-type is javascript_visualization")

        :else
        (chart-type :table "no other chart types match")))))

(defn- is-attached?
  [card]
  ((some-fn :include_csv :include_xls) card))

(mu/defn- render-pulse-card-body :- formatter/RenderedPulseCard
  [render-type
   timezone-id :- [:maybe :string]
   card
   dashcard
   {:keys [data error] :as results}]
  (try
    (when error
      (throw (ex-info (tru "Card has errors: {0}" error) (assoc results :card-error true))))
    (let [chart-type (or (detect-pulse-chart-type card dashcard data)
                         (when (is-attached? card)
                           :attached)
                         :unknown)]
      (log/debugf "Rendering pulse card with chart-type %s and render-type %s" chart-type render-type)
      (body/render chart-type render-type timezone-id card dashcard data))
    (catch Throwable e
      (if (:card-error (ex-data e))
        (do
          (log/error e "Pulse card query error")
          (body/render :card-error nil nil nil nil nil))
        (do
          (log/error e "Pulse card render error")
          (body/render :render-error nil nil nil nil nil))))))

(mu/defn render-pulse-card :- formatter/RenderedPulseCard
  "Render a single `card` for a `Pulse` to Hiccup HTML. `result` is the QP results. Returns a map with keys

  - attachments
  - content (a hiccup form suitable for rendering on rich clients or rendering into an image)
  - render/text : raw text suitable for substituting on clients when text is preferable. (Currently slack uses this for
    scalar results where text is preferable to an image of a div of a single result."
  [render-type
   timezone-id :- [:maybe :string]
   card
   dashcard
   results]
  (let [{title             :content
         title-attachments :attachments} (make-title-if-needed render-type card dashcard)
        {description :content}           (make-description-if-needed dashcard card)
        {pulse-body       :content
         body-attachments :attachments
         text             :render/text}  (render-pulse-card-body render-type timezone-id card dashcard results)]
    (cond-> {:attachments (merge title-attachments body-attachments)
             :content [:p
                       ;; Provide a horizontal scrollbar for tables that overflow container width.
                       ;; Surrounding <p> element prevents buggy behavior when dragging scrollbar.
                       [:div
                        [:a {:href        (card-href card)
                             :target      "_blank"
                             :rel         "noopener noreferrer"
                             :style       (style/style
                                           (style/section-style)
                                           {:display         :block
                                            :text-decoration :none})}
                         title
                         description
                         [:div {:class "pulse-body"
                                :style (style/style {:overflow-x :auto ;; when content is wide enough, automatically show a horizontal scrollbar
                                                     :display :block
                                                     :margin  :16px})}
                          (if-let [more-results-message (body/attached-results-text render-type card)]
                            (conj more-results-message (list pulse-body))
                            pulse-body)]]]]}
      text (assoc :render/text text))))

(defn render-pulse-card-for-display
  "Same as `render-pulse-card` but isn't intended for an email, rather for previewing so there is no need for
  attachments"
  [timezone-id card results]
  (:content (render-pulse-card :inline timezone-id card nil results)))

(mu/defn render-pulse-section :- formatter/RenderedPulseCard
  "Render a single Card section of a Pulse to a Hiccup form (representating HTML)."
  [timezone-id
   {card :card, dashcard :dashcard, result :result}]
  (let [{:keys [attachments content]} (binding [*include-title*       true
                                                *include-description* true]
                                        (render-pulse-card :attachment timezone-id card dashcard result))]
    {:attachments attachments
     :content     [:div {:style (style/style {:margin-top    :20px
                                              :margin-bottom :20px})}
                   content]}))

(mu/defn render-pulse-card-to-png :- bytes?
  "Render a `pulse-card` as a PNG. `data` is the `:data` from a QP result."
  ^bytes [timezone-id :- [:maybe :string] pulse-card result width]
  (png/render-html-to-png (render-pulse-card :inline timezone-id pulse-card nil result) width))

(mu/defn render-pulse-card-to-base64 :- string?
  "Render a `pulse-card` as a PNG and return it as a base64 encoded string."
  ^String [timezone-id card dashcard result width]
  (-> (render-pulse-card :inline timezone-id card dashcard result)
      (png/render-html-to-png width)
      image-bundle/render-img-data-uri))

(mu/defn png-from-render-info :- bytes?
  "Create a PNG file (as a byte array) from rendering info."
  ^bytes [rendered-info :- formatter/RenderedPulseCard width]
  ;; TODO huh? why do we need this indirection?
  (png/render-html-to-png rendered-info width))
