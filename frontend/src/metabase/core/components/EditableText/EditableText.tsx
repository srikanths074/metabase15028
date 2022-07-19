import React, {
  ChangeEvent,
  KeyboardEvent,
  forwardRef,
  HTMLAttributes,
  Ref,
  useLayoutEffect,
  useCallback,
  useState,
  useRef,
} from "react";

import { usePrevious } from "metabase/hooks/use-previous";

import { EditableTextArea, EditableTextRoot } from "./EditableText.styled";

export type EditableTextAttributes = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
>;

export interface EditableTextProps extends EditableTextAttributes {
  initialValue?: string | null;
  placeholder?: string;
  isOptional?: boolean;
  isMultiline?: boolean;
  isDisabled?: boolean;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  "data-testid"?: string;
}

const EditableText = forwardRef(function EditableText(
  {
    initialValue,
    placeholder,
    isOptional = false,
    isMultiline = false,
    isDisabled = false,
    onChange,
    onFocus,
    onBlur,
    "data-testid": dataTestId,
    ...props
  }: EditableTextProps,
  ref: Ref<HTMLDivElement>,
) {
  const [inputValue, setInputValue] = useState(initialValue ?? "");
  const [submitValue, setSubmitValue] = useState(initialValue ?? "");
  const displayValue = inputValue ? inputValue : placeholder;
  const previousInitialValue = usePrevious(initialValue);
  const submitOnBlur = useRef(true);

  useLayoutEffect(() => {
    if (previousInitialValue !== initialValue) {
      setInputValue(initialValue ?? "");
    }
  }, [previousInitialValue, initialValue]);

  const handleBlur = useCallback(
    e => {
      if (!isOptional && !inputValue) {
        setInputValue(submitValue);
      } else if (inputValue !== submitValue && submitOnBlur.current) {
        setSubmitValue(inputValue);
        onChange?.(inputValue);
      }
      onBlur?.();
    },
    [inputValue, submitValue, isOptional, onChange, onBlur],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(event.currentTarget.value);
      submitOnBlur.current = true;
    },
    [submitOnBlur],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        setInputValue(submitValue);
        submitOnBlur.current = false;
        event.currentTarget.blur();
      } else if (event.key === "Enter" && !isMultiline) {
        event.preventDefault();
        submitOnBlur.current = true;
        event.currentTarget.blur();
      }
    },
    [submitValue, isMultiline],
  );

  return (
    <EditableTextRoot
      {...props}
      ref={ref}
      isDisabled={isDisabled}
      data-value={`${displayValue}\u00A0`}
    >
      <EditableTextArea
        value={inputValue}
        placeholder={placeholder}
        disabled={isDisabled}
        data-testid={dataTestId}
        onFocus={onFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </EditableTextRoot>
  );
});

export default Object.assign(EditableText, { Root: EditableTextRoot });
