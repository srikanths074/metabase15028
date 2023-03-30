(ns metabase.metabot
  (:require
   [clojure.string :as str]
   [clojure.core.memoize :as memoize]
   [metabase.metabot.client :as metabot-client]
   [metabase.metabot.model-finder :as model-finder]
   [metabase.metabot.sql-generator :as sql-generator]
   [wkok.openai-clojure.api :as openai.api]))

(defn infer-sql [model question]
  (cond
    (false? (metabot-client/is-metabot-enabled)) nil
    (metabot-client/openai-sql-inference-webhook) (metabot-client/infer-sql model question)
    :else (sql-generator/infer-sql model question)))

(defn infer-model [database question]
  (cond
    (false? (metabot-client/is-metabot-enabled)) nil
    (metabot-client/openai-model-inference-webhook) (metabot-client/infer-model database question)
    :else (model-finder/infer-model database question)))
