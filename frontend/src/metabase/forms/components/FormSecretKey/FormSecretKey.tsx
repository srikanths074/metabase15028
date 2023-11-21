import { forwardRef, useCallback } from "react";
import type { ChangeEvent, FocusEvent, Ref } from "react";
import { useField } from "formik";
import { t } from "ttag";

import { TextInput } from "metabase/ui";
import type { TextInputProps } from "metabase/ui";

import Confirm from "metabase/components/Confirm";
import { UtilApi } from "metabase/services";

import { SecretKeyRoot, GenerateButton } from "./FormSecretKey.styled";

export interface FormSecretKeyProps
  extends Omit<TextInputProps, "value" | "error"> {
  name: string;
  nullable?: boolean;
  confirmation: {
    header: string;
    dialog: string;
  };
}

export const FormSecretKey = forwardRef(function FormSecretKey(
  {
    name,
    nullable,
    confirmation,
    onChange,
    onBlur,
    ...props
  }: FormSecretKeyProps,
  ref: Ref<HTMLInputElement>,
) {
  const [{ value }, { error, touched }, { setValue, setTouched }] =
    useField(name);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      if (newValue === "") {
        setValue(nullable ? null : undefined);
      } else {
        setValue(newValue);
      }
      onChange?.(event);
    },
    [nullable, setValue, onChange],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      onBlur?.(event);
    },
    [setTouched, onBlur],
  );
  const generateToken = async () => {
    const result = await UtilApi.random_token();
    setValue(result.token);
  };

  return (
    <SecretKeyRoot>
      <TextInput
        {...props}
        ref={ref}
        name={name}
        value={value ?? ""}
        error={touched ? error : null}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {value ? (
        <Confirm
          triggerClasses="full-height"
          title={confirmation.header}
          content={confirmation.dialog}
          action={generateToken}
        >
          <GenerateButton variant="filled">{t`Regenerate key`}</GenerateButton>
        </Confirm>
      ) : (
        <GenerateButton
          variant="filled"
          onClick={generateToken}
        >{t`Generate key`}</GenerateButton>
      )}
    </SecretKeyRoot>
  );
});
