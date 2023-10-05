import moment from "moment-timezone";
import * as ML from "cljs/metabase.lib.js";

import {
  BOOLEAN_FILTER_OPERATORS,
  COORDINATE_FILTER_OPERATORS,
  EXCLUDE_DATE_BUCKETS,
  EXCLUDE_DATE_FILTER_OPERATORS,
  NUMBER_FILTER_OPERATORS,
  RELATIVE_DATE_BUCKETS,
  SPECIFIC_DATE_FILTER_OPERATORS,
  STRING_FILTER_OPERATORS,
  TIME_FILTER_OPERATORS,
} from "./constants";
import { expressionClause, expressionParts } from "./expression";
import { displayInfo } from "./metadata";
import {
  availableTemporalBuckets,
  temporalBucket,
  withTemporalBucket,
} from "./temporal_bucket";
import type {
  BooleanFilterOperatorName,
  BooleanFilterParts,
  Bucket,
  BucketName,
  ColumnMetadata,
  CoordinateFilterOperatorName,
  CoordinateFilterParts,
  DateParts,
  DateTimeParts,
  ExcludeDateBucketName,
  ExcludeDateFilterOperatorName,
  ExcludeDateFilterParts,
  ExpressionClause,
  ExpressionOperatorName,
  ExpressionParts,
  FilterClause,
  FilterOperator,
  FilterOperatorName,
  FilterParts,
  NumberFilterOperatorName,
  NumberFilterParts,
  Query,
  RelativeDateBucketName,
  RelativeDateFilterParts,
  SpecificDateFilterOperatorName,
  SpecificDateFilterParts,
  StringFilterOperatorName,
  StringFilterParts,
  TimeFilterOperatorName,
  TimeFilterParts,
  TimeParts,
} from "./types";
import { isTime } from "./column_types";

export function filterableColumns(
  query: Query,
  stageIndex: number,
): ColumnMetadata[] {
  return ML.filterable_columns(query, stageIndex);
}

export function filterableColumnOperators(
  column: ColumnMetadata,
): FilterOperator[] {
  return ML.filterable_column_operators(column);
}

export function defaultFilterOperatorName(
  query: Query,
  stageIndex: number,
  column: ColumnMetadata,
): FilterOperatorName {
  return isTime(column) ? "<" : "=";
}

export function filter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause | ExpressionClause,
): Query {
  return ML.filter(query, stageIndex, filterClause);
}

export function filters(query: Query, stageIndex: number): FilterClause[] {
  return ML.filters(query, stageIndex);
}

export function stringFilterClause({
  operator,
  column,
  values,
  options,
}: StringFilterParts): ExpressionClause {
  return expressionClause(operator, [column, ...values], options);
}

export function stringFilterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): StringFilterParts | null {
  const { operator, options, args } = expressionParts(
    query,
    stageIndex,
    filterClause,
  );
  if (!isStringOperator(operator) || args.length < 1) {
    return null;
  }

  const [column, ...values] = args;
  if (!isColumnMetadata(column) || !isStringLiteralArray(values)) {
    return null;
  }

  return {
    operator,
    column,
    values,
    options,
  };
}

export function isStringFilter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): boolean {
  return stringFilterParts(query, stageIndex, filterClause) != null;
}

export function numberFilterClause({
  operator,
  column,
  values,
}: NumberFilterParts): ExpressionClause {
  return expressionClause(operator, [column, ...values]);
}

export function numberFilterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): NumberFilterParts | null {
  const { operator, args } = expressionParts(query, stageIndex, filterClause);
  if (!isNumberOperator(operator) || args.length < 1) {
    return null;
  }

  const [column, ...values] = args;
  if (!isColumnMetadata(column) || !isNumberLiteralArray(values)) {
    return null;
  }

  return {
    operator,
    column,
    values,
  };
}

export function isNumberFilter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): boolean {
  return numberFilterParts(query, stageIndex, filterClause) != null;
}

export function coordinateFilterClause({
  operator,
  column,
  longitudeColumn,
  values,
}: CoordinateFilterParts): ExpressionClause {
  const args =
    operator === "inside"
      ? [column, longitudeColumn ?? column, ...values]
      : [column, ...values];
  return expressionClause(operator, args);
}

export function coordinateFilterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): CoordinateFilterParts | null {
  const { operator, args } = expressionParts(query, stageIndex, filterClause);
  if (!isCoordinateOperator(operator) || args.length < 1) {
    return null;
  }

  const [column, ...otherArgs] = args;
  if (!isColumnMetadata(column)) {
    return null;
  }

  if (operator === "inside") {
    const [longitudeColumn, ...values] = otherArgs;
    if (isColumnMetadata(longitudeColumn) && isNumberLiteralArray(values)) {
      return { operator, column, longitudeColumn, values };
    }
  } else {
    const values = otherArgs;
    if (isNumberLiteralArray(values)) {
      return { operator, column, values };
    }
  }

  return null;
}

export function isCoordinateFilter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): boolean {
  return coordinateFilterParts(query, stageIndex, filterClause) != null;
}

export function booleanFilterClause({
  operator,
  column,
  values,
}: BooleanFilterParts): ExpressionClause {
  return expressionClause(operator, [column, ...values]);
}

export function booleanFilterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): BooleanFilterParts | null {
  const { operator, args } = expressionParts(query, stageIndex, filterClause);
  if (!isBooleanOperator(operator) || args.length < 1) {
    return null;
  }

  const [column, ...values] = args;
  if (!isColumnMetadata(column) || !isBooleanLiteralArray(values)) {
    return null;
  }

  return {
    operator,
    column,
    values,
  };
}

export function isBooleanFilter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): boolean {
  return booleanFilterParts(query, stageIndex, filterClause) != null;
}

export function specificDateFilterClause(
  query: Query,
  stageIndex: number,
  { operator, column, values }: SpecificDateFilterParts,
): ExpressionClause {
  const hasTime = values.some(hasTimeParts);
  const stringValues = hasTime
    ? values.map(value => dateTimePartsToString(value))
    : values.map(value => datePartsToString(value));

  const minuteBucket = hasTime
    ? findTemporalBucket(query, stageIndex, column, "minute")
    : undefined;
  const columnWithOrWithoutBucket =
    hasTime && minuteBucket
      ? withTemporalBucket(column, minuteBucket)
      : withTemporalBucket(column, null);

  return expressionClause(operator, [
    columnWithOrWithoutBucket,
    ...stringValues,
  ]);
}

export function specificDateFilterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): SpecificDateFilterParts | null {
  const { operator, args } = expressionParts(query, stageIndex, filterClause);
  if (!isSpecificDateOperator(operator) || args.length < 1) {
    return null;
  }

  const [column, ...stringValues] = args;
  if (!isColumnMetadata(column) || !isStringLiteralArray(stringValues)) {
    return null;
  }

  const values = stringValues.map(value => stringToDateTimeParts(value));
  if (!isDefinedArray(values)) {
    return null;
  }

  return {
    operator,
    column,
    values,
  };
}

export function isSpecificDateFilter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): boolean {
  return specificDateFilterParts(query, stageIndex, filterClause) != null;
}

export function relativeDateFilterClause({
  column,
  value,
  bucket,
  offsetValue,
  offsetBucket,
  options,
}: RelativeDateFilterParts): ExpressionClause {
  if (offsetValue == null || offsetBucket == null) {
    return expressionClause("time-interval", [column, value, bucket], options);
  }

  return expressionClause("between", [
    expressionClause("+", [
      column,
      expressionClause("interval", [-offsetValue, offsetBucket]),
    ]),
    expressionClause("relative-datetime", [value < 0 ? value : 0, bucket]),
    expressionClause("relative-datetime", [value > 0 ? value : 0, bucket]),
  ]);
}

export function relativeDateFilterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): RelativeDateFilterParts | null {
  const filterParts = expressionParts(query, stageIndex, filterClause);
  return (
    relativeDateFilterPartsWithoutOffset(query, stageIndex, filterParts) ??
    relativeDateFilterPartsWithOffset(query, stageIndex, filterParts)
  );
}

export function isRelativeDateFilter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): boolean {
  return relativeDateFilterParts(query, stageIndex, filterClause) != null;
}

export function excludeDateFilterClause(
  query: Query,
  stageIndex: number,
  { operator, column, values, bucket: bucketName }: ExcludeDateFilterParts,
): ExpressionClause {
  if (!bucketName) {
    const columnWithoutBucket = withTemporalBucket(column, null);
    return expressionClause(operator, [columnWithoutBucket]);
  }

  const bucket = findTemporalBucket(query, stageIndex, column, bucketName);
  const columnWithBucket = withTemporalBucket(column, bucket ?? null);
  const stringValues = values.map(value =>
    excludeDatePartToString(value, bucketName),
  );

  return expressionClause(operator, [columnWithBucket, ...stringValues]);
}

export function excludeDateFilterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): ExcludeDateFilterParts | null {
  const { operator, args } = expressionParts(query, stageIndex, filterClause);
  if (!isExcludeDateOperator(operator) || args.length < 1) {
    return null;
  }

  const [column, ...stringValues] = args;
  if (!isColumnMetadata(column) || !isStringLiteralArray(stringValues)) {
    return null;
  }

  const bucket = temporalBucket(column);
  if (!bucket) {
    return { column, operator, bucket, values: [] };
  }

  const bucketInfo = displayInfo(query, stageIndex, bucket);
  if (!isExcludeDateBucket(bucketInfo.shortName)) {
    return null;
  }

  const bucketValues = stringValues.map(value =>
    stringToExcludeDatePart(value, bucketInfo.shortName),
  );
  if (!isDefinedArray(bucketValues)) {
    return null;
  }

  return {
    column,
    operator,
    bucket: bucketInfo.shortName,
    values: bucketValues,
  };
}

export function isExcludeDateFilter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): boolean {
  return excludeDateFilterParts(query, stageIndex, filterClause) != null;
}

export function timeFilterClause({
  operator,
  column,
  values,
}: TimeFilterParts): ExpressionClause {
  const columnWithoutBucket = withTemporalBucket(column, null);
  const stringValues = values.map(value => timePartsToString(value));
  return expressionClause(operator, [columnWithoutBucket, ...stringValues]);
}

export function timeFilterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): TimeFilterParts | null {
  const { operator, args } = expressionParts(query, stageIndex, filterClause);
  if (!isTimeOperator(operator) || args.length < 1) {
    return null;
  }

  const [column, ...stringValues] = args;
  if (!isColumnMetadata(column) || !isStringLiteralArray(stringValues)) {
    return null;
  }

  const values = stringValues.map(value => stringToTimeParts(value));
  if (!isDefinedArray(values)) {
    return null;
  }

  return {
    operator,
    column,
    values,
  };
}

export function isTimeFilter(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): boolean {
  return timeFilterParts(query, stageIndex, filterClause) != null;
}

export function filterParts(
  query: Query,
  stageIndex: number,
  filterClause: FilterClause,
): FilterParts | null {
  return (
    stringFilterParts(query, stageIndex, filterClause) ??
    numberFilterParts(query, stageIndex, filterClause) ??
    booleanFilterParts(query, stageIndex, filterClause) ??
    specificDateFilterParts(query, stageIndex, filterClause) ??
    relativeDateFilterParts(query, stageIndex, filterClause) ??
    excludeDateFilterParts(query, stageIndex, filterClause) ??
    timeFilterParts(query, stageIndex, filterClause)
  );
}

function findTemporalBucket(
  query: Query,
  stageIndex: number,
  column: ColumnMetadata,
  bucketName: BucketName,
): Bucket | undefined {
  return availableTemporalBuckets(query, stageIndex, column).find(bucket => {
    const bucketInfo = displayInfo(query, stageIndex, bucket);
    return bucketInfo.shortName === bucketName;
  });
}

function isColumnMetadata(arg: unknown): arg is ColumnMetadata {
  return ML.is_column_metadata(arg);
}

function isExpression(arg: unknown): arg is ExpressionParts {
  return arg != null && typeof arg === "object";
}

function isDefined<T>(arg: T | undefined | null): arg is T {
  return arg != null;
}

function isDefinedArray<T>(arg: (T | undefined | null)[]): arg is T[] {
  return arg.every(isDefined);
}

function isStringLiteral(arg: unknown): arg is string {
  return typeof arg === "string";
}

function isStringLiteralArray(arg: unknown): arg is string[] {
  return Array.isArray(arg) && arg.every(isStringLiteral);
}

function isNumberLiteral(arg: unknown): arg is number {
  return typeof arg === "number";
}

function isNumberOrCurrentLiteral(arg: unknown): arg is number | "current" {
  return isNumberLiteral(arg) || arg === "current";
}

function isNumberLiteralArray(arg: unknown): arg is number[] {
  return Array.isArray(arg) && arg.every(isNumberLiteral);
}

function isBooleanLiteral(arg: unknown): arg is boolean {
  return typeof arg === "boolean";
}

function isBooleanLiteralArray(arg: unknown): arg is boolean[] {
  return Array.isArray(arg) && arg.every(isBooleanLiteral);
}

function isStringOperator(
  operator: ExpressionOperatorName,
): operator is StringFilterOperatorName {
  const operators: ReadonlyArray<string> = STRING_FILTER_OPERATORS;
  return operators.includes(operator);
}

function isNumberOperator(
  operator: ExpressionOperatorName,
): operator is NumberFilterOperatorName {
  const operators: ReadonlyArray<string> = NUMBER_FILTER_OPERATORS;
  return operators.includes(operator);
}

function isCoordinateOperator(
  operator: ExpressionOperatorName,
): operator is CoordinateFilterOperatorName {
  const operators: ReadonlyArray<string> = COORDINATE_FILTER_OPERATORS;
  return operators.includes(operator);
}

function isBooleanOperator(
  operator: ExpressionOperatorName,
): operator is BooleanFilterOperatorName {
  const operators: ReadonlyArray<string> = BOOLEAN_FILTER_OPERATORS;
  return operators.includes(operator);
}

function isSpecificDateOperator(
  operator: ExpressionOperatorName,
): operator is SpecificDateFilterOperatorName {
  const operators: ReadonlyArray<string> = SPECIFIC_DATE_FILTER_OPERATORS;
  return operators.includes(operator);
}

function isExcludeDateOperator(
  operator: ExpressionOperatorName,
): operator is ExcludeDateFilterOperatorName {
  const operators: ReadonlyArray<string> = EXCLUDE_DATE_FILTER_OPERATORS;
  return operators.includes(operator);
}

function isTimeOperator(
  operator: ExpressionOperatorName,
): operator is TimeFilterOperatorName {
  const operators: ReadonlyArray<string> = TIME_FILTER_OPERATORS;
  return operators.includes(operator);
}

function isRelativeDateBucket(
  bucketName: string,
): bucketName is RelativeDateBucketName {
  const buckets: ReadonlyArray<string> = RELATIVE_DATE_BUCKETS;
  return buckets.includes(bucketName);
}

function isExcludeDateBucket(
  bucketName: string,
): bucketName is ExcludeDateBucketName {
  const buckets: ReadonlyArray<string> = EXCLUDE_DATE_BUCKETS;
  return buckets.includes(bucketName);
}

const DATE_FORMAT = "yyyy-MM-DD";
const TIME_FORMAT = "HH:mm:ss";
const DATE_TIME_FORMAT = `${DATE_FORMAT}T${TIME_FORMAT}`;

function hasTimeParts({ hour, minute }: DateTimeParts): boolean {
  return hour !== 0 || minute !== 0;
}

function datePartsToString(parts: DateParts): string {
  const date = moment({
    year: parts.year,
    month: parts.month,
    date: parts.date,
  });

  return date.format(DATE_FORMAT);
}

function dateTimePartsToString(parts: DateTimeParts): string {
  const date = moment({
    year: parts.year,
    month: parts.month,
    date: parts.date,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: 0,
  });

  return date.format(DATE_TIME_FORMAT);
}

function stringToDateTimeParts(value: string): DateTimeParts | null {
  const dateTime = moment(value, [DATE_TIME_FORMAT, DATE_FORMAT], true);
  if (!dateTime.isValid()) {
    return null;
  }

  return {
    year: dateTime.year(),
    month: dateTime.month(),
    date: dateTime.date(),
    hour: dateTime.hour(),
    minute: dateTime.minute(),
  };
}

function timePartsToString(value: TimeParts): string {
  const time = moment({
    hour: value.hour,
    minute: value.minute,
  });

  return time.format(TIME_FORMAT);
}

function stringToTimeParts(value: string): TimeParts | null {
  const time = moment(value, TIME_FORMAT, true);
  if (!time.isValid()) {
    return null;
  }

  return {
    hour: time.hour(),
    minute: time.minute(),
  };
}

function relativeDateFilterPartsWithoutOffset(
  query: Query,
  stageIndex: number,
  { operator, args, options }: ExpressionParts,
): RelativeDateFilterParts | null {
  if (operator !== "time-interval" || args.length !== 3) {
    return null;
  }

  const [column, value, bucket] = args;
  if (
    !isColumnMetadata(column) ||
    !isNumberOrCurrentLiteral(value) ||
    !isStringLiteral(bucket) ||
    !isRelativeDateBucket(bucket)
  ) {
    return null;
  }

  return {
    column,
    value,
    bucket,
    offsetValue: null,
    offsetBucket: null,
    options,
  };
}

function relativeDateFilterPartsWithOffset(
  query: Query,
  stageIndex: number,
  { operator, args, options }: ExpressionParts,
): RelativeDateFilterParts | null {
  if (operator !== "between" || args.length !== 3) {
    return null;
  }

  const [offsetParts, startParts, endParts] = args;
  if (
    !isExpression(offsetParts) ||
    !isExpression(startParts) ||
    !isExpression(endParts) ||
    offsetParts.operator !== "+" ||
    offsetParts.args.length !== 2 ||
    startParts.operator !== "relative-datetime" ||
    startParts.args.length !== 2 ||
    endParts.operator !== "relative-datetime" ||
    endParts.args.length !== 2
  ) {
    return null;
  }

  const [column, intervalParts] = offsetParts.args;
  if (
    !isColumnMetadata(column) ||
    !isExpression(intervalParts) ||
    intervalParts.operator !== "interval"
  ) {
    return null;
  }

  const [offsetValue, offsetBucket] = intervalParts.args;
  if (
    !isNumberLiteral(offsetValue) ||
    !isStringLiteral(offsetBucket) ||
    !isRelativeDateBucket(offsetBucket)
  ) {
    return null;
  }

  const [startValue, startBucket] = startParts.args;
  const [endValue, endBucket] = endParts.args;
  if (
    !isNumberLiteral(startValue) ||
    !isStringLiteral(startBucket) ||
    !isRelativeDateBucket(startBucket) ||
    !isNumberLiteral(endValue) ||
    !isStringLiteral(endBucket) ||
    !isRelativeDateBucket(endBucket) ||
    startBucket !== endBucket ||
    (startValue !== 0 && endValue !== 0)
  ) {
    return null;
  }

  return {
    column,
    value: startValue < 0 ? startValue : endValue,
    bucket: startBucket,
    offsetValue,
    offsetBucket,
    options,
  };
}

function excludeDatePartToString(
  value: number,
  bucketName: ExcludeDateBucketName,
): string {
  const date = moment();

  switch (bucketName) {
    case "hour-of-day":
      date.hour(value);
      break;
    case "day-of-week":
      date.isoWeekday(value);
      break;
    case "month-of-year":
      date.month(value);
      break;
    case "quarter-of-year":
      date.quarter(value);
      break;
  }

  return date.format(DATE_FORMAT);
}

function stringToExcludeDatePart(
  value: string,
  bucketName: BucketName,
): number | null {
  const date = moment(value, DATE_FORMAT, true);
  if (!date.isValid()) {
    return null;
  }

  switch (bucketName) {
    case "hour-of-day":
      return date.hour();
    case "day-of-week":
      return date.isoWeekday();
    case "month-of-year":
      return date.month();
    case "quarter-of-year":
      return date.quarter();
    default:
      return null;
  }
}
