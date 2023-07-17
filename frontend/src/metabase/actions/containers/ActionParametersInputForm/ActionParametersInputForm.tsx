import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "ttag";
import _ from "underscore";

import EmptyState from "metabase/components/EmptyState";

import { ActionsApi, PublicApi } from "metabase/services";

import ActionForm from "metabase/actions/components/ActionForm";
import { getDashboardType } from "metabase/dashboard/utils";

import type {
  ActionDashboardCard,
  Dashboard,
  OnSubmitActionForm,
  ParametersForActionExecution,
  WritebackAction,
  WritebackParameter,
} from "metabase-types/api";

export interface ActionParametersInputFormProps {
  action: WritebackAction;
  dashboard?: Dashboard;
  dashcard?: ActionDashboardCard;
  mappedParameters?: WritebackParameter[];
  initialValues?: ParametersForActionExecution;
  onSubmit: OnSubmitActionForm;
  onSubmitSuccess?: () => void;
  onCancel?: () => void;
}

const shouldPrefetchValues = (action: WritebackAction) =>
  action.type === "implicit" && action.kind === "row/update";

function ActionParametersInputForm({
  action,
  mappedParameters = [],
  initialValues = {},
  dashboard,
  dashcard,
  onCancel,
  onSubmit,
  onSubmitSuccess,
}: ActionParametersInputFormProps) {
  const [prefetchedValues, setPrefetchedValues] =
    useState<ParametersForActionExecution>({});

  const hasPrefetchedValues = Object.keys(prefetchedValues).length > 0;
  const shouldPrefetch = useMemo(
    () => shouldPrefetchValues(action) && dashboard && dashcard,
    [action, dashboard, dashcard],
  );

  const values = useMemo(
    () => ({ ...prefetchedValues, ...initialValues }),
    [prefetchedValues, initialValues],
  );

  const hiddenFields = useMemo(() => {
    const hiddenFieldIds = Object.values(
      action.visualization_settings?.fields ?? {},
    )
      .filter(field => field.hidden)
      .map(field => field.id);

    return mappedParameters
      .map(parameter => parameter.id)
      .concat(hiddenFieldIds);
  }, [mappedParameters, action.visualization_settings?.fields]);

  const fetchInitialValues = useCallback(async () => {
    const prefetchEndpoint =
      getDashboardType(dashboard?.id) === "public"
        ? PublicApi.prefetchValues
        : ActionsApi.prefetchValues;

    const fetchedValues = await prefetchEndpoint({
      dashboardId: dashboard?.id,
      dashcardId: dashcard?.id,
      parameters: JSON.stringify(initialValues),
    }).catch(_.noop);

    if (fetchedValues) {
      setPrefetchedValues(fetchedValues);
    }
  }, [dashboard?.id, dashcard?.id, initialValues]);

  useEffect(() => {
    const hasValueFromDashboard = Object.keys(initialValues).length > 0;
    const canPrefetch = hasValueFromDashboard && dashboard && dashcard;

    if (shouldPrefetch && !hasPrefetchedValues) {
      setPrefetchedValues({});
      canPrefetch && fetchInitialValues();
    }
  }, [
    shouldPrefetch,
    hasPrefetchedValues,
    dashboard,
    dashcard,
    initialValues,
    fetchInitialValues,
  ]);

  const handleSubmit = useCallback(
    async (parameters, actions) => {
      actions.setSubmitting(true);
      const { success, error } = await onSubmit(parameters);
      if (success) {
        actions.setErrors({});
        onSubmitSuccess?.();
        shouldPrefetch ? fetchInitialValues() : actions.resetForm();
      } else {
        throw new Error(error);
      }
    },
    [shouldPrefetch, onSubmit, onSubmitSuccess, fetchInitialValues],
  );

  if (shouldPrefetch && !hasPrefetchedValues) {
    return <EmptyState message={t`Choose a record to update`} />;
  }

  return (
    <ActionForm
      action={action}
      initialValues={values}
      hiddenFields={hiddenFields}
      onSubmit={handleSubmit}
      onClose={onCancel}
    />
  );
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default ActionParametersInputForm;
