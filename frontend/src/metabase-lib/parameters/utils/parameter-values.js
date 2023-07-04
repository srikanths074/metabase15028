import _ from "underscore";
import { getParameterType } from "./parameter-type";
import {
  getQueryType,
  getSourceConfig,
  getSourceType,
} from "./parameter-source";

export function getValuePopulatedParameters(parameters, parameterValues) {
  return parameterValues
    ? parameters.map(parameter => ({
        ...parameter,
        value:
          parameter.id in parameterValues
            ? parameterValues[parameter.id]
            : null,
      }))
    : parameters;
}

export function hasDefaultParameterValue(parameter) {
  return parameter.default != null;
}

export function hasParameterValue(value) {
  return value != null;
}

export function normalizeParameter(parameter) {
  return {
    id: parameter.id,
    name: parameter.name,
    slug: parameter.slug,
    type: parameter.type,
    target: parameter.target,
    options: parameter.options,
    values_query_type: getQueryType(parameter),
    values_source_type: getSourceType(parameter),
    values_source_config: getSourceConfig(parameter),
  };
}

export function normalizeParameters(parameters) {
  return parameters
    .filter(parameter => _.has(parameter, "value"))
    .map(({ id, type, value, target, options }) => ({
      id,
      type,
      value: normalizeParameterValue(type, value),
      target,
      options,
    }));
}

export function normalizeParameterValue(type, value) {
  const fieldType = getParameterType(type);

  if (["string", "number"].includes(fieldType)) {
    return value == null ? null : [].concat(value);
  } else {
    return value;
  }
}

export function getParameterValuesBySlug(parameters, parameterValuesById) {
  parameters = parameters || [];
  parameterValuesById = parameterValuesById || {};
  const parameterValuePairs = parameters.map(parameter => [
    parameter,
    hasParameterValue(parameter.value)
      ? parameter.value
      : parameterValuesById[parameter.id],
  ]);

  const slugValuePairs = parameterValuePairs.map(([parameter, value]) => [
    parameter.slug,
    value,
  ]);

  return Object.fromEntries(slugValuePairs);
}
