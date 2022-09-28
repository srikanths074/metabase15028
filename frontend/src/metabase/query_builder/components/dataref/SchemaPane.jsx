/* eslint-disable react/prop-types */
import React from "react";
import PropTypes from "prop-types";
import Icon from "metabase/components/Icon";
import Schemas from "metabase/entities/schemas";

const propTypes = {
  show: PropTypes.func.isRequired,
  schema: PropTypes.object.isRequired,
};

const SchemaPaneInner = ({ schema, show }) => {
  const tables = schema.tables.sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <div className="ml1 my2 flex align-center justify-between border-bottom pb1">
        <div className="flex align-center">
          <Icon name="table2" className="text-light pr1" size={12} />
          <span className="text-medium">{tables.length}</span>
        </div>
      </div>
      <ul>
        {tables.map(table => (
          <li key={table.id}>
            <a
              className="flex-full flex p1 text-bold text-brand text-wrap no-decoration bg-medium-hover"
              onClick={() => show("table", table)}
            >
              {table.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

const SchemaPane = Schemas.load({ id: (state, { schema }) => schema.id })(
  SchemaPaneInner,
);
SchemaPane.propTypes = propTypes;
SchemaPaneInner.propTypes = propTypes;

export default SchemaPane;
