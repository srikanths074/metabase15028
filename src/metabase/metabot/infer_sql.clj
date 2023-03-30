(ns metabase.metabot.infer-sql
  (:require
   [cheshire.core :as json]
   [clojure.string :as str]
   [metabase.db.query :as mdb.query]
   [metabase.lib.native :as lib-native]
   [metabase.metabot.util :as metabot-util]
   [metabase.metabot.client :as metabot-client]
   [metabase.util :as u]
   [metabase.util.log :as log]))

(defn extract-sql
  "Search a provided string for a SQL block"
  [s]
  (if (str/starts-with? (u/upper-case-en (str/trim s)) "SELECT")
    ;; This is just a raw SQL statement
    s
    ;; It looks like markdown
    (let [[_pre sql _post] (str/split s #"```(sql|SQL)?")]
      (mdb.query/format-sql sql))))

(defn infer-sql
  "Given a model and prompt, attempt to generate a native dataset."
  [{:keys [model] :as context}]
  (log/debug "Metabot is inferring sql.")
  (let [{:keys [version prompt_template] :as template} (metabot-util/prompt-template :infer_sql)
        _        (log/infof "Generating SQL from prompt template: '%s:%s'" prompt_template version)
        messages (metabot-util/prompt-template->messages template context)
        {:keys [database_id inner_query]} model]
    (when-some [bot-sql (metabot-client/invoke-metabot messages extract-sql)]
      (let [final-sql     (metabot-util/bot-sql->final-sql model bot-sql)
            template-tags (lib-native/template-tags inner_query)
            response      {:dataset_query            {:database database_id
                                                      :type     "native"
                                                      :native   {:query         final-sql
                                                                 :template-tags template-tags}}
                           :display                  :table
                           :visualization_settings   {}
                           :prompt_template_versions (vec
                                                      (conj
                                                       (:prompt_template_versions model)
                                                       (format "%s:%s" prompt_template version)))}]
        (tap> {:response response})
        response))))
