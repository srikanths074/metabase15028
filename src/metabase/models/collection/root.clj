(ns metabase.models.collection.root
  (:require
   [metabase.models.dispatch :as models.dispatch]
   [metabase.models.interface :as mi]
   [metabase.models.permissions :as perms]
   [metabase.public-settings.premium-features :as premium-features]
   [metabase.util :as u]
   [potemkin.types :as p.types]
   [toucan.models :as models]))

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                   Root Collection Special Placeholder Object                                   |
;;; +----------------------------------------------------------------------------------------------------------------+

;; The Root Collection special placeholder object is used to represent the fact that we're working with the 'Root'
;; Collection in many of the functions in this namespace. The Root Collection is not a true Collection, but instead
;; represents things that have no collection_id, or are otherwise to be seen at the top-level by the current user.

(p.types/defrecord+ RootCollection [])

(doto RootCollection
  (derive ::mi/read-policy.full-perms-for-perms-set)
  (derive ::mi/write-policy.full-perms-for-perms-set))

(extend-protocol models.dispatch/Model
  RootCollection
  (model [_this]
    RootCollection))

(defmethod mi/perms-objects-set RootCollection
  [collection read-or-write]
  {:pre [(map? collection)]}
  ;; HACK Collections in the "snippets" namespace have no-op permissions unless EE enhancements are enabled
  (if (and (= (u/qualified-name (:namespace collection)) "snippets")
           (not (premium-features/enable-enhancements?)))
    #{}
    #{((case read-or-write
         :read  perms/collection-read-path
         :write perms/collection-readwrite-path) collection)}))

(u/strict-extend RootCollection
  models/IModel
  (merge
   models/IModelDefaults
   {:types {:type :keyword}}))

(def ^RootCollection root-collection
  "Special placeholder object representing the Root Collection, which isn't really a real Collection."
  (map->RootCollection {::is-root? true, :authority_level nil}))

(defn is-root-collection?
  "Is `x` the special placeholder object representing the Root Collection?"
  [x]
  ;; TODO -- not sure this makes sense because other places we check whether `::is-root?` is present or not.
  (instance? RootCollection x))
