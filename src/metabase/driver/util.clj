(ns metabase.driver.util
  "Utility functions for common operations on drivers."
  (:require [clojure.core.memoize :as memoize]
            [clojure.set :as set]
            [clojure.string :as str]
            [clojure.tools.logging :as log]
            [metabase.config :as config]
            [metabase.driver :as driver]
            [metabase.models.setting :refer [defsetting]]
            [metabase.public-settings.premium-features :as premium-features]
            [metabase.query-processor.error-type :as error-type]
            [metabase.util :as u]
            [metabase.util.i18n :refer [trs]]
            [toucan.db :as db])
  (:import java.io.ByteArrayInputStream
           [java.security.cert CertificateFactory X509Certificate]
           java.security.KeyStore
           java.util.Base64
           javax.net.SocketFactory
           [javax.net.ssl SSLContext TrustManagerFactory X509TrustManager]))

;; This is normally set via the env var `MB_DB_CONNECTION_TIMEOUT_MS`
(defsetting db-connection-timeout-ms
  "Consider [[metabase.driver/can-connect?]] / [[can-connect-with-details?]] to have failed if they were not able to
  successfully connect after this many milliseconds. By default, this is 10 seconds."
  :visibility :internal
  :type       :integer
  ;; for TESTS use a timeout time of 3 seconds. This is because we have some tests that check whether
  ;; [[driver/can-connect?]] is failing when it should, and we don't want them waiting 10 seconds to fail.
  ;;
  ;; Don't set the timeout too low -- I've have Circle fail when the timeout was 1000ms on *one* occasion.
  :default    (if config/is-test?
                3000
                10000))

(defn can-connect-with-details?
  "Check whether we can connect to a database with `driver` and `details-map` and perform a basic query such as `SELECT
  1`. Specify optional param `throw-exceptions` if you want to handle any exceptions thrown yourself (e.g., so you
  can pass the exception message along to the user); otherwise defaults to returning `false` if a connection cannot be
  established.

     (can-connect-with-details? :postgres {:host \"localhost\", :port 5432, ...})"
  ^Boolean [driver details-map & [throw-exceptions]]
  {:pre [(keyword? driver) (map? details-map)]}
  (if throw-exceptions
    (try
      (u/with-timeout (db-connection-timeout-ms)
        (driver/can-connect? driver details-map))
      ;; actually if we are going to `throw-exceptions` we'll rethrow the original but attempt to humanize the message
      ;; first
      (catch Throwable e
        (log/error e (trs "Database connection error"))
        (throw (Exception. (str (driver/humanize-connection-error-message driver (.getMessage e))) e))))
    (try
      (can-connect-with-details? driver details-map :throw-exceptions)
      (catch Throwable e
        (log/error e (trs "Failed to connect to database"))
        false))))

(defn report-timezone-if-supported
  "Returns the report-timezone if `driver` supports setting it's timezone and a report-timezone has been specified by
  the user."
  [driver]
  (when (driver/supports? driver :set-timezone)
    (let [report-tz (driver/report-timezone)]
      (when (seq report-tz)
        report-tz))))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                               Driver Resolution                                                |
;;; +----------------------------------------------------------------------------------------------------------------+

(defn- database->driver* [database-or-id]
  (or
   (when-let [engine (:engine database-or-id)]
     ;; ensure we get the engine as a keyword (sometimes it's a String)
     (keyword engine))
   (db/select-one-field :engine 'Database, :id (u/the-id database-or-id))))

(def ^{:arglists '([database-or-id])} database->driver
  "Look up the driver that should be used for a Database. Lightly cached.

  (This is cached for a second, so as to avoid repeated application DB calls if this function is called several times
  over the duration of a single API request or sync operation.)"
  (memoize/ttl database->driver* :ttl/threshold 1000))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                             Available Drivers Info                                             |
;;; +----------------------------------------------------------------------------------------------------------------+

(defn features
  "Return a set of all features supported by `driver` with respect to `database`."
  [driver database]
  (set (for [feature driver/driver-features
             :when (driver/database-supports? driver feature database)]
         feature)))

(defn available-drivers
  "Return a set of all currently available drivers."
  []
  (set (for [driver (descendants driver/hierarchy :metabase.driver/driver)
             :when  (driver/available? driver)]
         driver)))

(defn- file-upload-props [{prop-name :name, visible-if :visible-if, disp-nm :display-name, :as conn-prop}]
  (if (premium-features/is-hosted?)
    [(-> (assoc conn-prop
           :name (str prop-name "-value")
           :type "textFile"
           :treat-before-posting "base64")
         (dissoc :secret-kind))]
    [(cond-> {:name (str prop-name "-options")
              :display-name disp-nm
              :type "select"
              :options [{:name (trs "Local file path")
                         :value "local"}
                        {:name (trs "Uploaded file path")
                         :value "uploaded"}]
              :default "local"}
             visible-if (assoc :visible-if visible-if))
     (-> {:name (str prop-name "-value")
          :type "textFile"
          :treat-before-posting "base64"
          :visible-if {(keyword (str prop-name "-options")) "uploaded"}}
       (dissoc :secret-kind))
     {:name (str prop-name "-path")
      :type "string"
      :display-name (trs "File path")
      :placeholder (:placeholder conn-prop)
      :visible-if {(keyword (str prop-name "-options")) "local"}}]))

(defn- ->str
  "Turns `x` into a String. If `x` a keyword, then `name` is used. Otherwise, `str` is called on it."
  [k]
  (if (keyword? k)
    (name k)
    (str k)))

(defn- expand-secret-conn-prop [{prop-name :name, visible-if :visible-if, :as conn-prop}]
  (case (->str (:secret-kind conn-prop))
    "password"    [(-> conn-prop
                       (assoc :type "password")
                       (assoc :name (str prop-name "-value"))
                       (dissoc :secret-kind))]
    "keystore"    (file-upload-props conn-prop)
    ;; this may not necessarily be a keystore (could be a standalone PKCS-8 or PKCS-12 file)
    "binary-blob" (file-upload-props conn-prop)
    ;; PEM is a plaintext format
    ;; TODO: do we need to also allow a textarea type paste for this?  would require another special case
    "pem-cert"    (file-upload-props conn-prop)
    [conn-prop]))

(defn- resolve-info-conn-prop
  "Invokes the getter function on a info type connection property and adds it to the connection property map as its
  placeholder value. Returns nil if no placeholder value or getter is provided, or if the getter returns a non-string
  value or throws an exception."
  [{prop-name :name, getter :getter, placeholder :placeholder, :as conn-prop}]
  (let [content (or placeholder
                    (try (getter)
                         (catch Throwable e
                           (log/error e (trs "Error invoking getter for connection property {0}"
                                             (:name conn-prop))))))]
    (when (string? content)
      (-> conn-prop
          (assoc :placeholder content)
          (dissoc :getter)))))

(defn- expand-schema-filters-prop [prop]
  (let [prop-name (:name prop)
        disp-name (or (:display-name prop) "")
        type-prop-nm (str prop-name "-type")]
    [{:name type-prop-nm
      :display-name disp-name
      :type "select"
      :options [{:name (trs "All")
                 :value "all"}
                {:name (trs "Only these...")
                 :value "inclusion"}
                {:name (trs "All except...")
                 :value "exclusion"}]
      :default "all"}
     {:name (str prop-name "-patterns")
      :type "text"
      :placeholder "E.x. public,auth*"
      :description (trs "Comma separated names of {0} that <strong>should</strong> appear in Metabase" (str/lower-case disp-name))
      :visible-if  {(keyword type-prop-nm) "inclusion"}
      :helper-text (trs "You can use patterns like <strong>auth*</strong> to match multiple {0}" (str/lower-case disp-name))
      :required true}
     {:name (str prop-name "-patterns")
      :type "text"
      :placeholder "E.x. public,auth*"
      :description (trs "Comma separated names of {0} that <strong>should NOT</strong> appear in Metabase" (str/lower-case disp-name))
      :visible-if  {(keyword type-prop-nm) "exclusion"}
      :helper-text (trs "You can use patterns like <strong>auth*</strong> to match multiple {0}" (str/lower-case disp-name))
      :required true}
      ]))


(defn connection-props-server->client
  "Transforms `conn-props` for the given `driver` from their server side definition into a client side definition.

  This transforms :type :secret properties from the server side definition into other types for client
  display/editing. For example, a :secret-kind :keystore turns into a bunch of different properties, to encapsulate
  all the different options that might be available on the client side for populating the value.

  This also resolves the :getter function on :type :info properties, if one was provided."
  {:added "0.42.0"}
  [driver conn-props]
  (let [res (reduce (fn [acc conn-prop]
                      ;; TODO: change this to expanded- and use that as the basis for all calcs below (not conn-prop)
                      (let [expanded-props (case (keyword (:type conn-prop))
                                             :secret
                                             (expand-secret-conn-prop conn-prop)

                                             :info
                                             (if-let [conn-prop' (resolve-info-conn-prop conn-prop)]
                                               [conn-prop']
                                               [])

                                             :schema-filters
                                             (expand-schema-filters-prop conn-prop)

                                             [conn-prop])]
                        (-> (update acc ::final-props concat expanded-props)
                            (update ::props-by-name merge (into {} (map (fn [p]
                                                                          [(:name p) p])) expanded-props)))))
                    {::final-props [] ::props-by-name {}}
                    conn-props)
        {:keys [::final-props ::props-by-name]} res]
    ;; now, traverse the visible-if-edges and update all visible-if entries with their full set of "transitive"
    ;; dependencies (if property x depends on y having a value, but y itself depends on z having a value, then x
    ;; should be hidden if y is)
    (mapv (fn [prop]
            (let [v-ifs* (loop [props* [prop]
                                acc    {}]
                           (if (seq props*)
                             (let [all-visible-ifs  (apply merge (map :visible-if props*))
                                   transitive-props (map (comp (partial get props-by-name) ->str)
                                                         (keys all-visible-ifs))
                                   next-acc         (merge all-visible-ifs acc)
                                   cyclic-props     (set/intersection (into #{} (keys all-visible-ifs))
                                                                      (into #{} (keys acc)))]
                               (if (empty? cyclic-props)
                                 (recur transitive-props next-acc)
                                 (-> "Cycle detected resolving dependent visible-if properties for driver {0}: {1}"
                                     (trs driver cyclic-props)
                                     (ex-info {:type               error-type/driver
                                               :driver             driver
                                               :cyclic-visible-ifs cyclic-props})
                                     throw)))
                             acc))]
              (cond-> prop
                (seq v-ifs*)
                (assoc :visible-if v-ifs*))))
         final-props)))

(defn db-details-client->server
  "Currently, this transforms client side values for the various back into :type :secret for storage on the server.
  Sort of the opposite of `connection-props-server->client`, except that it operates on DB details key/values populated
  by the client, not on connection detail maps created on the server."
  {:added "0.42.0"}
  [driver db-details]
  (when db-details
    (assert (some? driver))
    (let [secret-names->props    (reduce (fn [acc prop]
                                           (if (= "secret" (:type prop))
                                             (assoc acc (:name prop) prop)
                                             acc))
                                         {}
                                         (driver/connection-properties driver))

          secrets-server->client (reduce (fn [acc prop]
                                           (assoc acc (keyword (:name prop)) prop))
                                   {}
                                   (connection-props-server->client driver (vals secret-names->props)))]
      (reduce-kv (fn [acc prop-name prop]
                   (let [subprop    (fn [suffix]
                                      (keyword (str prop-name suffix)))
                         path-kw    (subprop "-path")
                         val-kw     (subprop "-value")
                         source-kw  (subprop "-source")
                         options-kw (subprop "-options")
                         path       (path-kw acc)
                         get-treat  (fn []
                                      (let [options (options-kw acc)]
                                        (when (= "uploaded" options)
                                          ;; the :treat-before-posting, if defined, would be applied to the client
                                          ;; version of the -value property (the :type "textFile" one)
                                          (let [textfile-prop (val-kw secrets-server->client)]
                                            (:treat-before-posting textfile-prop)))))
                         value      (let [^String v (val-kw acc)]
                                      (case (get-treat)
                                        "base64" (.decode (Base64/getDecoder) v)
                                        v))]
                     (cond-> (assoc acc val-kw value)
                       ;; keywords here are associated to nil, rather than being dissoced, because they will be merged
                       ;; with the existing db-details blob to produce the final details
                       ;; therefore, if we want a changed setting to take effect (i.e. switching from a file path to an
                       ;; upload), then we need to ensure the nil value is merged, rather than the stale value from the
                       ;; app DB being picked
                       path  (-> ; from outer cond->
                               (assoc val-kw nil) ; local path specified; remove the -value entry, if it exists
                               (assoc source-kw :file-path)) ; and set the :source to :file-path
                       value (-> ; from outer cond->
                               (assoc path-kw nil) ; value specified; remove the -path entry, if it exists
                               (assoc source-kw nil)) ; and remove the :source mapping
                       true  (dissoc (subprop "-options")))))
                 db-details
                 secret-names->props))))

(def official-drivers
  "The set of all official drivers"
  #{"bigquery-cloud-sdk" "druid" "googleanalytics" "h2" "mongo" "mysql" "postgres" "presto" "presto-jdbc" "redshift" "snowflake" "sparksql" "sqlite" "sqlserver"})

(def partner-drivers
  "The set of other drivers in the partnership program"
  #{"firebolt"})

(defn driver-source
  "Return the source type of the driver: official, partner, or community"
  [driver-name]
  (cond
    (contains? official-drivers driver-name) "official"
    (contains? partner-drivers driver-name) "partner"
    :else "community"))

(defn available-drivers-info
  "Return info about all currently available drivers, including their connection properties fields and supported
  features. The output of `driver/connection-properties` is passed through `connection-props-server->client` before
  being returned, to handle any transformation between the server side and client side representation."
  []
  (into {} (for [driver (available-drivers)
                 :let   [props (try
                                 (->> (driver/connection-properties driver)
                                      (connection-props-server->client driver))
                                 (catch Throwable e
                                   (log/error e (trs "Unable to determine connection properties for driver {0}" driver))))]
                 :when  props]
             ;; TODO - maybe we should rename `details-fields` -> `connection-properties` on the FE as well?
             [driver {:source {:type (driver-source (name driver))
                               :contact (driver/contact-info driver)}
                      :details-fields props
                      :driver-name    (driver/display-name driver)
                      :superseded-by  (driver/superseded-by driver)}])))

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                             TLS Helpers                                                        |
;;; +----------------------------------------------------------------------------------------------------------------+

(defn- dn-for-cert
  [^X509Certificate cert]
  (.. cert getSubjectX500Principal getName))

(defn generate-keystore-with-cert
  "Generates a `KeyStore` with custom certificates added"
  ^KeyStore [cert-string]
  (let [cert-factory (CertificateFactory/getInstance "X.509")
        cert-stream (ByteArrayInputStream. (.getBytes ^String cert-string "UTF-8"))
        certs (.generateCertificates cert-factory cert-stream)
        keystore (doto (KeyStore/getInstance (KeyStore/getDefaultType))
                   (.load nil nil))
        ;; this TrustManagerFactory is used for cloning the default certs into the new TrustManagerFactory
        base-trust-manager-factory (doto (TrustManagerFactory/getInstance (TrustManagerFactory/getDefaultAlgorithm))
                                     (.init ^KeyStore (cast KeyStore nil)))]
    (doseq [cert certs]
      (.setCertificateEntry keystore (dn-for-cert cert) cert))

    (doseq [^X509TrustManager trust-mgr (.getTrustManagers base-trust-manager-factory)]
      (when (instance? X509TrustManager trust-mgr)
        (doseq [issuer (.getAcceptedIssuers trust-mgr)]
          (.setCertificateEntry keystore (dn-for-cert issuer) issuer))))

    keystore))

(defn socket-factory-for-cert
  "Generates an `SocketFactory` with the custom certificates added"
  ^SocketFactory [cert-string]
  (let [keystore (generate-keystore-with-cert cert-string)
        ;; this is the final TrustManagerFactory used to initialize the SSLContext
        trust-manager-factory (TrustManagerFactory/getInstance (TrustManagerFactory/getDefaultAlgorithm))
        ssl-context (SSLContext/getInstance "TLS")]
    (.init trust-manager-factory keystore)
    (.init ssl-context nil (.getTrustManagers trust-manager-factory) nil)

    (.getSocketFactory ssl-context)))

(def default-sensitive-fields
  "Set of fields that should always be obfuscated in API responses, as they contain sensitive data."
  #{:password :pass :tunnel-pass :tunnel-private-key :tunnel-private-key-passphrase :access-token :refresh-token
    :service-account-json})

(defn sensitive-fields
  "Returns all sensitive fields that should be redacted in API responses for a given database. Calls get-sensitive-fields
  using the given database's driver, if that driver is valid and registered. Refer to get-sensitive-fields docstring
  for full details."
  [driver]
  (if-some [conn-prop-fn (get-method driver/connection-properties driver)]
    (let [all-fields      (conn-prop-fn driver)
          password-fields (filter #(contains? #{:password :secret} (get % :type)) all-fields)]
      (into default-sensitive-fields (map (comp keyword :name) password-fields)))
    default-sensitive-fields))
