import { assoc, assocIn, chain } from "icepick";

import { titleize, humanize } from "metabase/lib/formatting";
import { startNewCard } from "metabase/lib/card";
import * as Urls from "metabase/lib/urls";
import * as Lib from "metabase-lib";
import { isTypePK } from "metabase-lib/types/utils/isa";
import Question from "metabase-lib/Question";

export const idsToObjectMap = (ids, objects) =>
  ids
    .map(id => objects[id])
    .reduce((map, object) => ({ ...map, [object.id]: object }), {});
// recursive freezing done by assoc here is too expensive
// hangs browser for large databases
// .reduce((map, object) => assoc(map, object.id, object), {});

export const filterUntouchedFields = (fields, entity = {}) =>
  Object.keys(fields)
    .filter(key => fields[key] !== undefined && entity[key] !== fields[key])
    .reduce((map, key) => ({ ...map, [key]: fields[key] }), {});

export const isEmptyObject = object => Object.keys(object).length === 0;

export const databaseToForeignKeys = database =>
  database && database.tables_lookup
    ? Object.values(database.tables_lookup)
        // ignore tables without primary key
        .filter(
          table =>
            table && table.fields.find(field => isTypePK(field.semantic_type)),
        )
        .map(table => ({
          table: table,
          field:
            table && table.fields.find(field => isTypePK(field.semantic_type)),
        }))
        .map(({ table, field }) => ({
          id: field.id,
          name:
            table.schema_name && table.schema_name !== "public"
              ? `${titleize(humanize(table.schema_name))}.${
                  table.display_name
                } → ${field.display_name}`
              : `${table.display_name} → ${field.display_name}`,
          description: field.description,
        }))
        .reduce((map, foreignKey) => assoc(map, foreignKey.id, foreignKey), {})
    : {};

export const getQuestionOld = ({
  dbId,
  tableId,
  fieldId,
  metricId,
  segmentId,
  getCount,
  visualization,
  metadata,
}) => {
  const newQuestion = startNewCard(dbId, tableId);

  // consider taking a look at Ramda as a possible underscore alternative?
  // http://ramdajs.com/0.21.0/index.html
  const question = chain(newQuestion)
    .updateIn(["dataset_query", "query", "aggregation"], aggregation =>
      getCount ? [["count"]] : aggregation,
    )
    .updateIn(["display"], display => visualization || display)
    .updateIn(["dataset_query", "query", "breakout"], oldBreakout => {
      if (fieldId && metadata && metadata.field(fieldId)) {
        return [metadata.field(fieldId).getDefaultBreakout()];
      }
      if (fieldId) {
        return [["field", fieldId, null]];
      }
      return oldBreakout;
    })
    .value();

  if (metricId) {
    return assocIn(
      question,
      ["dataset_query", "query", "aggregation"],
      [["metric", metricId]],
    );
  }

  if (segmentId) {
    return assocIn(
      question,
      ["dataset_query", "query", "filter"],
      ["segment", segmentId],
    );
  }

  return question;
};

export const getQuestion = ({
  dbId: databaseId,
  tableId,
  fieldId,
  metricId,
  segmentId,
  getCount,
  visualization,
  metadata,
}) => {
  const metadataProvider = Lib.metadataProvider(databaseId, metadata);
  const table = Lib.tableOrCardMetadata(metadataProvider, tableId);
  let query = Lib.queryFromTableOrCardMetadata(metadataProvider, table);

  if (getCount) {
    query = aggregateByCount(query);
  }

  if (fieldId) {
    query = breakoutWithDefaultTemporalBucket(query, metadata, fieldId);
  }

  if (metricId) {
    query = aggregateByMetricId(query, metricId);
  }

  if (segmentId) {
    query = filterBySegmentId(query, segmentId);
  }

  return Question.create({ databaseId, metadata })
    .setQuery(query)
    .setDisplay(visualization)
    .card();
};

function aggregateByCount(query) {
  const stageIndex = -1;
  const operators = Lib.availableAggregationOperators(query, stageIndex);
  const countOperator = operators.find(operator => {
    const info = Lib.displayInfo(query, stageIndex, operator);
    return info.shortName === "count";
  });
  const aggregationclause = Lib.aggregationClause(countOperator);
  return Lib.aggregate(query, stageIndex, aggregationclause);
}

function breakoutWithDefaultTemporalBucket(query, metadata, fieldId) {
  const stageIndex = -1;
  const field = metadata.field(fieldId);
  const column = Lib.fromLegacyColumn(query, stageIndex, field);

  if (!column) {
    return query;
  }

  return Lib.withDefaultTemporalBucket(query, stageIndex, column);
}

function filterBySegmentId(query, segmentId) {
  const stageIndex = -1;
  const segmentMetadata = Lib.segmentMetadata(query, segmentId);

  if (!segmentMetadata) {
    return query;
  }

  return Lib.filter(query, stageIndex, segmentMetadata);
}

function aggregateByMetricId(query, metricId) {
  const stageIndex = -1;
  const metricMetadata = Lib.metricMetadata(query, metricId);

  if (!metricMetadata) {
    return query;
  }

  return Lib.aggregate(query, stageIndex, metricMetadata);
}

export const getQuestionUrl = getQuestionArgs =>
  Urls.question(null, { hash: getQuestion(getQuestionArgs) });

// little utility function to determine if we 'has' things, useful
// for handling entity empty states
export const has = entity => entity && entity.length > 0;
