(ns metabase.util.json-test
  (:require [metabase.util.json :as json]
            [cheshire.core :as cheshire]
            [clojure.test :refer :all]))

(deftest cheshire-equivalency-test
  (testing "objects with custom encoders are encoded the same as in Cheshire"
    (are [object] (let [o object] (= (json/encode o) (cheshire/encode o)))
      ;; (Object.)
      (byte-array (range 60 80))
      (java.time.Instant/now))))
