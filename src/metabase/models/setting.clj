(ns metabase.models.setting
  (:refer-clojure :exclude [get set])
  (:require [clojure.string :as s]
            [environ.core :as env]
            [korma.core :as k]
            [metabase.config :as config]
            [metabase.db :refer [sel del]]
            [metabase.models [common :as common]
                             [interface :refer :all]]
            [metabase.setup :as setup]
            [metabase.util :as u]
            [metabase.util.password :as password]))

;; Settings are a fast + simple way to create a setting that can be set
;; from the SuperAdmin page. They are saved to the Database, but intelligently
;; cached internally for super-fast lookups.
;;
;; Define a new Setting with `defsetting` (optionally supplying a default value):
;;
;;    (defsetting mandrill-api-key "API key for Mandrill")
;;
;; The setting and docstr will then be auto-magically accessible from the SuperAdmin page.
;;
;; You can also set the value via the corresponding env var, which looks like
;; `MB_MANDRILL_API_KEY`, where the name of the setting is converted to uppercase and dashes to underscores.
;;
;; The var created with `defsetting` can be used as a getter/setter, or you can
;; use `get`/`set`/`delete`:
;;
;;     (require '[metabase.models.setting :as setting])
;;
;;     (setting/get :mandrill-api-key)           ; only returns values set explicitly from SuperAdmin
;;     (mandrill-api-key)                        ; returns value set in SuperAdmin, OR value of corresponding env var, OR the default value, if any (in that order)
;;
;;     (setting/set :mandrill-api-key "NEW_KEY")
;;     (mandrill-api-key "NEW_KEY")
;;
;;     (setting/delete :mandrill-api-key)
;;     (mandrill-api-key nil)
;;
;; Get a map of all Settings:
;;
;;    (setting/all)

(declare Setting
         cached-setting->value
         restore-cache-if-needed
         settings-list)

;; # PUBLIC

;; ## ACCESSORS

(defn get
  "Fetch value of `Setting`, first trying our cache, or fetching the value
   from the DB if that fails. (Cached lookup time is ~60µs, compared to ~1800µs for DB lookup)

   Unlike using the setting getter fn, this will *not* return default values or values specified by env vars."
  [k]
  {:pre [(keyword? k)]}
  (restore-cache-if-needed)
  (or (@cached-setting->value k)
      (when-let [v (sel :one :field [Setting :value] :key (name k))]
        (swap! cached-setting->value assoc k v)
        v)))

(defn set
  "Set the value of a `Setting`.

    (set :mandrill-api-key \"xyz123\")"
  [k v]
  {:pre [(keyword? k)
         (string? v)]}
  (if (get k) (k/update Setting
                        (k/set-fields {:value v})
                        (k/where {:key (name k)}))
      (k/insert Setting
                (k/values {:key   (name k)
                           :value v})))
  (restore-cache-if-needed)
  (swap! cached-setting->value assoc k v)
  v)

(defn delete
  "Delete a `Setting`."
  [k]
  {:pre [(keyword? k)]}
  (restore-cache-if-needed)
  (swap! cached-setting->value dissoc k)
  (del Setting :key (name k)))

;; ## DEFSETTING

(defn get-from-env-var
  "Given a `Setting` like `:mandrill-api-key`, return the value of the corresponding env var,
   e.g. `MB_MANDRILL_API_KEY`."
  [setting-key]
  (env/env (keyword (str "mb-" (name setting-key)))))

(defmacro defsetting
  "Defines a new `Setting` that will be added to the DB at some point in the future.
   Conveniently can be used as a getter/setter as well:

     (defsetting mandrill-api-key \"API key for Mandrill.\")
     (mandrill-api-key)           ; get the value
     (mandrill-api-key new-value) ; update the value
     (mandrill-api-key nil)       ; delete the value

   A setting can be set from the SuperAdmin page or via the corresponding env var,
   eg. `MB_MANDRILL_API_KEY` for the example above.

   You may optionally pass any of the kwarg OPTIONS below, which are kept as part of the
   metadata of the `Setting` under the key `::options`:

     *  `:internal` - This `Setting` is for internal use and shouldn't be exposed in the UI (i.e., not
        returned by the corresponding endpoints). Default: `false`"
  [nm description & [default-value & {:as options}]]
  {:pre [(symbol? nm)
         (string? description)]}
  (let [setting-key (keyword nm)]
    `(defn ~nm ~description
       {::is-setting?   true
        ::default-value ~default-value
        ::options       ~options}
       ([]
        (or (get ~setting-key)
            (get-from-env-var ~setting-key)
            ~default-value))
       ([value#]
        (if-not value#
          (delete ~setting-key)
          (set ~setting-key value#))))))


;; ## ALL SETTINGS (ETC)

(defn all
  "Return a map of all *defined* `Settings`.

    (all) -> {:mandrill-api-key ...}"
  []
  (restore-cache-if-needed)
  @cached-setting->value)

(defn all-with-descriptions
  "Return a sequence of Settings maps, including value and description."
  []
  (let [settings (all)]
    (->> (settings-list)
         (map (fn [{k :key :as setting}]
                (assoc setting
                       :value (k settings))))
         (sort-by :key))))

(defn public-settings
  "Return a simple map of key/value pairs which represent the public settings for the front-end application."
  []
  {:ga_code               "UA-60817802-1"
   :intercom_code         "gqfmsgf1"
   :password_complexity   (password/active-password-complexity)
   :setup_token           (setup/token-value)
   :timezones             common/timezones
   :version               (config/mb-version-info)
   ;; all of these values are dynamic settings controlled at runtime
   :anon_tracking_enabled (= "true" (get :anon-tracking-enabled))
   :site_name             (get :site-name)
   :email_configured      (not (s/blank? (get :email-smtp-host)))})

;; # IMPLEMENTATION

(defn- restore-cache-if-needed []
  (when-not @cached-setting->value
    (reset! cached-setting->value (->> (sel :many Setting)
                                       (map (fn [{k :key v :value}]
                                              {(keyword k) v}))
                                       (into {})))))

(def ^:private cached-setting->value
  "Map of setting name (keyword) -> string value, as they exist in the DB."
  (atom nil))

(defentity Setting
  [(k/table :setting)])

(defn- settings-list
  "Return a list of all Settings (as created with `defsetting`).
   This excludes Settings created with the option `:internal`."
  []
  (->> (all-ns)
       (mapcat ns-interns)
       vals
       (map meta)
       (filter ::is-setting?)
       (filter (complement (u/rpartial get-in [::options :internal]))) ; filter out :internal Settings
       (map (fn [{k :name desc :doc default ::default-value}]
              {:key         (keyword k)
               :description desc
               :default     (or (when (get-from-env-var k)
                                  (format "Using $MB_%s" (-> (name k)
                                                             (s/replace "-" "_")
                                                             s/upper-case)))
                                default)}))))
