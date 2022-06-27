import { getParameterType } from "./parameter-type";

export function getValuePopulatedParameters(parameters, parameterValues) {
  return parameterValues
    ? parameters.map(parameter => {
        return parameter.id in parameterValues
          ? {
              ...parameter,
              value: parameterValues[parameter.id],
            }
          : parameter;
      })
    : parameters;
}

export function hasDefaultParameterValue(parameter) {
  return parameter.default != null;
}

export function hasParameterValue(value) {
  return value != null;
}

export function getParameterValueFromQueryParams(
  parameter,
  queryParams,
  metadata,
) {
  queryParams = queryParams || {};

  const maybeParameterValue = queryParams[parameter.slug || parameter.id];

  // skip parsing "" because it indicates a forcefully unset parameter
  if (maybeParameterValue === "") {
    return "";
  } else if (hasParameterValue(maybeParameterValue)) {
    const parsedValue = parseParameterValue(maybeParameterValue, parameter);
    return normalizeParameterValueForWidget(parsedValue, parameter);
  } else {
    return parameter.default;
  }
}

export function parseParameterValue(value, parameter) {
  const { fields } = parameter;
  if (Array.isArray(fields) && fields.length > 0) {
    return parseParameterValueForFields(value, fields);
  }

  const type = getParameterType(parameter);
  if (type === "number") {
    return parseFloat(value);
  }

  return value;
}

function parseParameterValueForFields(value, fields) {
  if (Array.isArray(value)) {
    return value.map(v => parseParameterValueForFields(v, fields));
  }

  // unix dates fields are numeric but query params shouldn't be parsed as numbers
  if (fields.every(f => f.isNumeric() && !f.isDate())) {
    return parseFloat(value);
  }

  if (fields.every(f => f.isBoolean())) {
    return value === "true" ? true : value === "false" ? false : value;
  }

  return value;
}

function normalizeParameterValueForWidget(value, parameter) {
  const fieldType = getParameterType(parameter);
  if (fieldType !== "date" && !Array.isArray(value)) {
    return [value];
  }

  return value;
}

// on dashboards we treat a default parameter with a set value of "" (from a query parameter)
// to mean that the parameter value is explicitly unset.
// this is NOT the case elsewhere (native questions, pulses) because default values are
// automatically used in the query when unset.
function removeAllEmptyStringParameters(pairs) {
  return pairs
    .map(([parameter, value]) => [parameter, value === "" ? undefined : value])
    .filter(([parameter, value]) => hasParameterValue(value));
}

function removeUndefaultedEmptyStringParameters(pairs) {
  return pairs
    .map(([parameter, value]) => [
      parameter,
      value === "" ? parameter.default : value,
    ])
    .filter(([, value]) => hasParameterValue(value));
}

// when `forcefullyUnsetDefaultedParametersWithEmptyStringValue` is true, we treat defaulted parameters with an empty string value as explecitly unset.
// This CAN'T be used with native questions because defaulted parameters are always applied on the BE when unset on the FE.
export function getParameterValuesByIdFromQueryParams(
  parameters,
  queryParams,
  metadata,
  { forcefullyUnsetDefaultedParametersWithEmptyStringValue } = {},
) {
  const parameterValuePairs = parameters.map(parameter => [
    parameter,
    getParameterValueFromQueryParams(parameter, queryParams, metadata),
  ]);

  const transformedPairs = forcefullyUnsetDefaultedParametersWithEmptyStringValue
    ? removeAllEmptyStringParameters(parameterValuePairs)
    : removeUndefaultedEmptyStringParameters(parameterValuePairs);

  const idValuePairs = transformedPairs.map(([parameter, value]) => [
    parameter.id,
    value,
  ]);

  return Object.fromEntries(idValuePairs);
}

function removeNilValuedPairs(pairs) {
  return pairs.filter(([, value]) => hasParameterValue(value));
}

function removeUndefaultedNilValuedPairs(pairs) {
  return pairs.filter(
    ([parameter, value]) =>
      hasDefaultParameterValue(parameter) || hasParameterValue(value),
  );
}

// when `preserveDefaultedParameters` is true, we don't remove defaulted parameters with nil values
// so that they can be set in the URL query without a value. Used alongside `getParameterValuesByIdFromQueryParams`
// with `forcefullyUnsetDefaultedParametersWithEmptyStringValue` set to true.
export function getParameterValuesBySlug(
  parameters,
  parameterValuesById,
  { preserveDefaultedParameters } = {},
) {
  parameters = parameters || [];
  parameterValuesById = parameterValuesById || {};
  const parameterValuePairs = parameters.map(parameter => [
    parameter,
    hasParameterValue(parameter.value)
      ? parameter.value
      : parameterValuesById[parameter.id],
  ]);

  const transformedPairs = preserveDefaultedParameters
    ? removeUndefaultedNilValuedPairs(parameterValuePairs)
    : removeNilValuedPairs(parameterValuePairs);

  const slugValuePairs = transformedPairs.map(([parameter, value]) => [
    parameter.slug,
    value,
  ]);

  return Object.fromEntries(slugValuePairs);
}

export function normalizeParameterValue(type, value) {
  const fieldType = getParameterType(type);

  if (["string", "number"].includes(fieldType)) {
    return value == null ? [] : [].concat(value);
  } else {
    return value;
  }
}
