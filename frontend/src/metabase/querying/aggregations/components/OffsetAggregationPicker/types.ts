import type { TemporalUnit } from "metabase-types/api";

export type ComparisonType = "offset" | "moving-average";

export type ColumnType =
  | "offset"
  | "diff-offset"
  | "percent-diff-offset"
  | "moving-average"
  | "diff-moving-average"
  | "percent-diff-moving-average";

export type OffsetOptions = {
  comparisonType: ComparisonType;
  columnType: ColumnType;
  groupUnit: TemporalUnit;
  offsetValue: number;
  offsetUnit: TemporalUnit;
  includeCurrent: boolean;
};

export type BreakoutInfo = {
  breakoutIndex: number;
  breakoutUnit: TemporalUnit;
};