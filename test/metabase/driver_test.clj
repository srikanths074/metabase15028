(ns metabase.driver-test
  (:require [clojure.test :refer :all]
            [metabase.driver :as driver]
            [metabase.driver.impl :as impl]
            [metabase.plugins.classloader :as classloader]))

(driver/register! ::test-driver, :abstract? true)

(defmethod driver/supports? [::test-driver :foreign-keys] [_ _] true)
(defmethod driver/database-supports? [::test-driver :foreign-keys] [_ _ db] (= db "dummy"))


(deftest driver-supports?-test
  (is (= true
         (driver/supports? ::test-driver :foreign-keys)))
  (is (= false
         (driver/supports? ::test-driver :expressions)))
  (is (thrown? java.lang.Exception
               (driver/supports? ::test-driver :some-made-up-thing))))

(deftest database-supports?-test
  (is (= true
         (driver/database-supports? ::test-driver :foreign-keys "dummy")))
  (is (= false
         (driver/database-supports? ::test-driver :foreign-keys "not-dummy")))
  (is (= false
         (driver/database-supports? ::test-driver :expressions "dummy")))
  (is (thrown? java.lang.Exception
               (driver/database-supports? ::test-driver :some-made-up-thing "dummy"))))

(deftest the-driver-test
  (testing (str "calling `the-driver` should set the context classloader, important because driver plugin code exists "
                "there but not elsewhere")
    (.setContextClassLoader (Thread/currentThread) (ClassLoader/getSystemClassLoader))
    (driver/the-driver :h2)
    (is (= @@#'classloader/shared-context-classloader
           (.getContextClassLoader (Thread/currentThread))))))

(deftest available?-test
  (with-redefs [impl/concrete? (constantly true)]
    (is (= true
           (driver/available? ::test-driver)))
    (is (= true
           (driver/available? "metabase.driver-test/test-driver"))
        "`driver/available?` should work for if `driver` is a string -- see #10135")))
