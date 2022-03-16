(ns metabase.db.data-migrations-test
  "Tests to make sure the data migrations actually work as expected and don't break things. Shamefully, we have way less
  of these than we should... but that doesn't mean we can't write them for our new ones :)"
  (:require [cheshire.core :as json]
            [clojure.test :refer :all]
            [crypto.random :as crypto-random]
            [metabase.db.data-migrations :as migrations]
            [metabase.models.card :refer [Card]]
            [metabase.models.dashboard :refer [Dashboard]]
            [metabase.models.dashboard-card :refer [DashboardCard]]
            [metabase.models.permissions-group :as group]
            [metabase.models.setting :as setting]
            [metabase.public-settings.premium-features-test :as premium-features-test]
            [metabase.test :as mt]
            [metabase.test.fixtures :as fixtures]
            [metabase.util :as u]
            [metabase.util.i18n :refer [deferred-tru]]
            [toucan.db :as db])
  (:import com.unboundid.ldap.sdk.DN))

(use-fixtures :once (fixtures/initialize :db))

(deftest fix-click-through-test
  (let [migrate (fn [card dash]
                  (:visualization_settings
                   (#'migrations/fix-click-through {:id                     1
                                                    :dashcard_visualization dash
                                                    :card_visualization     card})))]
    (testing "toplevel"
      (let [card {"some_setting:"       {"foo" 123}
                  "click_link_template" "http://example.com/{{col_name}}"
                  "click"               "link"}
            dash {"other_setting" {"bar" 123}}]
        (is (= {"other_setting"  {"bar" 123}
                "click_behavior" {"type"         "link"
                                  "linkType"     "url"
                                  "linkTemplate" "http://example.com/{{col_name}}"}}
               (migrate card dash)))))

    (testing "top level disabled"
      (let [card {"some_setting:"       {"foo" 123}
                  "click_link_template" "http://example.com/{{col_name}}"
                  "click"               "link"}
            dash {"other_setting"       {"bar" 123}
                  "click_link_template" "http://example.com/{{col_name}}"
                  "click"               "menu"}]
        ;;click: "menu" turned off the custom drill through so it's not migrated. Dropping click and click_link_template would be fine but isn't needed.
        (is (nil? (migrate card dash)))))
    (testing "column settings"
      (let [card {"some_setting" {"foo" 123}
                  "column_settings"
                  {"[\"ref\",[\"field-id\",1]]"
                   {"view_as"       "link"
                    "link_template" "http://example.com/{{id}}"
                    "link_text"     "here is my id: {{id}}"}}}
            dash {"other_setting" {"bar" 123}
                  "column_settings"
                  {"[\"ref\",[\"field-id\",1]]" {"fun_formatting" "foo"}
                   "[\"ref\",[\"field-id\",2]]" {"other_fun_formatting" 123}}}]
        (is (= {"other_setting" {"bar" 123}
                "column_settings"
                {"[\"ref\",[\"field-id\",1]]"
                 {"fun_formatting" "foo"
                  "click_behavior" {"type"             "link"
                                    "linkType"         "url"
                                    "linkTemplate"     "http://example.com/{{id}}"
                                    "linkTextTemplate" "here is my id: {{id}}"}}
                 "[\"ref\",[\"field-id\",2]]"
                 {"other_fun_formatting" 123}}}
               (migrate card dash)))))
    (testing "manually updated new behavior"
      (let [card {"some_setting"        {"foo" 123}
                  "click_link_template" "http://example.com/{{col_name}}"
                  "click"               "link"}
            dash {"other_setting"  {"bar" 123}
                  "click_behavior" {"type"         "link"
                                    "linkType"     "url"
                                    "linkTemplate" "http://example.com/{{other_col_name}}"}}]
        (is (nil? (migrate card dash)))))
    (testing "Manually updated to new behavior on Column"
      (let [card {"some_setting" {"foo" 123},
                  "column_settings"
                  {"[\"ref\",[\"field-id\",1]]"
                   {"view_as"                  "link"
                    "link_template"            "http://example.com/{{id}}"
                    "other_special_formatting" "currency"}
                   "[\"ref\",[\"field-id\",2]]"
                   {"view_as"              "link",
                    "link_template"        "http://example.com/{{something_else}}",
                    "other_fun_formatting" 0}}}
            dash {"other_setting" {"bar" 123}
                  "column_settings"
                  {"[\"ref\",[\"field-id\",1]]"
                   {"click_behavior"
                    {"type"         "link"
                     "linkType"     "url"
                     "linkTemplate" "http://example.com/{{id}}"}}
                   "[\"ref\",[\"field-id\",2]]"
                   {"other_fun_formatting" 123}}}]
        (is (= {"other_setting" {"bar" 123}
                "column_settings"
                {"[\"ref\",[\"field-id\",1]]"
                 {"click_behavior"
                  {"type"         "link",
                   "linkType"     "url",
                   "linkTemplate" "http://example.com/{{id}}"}}
                 "[\"ref\",[\"field-id\",2]]"
                 {"other_fun_formatting" 123,
                  "click_behavior"
                  {"type"         "link",
                   "linkType"     "url",
                   "linkTemplate" "http://example.com/{{something_else}}"}}}}
               (migrate card dash)))))
    (testing "If there is migration eligible on dash but also new style on dash, new style wins"
      (let [dash {"column_settings"
                  {"[\"ref\",[\"field-id\",4]]"
                   {"view_as"       "link"
                    "link_template" "http://old" ;; this stuff could be migrated
                    "link_text"     "old"
                    "column_title"  "column title"
                    "click_behavior"
                    {"type"             "link",
                     "linkType"         "url", ;; but there is already a new style and it wins
                     "linkTemplate"     "http://new",
                     "linkTextTemplate" "new"}}}}]
        ;; no change
        (is (nil? (migrate nil dash)))))
    (testing "flamber case"
      (let [card {"column_settings"
                  {"[\"ref\",[\"field-id\",4]]"
                   {"view_as"       "link"
                    "link_template" "http//localhost/?QCDT&{{CATEGORY}}"
                    "link_text"     "MyQCDT {{CATEGORY}}"
                    "column_title"  "QCDT Category"}
                   "[\"ref\",[\"field-id\",6]]"
                   {"view_as"       "link"
                    "column_title"  "QCDT Rating"
                    "link_text"     "Rating {{RATING}}"
                    "link_template" "http//localhost/?QCDT&{{RATING}}"
                    "prefix"        "prefix-"
                    "suffix"        "-suffix"}
                   "[\"ref\",[\"field-id\",5]]"
                   {"view_as"       nil
                    "link_text"     "QCDT was disabled"
                    "link_template" "http//localhost/?QCDT&{{TITLE}}"
                    "column_title"  "(QCDT disabled) Title"}}
                  "table.pivot_column" "CATEGORY"
                  "table.cell_column"  "PRICE"}
            dash {"table.cell_column"  "PRICE"
                  "table.pivot_column" "CATEGORY"
                  "column_settings"
                  {"[\"ref\",[\"field-id\",5]]"
                   {"view_as"       nil
                    "link_text"     "QCDT was disabled"
                    "link_template" "http//localhost/?QCDT&{{TITLE}}"
                    "column_title"  "(QCDT disabled) Title"}
                   "[\"ref\",[\"field-id\",4]]"
                   {"view_as"       "link"
                    "link_template" "http//localhost/?QCDT&{{CATEGORY}}"
                    "link_text"     "MyQCDT {{CATEGORY}}"
                    "column_title"  "QCDT Category"
                    "click_behavior"
                    {"type"             "link"
                     "linkType"         "url"
                     "linkTemplate"     "http//localhost/?CB&{{CATEGORY}}"
                     "linkTextTemplate" "MyCB {{CATEGORY}}"}}
                   "[\"ref\",[\"field-id\",6]]"
                   {"view_as"       "link"
                    "column_title"  "QCDT Rating"
                    "link_text"     "Rating {{RATING}}"
                    "link_template" "http//localhost/?QCDT&{{RATING}}"
                    "prefix"        "prefix-"
                    "suffix"        "-suffix"}}
                  "card.title"         "Table with QCDT - MANUALLY ADDED CB 37"}]
        (is (= {"card.title"         "Table with QCDT - MANUALLY ADDED CB 37"
                "column_settings"
                {"[\"ref\",[\"field-id\",4]]"
                 {"column_title"  "QCDT Category"
                  "view_as"       "link"
                  "link_template" "http//localhost/?QCDT&{{CATEGORY}}"
                  "link_text"     "MyQCDT {{CATEGORY}}"
                  "click_behavior"
                  {"type"             "link"
                   "linkType"         "url"
                   "linkTemplate"     "http//localhost/?CB&{{CATEGORY}}"
                   "linkTextTemplate" "MyCB {{CATEGORY}}"}}
                 "[\"ref\",[\"field-id\",5]]"
                 {"link_text"     "QCDT was disabled"
                  "column_title"  "(QCDT disabled) Title"
                  "link_template" "http//localhost/?QCDT&{{TITLE}}"}
                 "[\"ref\",[\"field-id\",6]]"
                 {"prefix"        "prefix-"
                  "suffix"        "-suffix"
                  "column_title"  "QCDT Rating"
                  "view_as"       "link"
                  "link_text"     "Rating {{RATING}}"
                  "link_template" "http//localhost/?QCDT&{{RATING}}"
                  "click_behavior"
                  {"type"             "link"
                   "linkType"         "url"
                   "linkTemplate"     "http//localhost/?QCDT&{{RATING}}"
                   "linkTextTemplate" "Rating {{RATING}}"}}}
                "table.cell_column"  "PRICE"
                "table.pivot_column" "CATEGORY"}
               (migrate card dash))))))
  (testing "general case"
    (let [card-vis              {"column_settings"
                                 {"[\"ref\",[\"field-id\",2]]"
                                  {"view_as"       "link",
                                   "link_template" "http://example.com/{{ID}}",
                                   "link_text"     "here's an id: {{ID}}"},
                                  "[\"ref\",[\"field-id\",6]]"
                                  {"view_as"       "link",
                                   "link_template" "http://example.com//{{id}}",
                                   "link_text"     "here is my id: {{id}}"}},
                                 "table.pivot_column"  "QUANTITY",
                                 "table.cell_column"   "DISCOUNT",
                                 "click"               "link",
                                 "click_link_template" "http://example.com/{{count}}",
                                 "graph.dimensions"    ["CREATED_AT"],
                                 "graph.metrics"       ["count"],
                                 "graph.show_values"   true}
          original-dashcard-vis {"click"            "link",
                                 "click_link_template"
                                 "http://localhost:3001/?year={{CREATED_AT}}&cat={{CATEGORY}}&count={{count}}",
                                 "graph.dimensions" ["CREATED_AT" "CATEGORY"],
                                 "graph.metrics"    ["count"]}
          fixed                 (#'migrations/fix-click-through {:id                     1,
                                                                 :card_visualization     card-vis
                                                                 :dashcard_visualization original-dashcard-vis})]
      (is (= {:id 1,
              :visualization_settings
              {"graph.dimensions"    ["CREATED_AT" "CATEGORY"],
               "graph.metrics"       ["count"],
               "click"               "link",
               "click_link_template" "http://localhost:3001/?year={{CREATED_AT}}&cat={{CATEGORY}}&count={{count}}",
               "click_behavior"
               {"type"         "link",
                "linkType"     "url",
                "linkTemplate" "http://localhost:3001/?year={{CREATED_AT}}&cat={{CATEGORY}}&count={{count}}"},
               "column_settings"
               ;; note none of this keywordizes keys in json parsing since these structures are gross as keywords
               {"[\"ref\",[\"field-id\",2]]"
                {"click_behavior"
                 {"type"             "link",
                  "linkType"         "url",
                  "linkTemplate"     "http://example.com/{{ID}}",
                  "linkTextTemplate" "here's an id: {{ID}}"}},
                "[\"ref\",[\"field-id\",6]]"
                {"click_behavior"
                 {"type"             "link",
                  "linkType"         "url",
                  "linkTemplate"     "http://example.com//{{id}}",
                  "linkTextTemplate" "here is my id: {{id}}"}}}}}
             fixed))
      (testing "won't fix if fix is already applied"
        ;; a customer got a custom script from flamber (for which this is making that fix available for everyone. See
        ;; #15014)
        (is (= nil (#'migrations/fix-click-through
                    {:id                     1
                     :card_visualization     card-vis
                     :dashcard_visualization (:visualization_settings fixed)}))))))
  (testing "ignores columns when `view_as` is null"
    (let [card-viz {"column_settings"
                    {"normal"
                     ;; this one is view_as link so we should get it
                     {"view_as"       "link",
                      "link_template" "dash",
                      "link_text"     "here's an id: {{ID}}"}
                     "null-view-as"
                     {"view_as"       nil
                      "link_template" "i should not be present",
                      "link_text"     "i should not be present"}}}
          dash-viz {}]
      (is (= ["normal"]
             (keys (get-in
                    (#'migrations/fix-click-through {:id                     1
                                                     :card_visualization     card-viz
                                                     :dashcard_visualization dash-viz})
                    [:visualization_settings "column_settings"])))))))

(deftest migrate-click-through-test
  (testing "Migrate old style click through behavior to new (#15014)"
    (let [card-vis     (json/generate-string
                        {"column_settings"
                         {"[\"ref\",[\"field-id\",2]]"
                          {"view_as"       "link",
                           "link_template" "http://example.com/{{ID}}",
                           "link_text"     "here's an id: {{ID}}"},
                          "[\"ref\",[\"field-id\",6]]"
                          {"view_as"       "link",
                           "link_template" "http://example.com//{{id}}",
                           "link_text"     "here is my id: {{id}}"}},
                         "table.pivot_column"  "QUANTITY",
                         "table.cell_column"   "DISCOUNT",
                         "click"               "link",
                         "click_link_template" "http://example.com/{{count}}",
                         "graph.dimensions"    ["CREATED_AT"],
                         "graph.metrics"       ["count"],
                         "graph.show_values"   true})
          dashcard-vis (json/generate-string
                        {"click"            "link",
                         "click_link_template"
                         "http://localhost:3001/?year={{CREATED_AT}}&cat={{CATEGORY}}&count={{count}}",
                         "graph.dimensions" ["CREATED_AT" "CATEGORY"],
                         "graph.metrics"    ["count"]})]
      (mt/with-temp* [Dashboard     [{dashboard-id :id}]
                      Card          [{card-id :id} {:visualization_settings card-vis}]
                      DashboardCard [{dashcard-id :id} {:dashboard_id           dashboard-id
                                                        :card_id                card-id
                                                        :visualization_settings dashcard-vis}]]
        (let [expected-settings {:graph.dimensions ["CREATED_AT" "CATEGORY"],
                                 :graph.metrics    ["count"],
                                 :click            "link",
                                 :click_link_template
                                 "http://localhost:3001/?year={{CREATED_AT}}&cat={{CATEGORY}}&count={{count}}"
                                 :click_behavior
                                 {:type         "link",
                                  :linkType     "url",
                                  :linkTemplate "http://localhost:3001/?year={{CREATED_AT}}&cat={{CATEGORY}}&count={{count}}"},
                                 :column_settings
                                 ;; the model keywordizes the json parsing yielding this monstrosity below
                                 {"[\"ref\",[\"field\",2,null]]"
                                  {:click_behavior
                                   {:type             "link",
                                    :linkType         "url",
                                    :linkTemplate     "http://example.com/{{ID}}",
                                    :linkTextTemplate "here's an id: {{ID}}"}},
                                  "[\"ref\",[\"field\",6,null]]"
                                  {:click_behavior
                                   {:type             "link",
                                    :linkType         "url",
                                    :linkTemplate     "http://example.com//{{id}}",
                                    :linkTextTemplate "here is my id: {{id}}"}}}}
              get-settings!     #(:visualization_settings (db/select-one DashboardCard :id dashcard-id))]
          (#'migrations/migrate-click-through)
          (is (= expected-settings (get-settings!)))
          (testing "And it is idempotent"
            (#'migrations/migrate-click-through)
            (is (= expected-settings (get-settings!)))))))))

(deftest run-with-data-migration-index-test
  (let [meaning-of-life (atom nil)]
    (migrations/defmigration what-is-the-meaning-of-life?
      (migrations/run-with-data-migration-index 2
        (reset! meaning-of-life 42)))

    (testing "shouldn't run if current data-migration-index is larger than requried index"
      (mt/with-temporary-setting-values
        [data-migration-index 3]
        (what-is-the-meaning-of-life?)
        (is (= nil @meaning-of-life))
        (is (= 3 (setting/get :data-migration-index)))))

    (testing "should run if current data-migration-index is smaller than requried index"
      (mt/with-temporary-setting-values
        [data-migration-index 1]
        (what-is-the-meaning-of-life?)
        (is (= 42 @meaning-of-life))
        (is (= 2 (setting/get :data-migration-index)))))

    (testing "should run if current data-migration-index even if current data-migration-index is nil"
      (mt/with-temporary-setting-values
        [data-migration-index nil]
        (reset! meaning-of-life nil)
        (what-is-the-meaning-of-life?)
        (is (= 42 @meaning-of-life))
        (is (= 2 (setting/get :data-migration-index)))))))

(def ^:private default-saml-idp-certificate
  "Public certificate from Auth0, used to validate mock SAML responses from Auth0"
  "MIIDEzCCAfugAwIBAgIJYpjQiNMYxf1GMA0GCSqGSIb3DQEBCwUAMCcxJTAjBgNV
BAMTHHNhbWwtbWV0YWJhc2UtdGVzdC5hdXRoMC5jb20wHhcNMTgwNTI5MjEwMDIz
WhcNMzIwMjA1MjEwMDIzWjAnMSUwIwYDVQQDExxzYW1sLW1ldGFiYXNlLXRlc3Qu
YXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzNcrpju4
sILZQNe1adwg3beXtAMFGB+Buuc414+FDv2OG7X7b9OSYar/nsYfWwiazZRxEGri
agd0Sj5mJ4Qqx+zmB/r4UgX3q/KgocRLlShvvz5gTD99hR7LonDPSWET1E9PD4XE
1fRaq+BwftFBl45pKTcCR9QrUAFZJ2R/3g06NPZdhe4bg/lTssY5emCxaZpQEku/
v+zzpV2nLF4by0vSj7AHsubrsLgsCfV3JvJyTxCyo1aIOlv4Vrx7h9rOgl9eEmoU
5XJAl3D7DuvSTEOy7MyDnKF17m7l5nOPZCVOSzmCWvxSCyysijgsM5DSgAE8DPJy
oYezV3gTX2OO2QIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSp
B3lvrtbSDuXkB6fhbjeUpFmL2DAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQEL
BQADggEBAAEHGIAhR5GPD2JxgLtpNtZMCYiAM4Gr7hoTQMaKiXgVtdQu4iMFfbpE
wIr6UVaDU2HKhvSRFIilOjRGmCGrIzvJgR2l+RL1Z3KrZypI1AXKJT5pF5g5FitB
sZq+kiUpdRILl2hICzw9Q1M2Le+JSUcHcbHTVgF24xuzOZonxeE56Oc26Ju4CorL
pM3Nb5iYaGOlQ+48/GP82cLxlVyi02va8tp7KP03ePSaZeBEKGpFtBtEN/dC3NKO
1mmrT9284H0tvete6KLUH+dsS6bDEYGHZM5KGoSLWRr3qYlCB3AmAw+KvuiuSczL
g9oYBkdxlhK9zZvkjCgaLCen+0aY67A=")

(defn- call-with-default-ldap-and-sso-config [ldap-group-mapping sso-group-mapping f]
  (mt/with-temporary-setting-values
    [jwt-enabled                        true
     jwt-identity-provider-uri          "http://test.idp.metabase.com"
     jwt-shared-secret                  (crypto-random/hex 32)
     jwt-group-mappings                 sso-group-mapping
     saml-enabled                       true
     saml-identity-provider-uri         "http://test.idp.metabase.com"
     saml-identity-provider-certificate default-saml-idp-certificate
     saml-group-mappings                sso-group-mapping
     ldap-enabled                       true
     ldap-host                          "http://localhost:8888"
     ldap-user-base                     "dc=metabase,dc=com"
     ldap-group-mappings                ldap-group-mapping
     ldap-sync-admin-group              false
     data-migration-index               nil]
    (f)))

(defmacro ^:private with-full-ldap-and-sso-configured
  [ldap-group-mapping sso-group-mapping & body]
  (premium-features-test/with-premium-features #{:sso}
    (binding [setting/*allow-retired-setting-names* true]
      (setting/defsetting ldap-sync-admin-group
        (deferred-tru "Sync the admin group?")
        :type    :boolean
        :default false)
      `(call-with-default-ldap-and-sso-config ~ldap-group-mapping ~sso-group-mapping (fn [] ~@body)))))

(deftest migrate-remove-admin-from-group-mapping-if-needed-test
  (let [admin-group-id        (u/the-id (group/admin))
        sso-group-mapping     {:group-mapping-a [admin-group-id (+ 1 admin-group-id)]
                               :group-mapping-b [admin-group-id (+ 1 admin-group-id) (+ 2 admin-group-id)]}
        ldap-group-mapping    {"dc=metabase,dc=com" [admin-group-id (+ 1 admin-group-id)]}
        sso-expected-mapping  {:group-mapping-a [(+ 1 admin-group-id)]
                               :group-mapping-b [(+ 1 admin-group-id) (+ 2 admin-group-id)]}
        ldap-expected-mapping {(DN. "dc=metabase,dc=com") [(+ 1 admin-group-id)]}]

    (testing "Remove admin from group mapping for LDAP, SAML, JWT if they are enabled"
      (with-full-ldap-and-sso-configured ldap-group-mapping sso-group-mapping
        (#'migrations/migrate-remove-admin-from-group-mapping-if-needed)
        (is (= sso-expected-mapping (setting/get :jwt-group-mappings)))
        (is (= sso-expected-mapping (setting/get :saml-group-mappings)))
        (is (= ldap-expected-mapping (setting/get :ldap-group-mappings)))))

    (testing "Does not remove admin from group mapping for LDAP, SAML, JWT if they are disable"
      (with-full-ldap-and-sso-configured ldap-group-mapping sso-group-mapping
        (mt/with-temporary-setting-values
          [saml-enabled false
           jwt-enabled  false
           ldap-enabled false]
          (#'migrations/migrate-remove-admin-from-group-mapping-if-needed)
          (is (= sso-group-mapping (setting/get :jwt-group-mappings)))
          (is (= sso-group-mapping (setting/get :saml-group-mappings)))
          (is (= {(DN. "dc=metabase,dc=com") [admin-group-id(+ 1 admin-group-id)]}
                 (setting/get :ldap-group-mappings)))))))

  (testing "Don't remove admin group if `ldap-sync-admin-group` is enabled"
    (let [admin-group-id     (u/the-id (group/admin))
          group-ids          [admin-group-id (+ 1 admin-group-id)]
          ldap-group-mapping    {"dc=metabase,dc=com" group-ids}
          ldap-expected-mapping {(DN. "dc=metabase,dc=com") group-ids}]
      (with-full-ldap-and-sso-configured ldap-group-mapping nil
        (mt/with-temporary-setting-values
          [ldap-sync-admin-group true]
          (#'migrations/migrate-remove-admin-from-group-mapping-if-needed)
          (is (= ldap-expected-mapping (setting/get :ldap-group-mappings))))))))
