import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { FormikHelpers } from "formik";
import { FormContextType, FormState } from "metabase/core/context/FormContext";
import { FormError } from "./types";

export interface UseFormSubmitProps<T> {
  onSubmit: (values: T, helpers: FormikHelpers<T>) => void;
}

export interface UseFormSubmitResult<T> {
  context: FormContextType;
  handleSubmit: (values: T, helpers: FormikHelpers<T>) => void;
}

const useFormSubmit = <T>({
  onSubmit,
}: UseFormSubmitProps<T>): UseFormSubmitResult<T> => {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const context = useMemo(() => ({ state, setState }), [state, setState]);

  const handleSubmit = useCallback(
    async (data: T, helpers: FormikHelpers<T>) => {
      try {
        setState({ status: "pending" });
        await onSubmit(data, helpers);
        setState({ status: "fulfilled" });
      } catch (error) {
        helpers.setErrors(getFormErrors(error));
        setState({ status: "rejected", message: getFormMessage(error) });
      }
    },
    [onSubmit],
  );

  return {
    context,
    handleSubmit,
  };
};

const isFormError = <T>(error: unknown): error is FormError<T> => {
  return error != null && typeof error === "object";
};

const getFormErrors = (error: unknown) => {
  return isFormError(error) ? error.data?.errors ?? error.errors ?? {} : {};
};

const getFormMessage = (error: unknown) => {
  return isFormError(error) ? error.data?.message ?? error.message : undefined;
};

export default useFormSubmit;
