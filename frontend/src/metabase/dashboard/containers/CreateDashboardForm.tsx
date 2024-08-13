import { useCallback, useMemo } from "react";
import { connect } from "react-redux";
import { t } from "ttag";
import _ from "underscore";
import * as Yup from "yup";

import FormCollectionPicker from "metabase/collections/containers/FormCollectionPicker/FormCollectionPicker";
import type { FilterItemsInPersonalCollection } from "metabase/common/components/EntityPicker";
import Button from "metabase/core/components/Button";
import FormErrorMessage from "metabase/core/components/FormErrorMessage";
import FormFooter from "metabase/core/components/FormFooter";
import FormInput from "metabase/core/components/FormInput";
import FormSubmitButton from "metabase/core/components/FormSubmitButton";
import FormTextArea from "metabase/core/components/FormTextArea";
import Collections from "metabase/entities/collections";
import Dashboards from "metabase/entities/dashboards";
import { Form, FormProvider } from "metabase/forms";
import * as Errors from "metabase/lib/errors";
import type { CollectionId, Dashboard } from "metabase-types/api";
import type { State } from "metabase-types/store";

import { DASHBOARD_DESCRIPTION_MAX_LENGTH } from "../constants";

const DASHBOARD_SCHEMA = Yup.object({
  name: Yup.string()
    .required(Errors.required)
    .max(100, Errors.maxLength)
    .default(""),
  description: Yup.string()
    .nullable()
    .max(DASHBOARD_DESCRIPTION_MAX_LENGTH, Errors.maxLength)
    .default(null),
  collection_id: Yup.number().nullable(),
});

export interface CreateDashboardProperties {
  name: string;
  description: string | null;
  collection_id: CollectionId;
}

export interface CreateDashboardFormOwnProps {
  collectionId?: CollectionId | null; // can be used by `getInitialCollectionId`
  onCreate?: (dashboard: Dashboard) => void;
  onCancel?: () => void;
  initialValues?: CreateDashboardProperties | null;
  filterPersonalCollections?: FilterItemsInPersonalCollection;
}

interface CreateDashboardFormStateProps {
  initialCollectionId: CollectionId;
}

interface CreateDashboardFormDispatchProps {
  handleCreateDashboard: (
    dashboard: CreateDashboardProperties,
  ) => Promise<Dashboard>;
}

type Props = CreateDashboardFormOwnProps &
  CreateDashboardFormStateProps &
  CreateDashboardFormDispatchProps;

function mapStateToProps(state: State, props: CreateDashboardFormOwnProps) {
  return {
    initialCollectionId: Collections.selectors.getInitialCollectionId(
      state,
      props,
    ),
  };
}

const mapDispatchToProps = {
  handleCreateDashboard: Dashboards.actions.create,
};

function CreateDashboardForm({
  initialCollectionId,
  handleCreateDashboard,
  onCreate,
  onCancel,
  initialValues,
  filterPersonalCollections,
}: Props) {
  const computedInitialValues = useMemo(
    () => ({
      ...DASHBOARD_SCHEMA.getDefault(),
      collection_id: initialCollectionId,
      ...initialValues,
    }),
    [initialCollectionId, initialValues],
  );

  const handleCreate = useCallback(
    async (values: CreateDashboardProperties) => {
      const action = await handleCreateDashboard(values);
      const dashboard = Dashboards.HACK_getObjectFromAction(action);
      onCreate?.(dashboard);
    },
    [handleCreateDashboard, onCreate],
  );

  return (
    <FormProvider
      initialValues={computedInitialValues}
      validationSchema={DASHBOARD_SCHEMA}
      onSubmit={handleCreate}
    >
      {() => (
        <Form>
          <FormInput
            name="name"
            title={t`Name`}
            placeholder={t`What is the name of your dashboard?`}
            autoFocus
          />
          <FormTextArea
            name="description"
            title={t`Description`}
            placeholder={t`It's optional but oh, so helpful`}
            nullable
          />
          <FormCollectionPicker
            name="collection_id"
            title={t`Which collection should this go in?`}
            filterPersonalCollections={filterPersonalCollections}
          />
          <FormFooter>
            <FormErrorMessage inline />
            {!!onCancel && (
              <Button type="button" onClick={onCancel}>{t`Cancel`}</Button>
            )}
            <FormSubmitButton title={t`Create`} primary />
          </FormFooter>
        </Form>
      )}
    </FormProvider>
  );
}

export const CreateDashboardFormConnected = _.compose(
  connect(mapStateToProps, mapDispatchToProps),
)(CreateDashboardForm);
