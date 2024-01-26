(ns metabase-enterprise.advanced-permissions.models.permissions.block-permissions
  (:require
   [metabase.api.common :as api]
   [metabase.models.data-permissions :as data-perms]
   [metabase.public-settings.premium-features
    :refer [defenterprise]]
   [metabase.query-processor.error-type :as qp.error-type]
   [metabase.util.i18n :refer [tru]]))

(defn- current-user-has-block-permissions-for-database?
  [database-or-id]
  (= (data-perms/database-permission-for-user api/*current-user-id* :perms/data-access database-or-id)
     :block))

(defenterprise check-block-permissions
  "Assert that block permissions are not in effect for Database for a query that's only allowed to run because of
  Collection perms; throw an Exception if they are. Otherwise returns a keyword explaining why the check
  succeeded (this is mostly for test/debug purposes). The query is still allowed to run if the current User has
  appropriate data permissions from another Group. See the namespace documentation for [[metabase.models.collection]]
  for more details."
  :feature :advanced-permissions
  [{database-id :database}]
  (or
   (not (current-user-has-block-permissions-for-database? database-id))
   (throw (ex-info (tru "Blocked: you are not allowed to run queries against Database {0}." database-id)
                   {:type               qp.error-type/missing-required-permissions
                    :actual-permissions @api/*current-user-permissions-set*
                    :permissions-error? true}))))
