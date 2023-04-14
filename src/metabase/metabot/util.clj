(ns metabase.metabot.util
  "Functions for denormalizing input, prompt input generation, and sql handing.
  If this grows much, we might want to split these out into separate nses."
  (:require
   [cheshire.core :as json]
   [clojure.core.memoize :as memoize]
   [clojure.string :as str]
   [honey.sql :as sql]
   [metabase.db.query :as mdb.query]
   [metabase.mbql.util :as mbql.u]
   [metabase.metabot.settings :as metabot-settings]
   [metabase.models :refer [Card Field FieldValues Table]]
   [metabase.query-processor :as qp]
   [metabase.query-processor.reducible :as qp.reducible]
   [metabase.query-processor.util.add-alias-info :as add]
   [metabase.util :as u]
   [metabase.util.log :as log]
   [toucan2.core :as t2]))

(defn supported?
  "Is metabot supported for the given database."
  [db-id]
  (let [q "SELECT 1 FROM (SELECT 1 AS ONE) AS TEST"]
    (try
      (some?
       (qp/process-query {:database db-id
                          :type     "native"
                          :native   {:query q}}))
      (catch Exception _ false))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;; Input Denormalization ;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(defn normalize-name
  "Normalize model and column names to SLUG_CASE.
  The current bot responses do a terrible job of creating all kinds of SQL from a table or column name.
  Example: 'Created At', CREATED_AT, \"created at\" might all come back in the response.
  Standardization of names produces dramatically better results."
  [s]
  (some-> s
          u/upper-case-en
          (str/replace #"[^\p{Alnum}]+" " ")
          str/trim
          (str/replace #" " "_")))

(defn- add-qp-column-aliases
  "Add the aliases generated by the query processor to each results metadata field."
  [{:keys [dataset_query] :as model}]
  (let [fields           (let [qp (qp.reducible/combine-middleware
                                    (vec qp/around-middleware)
                                    (fn [query _rff _context]
                                      (add/add-alias-info
                                        (#'qp/preprocess* query))))]
                           (get-in (qp dataset_query nil nil) [:query :fields]))
        field-ref->alias (reduce
                           (fn [acc [_f _id-or-name m :as field-ref]]
                             (if-let [alias (::add/desired-alias m)]
                               (assoc acc (mbql.u/remove-namespaced-options field-ref) alias)
                               acc))
                           {}
                           fields)]
    (update model :result_metadata
            (fn [result_metadata]
              (map
                (fn [{:keys [field_ref] :as rsmd}]
                  (assoc rsmd :qp_column_name (field-ref->alias field_ref)))
                result_metadata)))))

(defn- add-inner-query
  "Produce a SELECT * over the parameterized model with columns aliased to normalized display names.
  Add this result to the input model along with the generated column aliases.
  This can be used in a CTE such that an outer query can be called on this query."
  [{:keys [id result_metadata] :as model}]
  (let [column-aliases (or
                         (some->> result_metadata
                                  (map (comp
                                         (fn [[column_name column_alias]]
                                           (cond
                                             (and column_name column_alias) (format "\"%s\" AS %s" column_name column_alias)
                                             column_alias column_alias
                                             :else nil))
                                         (juxt :qp_column_name :sql_name)))
                                  (filter identity)
                                  seq
                                  (str/join ", "))
                         "*")]
    (assoc model
      :column_aliases column-aliases
      :inner_query
      (mdb.query/format-sql
        (format "SELECT %s FROM {{#%s}} AS INNER_QUERY" column-aliases id)))))

(defn- denormalize-field
  "Create a 'denormalized' version of the field which is optimized for querying
  and prompt engineering. Add in enumerated values (if a low-cardinality field),
  and remove fields unused in prompt engineering."
  [{:keys [id base_type] :as field}]
  (let [field-vals (when
                     (and
                       (not= :type/Boolean base_type)
                       (< 0
                          (get-in field [:fingerprint :global :distinct-count] 0)
                          (inc (metabot-settings/enum-cardinality-threshold))))
                     (t2/select-one-fn :values FieldValues :field_id id))]
    (-> (cond-> field
          (seq field-vals)
          (assoc :possible_values (vec field-vals)))
        (dissoc :field_ref :id))))

(defn- create-enum-ddl
  "Create the postgres enum for any item in result_metadata that has enumerated/low cardinality values."
  [{:keys [result_metadata]}]
  (into {}
        (for [{:keys [display_name sql_name possible_values]} result_metadata
              :when (seq possible_values)
              :let [ddl-str (format "create type %s_t as enum %s;"
                                    sql_name
                                    (str/join ", " (map (partial format "'%s'") possible_values)))
                    nchars  (count ddl-str)]]
          (do
            (log/debugf "Pseudo-ddl for field %s enumerates %s possible values contains %s chars (~%s tokens)."
                        display_name
                        (count possible_values)
                        nchars
                        (quot nchars 4))
            [sql_name ddl-str]))))

(defn- create-table-ddl
  "Create an equivalent DDL for this model"
  [{model-name :name :keys [sql_name result_metadata] :as model}]
  (let [enums   (create-enum-ddl model)
        [ddl] (sql/format
               {:create-table sql_name
                :with-columns (for [{:keys [sql_name base_type]} result_metadata
                                    :let [k sql_name]]
                                [k (if (enums k)
                                     (format "%s_t" k)
                                     base_type)])}
               {:dialect :ansi})
        ddl-str (str/join "\n\n" (conj (vec (vals enums)) (mdb.query/format-sql ddl)))
        nchars  (count ddl-str)]
    (log/debugf "Pseudo-ddl for model %s describes %s enum fields and contains %s chars (~%s tokens)."
                model-name
                (count enums)
                nchars
                (quot nchars 4))
    ddl-str))

(defn- add-create-table-ddl [model]
  (assoc model :create_table_ddl (create-table-ddl model)))

(defn- add-sql-names
  "Add a distinct SCREAMING_SNAKE_CASE sql name to each field in the result_metadata."
  [{:keys [result_metadata] :as model}]
  (let [m (->> result_metadata
               (map
                 (fn [{:keys [display_name] :as rsmd}]
                   ;; Add in a baseline name
                   (assoc rsmd :sql_name (normalize-name display_name))))
               ;; Sort name length (desc) then sql_name.
               ;; We want longer names first so pre-existing conflicts will resolve first
               ;; e.g. ABC, ABC, ABC_0 should result in ABC_0, ABC, ABC_1, not ABC, ABC_0, ABC_0_0
               ;; The remaining sort keys beyond :sql_name aren't that important.
               ;; They are just there for stability.
               (sort-by (juxt (comp - count :sql_name)
                              :sql_name
                              :display_name
                              :name
                              :id)))]
    (loop [[{:keys [sql_name] :as f} & r] m
           reserved-names #{}
           res            []]
      (cond
        (nil? f)
        (assoc model :result_metadata res)
        ;; This name is already taken, find a unique one
        (reserved-names sql_name)
        (let [sql-names      (map (partial format "%s_%s" sql_name) (range))
              final-sql-name (first (drop-while reserved-names sql-names))]
          (recur r (conj reserved-names final-sql-name) (conj res (assoc f :sql_name final-sql-name))))
        ;; Name is unique, continue
        :else
        (recur r (conj reserved-names sql_name) (conj res f))))))

(defn denormalize-model
  "Create a 'denormalized' version of the model which is optimized for querying.
  All foreign keys are resolved as data, sql-friendly names are added, and
  an inner_query is added that is a 'plain sql' query of the data
  (with sql friendly column names) that can be used to query this model."
  [{model-name :name :as model}]
  (-> model
      add-qp-column-aliases
      add-sql-names
      add-inner-query
      (update :result_metadata #(mapv denormalize-field %))
      (assoc :sql_name (normalize-name model-name))
      add-create-table-ddl
      (dissoc :creator_id :dataset_query :table_id :collection_position)))

(defn- models->json-summary
  "Convert a map of {:models ...} to a json string summary of these models.
  This is used as a summary of the database in prompt engineering."
  [{:keys [models]}]
  (let [json-str (json/generate-string
                  {:tables
                   (for [{model-name :name model-id :id :keys [result_metadata] :as _model} models]
                     {:table-id     model-id
                      :table-name   model-name
                      :column-names (mapv :display_name result_metadata)})}
                  {:pretty true})
        nchars   (count json-str)]
    (log/debugf "Database json string descriptor contains %s chars (~%s tokens)."
                nchars
                (quot nchars 4))
    json-str))

(defn- add-model-json-summary [database]
  (assoc database :model_json_summary (models->json-summary database)))

(defn- field->pseudo-enums
  "For a field, create a potential enumerated type string.
  Returns nil if there are no field values or the cardinality is too high."
  [{table-name :name} {field-name :name field-id :id :keys [base_type]}]
  (when-let [values (and
                     (not= :type/Boolean base_type)
                     (t2/select-one-fn :values FieldValues :field_id field-id))]
    (when (<= (count values) (metabot-settings/enum-cardinality-threshold))
      (let [ddl-str (format "create type %s_%s_t as enum %s;"
                            table-name
                            field-name
                            (str/join ", " (map (partial format "'%s'") values)))
            nchars  (count ddl-str)]
        (log/debugf "Pseudo-ddl for field enum %s describes %s values and contains %s chars (~%s tokens)."
                    field-name
                    (count values)
                    nchars
                    (quot nchars 4))
        ddl-str))))

(defn- table->pseudo-ddl
  "Create an 'approximate' ddl to represent how this table might be created as SQL."
  [{table-name :name table-id :id :as table}]
  (let [fields       (t2/select [Field
                                 :base_type
                                 :database_required
                                 :database_type
                                 :fk_target_field_id
                                 :id
                                 :name
                                 :semantic_type]
                                :table_id table-id)
        enums        (reduce
                      (fn [acc {field-name :name :as field}]
                        (if-some [enums (field->pseudo-enums table field)]
                          (assoc acc field-name enums)
                          acc))
                      {}
                      fields)
        columns      (vec
                      (for [{column-name :name :keys [database_required database_type]} fields]
                        (cond-> [column-name
                                 (if (enums column-name)
                                   (format "%s_%s_t" table-name column-name)
                                   database_type)]
                          database_required
                          (conj [:not nil]))))
        primary-keys [[(into [:primary-key]
                             (comp (filter (comp #{:type/PK} :semantic_type))
                                   (map :name))
                             fields)]]
        foreign-keys (for [{field-name :name :keys [semantic_type fk_target_field_id]} fields
                           :when (= :type/FK semantic_type)
                           :let [{fk-field-name :name fk-table-id :table_id} (t2/select-one [Field :name :table_id]
                                                                                            :id fk_target_field_id)
                                 {fk-table-name :name} (t2/select-one [Table :name]
                                                                      :id fk-table-id)]]
                       [[:foreign-key field-name]
                        [:references fk-table-name fk-field-name]])
        create-sql   (->
                      (sql/format
                       {:create-table table-name
                        :with-columns (reduce into columns [primary-keys foreign-keys])}
                       {:dialect :ansi :pretty true})
                      first
                      mdb.query/format-sql)
        ddl-str      (str/join "\n\n" (conj (vec (vals enums)) create-sql))
        nchars       (count ddl-str)]
    (log/debugf "Pseudo-ddl for table %s describes %s fields, %s enums, and contains %s chars (~%s tokens)."
                table-name
                (count fields)
                (count enums)
                nchars
                (quot nchars 4))
    ddl-str))

(defn- database->pseudo-ddl
  "Create an 'approximate' ddl to represent how this database might be created as SQL."
  [{db-name :name db_id :id :as _database}]
  (let [tables  (t2/select Table :db_id db_id)
        ddl-str (->> tables
                     (map table->pseudo-ddl)
                     (str/join "\n\n"))
        nchars  (count ddl-str)]
    (log/debugf "Pseudo-ddl for db %s describes %s tables and contains %s chars (~%s tokens)."
                db-name
                (count tables)
                nchars
                (quot nchars 4))
    ddl-str))

(defn add-pseudo-database-ddl
  "Add a create_database_ddl entry to the denormalized database suitable for raw sql inference input."
  [database]
  (assoc database :create_database_ddl (database->pseudo-ddl database)))

(defn denormalize-database
  "Create a 'denormalized' version of the database which is optimized for querying.
  Adds in denormalized models, sql-friendly names, and a json summary of the models
  appropriate for prompt engineering."
  [{database-name :name db_id :id :as database}]
  (let [models (t2/select Card :database_id db_id :dataset true)]
    (-> database
        (assoc :sql_name (normalize-name database-name))
        (assoc :models (mapv denormalize-model models))
        add-model-json-summary)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;; Prompt Input ;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(defn- prompt-template->messages
  "Given a prompt template and a context, fill the template messages in with
  the appropriate values to create the actual submitted messages."
  [{:keys [messages]} context]
  (letfn [(update-contents [s]
            (str/replace s #"%%([^%]+)%%"
                         (fn [[_ path]]
                           (let [kw (->> (str/split path #":")
                                         (mapv (comp keyword u/lower-case-en)))]
                             (or (get-in context kw)
                                 (let [message (format "No value found in context for key path '%s'" kw)]
                                   (throw (ex-info
                                           message
                                           {:message     message
                                            :status-code 400}))))))))]
    (map (fn [prompt] (update prompt :content update-contents)) messages)))

(def ^:private ^:dynamic *prompt-templates*
  "Return a map of prompt templates with keys of template type and values
  which are objects containing keys 'latest' (the latest template version)
   and 'templates' (all template versions)."
  (memoize/ttl
   (fn []
     (log/info "Refreshing metabot prompt templates.")
     (let [all-templates (-> (metabot-settings/metabot-get-prompt-templates-url)
                             slurp
                             (json/parse-string keyword))]
       (-> (group-by (comp keyword :prompt_template) all-templates)
           (update-vals
            (fn [templates]
              (let [ordered (vec (sort-by :version templates))]
                {:latest    (peek ordered)
                 :templates ordered}))))))
   ;; Check for updates every hour
   :ttl/threshold (* 1000 60 60)))

(defn create-prompt
  "Create a prompt by looking up the latest template for the prompt_task type
   of the context interpolating all values from the template. The returned
   value is the template object with the prompt contained in the ':prompt' key."
  [{:keys [prompt_task] :as context}]
  (if-some [{:keys [messages] :as template} (get-in (*prompt-templates*) [prompt_task :latest])]
    (let [prompt (assoc template
                   :message_templates messages
                   :messages (prompt-template->messages template context))]
      (let [nchars (count (mapcat :content messages))]
        (log/debugf "Prompt running with %s chars (~%s tokens)." nchars (quot nchars 4)))
      prompt)
    (throw
     (ex-info
      (format "No prompt inference template found for prompt type: %s" prompt_task)
      {:prompt_type prompt_task}))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;; Results Processing ;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(defn select-all?
  "Is this a simple SELECT * query?"
  [sql]
  (some? (re-find #"(?i)^select\s*\*" sql)))

(defn find-result
  "Given a set of choices returned from the bot, find the first one returned by
   the supplied message-fn."
  [message-fn {:keys [choices]}]
  (or
   (some
    (fn [{:keys [message]}]
      (when-some [res (message-fn (:content message))]
        res))
    choices)
   (log/infof
    "Unable to find appropriate result for user prompt in responses:\n\t%s"
    (str/join "\n\t" (map (fn [m] (get-in m [:message :content])) choices)))))

(defn extract-sql
  "Search a provided string for a SQL block"
  [s]
  (let [sql (if (str/starts-with? (u/upper-case-en (str/trim s)) "SELECT")
              ;; This is just a raw SQL statement
              s
              ;; It looks like markdown
              (let [[_pre sql _post] (str/split s #"```(sql|SQL)?")]
                sql))]
    (mdb.query/format-sql sql)))

(defn bot-sql->final-sql
  "Produce the final query usable by the UI but converting the model to a CTE
  and calling the bot sql on top of it."
  [{:keys [inner_query sql_name] :as _denormalized-model} outer-query]
  (format "WITH %s AS (%s) %s" sql_name inner_query outer-query))

(defn response->viz
  "Given a response from the LLM, map this to visualization settings. Default to a table."
  [{:keys [display description visualization_settings]}]
  (let [display (keyword display)
        {:keys [x-axis y-axis]} visualization_settings]
    (case display
      (:line :bar :area :waterfall) {:display                display
                                     :name                   description
                                     :visualization_settings {:graph.dimensions [x-axis]
                                                              :graph.metrics    y-axis}}
      :scalar {:display                display
               :name                   description
               :visualization_settings {:graph.metrics    y-axis
                                        :graph.dimensions []}}
      {:display                :table
       :name                   description
       :visualization_settings {:title description}})))
