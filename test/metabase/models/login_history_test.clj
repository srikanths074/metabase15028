(ns metabase.models.login-history-test
  (:require [clojure.string :as str]
            [clojure.test :refer :all]
            [environ.core :as env]
            [metabase.models :refer [LoginHistory User]]
            [metabase.models.login-history :as login-history]
            [metabase.models.setting.cache :as setting.cache]
            [metabase.test :as mt]
            [schema.core :as s]))

(deftest first-login-for-user-on-this-device?-test
  (let [device-1 (str (java.util.UUID/randomUUID))
        device-2 (str (java.util.UUID/randomUUID))]
    (mt/with-temp* [User         [{user-id :id}]
                    LoginHistory [history-1 {:user_id user-id, :device_id device-1}]]
      (testing "one login to device 1 -- should be the first login with this device"
        (is (= true
               (#'login-history/first-login-for-user-on-this-device? history-1))))
      (testing "add a history item for a *different* device -- should be the first login with this device"
        (mt/with-temp LoginHistory [history-2 {:user_id user-id, :device_id device-2}]
          (is (= true
                 (#'login-history/first-login-for-user-on-this-device? history-1)))
          (testing "add a second history item for device 1 -- should *not* be the first login with this device"
            (mt/with-temp LoginHistory [history-2 {:user_id user-id, :device_id device-1}]
              (is (= false
                     (#'login-history/first-login-for-user-on-this-device? history-1))))))))))

(deftest send-email-on-first-login-from-new-device-test
  (mt/with-temp User [{user-id :id, email :email, first-name :first_name}]
    (let [device (str (java.util.UUID/randomUUID))]
      (testing "send email on first login from new device"
        (mt/with-fake-inbox
          (mt/with-temp LoginHistory [_ {:user_id user-id, :device_id device, :timestamp #t "2021-04-02T15:52:00-07:00[US/Pacific]"}]
            (is (schema= {(s/eq email)
                          [{:from    (s/eq "metamailman@metabase.com")
                            :to      (s/eq [email])
                            :subject (s/eq (format "We've Noticed a New Login, %s" first-name))
                            :body    [(s/one {:type    (s/eq "text/html; charset=utf-8")
                                              :content s/Str}
                                             "HTML body")]}]}
                         @mt/inbox))
            (let [message (-> @mt/inbox (get email) first :body first :content)]
              (testing (format "\nMessage = %s" (pr-str message))
                (is (str/includes? message (format "We've Noticed a New Login, %s" first-name)))
                (is (str/includes? message "We noticed a login from a device you don't usually use."))
                (is (str/includes? message "Browser (Chrome/Windows) - Unknown location"))
                (is (str/includes? message "April 2 10:52 PM (GMT)"))))

            (testing "don't send email on subsequent login from same device"
              (mt/reset-inbox!)
              (mt/with-temp LoginHistory [_ {:user_id user-id, :device_id device}]
                (is (= {}
                       @mt/inbox)))))))))

  (testing "don't send email if the setting is disabled"
    (mt/with-temp User [{user-id :id, email :email, first-name :first_name}]
      (testing "send email on first login from new device"
        (try
          (mt/with-fake-inbox
            ;; can't use `mt/with-temporary-setting-values` here because it's a read-only setting
            (with-redefs [env/env (assoc env/env :mb-send-email-on-first-login-from-new-device "FALSE")]
              ;; flush the Setting cache so it picks up the env var value for the `send-email-on-first-login-from-new-device` setting
              (setting.cache/restore-cache!)
              (mt/with-temp LoginHistory [_ {:user_id user-id, :device_id (str (java.util.UUID/randomUUID))}]
                (is (= {}
                       @mt/inbox)))))
          (finally
            ;; flush the cache again so the original value of `send-email-on-first-login-from-new-device` gets
            ;; restored
            (setting.cache/restore-cache!)))))))
