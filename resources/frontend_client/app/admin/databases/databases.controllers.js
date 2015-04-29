"use strict";
/*global _*/

var DatabasesControllers = angular.module('corvusadmin.databases.controllers', ['corvus.metabase.services']);

DatabasesControllers.controller('DatabaseList', ['$scope', 'Metabase', function($scope, Metabase) {

    $scope.delete = function(databaseId) {
        if ($scope.databases) {

            Metabase.db_delete({
                'dbId': databaseId
            }, function(result) {
                $scope.databases = _.filter($scope.databases, function(database) {
                    return database.id != databaseId;
                });
            }, function(error) {
                console.log('error deleting database', error);
            });
        }
    };

    $scope.$watch('currentOrg', function(org) {
        if (org) {
            $scope.databases = [];

            Metabase.db_list({
                'orgId': org.id
            }, function(databases) {
                // if we are an org that 'inherits' lets only show our our own dbs in this view
                if (org.inherits) {
                    var dm = _.filter(databases, function(database) {
                        return database.organization.id === org.id;
                    });
                    $scope.databases = dm;
                } else {

                    $scope.databases = databases;
                }
            }, function(error) {
                console.log('error getting database list', error);
            });
        }
    });
}]);

DatabasesControllers.controller('DatabaseEdit', ['$scope', '$routeParams', '$location', 'Metabase',
    function($scope, $routeParams, $location, Metabase) {

        // takes in our API form database details and parses them into a map of usable form field values
        var parseDetails = function(engine, details) {
            var map = {};
            if (engine === 'postgres') {
                details.conn_str.split(' ').forEach(function (val) {
                    var split = val.split('=');
                    if (split.length === 2) {
                        map[split[0]] = split[1];
                    }
                });
            } else if (engine === 'h2') {
                map.file = details.conn_str.substring(5);
            }

            return map;
        };

        // takes in a map of our form field values and builds them into our API form database details
        var buildDetails = function(engine, details) {
            var conn_str;
            if (engine === 'postgres') {
                conn_str = "host="+details.host+" port="+details.port+" dbname="+details.dbname+" user="+details.user+" password="+details.pass;
            } else if (engine === 'h2') {
                conn_str = "file:"+details.file;
            } else {
                conn_str = "";
            }

            return {
                'conn_str': conn_str
            };
        };

        // update an existing Database
        var update = function(database, details) {
            $scope.$broadcast("form:reset");
            database.details = buildDetails(database.engine, details);
            Metabase.db_update(database, function (updated_database) {
                $scope.database = updated_database;
                $scope.$broadcast("form:api-success", "Successfully saved!");
            }, function (error) {
                $scope.$broadcast("form:api-error", error);
            });
        };

        // create a new Database
        var create = function(database, details) {
            $scope.$broadcast("form:reset");
            database.org = $scope.currentOrg.id;
            database.details = buildDetails(database.engine, details);
            Metabase.db_create(database, function (new_database) {
                $location.path('/' + $scope.currentOrg.slug + '/admin/databases/' + new_database.id);
            }, function (error) {
                $scope.$broadcast("form:api-error", error);
            });
        };

        $scope.save = function(database, details) {
            if ($routeParams.databaseId) {
                update(database, details);
            } else {
                create(database, details);
            }
        };

        $scope.sync = function() {
            var call = Metabase.db_sync_metadata({
                'dbId': $scope.database.id
            });

            return call.$promise;
        };

        // load our form input data
        Metabase.db_form_input(function (form_input) {
            $scope.form_input = form_input;
        }, function (error) {
            console.log('error getting database form_input', error);
        });

        if ($routeParams.databaseId) {
            // load existing database for editing
            Metabase.db_get({
                'dbId': $routeParams.databaseId
            }, function (database) {
                $scope.database = database;
                $scope.details = parseDetails(database.engine, database.details);
            }, function (error) {
                console.log('error loading database', error);
                if (error.status == 404) {
                    $location.path('/admin/databases/');
                }
            });
        } else {
            // prepare an empty database for creation
            $scope.database = {
                "name": "",
                "engine": 'postgres',
                "details": {}
            };
            $scope.details = {};
        }
    }
]);


DatabasesControllers.controller('DatabaseTables', ['$scope', '$routeParams', '$location', 'Metabase',
    function($scope, $routeParams, $location, Metabase) {

        Metabase.db_get({
            'dbId': $routeParams.databaseId
        }, function (database) {
            $scope.database = database;
        }, function (error) {
            console.log('error loading database', error);
            if (error.status == 404) {
                $location.path('/admin/databases/');
            }
        });

        Metabase.db_tables({
            'dbId': $routeParams.databaseId
        }, function (tables) {
            $scope.tables = tables;
        }, function (error) {

        });
    }
]);


DatabasesControllers.controller('DatabaseTable', ['$scope', '$routeParams', '$location', 'Metabase', 'ForeignKey',
    function($scope, $routeParams, $location, Metabase, ForeignKey) {

        $scope.getIdFields = function() {
            // fetch the ID fields
            Metabase.db_idfields({
                'dbId': $scope.table.db.id
            }, function(result) {
                if (result && !result.error) {
                    $scope.idfields = result;
                    result.forEach(function(field) {
                        field.displayName = field.table.name + '.' + field.name;
                    });
                } else {
                    console.log(result);
                }
            });

        };

        $scope.decorateWithTargets = function() {
            $scope.table.fields.forEach(function(field) {
                if (field.target) {
                    field.target_id = field.target.id;
                }
            });
        };

        $scope.syncMetadata = function() {
            Metabase.table_sync_metadata({
                'tableId': $routeParams.tableId
            }, function(result) {
                // nothing to do here really
            }, function(error) {
                console.log('error doing metabase sync', error);
            });
        };

        $scope.inlineSave = function() {
            if ($scope.table) {
                Metabase.table_update($scope.table, function (result) {
                    // there is a difference between the output of table/:id and table/:id/query_metadata
                    // so we don't actually want to overwrite $scope.table with this data in this case
                    //$scope.table = result;
                }, function (error) {
                    console.log('error updating table', error);
                });
            }
        };

        $scope.inlineSpecialTypeChange = function(idx) {
            // If we are changing the field from a FK to something else, we should delete any FKs present
            var field = $scope.table.fields[idx];
            if (field.target_id && field.special_type != "fk") {
                // we have something that used to be an FK and is now not an FK
                // Let's delete its foreign keys
                var fks = Metabase.field_foreignkeys({
                    'fieldId': field.id
                }, function(result) {
                    fks.forEach(function(fk) {
                        console.log("deleting ", fk);
                        ForeignKey.delete({
                            'fkID': fks[0].id
                        }, function(result) {
                            console.log("deleted fk");
                        }, function(error) {
                            console.log("error deleting fk");
                        });
                    });
                });
                // clean up after ourselves
                field.target = null;
                field.target_id = null;
            }
            // save the field
            $scope.inlineSaveField(idx);
        };

        $scope.inlineSaveField = function(idx) {
            if ($scope.table.fields && $scope.table.fields[idx]) {
                Metabase.field_update($scope.table.fields[idx], function(result) {
                    if (result && !result.error) {
                        $scope.table.fields[idx] = result;
                    } else {
                        console.log(result);
                    }
                });
            }
        };

        $scope.inlineChangeFKTarget = function(idx) {
            // This function notes a change in the target of the target of a foreign key
            // If there is already a target, we should delete that FK and create a new one
            // This is meant to be transitional until we add an FK modify function to the API
            // If there was not a target, we should create a new FK
            if ($scope.table.fields && $scope.table.fields[idx]) {
                var field = $scope.table.fields[idx];
                var new_target_id = field.target_id;

                var fks = Metabase.field_foreignkeys({
                    'fieldId': field.id
                });

                if (fks.length > 0) {
                    // delete this key
                    var relationship_id = 0;
                    ForeignKey.delete({
                        'fkID': fks[0].id
                    }, function(result) {
                        console.log("Deleted FK");
                        Metabase.field_addfk({
                            "db": $scope.table.db.id,
                            "fieldId": field.id,
                            'target_field': new_target_id,
                            "relationship": "Mt1"
                        });

                    }, function(error) {
                        console.log('Error deleting key ', error);
                    });
                } else {
                    Metabase.field_addfk({
                        "db": $scope.table.db.id,
                        "fieldId": field.id,
                        'target_field': new_target_id,
                        "relationship": "Mt1"
                    });
                }
            }
        };

        $scope.deleteTarget = function(field, target) {

        };

        $scope.fields = [];

        $scope.dragControlListeners = {
            containment: '.EntityGroup',
            orderChanged: function(event) {
                // Change order here
                var new_order = _.map($scope.fields, function(field) {
                    return field.id;
                });
                Metabase.table_reorder_fields({
                    'tableId': $routeParams.tableId,
                    'new_order': new_order
                });
            }
        };


        Metabase.table_query_metadata({
            'tableId': $routeParams.tableId
        }, function(result) {
            $scope.table = result;
            $scope.fields = $scope.table.fields;
            $scope.getIdFields();
            $scope.decorateWithTargets();
        }, function(error) {
            console.log(error);
            if (error.status == 404) {
                $location.path('/');
            }
        });
    }
]);



DatabasesControllers.controller('DatabaseTableField', ['$scope', '$routeParams', '$location', 'Metabase', 'ForeignKey',
    function($scope, $routeParams, $location, Metabase, ForeignKey) {

        $scope.inlineSave = function() {
            console.log($scope.field);
            if ($scope.field) {
                Metabase.field_update($scope.field, function(result) {
                    if (result && !result.error) {
                        $scope.field = result;
                    } else {
                        console.log(result);
                    }
                });
            }
        };

        $scope.updateMappedValues = function() {
            Metabase.field_value_map_update({
                'fieldId': $routeParams.fieldId,
                'values_map': $scope.field_values.human_readable_values
            }, function(result) {
                // nothing to do
            }, function(error) {
                console.log('Error');
            });
        };

        $scope.toggleAddRelationshipModal = function() {
            // toggle display
            $scope.modalShown = !$scope.modalShown;
        };

        $scope.relationshipAdded = function(relationship) {
            // this is here to clone the original array so that we can modify it
            // by default the deserialized data from an api response is immutable
            $scope.fks = $scope.fks.slice(0);
            $scope.fks.push(relationship);
        };

        $scope.deleteRelationship = function(relationship_id) {
            // this is here to clone the original array so that we can modify it
            // by default the deserialized data from an api response is immutable
            ForeignKey.delete({
                'fkID': relationship_id
            }, function(result) {
                $scope.fks = _.reject($scope.fks, function(fk) {
                    return fk.id == relationship_id;
                });
            }, function(error) {
                console.log('Error deleting key ', error);
            });
        };

        // $scope.field
        // $scope.pivots
        // $scope.fks
        $scope.modalShown = false;

        Metabase.field_get({
            'fieldId': $routeParams.fieldId
        }, function(result) {
            $scope.field = result;

            // grab where this field is foreign keyed to
            Metabase.field_foreignkeys({
                'fieldId': $routeParams.fieldId
            }, function(result) {
                $scope.fks = result;
            }, function(error) {
                console.log('error getting fks for field', error);
            });

            // grab summary data about our field
            Metabase.field_summary({
                'fieldId': $routeParams.fieldId
            }, function(result) {
                $scope.field_summary = result;
            }, function(error) {
                console.log('error gettting field summary', error);
            });

            // grab our field values
            Metabase.field_values({
                'fieldId': $routeParams.fieldId
            }, function(result) {
                $scope.field_values = result;
            }, function(error) {
                console.log('error getting field values', error);
            });
        }, function(error) {
            console.log(error);
            if (error.status == 404) {
                $location.path('/');
            }
        });
    }
]);
