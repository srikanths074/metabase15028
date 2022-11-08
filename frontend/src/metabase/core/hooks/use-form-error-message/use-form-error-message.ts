import { useContext, useLayoutEffect, useState } from "react";
import { useFormikContext } from "formik";
import { t } from "ttag";
import FormContext from "metabase/core/context/FormContext";

const useFormErrorMessage = (): string | undefined => {
  const { values, errors } = useFormikContext();
  const { status, message } = useContext(FormContext);
  const [isVisible, setIsVisible] = useState(false);
  const hasErrors = Object.keys(errors).length > 0;

  useLayoutEffect(() => {
    setIsVisible(false);
  }, [values]);

  useLayoutEffect(() => {
    setIsVisible(status === "rejected");
  }, [status]);

  if (!isVisible) {
    return undefined;
  } else if (message) {
    return message;
  } else if (!hasErrors) {
    return t`An error occurred`;
  }
};

export default useFormErrorMessage;
