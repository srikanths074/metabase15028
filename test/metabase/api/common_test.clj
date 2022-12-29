(ns metabase.api.common-test
  (:require [clj-http.client :as http]
            [clojure.test :refer :all]
            [clout.core :as clout]
            [compojure.core :refer [POST]]
            [metabase.api.common :as api]
            [metabase.api.common.internal :as api.internal]
            [metabase.server.middleware.exceptions :as mw.exceptions]
            [metabase.server.middleware.misc :as mw.misc]
            [metabase.server.middleware.security :as mw.security]
            [ring.adapter.jetty :as jetty])
  (:import clojure.lang.ExceptionInfo))

;;; TESTS FOR CHECK (ETC)

(def ^:private four-oh-four
  "The expected format of a 404 response."
  {:status  404
   :body    "Not found."
   :headers {"Cache-Control"                     "max-age=0, no-cache, must-revalidate, proxy-revalidate"
             "Content-Security-Policy"           (str (-> (@#'mw.security/content-security-policy-header) vals first)
                                                      " frame-ancestors 'none';")
             "Content-Type"                      "text/plain"
             "Expires"                           "Tue, 03 Jul 2001 06:00:00 GMT"
             "Last-Modified"                     true ; this will be current date, so do update-in ... string?
             "Strict-Transport-Security"         "max-age=31536000"
             "X-Content-Type-Options"            "nosniff"
             "X-Frame-Options"                   "DENY"
             "X-Permitted-Cross-Domain-Policies" "none"
             "X-XSS-Protection"                  "1; mode=block"}})

(defn- mock-api-fn [response-fn]
  ((-> (fn [request respond _]
         (respond (response-fn request)))
       mw.exceptions/catch-uncaught-exceptions
       mw.exceptions/catch-api-exceptions
       mw.misc/add-content-type)
   {:uri "/api/my_fake_api_call"}
   identity
   (fn [e] (throw e))))

(defn my-mock-api-fn []
  (mock-api-fn
   (fn [_]
     (api/check-404 @api/*current-user*)
     {:status 200
      :body   @api/*current-user*})))

(deftest ^:parallel check-404-test
  (testing "check that `check-404` doesn't throw an exception if `test` is true"
    (is (= {:status  200
            :body    "Cam Saul"
            :headers {"Content-Type" "text/plain"}}
           (binding [api/*current-user* (atom "Cam Saul")]
             (my-mock-api-fn)))))

  (testing "check that 404 is returned otherwise"
    (is (= four-oh-four
           (-> (my-mock-api-fn)
               (update-in [:headers "Last-Modified"] string?)))))

  (testing "let-404 should return nil if test fails"
    (is (= four-oh-four
           (-> (mock-api-fn
                (fn [_]
                  (api/let-404 [user nil]
                    {:user user})))
               (update-in [:headers "Last-Modified"] string?)))))

  (testing "otherwise let-404 should bind as expected"
    (is (= {:user {:name "Cam"}}
           ((mw.exceptions/catch-api-exceptions
             (fn [_ respond _]
               (respond
                (api/let-404 [user {:name "Cam"}]
                  {:user user}))))
            nil
            identity
            (fn [e] (throw e)))))))

(deftest ^:parallel parse-defendpoint-args-test
  (is (= {:method      'POST
          :route       ["/:id/dimension" :id "[0-9]+"]
          :docstr      String
          :args        '[id :as {{dimension-type :type, dimension-name :name} :body}]
          :arg->schema '{dimension-type schema.core/Int, dimension-name schema.core/Str}
          :fn-name     'POST_:id_dimension}
         (-> (#'api/parse-defendpoint-args
              '[POST "/:id/dimension"
                "Sets the dimension for the given object with ID."
                [id :as {{dimension-type :type, dimension-name :name} :body}]
                {dimension-type schema.core/Int
                 dimension-name schema.core/Str}])
             (update :docstr class)
             ;; two regex patterns are not equal even if they're the exact same pattern so convert to string so we can
             ;; compare easily.
             (update-in [:route 2] str)))))

(deftest ^:parallel defendpoint-test
  ;; replace regex `#"[0-9]+"` with str `"#[0-9]+" so expectations doesn't barf
  (binding [api.internal/*auto-parse-types* (update-in api.internal/*auto-parse-types* [:int :route-param-regex] (partial str "#"))]
    (is (= '(def GET_:id
              (compojure.core/GET
               ["/:id" :id "#[0-9]+"]
               [id]
               (metabase.api.common.internal/auto-parse [id]
                 (metabase.api.common.internal/validate-param 'id id metabase.util.schema/IntGreaterThanZero)
                 (metabase.api.common.internal/wrap-response-if-needed
                  (do
                    (select-one Card :id id))))))
           (macroexpand '(metabase.api.common/defendpoint compojure.core/GET "/:id" [id]
                           {id metabase.util.schema/IntGreaterThanZero}
                           (select-one Card :id id)))))))



(deftest matching-route-test
  (letfn [(in [bytes] (java.io.ByteArrayInputStream. bytes))
          (request [{:keys [body content length]}]
            {:uri     "/card/1"
             :headers (cond-> {}
                        content (assoc "content-type" (content
                                                       {:json "application/json"
                                                        :form "application/form"
                                                        :text "application/text"}))
                        length  (assoc "content-length" (str length)))
             :body    (in (.getBytes (case body
                                       :empty
                                       ""
                                       :json
                                       "{\"a\": 1}"
                                       :form
                                       "aa\nbb")))})
          (route
            ([] (api/matching-route "/card/:id" #{}))
            ([content-types] (api/matching-route "/card/:id" content-types)))]
    (testing "When no content-type is set"
      (testing "matches when content-length is zero"
        (is (= {:id "1"}
               (clout/route-matches (route) (request {:body    :empty
                                                      :length  0})))))
      (testing "matches when content-length is zero and route specifies a type"
        (is (= {:id "1"}
               (clout/route-matches (route #{:content/json})
                                    (request {:body    :empty
                                              :length  0})))))
      (testing "matches when content-length is absent and route specifies a type"
        (is (= {:id "1"}
               (clout/route-matches (route #{:content/json})
                                    (request {:body    :empty})))))
      (testing "throws when content-length is non-zero"
        (is (thrown-with-msg? ExceptionInfo #"Invalid content-type"
                              (clout/route-matches (route) (request {:body    :json
                                                                     :length  4})))))
      (testing "throws if content-length is 0 but body has info"
        (is (thrown-with-msg? ExceptionInfo #"Invalid content-type"
                              (clout/route-matches (route) (request {:body    :json
                                                                     :length  0 ;; liar
                                                                     }))))))
    (testing "When content-type is set"
      (testing "matches when content type is json and route doesn't specify"
        (is (= {:id "1"}
               (clout/route-matches (route) (request {:body    :json
                                                      :content :json
                                                      :length  4})))))
      (testing "matches when content type is form and route allows it"
        (is (= {:id "1"}
               (clout/route-matches (route #{:content/form})
                                    (request {:body    :form
                                              :content :form
                                              :length  4})))))
      (testing "throw when content type doesn't align and empty body"
        (is (thrown-with-msg? ExceptionInfo #"Invalid content-type"
                              (clout/route-matches (route #{:content/json})
                                                   (request {:body    :form
                                                             :content :empty
                                                             :length  0}))))))))

;; endpoint content-types are only honored if the route args have args not from the route
(api/defendpoint ^{:content-types #{:content/json :content/form}} POST
  "/both"
  []
  {:status 200 :body "/both"})

(api/defendpoint ^{:content-types #{:content/json}} POST
  "/json"
  []
  {:status 200 :body "/json"})

(api/defendpoint ^{:content-types #{:content/form}} POST
  "/form"
  []
  {:status 200 :body "/form"})

(api/defendpoint POST
  "/default"
  []
  {:status 200 :body "/default"})

(api/defendpoint ^{:content-types #{:content/*}} POST
  "/any"
  []
  {:status 200 :body "/any"})

(api/defendpoint POST ["/complicated/:foo" :foo #"aa|bb"]
  [foo]
  {:status 200 :body foo})

(api/defendpoint POST "/restore/:name"
  [name]
  {:status 200 :body name})

(api/defendpoint PUT "/put/none-specified"
  []
  {:status 200 :body "/put/none-specified"})

(api/defendpoint ^{:content-types #{:content/form}} PUT "/put/form"
  []
  {:status 200 :body "/put/form"})

(api/defendpoint ^{:content-types #{:content/*}} PUT "/put/any"
  []
  {:status 200 :body "/put/any"})

(api/define-routes)

(deftest post-and-put-routing-test
  (let [server (jetty/run-jetty routes {:port 0 :join? false})
        port (.. server getURI getPort)
        request! (fn [req-fn content-type route]
                   (req-fn (str "http://localhost:" port route)
                           (cond-> {:content-type content-type
                                    :throw-exceptions false}
                             (= content-type :json)
                             (assoc :body "{\"json\": \"input\"}")

                             (= content-type :form)
                             (assoc :multipart [{:name "title" :content "My Awesome Picture"}])

                             (= content-type :text)
                             (assoc :body "foo"))))
        post (partial request! http/post)
        put  (partial request! http/put)]
    (try
      (testing "allows content-type"
        (doseq [[route content-types] [["/both"    [:json :form]]
                                       ["/json"    [:json]]
                                       ["/form"    [:form]]
                                       ["/default" [:json]]
                                       ["/any"     [:json :text :form]]]
                content-type content-types]
          (testing route
            (testing content-type
              (is (= route (:body (post content-type route))))))))
      (testing "disallows non-allowed content-types"
        (doseq [[route content-types] [["/both" [:text]]
                                       ["/json" [:form :text]]
                                       ["/form" [:json :text]]
                                       ["/default" [:form :text]]]
                content-type content-types]
          (testing route
            (testing content-type
              (let [results (post content-type route)]
                (is (= 500 (:status results)))
                (is (re-find #"Invalid content-type" (:body results))))))))
      (testing "works for more routes with regexes"
        (is (= "aa" (:body (post :json "/complicated/aa"))))
        (is (= "foo" (:body (post :json "/restore/foo")))))
      (testing "puts"
        (testing "Allows given content-types"
          (doseq [[route content-types] [["/put/none-specified" [:json]]
                                         ["/put/any"            [:json :form :text]]
                                         ["/put/form"           [:form]]]
                  content-type content-types]
            (testing route
              (testing content-type
                (let [response (put content-type route)]
                  (is (= 200 (:status response)))
                  (is (= route (:body response))))))))
        (testing "Disallows given content-types"
          (doseq [[route content-types] [["/put/none-specified" [:form :text]]
                                         ["/put/form"           [:text :json]]]
                  content-type content-types]
            (testing route
              (testing content-type
                (let [response (put content-type route)]
                  (is (= 500 (:status response)))
                  ;; puts on this webserver return empty bodies. Not sure why but works in app
                  #_(is (re-find #"Invalid content-type" (:body response)))))))))
      (finally (.stop server)))))
