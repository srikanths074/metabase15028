import type {
  AggregationKey,
  ColumnHeader,
  QueryPlan,
  ResultProvider,
  SummaryTableDatasetData,
  SummaryTableSettings
} from "metabase/meta/types/summary_table";
import type {ColumnName, DatasetData, Column, Row} from "metabase/meta/types/Dataset";
import set from "lodash.set";
import get from "lodash.get";
import flatMap from "lodash.flatmap";
import zip from "lodash.zip";
import orderBy from "lodash.orderby";
import invert from "lodash.invert";
import {canTotalizeByType} from "metabase/visualizations/lib/settings/summary_table";
import {getAllQueryKeys, getQueryPlan, grandTotalsLabel} from "metabase/visualizations/lib/summary_table";

type RowUpdater = (Row, Row) => Row;

type RowAssembler = {
  shouldUpdateAssembler: (ColumnName[]) => (Row, Row) => boolean,
  updateAssembler: (ColumnName[]) => RowUpdater,
};

const repeat = (values: [], len) => flatMap(Array(len), () => values);

const getColumnsFromPivotSource = ({columns, rows}: DatasetData, columnName: ColumnName) => {
  const pivotIndex = columns.indexOf(columnName);
  const resSet = rows.reduce((acc, elem) => acc.add(elem[pivotIndex]), new Set());
  return Array.from(resSet);
};

const buildColumnHeaders = ({groupsSources, columnsSource, valuesSources, columnNameToMetadata}: SummaryTableSettings, mainResults: DatasetData):
  { columnsHeaders: ColumnHeader[][], cols: Column[] } => {

  const columnNameToColumn = mainResults.cols.reduce((acc, column) => set(acc, column.name, column), {});
  const getColumn = columnName => columnNameToColumn[columnName];
  const toColumnHeader = column => ({column, columnSpan: 1});
  const getSortOrder = columnName => columnNameToMetadata[columnName].isAscSortOrder ? 'asc' : 'desc';
  const shouldTotlize = columnName => canTotalizeByType(getColumn(columnName).base_type);
  const showTotalsFor = columnName => columnNameToMetadata[columnName].showTotals;

  const partGroupingsRaw = groupsSources.map(getColumn).map(toColumnHeader);
  const partValuesRaw = valuesSources.map(getColumn).map(toColumnHeader);

  const isPivoted = columnsSource.length > 0;
  if (isPivoted) {
    const pivotSource = columnsSource[0];
    const pivotColumn = getColumn(pivotSource);
    const columnSpan = partValuesRaw.length;
    const partPivotRaw = orderBy(getColumnsFromPivotSource(mainResults, pivotSource), p => p, getSortOrder(pivotSource))
      .map(value => ({column: pivotColumn, value, columnSpan}));

    const partValuesTotalized = partValuesRaw.filter(({column: {name}}) => shouldTotlize(name));
    const grandTotalsSpan = partValuesTotalized.length;

    const hasGrandsTotalsColumn = showTotalsFor(pivotSource) && grandTotalsSpan > 0;


    const topRowNormalPart = [...partGroupingsRaw.map(() => null), ...flatMap(partPivotRaw.map(header => set(Array(header.columnSpan), 0, header)))];
    const topRow = hasGrandsTotalsColumn ?
      [...topRowNormalPart, {
        column: pivotColumn,
        columnSpan: grandTotalsSpan,
        displayText: grandTotalsLabel
      }, ...repeat([null], grandTotalsSpan - 1)]
      : topRowNormalPart;
    const bottomRow = [...partGroupingsRaw, ...repeat(partValuesRaw, partPivotRaw.length), ...(hasGrandsTotalsColumn ? partValuesTotalized : [])];


    return {columnsHeaders: [topRow, bottomRow], cols: bottomRow.map(p => p.column)};
  }
  else {
    const mainRow = [...partGroupingsRaw, ...partValuesRaw];
    return {columnsHeaders: [mainRow], cols: mainRow.map(p => p.column)};
  }
};

const tryCompressColumnsHeaders = ({valuesSources}, columnsHeaders) => {

  if (valuesSources.length > 1){
    return columnsHeaders;
  }

  const [topRow, bottomRow] = columnsHeaders;
  return [zip(topRow, bottomRow).map(([top, bottom]) => top || bottom)]
};

const updateValueIfExists = (toUpdate, index, value) => {
  if (isDefined(value)) {
    toUpdate[index]=value;
  }

  return toUpdate;
};

const pivotedRowUpdater = (expectedRowShape: ColumnName[], pivotColumnName: ColumnName, expectedPivotShape: { [key: any]: [ColumnName, Number][]}): (ColumnName[] => RowUpdater) => {

  return (givenRowShape: ColumnName[]) => {
    const pivotColumnIndex = givenRowShape.indexOf(pivotColumnName);
    const rowToExpectedPivotShape = row => expectedPivotShape[row[pivotColumnIndex]];
    return rowUpdater(expectedRowShape, rowToExpectedPivotShape)(givenRowShape);
  };
};

const rowUpdater = (expectedRowShape: ColumnName[], rowToExpectedPivotShape: (Row => [ColumnName, Number][])): (ColumnName[] => RowUpdater) => {
  return (givenRowShape: ColumnName[]): RowUpdater => {

    const columnNameToValueIndex = invert(givenRowShape);

    return (toUpdate, updateFrom) => {

      const pivotShape = rowToExpectedPivotShape(updateFrom);

      const normalPart = expectedRowShape.map((columnName, targetIndex) => [targetIndex, columnNameToValueIndex[columnName]]);
      const pivotPart = pivotShape.map(([columnName, targetIndex]) => [targetIndex, columnNameToValueIndex[columnName]]);

      const rowUpdateMethod = (acc, [targetIndex, valueIndex]) => updateValueIfExists(acc, targetIndex, get(updateFrom, valueIndex));

      normalPart.reduce(rowUpdateMethod, toUpdate);
      pivotPart.reduce(rowUpdateMethod, toUpdate);

      return toUpdate;
    };
  };
};

const haveEqualPrefixAssembler = (expectedRowShape: ColumnName[]) => (givenRowShape: ColumnName[]): ((Row, Row) => boolean) => {
  const columnNameToNormalizedValueIndex = invert(expectedRowShape);
  const columnNameToValueIndex = invert(givenRowShape);

  const valueIndexes = expectedRowShape
    .filter(columnName => columnName in columnNameToValueIndex)
    .map(columnName => [columnNameToNormalizedValueIndex[columnName], columnNameToValueIndex[columnName]]);

  return (normalizedRow, nextRow) => {
    if (!normalizedRow){
      return false;
    }



    for (let i = 0; i < valueIndexes.length; i++) {
      const [normValueIndex, nextRowValueIndex] = valueIndexes[i];
      if (normalizedRow[normValueIndex] !== nextRow[nextRowValueIndex]) {
        return false;
      }
    }
    return true;
  };

};

const getRowAssembler = (columnsHeaders: ColumnHeader[][]): RowAssembler => {

  if (columnsHeaders.length === 1) {
    const expectedRowShape = columnsHeaders[0].map(({column: {name}}) => name);
    const alwaysFalse = () => false;
    const emptyPivotShape = () => [];
    return {
      shouldUpdateAssembler: () => alwaysFalse,
      updateAssembler: rowUpdater(expectedRowShape, emptyPivotShape),
    };
  }

  const firstPivotIndex = columnsHeaders[0].findIndex(p => p);
  const expectedRowShape = columnsHeaders[1].slice(0, firstPivotIndex).map(({column: {name}}) => name);

  const pivotShape = columnsHeaders[0].reduce((acc, header, index) => {
    if (header) {
      const {columnSpan, value} = header;
      const pivotValueColumnsNames = columnsHeaders[1].slice(index, index + columnSpan).map(({column: {name}}) => name);
      acc[value] = pivotValueColumnsNames.reduce((acc, columnName, localIndex) => set(acc, localIndex, [columnName, localIndex + index]), [])
    }
    return acc;
  }, {});
  const shouldUpdateAssembler = haveEqualPrefixAssembler(expectedRowShape);

  const pivotColumnName = columnsHeaders[0][firstPivotIndex].column.name;
  return {
    shouldUpdateAssembler,
    updateAssembler: pivotedRowUpdater(expectedRowShape, pivotColumnName, pivotShape),
  };
};


const canTotalizeBuilder = (cols: Column[]): (ColumnName => boolean) => {
  const columnNameToType = cols.reduce(
    (acc, {name, base_type}) => ({...acc, [name]: base_type}),
    {},
  );
  return p => canTotalizeByType(columnNameToType[p]);
};


const extractRows = ({shouldUpdateAssembler, updateAssembler}: RowAssembler, [mainData, pivotColumnData]) => {
  const {columns, rows} = mainData;

  const shouldUpdate = shouldUpdateAssembler(columns);
  const update = updateAssembler(columns);

  const {result} = rows.reduce(({result, prevNormalizedRow}, currentRow) => {
      if (shouldUpdate(prevNormalizedRow, currentRow)) {
        update(prevNormalizedRow, currentRow);
        return {result, prevNormalizedRow}
      }
      else {
        const newRow = update([], currentRow);
        result.push(newRow);
        return {result, prevNormalizedRow: newRow};
      }
    },
    {result: []}
  );

  return result;
};

const isDefined = value => value || value === 0;

const buildComparer = (ascDescMultiplier, index) => (nextComparer) => (item1, item2) => {

  const value1 = item1[index];
  const value2 = item2[index];

  if (value1 === value2 || !isDefined(value1) && !isDefined(value2)) {
    return nextComparer ? nextComparer(item1, item2) : 0;
  }

  if (isDefined(value1) && !isDefined(value2))
    return -1;

  if (!isDefined(value1) && isDefined(value2))
    return 1;

  if (value1 < value2)
    return -1 * ascDescMultiplier;

  return 1 * ascDescMultiplier;

};

const buildUberComparer = (sortOrders) => {

  const ascDescMultiplier = ascDesc => ascDesc === 'asc' ? 1 : -1;

  return sortOrders
    .map(([ascDesc], index) => buildComparer(ascDescMultiplier(ascDesc), index))
    .reverse()
    .reduce((prevCmp, currentPartCmp) => currentPartCmp(prevCmp));
};

//todo: do it better, we can merge in O(n) time
const combineRows = (sortOrder, rowsArray: Row[][]) =>
  flatMap(rowsArray, p => p).sort(buildUberComparer(sortOrder));

const setTotalIndex = (row, index) => {
  row.isTotalColumnIndex = index;
  return row;
};

const addTotalIndex = (rows: Row[], keys: AggregationKey[], {columnsSource}: SummaryTableSettings) => {

  const groupings = keys[0][0];
  const pivotCorrection = groupings.has(columnsSource[0]) ? 1 : 0;

  const isTotalColumnIndex = groupings.size - pivotCorrection;
  rows.forEach(row => setTotalIndex(row, isTotalColumnIndex));

  return rows;
};

const combineData = (rowAssembler: RowAssembler, queryPlan: QueryPlan, settings: SummaryTableSettings, resultsProvider: ResultProvider) => {

  const normalizedRows = getAllQueryKeys(queryPlan)
    .map(keys => ({results: keys.map(key => resultsProvider(key)), keys}))
    .map(({results, keys}) => ({rows: extractRows(rowAssembler, results), keys}))
    .map(({rows, keys}, index) => index === 0 ? rows : addTotalIndex(rows, keys, settings));

  const combinedRows = combineRows(queryPlan.sortOrder, normalizedRows);
  return {rows: combinedRows};
};


export const buildDatasetData = (settings: SummaryTableSettings, mainResults: DatasetData, resultsProvider: ResultProvider): SummaryTableDatasetData => {
  const {columnsHeaders, cols} = buildColumnHeaders(settings, mainResults);
  const compressedColumnsHeaders = tryCompressColumnsHeaders(settings, columnsHeaders);
  const rowAssembler = getRowAssembler(columnsHeaders);

  const queryPlan = getQueryPlan(settings, canTotalizeBuilder(mainResults.cols));

  const {rows} = combineData(rowAssembler, queryPlan, settings, resultsProvider);

  return {
    columnsHeaders: compressedColumnsHeaders,
    cols,
    columns: cols.map(p => p.name),
    rows
  };
};
