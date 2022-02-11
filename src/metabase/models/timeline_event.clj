(ns metabase.models.timeline-event
  (:require [metabase.models.interface :as i]
            [metabase.util :as u]
            [metabase.util.honeysql-extensions :as hx]
            [toucan.db :as db]
            [toucan.models :as models]))

(models/defmodel TimelineEvent :timeline_event)

;;;; permissions

(defn- perms-objects-set
  [event read-or-write]
  (let [timeline (or (:timeline event)
                     (db/select-one 'Timeline :id (:timeline_id event)))]
    (i/perms-objects-set timeline read-or-write)))

;;;; hydration
(defn- hydrate-events-impl
  "Event hydration implementation."
  [timelines archived?]
  (when (seq timelines)
    (let [timeline-id->events (->> (db/select TimelineEvent
                                     :timeline_id [:in (map :id timelines)]
                                     :archived archived?
                                     {:order-by [[:timestamp :asc]]})
                                   (group-by :timeline_id))]
      (for [{:keys [id] :as timeline} timelines]
        (let [events (timeline-id->events id)]
          (when timeline
            (assoc timeline :events (if events events []))))))))

;; todo: is there a way to pass args into the hydrate function instead of having two hydrate keys?
(defn hydrate-events
  "Efficiently hydrate the events for a timeline."
  {:batched-hydrate :events}
  [timelines]
  (hydrate-events-impl timelines false))

(defn hydrate-archived-events
  "Efficiently hydrate the events for a timeline when `archived` is `true`."
  {:batched-hydrate :archived-events}
  [timelines]
  (hydrate-events-impl timelines true))

;;;; model

(u/strict-extend (class TimelineEvent)
  models/IModel
  (merge
   models/IModelDefaults
   ;; todo: add hydration keys??
   {#_#_:hydration-keys (constantly [:timeline-event])
    :properties (constantly {:timestamped? true})})

  i/IObjectPermissions
  (merge
   i/IObjectPermissionsDefaults
   {:perms-objects-set perms-objects-set
    :can-read?         (partial i/current-user-has-full-permissions? :read)
    :can-write?        (partial i/current-user-has-full-permissions? :write)}))

(comment
  (let [start (java.time.OffsetDateTime/of
               (java.time.LocalDateTime/of 2022 2 8 9 0)
               (java.time.ZoneOffset/of "+6"))
        end (java.time.OffsetDateTime/now)]
    (count
     (db/query {:select [:*]
                :from [[TimelineEvent :e]]
                :where [:and
                        ;; in our collections
                        [:in :timeline_id [2 3]]
                        [:or
                         ;; absolute time in bounds
                         [:and
                          [:= :time_matters true]
                          ;; less than or equal?
                          [:<= start :timestamp]
                          [:<= :timestamp end]]
                         ;; non-specic time in bounds
                         [:and
                          [:= :time_matters false]
                          [:<= (hx/->date start) (hx/->date :timestamp)]
                          [:<= (hx/->date :timestamp) (hx/->date end)]]]]})))
  )
