import { t } from "ttag";
import _ from "underscore";
import * as Yup from "yup";

import type {
  ActionFormSettings,
  FieldSettings,
  WritebackParameter,
  ActionFormProps,
  ActionFormFieldProps,
  ActionFormOption,
  InputSettingType,
  InputComponentType,
} from "metabase-types/api";

import { sortActionParams, isEditableField } from "metabase/actions/utils";
import type { Parameter } from "metabase-types/types/Parameter";

const getOptionsFromArray = (
  options: (number | string)[],
): ActionFormOption[] => options.map(o => ({ name: o, value: o }));

const getSampleOptions = () => [
  { name: t`Option One`, value: 1 },
  { name: t`Option Two`, value: 2 },
  { name: t`Option Three`, value: 3 },
];

const inputTypeHasOptions = (fieldSettings: FieldSettings) =>
  ["select", "radio"].includes(fieldSettings.inputType);

type FieldPropTypeMap = Record<InputSettingType, InputComponentType>;

const fieldPropsTypeMap: FieldPropTypeMap = {
  string: "text",
  text: "textarea",
  date: "date",
  datetime: "datetime-local",
  time: "time",
  number: "number",
  boolean: "boolean",
  category: "category",
  select: "select",
  radio: "radio",
};

export const getFormField = (
  parameter: Parameter,
  fieldSettings: FieldSettings,
) => {
  if (
    fieldSettings.field &&
    !isEditableField(fieldSettings.field, parameter as Parameter)
  ) {
    return undefined;
  }

  const fieldProps: ActionFormFieldProps = {
    name: parameter.id,
    type: fieldPropsTypeMap[fieldSettings?.inputType] ?? "text",
    title:
      fieldSettings.title ||
      fieldSettings.name ||
      parameter["display-name"] ||
      parameter.name ||
      parameter.id,
    description: fieldSettings.description ?? "",
    placeholder: fieldSettings?.placeholder,
    optional: !fieldSettings.required,
    fieldInstance: fieldSettings.fieldInstance,
  };

  if (inputTypeHasOptions(fieldSettings)) {
    fieldProps.options = fieldSettings.valueOptions?.length
      ? getOptionsFromArray(fieldSettings.valueOptions)
      : getSampleOptions();
  }

  return fieldProps;
};

export const getForm = (
  parameters: WritebackParameter[] | Parameter[],
  fieldSettings: Record<string, FieldSettings> = {},
): ActionFormProps => {
  const sortedParams = parameters.sort(
    sortActionParams({ fields: fieldSettings } as ActionFormSettings),
  );
  return {
    fields: sortedParams
      ?.map(param => getFormField(param, fieldSettings[param.id] ?? {}))
      .filter(Boolean) as ActionFormFieldProps[],
  };
};

export const getFormValidationSchema = (
  parameters: WritebackParameter[] | Parameter[],
  fieldSettings: Record<string, FieldSettings> = {},
) => {
  const requiredMessage = t`This field is required`;

  const schema = Object.values(fieldSettings)
    .filter(fieldSetting =>
      // only validate fields that are present in the form
      parameters.find(parameter => parameter.id === fieldSetting.id),
    )
    .map(fieldSetting => {
      let yupType =
        fieldSetting.fieldType === "number" ? Yup.number() : Yup.string();

      if (fieldSetting.required) {
        yupType = yupType.required(requiredMessage);
      }

      return [fieldSetting.id, yupType];
    });

  return Yup.object(Object.fromEntries(schema));
};
