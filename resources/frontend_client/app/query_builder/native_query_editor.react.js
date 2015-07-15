'use strict';
/*global ace*/

import RunButton from './run_button.react';
import DatabaseSelector from './database_selector.react';

export default React.createClass({
    displayName: 'NativeQueryEditor',
    propTypes: {
        databases: React.PropTypes.array.isRequired,
        query: React.PropTypes.object.isRequired,
        isRunning: React.PropTypes.bool.isRequired,
        runQueryFn: React.PropTypes.func.isRequired,
        setQueryFn: React.PropTypes.func.isRequired,
        setDatabaseFn: React.PropTypes.func.isRequired,
        autocompleteResultsFn: React.PropTypes.func.isRequired
    },

    getInitialState: function() {
        return {};
    },

    componentDidMount: function() {
        this.loadAceEditor();
    },

    loadAceEditor: function() {
        var editor = ace.edit("id_sql");

        // TODO: theme?

        // set editor mode appropriately
        // TODO: at some point we could make this dynamic based on database type
        editor.getSession().setMode("ace/mode/sql");

        // listen to onChange events
        editor.getSession().on('change', this.onChange);

        // initialize the content
        editor.setValue(this.props.query.native.query);

        // clear the editor selection, otherwise we start with the whole editor selected
        editor.clearSelection();

        // hmmm, this could be dangerous
        editor.focus();

        this.setState({
            editor: editor
        });

        var aceLanguageTools = ace.require('ace/ext/language_tools');
        editor.setOptions({
            enableBasicAutocompletion: true,
            enableSnippets: true,
            enableLiveAutocompletion: true
        });

        var autocompleteFn = this.props.autocompleteResultsFn;
        aceLanguageTools.addCompleter({
            getCompletions: function(editor, session, pos, prefix, callback) {
                if (prefix.length < 2) {
                    callback(null, []);
                    return;
                }

                autocompleteFn(prefix).then(function (results) {
                    // transform results of the API call into what ACE expects
                    var js_results = results.map(function(result) {
                        return {
                            name: result[0],
                            value: result[0],
                            meta: result[1]
                        };
                    });
                    callback(null, js_results);

                }, function (error) {
                    console.log('error getting autocompletion data', error);
                    callback(null, []);
                });
            }
        });
    },

    setQuery: function(dataset_query) {
        this.props.setQueryFn(dataset_query);
    },

    setDatabase: function(databaseId) {
        this.props.setDatabaseFn(databaseId);
    },

    canRunQuery: function() {
        return (this.props.query.database !== undefined && this.props.query.native.query !== "");
    },

    runQuery: function() {
        this.props.runQueryFn(this.props.query);
    },

    onChange: function(event) {
        if (this.state.editor) {
            var query = this.props.query;
            query.native.query = this.state.editor.getValue();
            this.setQuery(query);
        }
    },

    render: function() {
        // we only render a db selector if there are actually multiple to choose from
        var dbSelector;
        if(this.props.databases && this.props.databases.length > 1) {
            dbSelector = (
                <DatabaseSelector
                    databases={this.props.databases}
                    setDatabase={this.setDatabase}
                    currentDatabaseId={this.props.query.database}
                />
            );
        }

        return (
            <div className="QueryBuilder-section border-bottom">
                <div className="wrapper">
                    <div id="id_sql" className="Query-section bordered mt2"></div>
                    <div className="py2 clearfix">
                        <div className="float-right">
                            <RunButton
                                canRun={this.canRunQuery()}
                                isRunning={this.props.isRunning}
                                runFn={this.runQuery}
                            />
                        </div>
                        <div className="float-left">
                            {dbSelector}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
