(ns metabase.lib.cache)

(defn side-channel-cache
  "(CLJS only; this is a pass-through in CLJ.)

  Attaches a JS property `__mbcache` to `x` (a JS object or CLJS map) if it doesn't already have one.
  This property holds an `(atom {})`, which is used as a \"personal\" cache attached to `x`.
  This property is ignored by CLJS, which only uses specific keys on the JS objects used to implement CLJS maps.
  Since CLJS maps are immutable, any `assoc`, `update`, etc. will create a new object without the cache property.

  If there is not already a key `subkey` in the map, calls `(f x)` and caches the value at `subkey`.
  If there is a value at `subkey`, it is returned directly."
<<<<<<< HEAD
  ([subkey x f] (side-channel-cache subkey x f false))
  ([subkey x f force?]
   (comment subkey, force?) ; Avoids lint warning for half-unused inputs.
   #?(:clj  (f x)
      :cljs (if (or force? (object? x) (map? x))
              (do
                (when-not (.-__mbcache ^js x)
                  (set! (.-__mbcache ^js x) (atom {})))
                (if-let [cache (.-__mbcache ^js x)]
                  (if-let [cached (get @cache subkey)]
                    cached
                    ;; Cache miss - generate the value and cache it.
                    (let [value (f x)]
                      (swap! cache assoc subkey value)
                      value))
                  (f x)))
              (f x)))))
=======
  [subkey x f]
  (comment subkey) ; Avoids lint warning for half-unused `subkey`.
  #?(:clj  (f x)
     :cljs (if (or (object? x) (map? x))
             (do
               (when-not (.-__mbcache ^js x)
                 (set! (.-__mbcache ^js x) (atom {})))
               (when-not js/window.__mbcache_stats
                 (set! js/window.__mbcache_stats (js-obj)))
               (if-let [cache (.-__mbcache ^js x)]
                 (if-let [cached (get @cache subkey)]
                   (do
                     (if-let [^js stats (aget js/window.__mbcache_stats subkey)]
                       (set! (.-hits stats) (inc (.-hits stats)))
                       (aset js/window.__mbcache_stats subkey (js-obj "hits" 1 "misses" 0)))
                     cached)
                   ;; Cache miss - generate the value and cache it.
                   (let [value (f x)]
                     (swap! cache assoc subkey value)
                     (if-let [^js stats (aget js/window.__mbcache_stats subkey)]
                       (set! (.-misses stats) (inc (.-misses stats)))
                       (aset js/window.__mbcache_stats subkey (js-obj "hits" 0 "misses" 1)))
                     value))
                 (f x)))
             (f x))))
>>>>>>> 4eea6a12fa (Revert "Adding cache stats to metabase.lib.cache")
