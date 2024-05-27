import { t } from "ttag";

import * as ML from "cljs/metabase.lib.js";
import { inflect } from "metabase/lib/formatting";

import { breakouts } from "./breakout";
import { displayInfo } from "./metadata";
import { temporalBucket } from "./temporal_bucket";
import type {
  AggregationClause,
  ColumnMetadata,
  ExpressionArg,
  ExpressionClause,
  ExpressionOperatorName,
  ExpressionOptions,
  ExpressionParts,
  FilterClause,
  JoinCondition,
  Query,
} from "./types";

type ErrorWithMessage = {
  message: string;
  friendly?: boolean;
};

export function expression(
  query: Query,
  stageIndex: number,
  expressionName: string,
  clause: ExpressionClause,
): Query {
  return ML.expression(query, stageIndex, expressionName, clause);
}

export function withExpressionName<
  Clause extends AggregationClause | ExpressionClause,
>(clause: Clause, newName: string): Clause {
  return ML.with_expression_name(clause, newName);
}

export function expressions(
  query: Query,
  stageIndex: number,
): ExpressionClause[] {
  return ML.expressions(query, stageIndex);
}

export function expressionableColumns(
  query: Query,
  stageIndex?: number,
  expressionPosition?: number,
): ColumnMetadata[] {
  return ML.expressionable_columns(query, stageIndex, expressionPosition);
}

export function expressionParts(
  query: Query,
  stageIndex: number,
  clause: AggregationClause | ExpressionClause | FilterClause | JoinCondition,
): ExpressionParts {
  return ML.expression_parts(query, stageIndex, clause);
}

export function expressionClause(
  operator: ExpressionOperatorName,
  args: (ExpressionArg | AggregationClause | ExpressionClause | FilterClause)[],
  options: ExpressionOptions | null = null,
): ExpressionClause {
  return ML.expression_clause(operator, args, options);
}

export function expressionClauseForLegacyExpression(
  query: Query,
  stageIndex: number,
  mbql: any,
): ExpressionClause {
  return ML.expression_clause_for_legacy_expression(query, stageIndex, mbql);
}

export function legacyExpressionForExpressionClause(
  query: Query,
  stageIndex: number,
  expressionClause: ExpressionClause | AggregationClause | FilterClause,
): any {
  return ML.legacy_expression_for_expression_clause(
    query,
    stageIndex,
    expressionClause,
  );
}

export type ExpressionMode = "expression" | "aggregation" | "filter";
export function diagnoseExpression(
  query: Query,
  stageIndex: number,
  expressionMode: ExpressionMode,
  mbql: any,
  expressionPosition?: number,
): ErrorWithMessage | null {
  return ML.diagnose_expression(
    query,
    stageIndex,
    expressionMode,
    mbql,
    expressionPosition,
  );
}

export function offsetClause(
  query: Query,
  stageIndex: number,
  clause: AggregationClause | ExpressionClause,
  offset: number,
): ExpressionClause {
  const newName = getOffsetClauseName(query, stageIndex, clause, offset, "");
  const newClause = expressionClause("offset", [clause, offset]);
  return withExpressionName(newClause, newName);
}

export function diffOffsetClause(
  query: Query,
  stageIndex: number,
  clause: AggregationClause | ExpressionClause,
  offset: number,
): ExpressionClause {
  const newName = getOffsetClauseName(query, stageIndex, clause, offset, "vs ");
  const newClause = expressionClause("-", [
    clause,
    expressionClause("offset", [clause, offset]),
  ]);
  return withExpressionName(newClause, newName);
}

export function percentDiffOffsetClause(
  query: Query,
  stageIndex: number,
  clause: AggregationClause | ExpressionClause,
  offset: number,
): ExpressionClause {
  const prefix = "% vs ";
  const newName = getOffsetClauseName(
    query,
    stageIndex,
    clause,
    offset,
    prefix,
  );
  const newClause = expressionClause("-", [
    expressionClause("/", [
      clause,
      expressionClause("offset", [clause, offset]),
    ]),
    1,
  ]);
  return withExpressionName(newClause, newName);
}

function getOffsetClauseName(
  query: Query,
  stageIndex: number,
  clause: AggregationClause | ExpressionClause,
  offset: number,
  prefix: string,
): string {
  if (offset >= 0) {
    throw new Error(
      "non-negative offset values aren't supported in 'getOffsettedName'",
    );
  }

  const absoluteOffset = Math.abs(offset);
  const { displayName } = displayInfo(query, stageIndex, clause);
  const firstBreakout = breakouts(query, stageIndex)[0];

  if (!firstBreakout) {
    return absoluteOffset === 1
      ? t`${displayName} (${prefix}previous period)`
      : t`${displayName} (${prefix}${absoluteOffset} periods ago)`;
  }

  const firstBreakoutInfo = displayInfo(query, stageIndex, firstBreakout);
  const isFirstBreakoutDateTime =
    firstBreakoutInfo.effectiveType === "type/DateTime";

  if (!isFirstBreakoutDateTime) {
    return absoluteOffset === 1
      ? t`${displayName} (${prefix}previous value)`
      : t`${displayName} (${prefix}${absoluteOffset} rows above)`;
  }

  const bucket = temporalBucket(firstBreakout);

  if (!bucket) {
    return absoluteOffset === 1
      ? t`${displayName} (${prefix}previous period)`
      : t`${displayName} (${prefix}${absoluteOffset} periods ago)`;
  }

  const bucketInfo = displayInfo(query, stageIndex, bucket);
  const period = inflect(bucketInfo.shortName, absoluteOffset);

  return absoluteOffset === 1
    ? t`${displayName} (${prefix}previous ${period})`
    : t`${displayName} (${prefix}${absoluteOffset} ${period} ago)`;
}
