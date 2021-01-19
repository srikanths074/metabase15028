(ns metabase.cmd.dump-to-h2-test
  (:require [clojure.java.io :as io]
            [clojure.java.jdbc :as jdbc]
            [clojure.test :refer :all]
            [metabase.cmd :as cmd]
            [metabase.cmd.copy :as copy]
            [metabase.cmd.copy.h2 :as copy.h2]
            [metabase.cmd.dump-to-h2 :as dump-to-h2]
            [metabase.cmd.load-from-h2 :as load-from-h2]
            [metabase.db.connection :as mdb.connection]
            [metabase.db.spec :as db.spec]
            [metabase.driver :as driver]
            [metabase.models :refer [Setting]]
            [metabase.test :as mt]
            [metabase.test.data.interface :as tx]
            [metabase.util.encryption-test :as eu]
            [metabase.util.files :as u.files]
            [toucan.db :as db]))

(deftest dump-deletes-target-db-files-tests
  ;; test fails when the application db is anything but H2 presently
  ;; TODO: make this test work with postgres / mysql / mariadb
  (let [tmp-h2-db     (str (u.files/get-path (System/getProperty "java.io.tmpdir") "mbtest_dump.h2"))
        tmp-h2-db-mv  (str tmp-h2-db ".mv.db")
        file-contents {tmp-h2-db    "Not really an H2 DB"
                       tmp-h2-db-mv "Not really another H2 DB"}]
    ;; 1. Don't actually run the copy steps themselves
    (with-redefs [copy/copy! (constantly nil)]
      (try
        (doseq [[filename contents] file-contents]
          (spit filename contents))
        (dump-to-h2/dump-to-h2! tmp-h2-db)

        (doseq [filename (keys file-contents)]
          (testing (str filename " was deleted")
            (is (false? (.exists (io/file filename))))))

        (finally
          (doseq [filename (keys file-contents)
                  :let     [file (io/file filename)]]
            (when (.exists file)
              (io/delete-file file))))))))

(deftest cmd-dump-to-h2-returns-code-from-dump-test
  (with-redefs [dump-to-h2/dump-to-h2! (constantly 1)
                cmd/system-exit! identity]
    (is (= 1 (cmd/dump-to-h2 "file1")))))

(defn- persistent-jdbcspec
  "Return a jdbc spec for the specified `db-type` on the db `db-name`. In case of H2, makes the connection persistent
  10secs to give us time to fetch the results later."
  [db-type db-name app-db]
  (case db-type
    :h2 {:subprotocol "h2"
         :subname     (format "mem:%s;DB_CLOSE_DELAY=10" app-db)
         :classname   "org.h2.Driver"}
    :postgres (db.spec/postgres (tx/dbdef->connection-details :postgres :db {:database-name db-name}))
    :mysql (db.spec/mysql (tx/dbdef->connection-details :mysql :db {:database-name db-name}))))

(defn- abs-path
  [path]
  (.getAbsolutePath (io/file path)))

(deftest dump-to-h2-dump-plaintext-test
  (let [h2-fixture-db-file (abs-path "frontend/test/__runner__/test_db_fixture.db")
        app-db (mt/random-name)
        h2-file (format "/tmp/out-%s.db" (mt/random-name))
        db-name "test"]
    (mt/test-drivers #{:h2 :postgres :mysql}
     (binding [mdb.connection/*db-type*   driver/*driver*
               mdb.connection/*jdbc-spec* (persistent-jdbcspec driver/*driver* db-name app-db)
               db/*db-connection* (persistent-jdbcspec driver/*driver* db-name app-db)
               db/*quoting-style* driver/*driver*]
       (when-not (= driver/*driver* :h2)
         (tx/create-db! driver/*driver* {:database-name db-name }))
       (load-from-h2/load-from-h2! h2-fixture-db-file)
       (eu/with-secret-key "89ulvIGoiYw6mNELuOoEZphQafnF/zYe+3vT+v70D1A="
         (db/insert! Setting {:key "my-site-admin", :value "baz"})
         (dump-to-h2/dump-to-h2! h2-file {:dump-plaintext? true}))
       (jdbc/with-db-connection [target-conn (copy.h2/h2-jdbc-spec h2-file)]
         (is (= "baz"
                (:value (first (jdbc/query target-conn "select value from SETTING where key='my-site-admin';"))))))))))
