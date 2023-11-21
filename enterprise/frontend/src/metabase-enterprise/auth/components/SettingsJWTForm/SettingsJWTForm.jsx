import { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { t } from "ttag";
import _ from "underscore";
import { updateSettings } from "metabase/admin/settings/settings";
import {
  FormErrorMessage,
  FormProvider,
  FormSecretKey,
  FormSubmitButton,
  FormTextInput,
} from "metabase/forms";
import Breadcrumbs from "metabase/components/Breadcrumbs";
import { Stack } from "metabase/ui";
import { settingToFormField } from "metabase/admin/settings/utils";
import { FormSection } from "metabase/containers/FormikForm";
import GroupMappingsWidget from "metabase/admin/settings/containers/GroupMappingsWidget";
import { JWTForm, JWTFormFooter } from "./SettingsJWTForm.styled";

const propTypes = {
  elements: PropTypes.array,
  settingValues: PropTypes.object.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

const SettingsJWTForm = ({
  elements = [],
  settingValues,
  onSubmit,
  ...props
}) => {
  const isEnabled = settingValues["jwt-enabled"];

  const settings = useMemo(() => {
    return _.indexBy(elements, "key");
  }, [elements]);

  const fields = useMemo(() => {
    return _.mapObject(settings, settingToFormField);
  }, [settings]);

  const attributeValues = useMemo(() => {
    return getAttributeValues(settingValues);
  }, [settingValues]);

  const handleSubmit = useCallback(
    values => {
      return onSubmit({ ...values, "jwt-enabled": true });
    },
    [onSubmit],
  );

  return (
    <FormProvider
      initialValues={attributeValues}
      onSubmit={handleSubmit}
      enableReinitialize
      // disablePristineSubmit
    >
      <JWTForm>
        <Breadcrumbs
          className="mb3"
          crumbs={[
            [t`Authentication`, "/admin/settings/authentication"],
            [t`JWT`],
          ]}
        />
        <FormSection title={"Server Settings"}>
          <Stack gap="md">
            <FormTextInput {...fields["jwt-identity-provider-uri"]} />
            <FormSecretKey
              {...fields["jwt-shared-secret"]}
              confirmation={{
                header: t`Regenerate JWT signing key?`,
                dialog: t`This will cause existing tokens to stop working until the identity provider is updated with the new key.`,
              }}
            />
          </Stack>
        </FormSection>
        <FormSection
          title={"User attribute configuration (optional)"}
          collapsible
        >
          <Stack gap="md">
            <FormTextInput {...fields["jwt-attribute-email"]} />
            <FormTextInput {...fields["jwt-attribute-firstname"]} />
            <FormTextInput {...fields["jwt-attribute-lastname"]} />
          </Stack>
        </FormSection>
        <FormSection title={"Group Schema"}>
          <GroupMappingsWidget
            isFormik
            setting={{ key: "jwt-group-sync" }}
            onChange={handleSubmit}
            settingValues={settingValues}
            mappingSetting="jwt-group-mappings"
            groupHeading={t`Group Name`}
            groupPlaceholder={t`Group Name`}
          />
        </FormSection>

        <JWTFormFooter>
          <FormErrorMessage />
          <FormSubmitButton
            label={isEnabled ? t`Save changes` : t`Save and enable`}
            variant="filled"
          />
        </JWTFormFooter>
      </JWTForm>
    </FormProvider>
  );
};

const JWT_ATTRS = [
  "jwt-identity-provider-uri",
  "jwt-shared-secret",
  "jwt-attribute-email",
  "jwt-attribute-firstname",
  "jwt-attribute-lastname",
  "jwt-group-sync",
  "jwt-group-mappings",
];

const getAttributeValues = values => {
  return Object.fromEntries(JWT_ATTRS.map(key => [key, values[key]]));
};

SettingsJWTForm.propTypes = propTypes;

const mapDispatchToProps = {
  onSubmit: updateSettings,
};

export default connect(null, mapDispatchToProps)(SettingsJWTForm);
