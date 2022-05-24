import _ from "underscore";
// todo, rename
import { TYPE_USABLE_AS_LINKED_FILTER } from "metabase/parameters/constants";

import { FieldFilterUiParameter } from "metabase/parameters/types";
import { Parameter } from "metabase-types/types/Parameter";

export function getParameterType(parameter: Parameter | string) {
  return typeof parameter === "string"
    ? splitType(parameter)[0]
    : parameter.sectionId || splitType(parameter)[0];
}

export function getParameterSubType(parameter: Parameter) {
  const [, subtype] = splitType(parameter);
  return subtype;
}

function splitType(parameterOrType: Parameter | string) {
  const parameterType = _.isString(parameterOrType)
    ? parameterOrType
    : parameterOrType?.type || "";

  return parameterType.split("/");
}

export function isDateParameter(parameter: Parameter | string) {
  const type = getParameterType(parameter);
  return type === "date";
}

export function isFieldFilterParameter(
  parameter: Parameter,
): parameter is FieldFilterUiParameter {
  const type = getParameterType(parameter);
  return TYPE_USABLE_AS_LINKED_FILTER.includes(type);
}
