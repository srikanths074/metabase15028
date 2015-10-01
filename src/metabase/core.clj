;; -*- comment-column: 35; -*-
(ns metabase.core
  (:gen-class)
  (:require (clojure.java [io :as io]
                          [shell :as shell])
            [clojure.string :as s]
            [clojure.tools.logging :as log]
            [colorize.core :as color]
            [ring.adapter.jetty :as ring-jetty]
            (ring.middleware [cookies :refer [wrap-cookies]]
                             [gzip :refer [wrap-gzip]]
                             [json :refer [wrap-json-response
                                           wrap-json-body]]
                             [keyword-params :refer [wrap-keyword-params]]
                             [params :refer [wrap-params]]
                             [session :refer [wrap-session]])
            [medley.core :as m]
            (metabase [config :as config]
                      [db :as db]
                      [driver :as driver]
                      [events :as events]
                      [middleware :as mb-middleware]
                      [routes :as routes]
                      [setup :as setup]
                      [task :as task])
            (metabase.models [setting :refer [defsetting]]
                             [database :refer [Database]]
                             [user :refer [User]])))

;; ## CONFIG

(defsetting site-name "The name used for this instance of Metabase." "Metabase")

(defsetting -site-url "The base URL of this Metabase instance, e.g. \"http://metabase.my-company.com\"")

(defsetting anon-tracking-enabled "Enable the collection of anonymous usage data in order to help Metabase improve." "true")

(defn site-url
  "Fetch the site base URL that should be used for password reset emails, etc.
   This strips off any trailing slashes that may have been added.

   The first time this function is called, we'll set the value of the setting `-site-url` with the value of
   the ORIGIN header (falling back to HOST if needed, i.e. for unit tests) of some API request.
   Subsequently, the site URL can only be changed via the admin page."
  {:arglists '([request])}
  [{{:strs [origin host]} :headers}]
  {:pre  [(or origin host)]
   :post [(string? %)]}
  (or (some-> (-site-url)
              (s/replace #"/$" "")) ; strip off trailing slash if one was included
      (-site-url (or origin host))))

(def app
  "The primary entry point to the HTTP server"
  (-> routes/routes
      (mb-middleware/log-api-call :request :response)
      mb-middleware/add-security-headers              ; [METABASE] Add HTTP headers to API responses to prevent them from being cached
      mb-middleware/format-response                   ; [METABASE] Do formatting before converting to JSON so serializer doesn't barf
      (wrap-json-body                                 ; extracts json POST body and makes it avaliable on request
        {:keywords? true})
      wrap-json-response                              ; middleware to automatically serialize suitable objects as JSON in responses
      wrap-keyword-params                             ; converts string keys in :params to keyword keys
      wrap-params                                     ; parses GET and POST params as :query-params/:form-params and both as :params
      mb-middleware/bind-current-user                 ; Binds *current-user* and *current-user-id* if :metabase-user-id is non-nil
      mb-middleware/wrap-current-user-id              ; looks for :metabase-session-id and sets :metabase-user-id if Session ID is valid
      mb-middleware/wrap-api-key                      ; looks for a Metabase API Key on the request and assocs as :metabase-api-key
      mb-middleware/wrap-session-id                   ; looks for a Metabase Session ID and assoc as :metabase-session-id
      wrap-cookies                                    ; Parses cookies in the request map and assocs as :cookies
      wrap-session                                    ; reads in current HTTP session and sets :session/key
      wrap-gzip))                                     ; GZIP response if client can handle it

(defn- -init-create-setup-token
  "Create and set a new setup token, and open the setup URL on the user's system."
  []
  (let [setup-token (setup/token-create)
        hostname    (or (config/config-str :mb-jetty-host) "localhost")
        port        (config/config-int :mb-jetty-port)
        setup-url   (str "http://"
                         (or hostname "localhost")
                         (when-not (= 80 port) (str ":" port))
                         "/setup/init/"
                         setup-token)]
    (log/info (color/green "Please use the following url to setup your Metabase installation:\n\n"
                           setup-url
                           "\n\n"))))

(defn destroy
  "General application shutdown function which should be called once at application shuddown."
  []
  (log/info "Metabase Shutting Down ...")
  (task/stop-scheduler!)
  (log/info "Metabase Shutdown COMPLETE"))

(defn init
  "General application initialization function which should be run once at application startup."
  []
  (log/info (format "Starting Metabase version %s..." ((config/mb-version-info) :long)))
  ;; First of all, lets register a shutdown hook that will tidy things up for us on app exit
  (.addShutdownHook (Runtime/getRuntime) (Thread. ^Runnable destroy))
  (log/debug "Using Config:\n" (with-out-str (clojure.pprint/pprint config/config-all)))

  ;; Bootstrap the event system
  (events/initialize-events!)

  ;; startup database.  validates connection & runs any necessary migrations
  (db/setup-db :auto-migrate (config/config-bool :mb-db-automigrate))

  ;; run a very quick check to see if we are doing a first time installation
  ;; the test we are using is if there is at least 1 User in the database
  (when-not (db/sel :one :fields [User :id])
    (log/info "Looks like this is a new installation ... preparing setup wizard")
    (-init-create-setup-token)
    (events/publish-event :install {}))

  ;; Now start the task runner
  (task/start-scheduler!)

  (log/info "Metabase Initialization COMPLETE")
  true)


;; ## Jetty (Web) Server

(def ^:private jetty-instance
  (atom nil))

(defn start-jetty
  "Start the embedded Jetty web server."
  []
  (when-not @jetty-instance
    (let [jetty-config (cond-> (m/filter-vals identity {:port (config/config-int :mb-jetty-port)
                                                        :host (config/config-str :mb-jetty-host)
                                                        :max-threads (config/config-int :mb-jetty-maxthreads)
                                                        :min-threads (config/config-int :mb-jetty-minthreads)
                                                        :max-queued (config/config-int :mb-jetty-maxqueued)
                                                        :max-idle-time (config/config-int :mb-jetty-maxidletime)})
                         (config/config-str :mb-jetty-join) (assoc :join? (config/config-bool :mb-jetty-join))
                         (config/config-str :mb-jetty-daemon) (assoc :daemon? (config/config-bool :mb-jetty-daemon)))]
      (log/info "Launching Embedded Jetty Webserver with config:\n" (with-out-str (clojure.pprint/pprint jetty-config)))
      (->> (ring-jetty/run-jetty app jetty-config)
           (reset! jetty-instance)))))

(defn stop-jetty
  "Stop the embedded Jetty web server."
  []
  (when @jetty-instance
    (log/info "Shutting Down Embedded Jetty Webserver")
    (.stop ^org.eclipse.jetty.server.Server @jetty-instance)
    (reset! jetty-instance nil)))

(def ^:private ^:const sample-dataset-name "Sample Dataset")
(def ^:private ^:const sample-dataset-filename "sample-dataset.db.mv.db")

(defsetting sample-dataset-id
  "The string-serialized integer ID of the `Database` entry for the Sample Dataset. If this is `nil`, the Sample Dataset
   hasn't been loaded yet, and we should do so; otherwise we've already loaded it, and should not do so again. Keep in
   mind the user may delete the Sample Dataset's DB, so this ID is not guaranteed to correspond to an existent object."
  nil
  :internal true) ; don't expose in the UI

(defn- add-sample-dataset! []
  (when-not (sample-dataset-id)
    (try
      (log/info "Loading sample dataset...")
      (let [resource (io/resource sample-dataset-filename)]
        (if-not resource
          (log/error (format "Can't load sample dataset: the DB file '%s' can't be found." sample-dataset-filename))
          (let [h2-file (-> (.getPath resource)
                            (s/replace #"^file:" "zip:")        ; to connect to an H2 DB inside a JAR just replace file: with zip:
                            (s/replace #"\.mv\.db$" "")         ; strip the .mv.db suffix from the path
                            (str ";USER=GUEST;PASSWORD=guest")) ; specify the GUEST user account created for the DB
                db      (db/ins Database
                          :name    sample-dataset-name
                          :details {:db h2-file}
                          :engine  :h2)]
            (driver/sync-database! db)
            (sample-dataset-id (str (:id db))))))
      (catch Throwable e
        (log/error (format "Failed to load sample dataset: %s" (.getMessage e)))))))

(defn- run-script [script-name & args]
  (let [script-resource (io/resource (str "scripts/" script-name))]
    (when-not script-resource
      (throw (Exception. (format "No script named %s." script-name))))
    ;; Now copy the file from path/to/metabase.jar!/scripts/<file> to ./<file>
    ;; because we can't run scripts bundled inside the jar
    (let [script (str "./" script-name)]
      (io/copy (slurp script-resource) (io/file script))
      (shell/sh "chmod" "+x" script)
      (println "\n\nScript copied to:" script) ; use println here instead of log/* because this is guaranteed to happen interactively
      (println "Running script...\n")
      (-> (apply shell/sh script args)
          :out
          println))))
;; TODO - should we delete the "temporary" script (e.g. ./<script>) when we're done?
;; or should we advise the user they can run it again from there instead of via the uberjar ??

(defn- start-metabase []
  (log/info "Starting Metabase in STANDALONE mode")
  (try
    ;; run our initialization process
    (init)
    ;; add the sample dataset DB if applicable
    (add-sample-dataset!)
    ;; launch embedded webserver
    (start-jetty)
    (catch Exception e
      (.printStackTrace e)
      (log/error "Metabase Initialization FAILED: " (.getMessage e)))))

(defn -main
  "Launch Metabase in standalone mode."
  [first-arg & rest-args]
  (if (= first-arg "--script")
    (do (apply run-script rest-args) ; run a script like java -jar path/to/metabase.jar --script [my-script-name] [args....]
        (System/exit 0))
    (start-metabase)))
