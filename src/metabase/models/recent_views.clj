(ns metabase.models.recent-views
  "The Recent Views table is used to track the most recent views of objects such as Cards, Tables and Dashboards for
  each user."
  (:require
   [metabase.util :as u]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]
   [methodical.core :as m]
   [toucan2.core :as t2]))

(doto :model/RecentViews
  (derive :metabase/model))

(m/defmethod t2/table-name :model/RecentViews
  [_model]
  :recent_views)

(t2/define-before-insert :model/RecentViews
  [log-entry]
  (let [defaults {:timestamp :%now}]
    (merge defaults log-entry)))

(def ^:private ^:dynamic recent-views-stored-per-user
  "The number of recently viewed items to keep per user. This should be larger than the number of items returned by the
  /api/activity/recent_views endpoint, but it should still be lightweight to read all of a user's recent views at once."
  100)

(defn- view-ids-to-prune
  "Returns a set of view IDs to prune from the RecentViews table so we only keep the most recent n views per user.
  Ensures that we keep the most recent dashboard view for the user."
  [prior-views n]
  (if (< (count prior-views) n)
    []
    (let [ids-to-keep                    (map :id (take n prior-views))
          ;; We want to make sure we keep the most recent dashboard view for the user
          ids-to-prune                   (map :id (drop n prior-views))
          most-recent-dashboard-id       (->> prior-views (filter #(= "dashboard" (:model %))) first :id)
          pruning-most-recent-dashboard? ((set ids-to-keep) most-recent-dashboard-id)]
      (if pruning-most-recent-dashboard?
        (conj (remove #{most-recent-dashboard-id} (set ids-to-prune))
              (first ids-to-keep))
        ids-to-prune))))

(defn user-recent-views
  "Returns the most recent `n` unique views for a given user."
  ([user-id]
   (user-recent-views user-id recent-views-stored-per-user))

  ([user-id n]
   (let [all-user-views (t2/select-fn-vec #(select-keys % [:model :model_id])
                                          :model/RecentViews
                                          :user_id user-id
                                          {:order-by [[:timestamp :desc]]
                                           :limit    recent-views-stored-per-user})]
     (take n (distinct all-user-views)))))

(mu/defn update-users-recent-views!
  "Updates the RecentViews table for a given user with a new view, and prunes old views."
  [user-id  :- [:maybe ms/PositiveInt]
   model    :- [:enum :model/Card :model/Table :model/Dashboard]
   model-id :- ms/PositiveInt]
  (when user-id
    (t2/with-transaction [_conn]
      (let [prior-views  (t2/select :model/RecentViews :user_id user-id {:order-by [[:timestamp :desc]]})
            ids-to-prune (view-ids-to-prune prior-views recent-views-stored-per-user)
            ;; Lower-case the model name, since that's what the FE expects
            model-name   (u/lower-case-en (name model))]
        (t2/insert! :model/RecentViews {:user_id  user-id
                                        :model    model-name
                                        :model_id model-id})
        (when (seq ids-to-prune)
         (t2/delete! :model/RecentViews :id [:in ids-to-prune]))))))
