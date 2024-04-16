import { useMemo } from "react";
import { withRouter, type WithRouterProps } from "react-router";
import { t } from "ttag";
import * as Yup from "yup";

import FormCollectionPicker from "metabase/collections/containers/FormCollectionPicker/FormCollectionPicker";
import FormFooter from "metabase/core/components/FormFooter";
import getInitialCollectionId from "metabase/entities/collections/getInitialCollectionId";
import {
  Form,
  FormTextInput,
  FormTextarea,
  FormProvider,
  FormSubmitButton,
  FormErrorMessage,
} from "metabase/forms";
import * as Errors from "metabase/lib/errors";
import { useSelector } from "metabase/lib/redux";
import { Button } from "metabase/ui";
import type { CollectionId } from "metabase-types/api";

const QUESTION_SCHEMA = Yup.object({
  name: Yup.string()
    .required(Errors.required)
    .max(100, Errors.maxLength)
    .default(""),
  description: Yup.string().nullable().max(255, Errors.maxLength).default(null),
  collection_id: Yup.number().nullable(),
});

type CopyQuestionProperties = {
  name: string;
  description: string | null;
  collection_id: CollectionId | null;
};

interface CopyQuestionFormProps {
  initialValues: Partial<CopyQuestionProperties>;
  onCancel: () => void;
  onSubmit: (vals: CopyQuestionProperties) => void;
  onSaved: () => void;
}

export const CopyQuestionForm = withRouter(
  ({
    initialValues,
    params,
    onCancel,
    onSubmit,
    onSaved,
  }: CopyQuestionFormProps & WithRouterProps) => {
    const initialCollectionId = useSelector(state =>
      getInitialCollectionId(state, { params }),
    );

    const computedInitialValues = useMemo<CopyQuestionProperties>(
      () => ({
        ...QUESTION_SCHEMA.getDefault(),
        collection_id: initialCollectionId,
        ...initialValues,
      }),
      [initialCollectionId, initialValues],
    );

    const handleDuplicate = async (vals: CopyQuestionProperties) => {
      await onSubmit(vals);
      onSaved?.();
    };

    return (
      <FormProvider
        initialValues={computedInitialValues}
        validationSchema={QUESTION_SCHEMA}
        onSubmit={handleDuplicate}
      >
        {() => (
          <Form>
            <FormTextInput
              name="name"
              label={t`Name`}
              placeholder={t`What is the name of your dashboard?`}
              autoFocus
              mb="0.5rem"
            />
            <FormTextarea
              name="description"
              label={t`Description`}
              placeholder={t`It's optional but oh, so helpful`}
              nullable
              mb="0.5rem"
            />
            <FormCollectionPicker
              name="collection_id"
              title={t`Which collection should this go in?`}
            />
            <FormFooter>
              <FormErrorMessage inline />
              {!!onCancel && (
                <Button type="button" onClick={onCancel}>{t`Cancel`}</Button>
              )}
              <FormSubmitButton title={t`Copy`} />
            </FormFooter>
          </Form>
        )}
      </FormProvider>
    );
  },
);
