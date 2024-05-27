import * as Lib from "metabase-lib";
import { TemplateTagDimension } from "metabase-lib/v1/Dimension";
import type Question from "metabase-lib/v1/Question";
import type NativeQuery from "metabase-lib/v1/queries/NativeQuery";
import { isTemplateTagReference } from "metabase-lib/v1/references";
import type TemplateTagVariable from "metabase-lib/v1/variables/TemplateTagVariable";
import type {
  ConcreteFieldReference,
  FieldReference,
  NativeParameterDimensionTarget,
  ParameterTarget,
  ParameterTextTarget,
  ParameterVariableTarget,
  StructuredParameterDimensionTarget,
} from "metabase-types/api";
import { isDimensionTarget } from "metabase-types/guards";

export function isParameterVariableTarget(
  target: ParameterTarget,
): target is ParameterVariableTarget {
  return target[0] === "variable";
}

function isConcreteFieldReference(
  reference: FieldReference,
): reference is ConcreteFieldReference {
  return reference[0] === "field" || reference[0] === "expression";
}

export function getTemplateTagFromTarget(target: ParameterTarget) {
  if (!target?.[1] || target?.[0] === "text-tag") {
    return null;
  }

  const [, [type, tag]] = target;
  return type === "template-tag" ? tag : null;
}

export function getParameterTargetField(
  target: ParameterTarget,
  question: Question,
) {
  if (!isDimensionTarget(target)) {
    return null;
  }

  const fieldRef = target[1];
  const metadata = question.metadata();

  // native queries
  if (isTemplateTagReference(fieldRef)) {
    const dimension = TemplateTagDimension.parseMBQL(
      fieldRef,
      metadata,
      question.legacyQuery() as NativeQuery,
    );
    return dimension?.field();
  }

  if (isConcreteFieldReference(fieldRef)) {
    const query = question.query();
    const stageIndex = -1;
    const columns = Lib.visibleColumns(query, stageIndex);
    const fields = metadata.fieldsList();
    if (columns.length > 0) {
      const [columnIndex] = Lib.findColumnIndexesFromLegacyRefs(
        query,
        stageIndex,
        columns,
        [fieldRef],
      );
      if (columnIndex >= 0) {
        const column = columns[columnIndex];
        const fieldIndexes = Lib.findColumnIndexesFromLegacyRefs(
          query,
          stageIndex,
          [column],
          fields.map(field => field.reference()),
        );
        const fieldIndex = fieldIndexes.findIndex(index => index >= 0);
        return fields[fieldIndex];
      }
    } else {
      // empty columns mean we don't have table metadata (embedding)
      // we cannot match columns with MBQL lib in this case, so we rely on the BE returning metadata for only used fields
      const tableId = Lib.sourceTableOrCardId(query);
      const fieldId = fieldRef[1];
      return metadata.field(fieldId, tableId) ?? metadata.field(fieldId);
    }
  }

  return null;
}

export function buildDimensionTarget(
  dimension: TemplateTagDimension,
): NativeParameterDimensionTarget {
  return ["dimension", dimension.mbql()];
}

export function buildColumnTarget(
  query: Lib.Query,
  stageIndex: number,
  column: Lib.ColumnMetadata,
): StructuredParameterDimensionTarget {
  const fieldRef = Lib.legacyRef(query, stageIndex, column);

  if (!isConcreteFieldReference(fieldRef)) {
    throw new Error(`Cannot build column target field reference: ${fieldRef}`);
  }

  return ["dimension", fieldRef];
}

export function buildTemplateTagVariableTarget(
  variable: TemplateTagVariable,
): ParameterVariableTarget {
  return ["variable", variable.mbql()];
}

export function buildTextTagTarget(tagName: string): ParameterTextTarget {
  return ["text-tag", tagName];
}

export function compareMappingOptionTargets(
  target1: ParameterTarget,
  target2: ParameterTarget,
  question1: Question,
  question2: Question,
) {
  if (!isDimensionTarget(target1) || !isDimensionTarget(target2)) {
    return false;
  }

  const fieldReference1 = getParameterTargetField(target1, question1);
  const fieldReference2 = getParameterTargetField(target2, question2);

  return fieldReference1?.id === fieldReference2?.id;
}
