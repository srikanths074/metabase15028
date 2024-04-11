import { t } from "ttag";

import { checkNotNull } from "metabase/lib/types";
import * as Lib from "metabase-lib";
import type { Dataset, RowValue, RowValues } from "metabase-types/api";

import type { ColumnAndSeparator, ColumnOption } from "./types";

export const getColumnOptions = (
  query: Lib.Query,
  stageIndex: number,
  columns: Lib.ColumnMetadata[],
) => {
  return columns.map((column, index) => {
    const info = Lib.displayInfo(query, stageIndex, column);
    const label = info.displayName;
    const value = String(index);
    return { column, label, value };
  });
};

export const fromSelectValue = (
  options: ColumnOption[],
  value: string | null,
): Lib.ColumnMetadata => {
  const index = Number(checkNotNull(value));
  return options[index].column;
};

export const toSelectValue = (
  options: ColumnOption[],
  column: Lib.ColumnMetadata,
): string => {
  const index = options.findIndex(option => option.column === column);
  return String(index);
};

export const getNextColumnAndSeparator = (
  columns: Lib.ColumnMetadata[],
  defaultSeparator: string,
  options: ColumnOption[],
  columnsAndSeparators: ColumnAndSeparator[],
): ColumnAndSeparator => {
  const lastSeparator = columnsAndSeparators.at(-1)?.separator;
  const separator = lastSeparator ?? defaultSeparator;
  const defaultColumn = columns[0];
  const nextUnusedOption = options.find(option => {
    return columnsAndSeparators.every(({ column }) => column !== option.column);
  });
  const column = nextUnusedOption ? nextUnusedOption.column : defaultColumn;
  return { column, separator };
};

export const formatSeparator = (separator: string) => {
  if (separator === " ") {
    return `(${t`space`})`;
  }

  return separator;
};

export const extractQueryResults = (
  query: Lib.Query,
  stageIndex: number,
  datasets: Dataset[] | null,
): {
  columns: Lib.ColumnMetadata[];
  rows: RowValues[];
} => {
  if (!datasets || datasets.length === 0) {
    return { columns: [], rows: [] };
  }

  const data = datasets[0].data;
  const rows = data.rows;

  const columns = data.results_metadata.columns.map(column => {
    return Lib.fromLegacyColumn(query, stageIndex, column);
  });

  return { rows, columns };
};

export const getPreview = (
  query: Lib.Query,
  stageIndex: number,
  expressionClause: Lib.ExpressionClause,
  columns: Lib.ColumnMetadata[],
  rows: RowValues[],
): { color: string; value: RowValue }[] => {
  const PREVIEW_COLORS = ["text-dark", "text-medium", "text-light"];

  return rows.slice(0, PREVIEW_COLORS.length).map((row, index) => {
    const color = PREVIEW_COLORS[index];
    const value = Lib.previewExpression(
      query,
      stageIndex,
      expressionClause,
      columns,
      row,
    );

    return { color, value };
  });
};

export const getDefaultSeparator = (column: Lib.ColumnMetadata): string => {
  if (Lib.isURL(column)) {
    return "/";
  }

  if (Lib.isEmail(column)) {
    return "";
  }

  return " ";
};

export const getDrillExpressionClause = (
  column: Lib.ColumnMetadata,
  columnsAndSeparators: ColumnAndSeparator[],
) => {
  return Lib.expressionClause("concat", [
    column,
    ...columnsAndSeparators.flatMap(({ column, separator }) => [
      separator,
      column,
    ]),
  ]);
};

export const getExpressionName = (
  query: Lib.Query,
  stageIndex: number,
  column: Lib.ColumnMetadata,
  columnsAndSeparators: ColumnAndSeparator[],
): string => {
  const columns = [column, ...columnsAndSeparators.map(({ column }) => column)];
  const names = columns.map(
    column => Lib.displayInfo(query, stageIndex, column).displayName,
  );
  return names.join(" ");
};
