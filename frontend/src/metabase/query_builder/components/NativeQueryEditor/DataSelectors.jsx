import React from "react";
import PropTypes from "prop-types";
import { t } from "ttag";

import {
  DatabaseDataSelector,
  SchemaAndTableDataSelector,
} from "metabase/query_builder/components/DataSelector";

const DataSelectorsPropTypes = {
  isNativeEditorOpen: PropTypes.bool.isRequired,
  query: PropTypes.object,
  readOnly: PropTypes.bool,
  setDatabaseId: PropTypes.func,
  setTableId: PropTypes.func,
};

const PopulatedDataSelectorsPropTypes = {
  database: PropTypes.object,
  databases: PropTypes.array,
  isNativeEditorOpen: PropTypes.bool.isRequired,
  query: PropTypes.object,
  readOnly: PropTypes.bool,
  setDatabaseId: PropTypes.func,
  setTableId: PropTypes.func,
};

const DatabaseSelectorPropTypes = {
  database: PropTypes.object,
  databases: PropTypes.array,
  readOnly: PropTypes.bool,
  setDatabaseId: PropTypes.func,
};

const DatabaseNameSpanPropTypes = {
  database: PropTypes.object,
};

const TableSelectorPropTypes = {
  database: PropTypes.object,
  readOnly: PropTypes.bool,
  selectedTable: PropTypes.object,
  setTableId: PropTypes.func,
};

const PlaceholderPropTypes = {
  query: PropTypes.object,
};

const DataSelectors = ({
  isNativeEditorOpen,
  query,
  readOnly,
  setDatabaseId,
  setTableId,
}) => {
  const database = query.database();
  const databases = query.metadata().databasesList({ savedQuestions: false });

  if (!isNativeEditorOpen || databases.length === 0) {
    return <Placeholder query={query} />;
  }

  return (
    <PopulatedDataSelectors
      database={database}
      databases={databases}
      query={query}
      readOnly={readOnly}
      setDatabaseId={setDatabaseId}
      setTableId={setTableId}
    />
  );
};

DataSelectors.propTypes = DataSelectorsPropTypes;

const PopulatedDataSelectors = ({
  database,
  databases,
  query,
  readOnly,
  setDatabaseId,
  setTableId,
}) => {
  const dataSelectors = [];

  const areThereMultipleDatabases = checkIfThereAreMultipleDatabases(
    database,
    databases,
  );

  if (areThereMultipleDatabases) {
    dataSelectors.push(
      <DatabaseSelector
        database={database}
        databases={databases}
        key="db_selector"
        readOnly={readOnly}
        setDatabaseId={setDatabaseId}
      />,
    );
  } else if (database) {
    dataSelectors.push(<DatabaseNameSpan key="db" database={database} />);
  }

  if (query.requiresTable()) {
    dataSelectors.push(
      <TableSelector
        database={database}
        key="table_selector"
        readOnly={readOnly}
        selectedTable={query.table()}
        setTableId={setTableId}
      />,
    );
  }

  return dataSelectors;
};

PopulatedDataSelectors.propTypes = PopulatedDataSelectorsPropTypes;

const checkIfThereAreMultipleDatabases = (database, databases) =>
  database == null ||
  (databases.length > 1 && databases.some(db => db.id === database.id));

const DatabaseSelector = ({ database, databases, readOnly, setDatabaseId }) => (
  <div className="GuiBuilder-section GuiBuilder-data flex align-center ml2">
    <DatabaseDataSelector
      databases={databases}
      selectedDatabaseId={database?.id}
      setDatabaseFn={setDatabaseId}
      isInitiallyOpen={database == null}
      readOnly={readOnly}
    />
  </div>
);

DatabaseSelector.propTypes = DatabaseSelectorPropTypes;

const DatabaseNameSpan = ({ database }) => (
  <span className="p2 text-bold text-grey">{database.name}</span>
);

DatabaseNameSpan.propTypes = DatabaseNameSpanPropTypes;

const TableSelector = ({ database, readOnly, selectedTable, setTableId }) => (
  <div className="GuiBuilder-section GuiBuilder-data flex align-center ml2">
    <SchemaAndTableDataSelector
      selectedTableId={selectedTable?.id || null}
      selectedDatabaseId={database?.id}
      databases={[database]}
      setSourceTableFn={setTableId}
      isInitiallyOpen={false}
      readOnly={readOnly}
    />
  </div>
);

TableSelector.propTypes = TableSelectorPropTypes;

const Placeholder = ({ query }) => (
  <span className="ml2 p2 text-medium">
    {t`This question is written in ${query.nativeQueryLanguage()}.`}
  </span>
);

Placeholder.propTypes = PlaceholderPropTypes;

export default DataSelectors;
