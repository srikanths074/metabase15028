import { useMemo, useState } from "react";
import * as Lib from "metabase-lib";
import {
  getAvailableColumns,
  getAvailableOptions,
  getDefaultSecondColumn,
  getDefaultValues,
  getFilterClause,
  getOptionByOperator,
  isValidFilter,
} from "./utils";
import type { NumberValue } from "./types";

interface UseCoordinateFilterProps {
  query: Lib.Query;
  stageIndex: number;
  column: Lib.ColumnMetadata;
  filter?: Lib.FilterClause;
}

export function useCoordinateFilter({
  query,
  stageIndex,
  column,
  filter,
}: UseCoordinateFilterProps) {
  const filterParts = useMemo(
    () =>
      filter ? Lib.coordinateFilterParts(query, stageIndex, filter) : null,
    [query, stageIndex, filter],
  );

  const availableOptions = useMemo(
    () => getAvailableOptions(query, stageIndex, column),
    [query, stageIndex, column],
  );

  const availableColumns = useMemo(
    () => getAvailableColumns(query, stageIndex, column),
    [query, stageIndex, column],
  );

  const [operator, setOperator] = useState(
    filterParts ? filterParts.operator : "=",
  );
  const [values, setValues] = useState(
    getDefaultValues(operator, filterParts?.values),
  );
  const [secondColumn, setSecondColumn] = useState(
    getDefaultSecondColumn(availableColumns, filterParts?.longitudeColumn),
  );

  const { valueCount, hasMultipleValues } = getOptionByOperator(operator);
  const isValid = isValidFilter(operator, column, secondColumn, values);

  const setOperatorAndValues = (operator: Lib.CoordinateFilterOperatorName) => {
    setOperator(operator);
    setValues(getDefaultValues(operator, values));
  };

  return {
    operator,
    availableOptions,
    values,
    valueCount,
    hasMultipleValues,
    availableColumns,
    secondColumn,
    isValid,
    getFilterClause: (
      operator: Lib.CoordinateFilterOperatorName,
      secondColumn: Lib.ColumnMetadata,
      values: NumberValue[],
    ) => getFilterClause(operator, column, secondColumn, values),
    setOperator: setOperatorAndValues,
    setValues,
    setSecondColumn,
  };
}
