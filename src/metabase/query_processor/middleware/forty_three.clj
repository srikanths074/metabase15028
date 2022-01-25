(ns metabase.query-processor.middleware.forty-three
  "Once we're done with the 43 middleware overhaul this namespace should be DELETED.")

(defn wrap-43-pre-processing-middleware
  "Temporary helper to wrap a 43+ style pre-processing middleware function so it can be used as a <=42 style around
  middleware function. Once the rest of the 43+ middleware changes are merged in, this function can be deleted and the
  previously-wrapped function can be used directly.

  43+ style pre-processing middleware:

    (f query) -> query

  Old style:

    (f qp) -> (f query rff context)"
  [f]
  (fn [qp]
    (fn [query rff context]
      (qp (f query) rff context))))

(defmacro define-pre-processing-middleware
  {:style/indent :defn}
  [middleware-name docstring [query-binding] & body]
  {:pre [(symbol? middleware-name)
         (string? docstring)]}
  `(def ~middleware-name
     ~docstring
     (pre-process-middleware (fn [~query-binding] ~@body))))

(defn wrap-43-post-processing-middleware
  "Temporary helper to wrap a 43+ style post-processing middleware function so it can be used as a <=42 style around
  middleware function. Once the rest of the 43+ middleware changes are merged in, this function can be deleted and the
  previously-wrapped function can be used directly.

  43+ style post-processing middleware:

    (f query rff) -> rff

  Old style:

    (f qp) -> (f query rff context)"
  [f]
  (fn [qp]
    (fn [query rff context]
      (qp query (f query rff) context))))
