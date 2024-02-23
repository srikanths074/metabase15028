import { t } from "ttag";

import FormFooter from "metabase/core/components/FormFooter";
import Collections from "metabase/entities/collections";
import {
  Form,
  FormProvider,
  FormTextInput,
  FormErrorMessage,
  FormSubmitButton,
} from "metabase/forms";
import { useDispatch } from "metabase/lib/redux";
import { Modal, Button } from "metabase/ui";
import type { CollectionId } from "metabase-types/api";

interface NewCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parentCollectionId: CollectionId;
}

export const NewCollectionDialog = ({
  isOpen,
  onClose,
  parentCollectionId,
}: NewCollectionDialogProps) => {
  const dispatch = useDispatch();

  const onCreateNewCollection = async ({ name }: { name: string }) => {
    await dispatch(
      Collections.actions.create({
        name,
        parent_id: parentCollectionId === "root" ? null : parentCollectionId,
      }),
    );
    onClose();
  };

  return (
    <Modal
      title="Create a new collection"
      opened={isOpen}
      onClose={onClose}
      data-testid="create-collection-on-the-go"
      trapFocus={true}
      withCloseButton={false}
      styles={{
        content: {
          padding: "1rem",
        },
      }}
    >
      <FormProvider
        initialValues={{ name: "" }}
        onSubmit={onCreateNewCollection}
      >
        {({ dirty }: { dirty: boolean }) => (
          <Form>
            <FormTextInput
              name="name"
              label={t`Give it a name`}
              placeholder={t`My new collection`}
              mb="1rem"
              labelProps={{ my: "0.5rem" }}
              data-autofocus
            />
            <FormFooter>
              <FormErrorMessage inline />
              <Button type="button" onClick={onClose}>{t`Cancel`}</Button>
              <FormSubmitButton
                label={t`Create`}
                disabled={!dirty}
                variant="filled"
              />
            </FormFooter>
          </Form>
        )}
      </FormProvider>
    </Modal>
  );
};
