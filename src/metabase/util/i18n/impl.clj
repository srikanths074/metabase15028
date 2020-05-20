(ns metabase.util.i18n.impl
  "Lower-level implementation functions for `metabase.util.i18n`. Most of this is not meant to be used directly; use the
  functions and macros in `metabase.util.i18n` instead."
  (:require [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.tools.logging :as log]
            [clojure.tools.reader.edn :as edn]
            [metabase.plugins.classloader :as classloader]
            [potemkin.types :as p.types])
  (:import java.text.MessageFormat
           [java.util Locale MissingResourceException ResourceBundle]
           org.apache.commons.lang3.LocaleUtils))

(p.types/defprotocol+ CoerceToLocale
  "Protocol for anything that can be coerced to a `java.util.Locale`."
  (locale ^java.util.Locale [this]
    "Coerce `this` to a `java.util.Locale`."))

(defn normalized-locale-string
  "Normalize a locale string to the canonical format.

    (normalized-locale-string \"EN-US\") ;-> \"en_US\"

  Returns `nil` for invalid strings -- you can use this to check whether a String is valid."
  [s]
  (when (string? s)
    (when-let [[_ language country] (re-matches #"^(\w{2})(?:[-_](\w{2}))?$" s)]
      (let [language (str/lower-case language)]
        (if country
          (str language \_ (some-> country str/upper-case))
          language)))))

(extend-protocol CoerceToLocale
  nil
  (locale [_] nil)

  Locale
  (locale [this] this)

  String
  (locale [^String s]
    (LocaleUtils/toLocale (normalized-locale-string s)))

  ;; Support namespaced keywords like `:en/US` and `:en/UK` because we can
  clojure.lang.Keyword
  (locale [this]
    (locale (if-let [namespce (namespace this)]
              (str namespce \_ (name this))
              (name this)))))

(defn available-locale?
  "True if `locale` (a string, keyword, or `Locale`) is a valid locale available on this system. Normalizes args
  automatically."
  [locale-or-name]
  (boolean
   (when-let [locale (locale locale-or-name)]
     (LocaleUtils/isAvailableLocale locale))))

(defn parent-locale
  "For langugage + country Locales, returns the language-only Locale. Otherwise returns `nil`.

    (parent-locale \"en/US\") ; -> #object[java.util.Locale 0x79301688 \"en\"]"
  ^Locale [locale-or-name]
  (when-let [a-locale (locale locale-or-name)]
    (when (seq (.getCountry a-locale))
      (locale (.getLanguage a-locale)))))

(def ^:private ^:const ^String i18n-bundle-name "metabase.Messages")

(def ^:dynamic *bundle-fn*
  "Function that should be used to fetch the i18n translations resources bundle for a Locale. Bind this value for
  dev/test mocking purposes."
  (fn [^Locale locale]
    (try
      (ResourceBundle/getBundle i18n-bundle-name locale (classloader/the-classloader))
      (catch MissingResourceException _
        (log/error (format "Error translating to %s: no resource bundle" locale))))))

(defn- bundle
  "Get the Metabase i18n resource bundle associated with `locale`. Returns `nil` if no such bundle can be found."
  ^ResourceBundle [locale-or-name]
  (when-let [locale (locale locale-or-name)]
    (*bundle-fn* locale)))

(def ^:dynamic *translated-format-string-fn*
  "Function to use to find the translated version of `format-string` for `locale` -- normally this loads the matching
  `ResourceBundle` and looks for a matching key, returning `nil` if the bundle or the key weren't found. You can
  rebind this for test/mocking purposes."
  (fn [^Locale locale format-string]
    (when (seq format-string)
      (when-let [bundle (bundle locale)]
        (try
          (.getString bundle format-string)
          ;; no translated version available
          (catch MissingResourceException _))))))

(defn- translated-format-string
  "Find the translated version of `format-string` in the bundle for `locale-or-name`, or `nil` if none can be found.
  Does not search 'parent' (country-only) locale bundle."
  ^String [locale-or-name format-string]
  (*translated-format-string-fn* (locale locale-or-name) format-string))

(defn translate
  "Find the translated version of `format-string` for a `locale-or-name`, then format it. Translates using the resource
  bundles generated by the `./bin/i18n/build-translation-resources` script; these live in
  `./resources/metabase/Metabase/Messages_<locale>.class`. Attempts to translate with `language-country` Locale if
  specified, falling back to `language` (without country), finally falling back to English (i.e., not formatting the
  original untranslated `format-string`) if no matching bundles/translations exist, or if translation fails for some
  other reason.

  Will attempt to translate `format-string`, but if for some reason we're not able to (such as a typo in the
  translated version of the string), log the failure but return the original (untranslated) string. This is a
  workaround for translations that, due to a typo, will fail to parse using Java's message formatter.

    (translate \"es-MX\" \"must be {0} characters or less\" 140) ; -> \"deben tener 140 caracteres o menos\""
  [locale-or-name ^String format-string & args]
  (when (seq format-string)
    (try
      (let [locale                        (locale locale-or-name)
            ^String translated            (or (when (= locale Locale/ENGLISH)
                                                format-string)
                                              (translated-format-string locale format-string)
                                              (when-let [parent-locale (parent-locale locale)]
                                                (translated-format-string parent-locale format-string))
                                              format-string)
            ^MessageFormat message-format (if locale
                                            (MessageFormat. translated locale)
                                            (MessageFormat. translated))]
        (.format message-format (to-array args)))
      (catch Throwable e
        ;; Not translating this string to prevent an unfortunate stack overflow. If this string happened to be the one
        ;; that had the typo, we'd just recur endlessly without logging an error.
        (log/errorf e "Unable to translate string %s to %s" (pr-str format-string) (str locale))
        (try
          (.format (MessageFormat. format-string) (to-array args))
          (catch Throwable _
            (log/errorf e "Invalid format string %s" (pr-str format-string))
            format-string))))))

(defn- available-locales*
  []
  (log/info "Reading available locales from locales.clj...")
  (some-> (io/resource "locales.clj") slurp edn/read-string :locales set))

(def ^{:arglists '([])} available-locales
  "Return set of available locales, as Strings.

    (available-locales) ; -> #{\"nl\" \"pt\" \"en\" \"zh\"}"
  (let [locales (delay (available-locales*))]
    (fn [] @locales)))

;; We can't fetch the system locale until the application DB has been initiailized. Once that's done, we don't need to
;; do the check anymore -- swapping out the getter fn with the simpler one speeds things up substantially
(def ^:private system-locale-from-setting-fn
  (atom
   (fn []
     (when-let [db-is-setup? (resolve 'metabase.db/db-is-setup?)]
       (when (db-is-setup?)
         (when-let [get-string (var-get (resolve 'metabase.models.setting/get-string))]
           (let [f (fn [] (get-string :site-locale))]
             (reset! system-locale-from-setting-fn f)
             (f))))))))

(defn system-locale-from-setting
  "Fetch the value of the `site-locale` Setting."
  []
  (@system-locale-from-setting-fn))

(defmethod print-method Locale
  [locale ^java.io.Writer writer]
  ((get-method print-dup Locale) locale writer))

(defmethod print-dup Locale
  [locale ^java.io.Writer writer]
  (.write writer (format "#locale %s" (pr-str (str locale)))))
