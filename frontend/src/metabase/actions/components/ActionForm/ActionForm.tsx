import React, { useCallback, useMemo } from "react";
import { t } from "ttag";
import _ from "underscore";

import type { FormikHelpers } from "formik";

import Button from "metabase/core/components/Button";
import Form from "metabase/core/components/Form";
import FormProvider from "metabase/core/components/FormProvider";
import FormSubmitButton from "metabase/core/components/FormSubmitButton";
import FormErrorMessage from "metabase/core/components/FormErrorMessage";

import {
  getForm,
  getFormValidationSchema,
  getSubmitButtonColor,
  getSubmitButtonLabel,
  generateFieldSettingsFromParameters,
} from "metabase/actions/utils";

import type {
  ActionFormInitialValues,
  WritebackParameter,
  Parameter,
  ParametersForActionExecution,
  WritebackAction,
} from "metabase-types/api";

import ActionFormFieldWidget from "../ActionFormFieldWidget";

import { formatInitialValue, getChangedValues } from "./utils";
import { ActionFormButtonContainer } from "./ActionForm.styled";

interface ActionFormProps {
  action: WritebackAction;
  initialValues?: ActionFormInitialValues;
  parameters?: WritebackParameter[] | Parameter[];
  onSubmit: (
    params: ParametersForActionExecution,
    actions: FormikHelpers<ParametersForActionExecution>,
  ) => void;
  onClose?: () => void;
}

function ActionForm({
  action,
  initialValues = {},
  parameters = action.parameters,
  onSubmit,
  onClose,
}: ActionFormProps): JSX.Element {
  const fieldSettings = useMemo(
    () =>
      action.visualization_settings?.fields ||
      generateFieldSettingsFromParameters(action.parameters),
    [action],
  );

  const form = useMemo(
    () => getForm(parameters, fieldSettings),
    [parameters, fieldSettings],
  );

  const formValidationSchema = useMemo(
    () => getFormValidationSchema(parameters, fieldSettings),
    [parameters, fieldSettings],
  );

  const formInitialValues = useMemo(() => {
    const values = formValidationSchema.cast(initialValues);
    return _.mapObject(values, (value, fieldId) => {
      const formField = fieldSettings[fieldId];
      return formatInitialValue(value, formField?.inputType);
    });
  }, [initialValues, fieldSettings, formValidationSchema]);

  const submitButtonProps = useMemo(() => {
    const variant = getSubmitButtonColor(action);
    return {
      title: getSubmitButtonLabel(action),
      [variant]: true,
    };
  }, [action]);

  const handleSubmit = useCallback(
    (
      values: ParametersForActionExecution,
      actions: FormikHelpers<ParametersForActionExecution>,
    ) => {
      const validatedValues = formValidationSchema.cast(values);
      const changed = getChangedValues(validatedValues, formInitialValues);
      onSubmit(changed, actions);
    },
    [formInitialValues, formValidationSchema, onSubmit],
  );

  return (
    <FormProvider
      initialValues={formInitialValues}
      validationSchema={formValidationSchema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      <Form role="form" data-testid="action-form">
        {form.fields.map(field => (
          <ActionFormFieldWidget key={field.name} formField={field} />
        ))}

        <ActionFormButtonContainer>
          {onClose && (
            <Button type="button" onClick={onClose}>{t`Cancel`}</Button>
          )}
          <FormSubmitButton {...submitButtonProps} />
        </ActionFormButtonContainer>

        <FormErrorMessage />
      </Form>
    </FormProvider>
  );
}

export default ActionForm;
