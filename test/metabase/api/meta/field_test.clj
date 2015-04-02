(ns metabase.api.meta.field-test
  (:require [expectations :refer :all]
            [metabase.db :refer :all]
            (metabase.models [field :refer [Field]]
                             [field-values :refer [FieldValues]]
                             [table :refer [Table]])
            [metabase.test-data :refer :all]
            [metabase.test.util :refer [match-$ expect-eval-actual-first]]))



;; ## GET /api/meta/field/:id
(expect
    (match-$ (let [field-id (field->id :users :name)] ; !!! field->id causes lazy loading of the test data and Metabase DB
               (sel :one Field :id field-id))         ; If it's not evaluated before sel then the Metabase DB won't exist when sel
      {:description nil                               ; is executed
       :table_id (table->id :users)
       :table (match-$ (sel :one Table :id (table->id :users))
                {:description nil
                 :entity_type nil
                 :db (match-$ @test-db
                       {:created_at $
                        :engine "h2"
                        :id $
                        :details $
                        :updated_at $
                        :name "Test Database"
                        :organization_id @org-id
                        :description nil})
                 :name "USERS"
                 :rows 15
                 :updated_at $
                 :entity_name nil
                 :active true
                 :id (table->id :users)
                 :db_id (:id @test-db)
                 :created_at $})
       :special_type nil
       :name "NAME"
       :updated_at $
       :active true
       :id (field->id :users :name)
       :field_type "info"
       :position 0
       :preview_display true
       :created_at $
       :base_type "TextField"})
  ((user->client :rasta) :get 200 (format "meta/field/%d" (field->id :users :name))))


;; ## GET /api/meta/field/:id/summary
(expect [["count" 75]      ; why doesn't this come back as a dictionary ?
         ["distincts" 75]]
  ((user->client :rasta) :get 200 (format "meta/field/%d/summary" (field->id :categories :name))))


;; ## PUT /api/meta/field/:id
;; Check that we can update a Field
;; TODO - this should NOT be modifying a field from our test data, we should create new data to mess with
(expect-eval-actual-first
    (match-$ (let [field (sel :one Field :id (field->id :venues :latitude))]
               ;; this is sketchy. But return the Field back to its unmodified state so it won't affect other unit tests
               (upd Field (field->id :venues :latitude) :special_type "latitude")
               ;; match against the modified Field
               field)
      {:description nil
       :table_id (table->id :venues)
       :special_type "fk"
       :name "LATITUDE"
       :updated_at $
       :active true
       :id $
       :field_type "info"
       :position 0
       :preview_display true
       :created_at $
       :base_type "FloatField"})
  ((user->client :rasta) :put 200 (format "meta/field/%d" (field->id :venues :latitude)) {:special_type :fk}))

(defn- field->field-values
  "Fetch the `FieldValues` object that corresponds to a given `Field`."
  [table-kw field-kw]
  (sel :one FieldValues :field_id (field->id table-kw field-kw)))

;; ## GET /api/meta/field/:id/values
;; Should return something useful for a field that has special_type :category
(expect-eval-actual-first
    (match-$ (field->field-values :venues :price)
      {:field_id (field->id :venues :price)
       :human_readable_values {}
       :values [1 2 3 4]
       :updated_at $
       :created_at $
       :id $})
  (do (upd FieldValues (:id (field->field-values :venues :price)) :human_readable_values nil)       ; clear out existing human_readable_values in case they're set
      ((user->client :rasta) :get 200 (format "meta/field/%d/values" (field->id :venues :price)))))

;; Should return nothing for a field whose special_type is *not* :category
(expect
    {:values {}
     :human_readable_values {}}
  ((user->client :rasta) :get 200 (format "meta/field/%d/values" (field->id :venues :id))))


;; ## POST /api/meta/field/:id/value_map_update

;; Check that we can set values
(expect-eval-actual-first
    [{:status "success"}
     (match-$ (sel :one FieldValues :field_id (field->id :venues :price))
       {:field_id (field->id :venues :price)
        :human_readable_values {:1 "$"
                                :2 "$$"
                                :3 "$$$"
                                :4 "$$$$"}
        :values [1 2 3 4]
        :updated_at $
        :created_at $
        :id $})]
  [((user->client :rasta) :post 200 (format "meta/field/%d/value_map_update" (field->id :venues :price)) {:values_map {:1 "$"
                                                                                                                       :2 "$$"
                                                                                                                       :3 "$$$"
                                                                                                                       :4 "$$$$"}})
   ((user->client :rasta) :get 200 (format "meta/field/%d/values" (field->id :venues :price)))])

;; Check that we can unset values
(expect-eval-actual-first
    [{:status "success"}
     (match-$ (sel :one FieldValues :field_id (field->id :venues :price))
       {:field_id (field->id :venues :price)
        :human_readable_values {}
        :values [1 2 3 4]
        :updated_at $
        :created_at $
        :id $})]
  [(do (upd FieldValues (:id (field->field-values :venues :price)) :human_readable_values {:1 "$"      ; make sure they're set
                                                                                           :2 "$$"
                                                                                           :3 "$$$"
                                                                                           :4 "$$$$"})
       ((user->client :rasta) :post 200 (format "meta/field/%d/value_map_update" (field->id :venues :price))
        {:values_map {}}))
   ((user->client :rasta) :get 200 (format "meta/field/%d/values" (field->id :venues :price)))])

;; Check that we get an error if we call value_map_update on something that isn't a category
(expect "You can only update the mapped values of a Field whose 'special_type' is 'category'/'city'/'state'/'country' or whose 'base_type' is 'BooleanField'."
  ((user->client :rasta) :post 400 (format "meta/field/%d/value_map_update" (field->id :venues :id))
   {:values_map {:1 "$"
                 :2 "$$"
                 :3 "$$$"
                 :4 "$$$$"}}))
