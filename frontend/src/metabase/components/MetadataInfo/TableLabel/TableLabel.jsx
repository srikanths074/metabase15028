import React from "react";
import PropTypes from "prop-types";

import Table from "metabase-lib/lib/metadata/Table";
import { LabelContainer, Label } from "../MetadataInfo.styled";
import { TableIcon } from "./TableLabel.styled";

const propTypes = {
  className: PropTypes.string,
  table: PropTypes.instanceOf(Table).isRequired,
};

function TableLabel({ className, table }) {
  return (
    <LabelContainer className={className}>
      <TableIcon />
      <Label>{table.displayName()}</Label>
    </LabelContainer>
  );
}

TableLabel.propTypes = propTypes;

export default TableLabel;
