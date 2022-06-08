import React, { useState } from "react";

import { Root, StyledTextArea } from "./EditableText.styled";

import { KEY_ESCAPE } from "metabase/lib/keyboard";

type text = string | null | undefined;

interface Props {
  value: text;
  onChange?: (val: string) => void;
}

const EditableText = ({ value, onChange }: Props) => {
  const [memo, setMemo] = useState<text>(value);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMemo(e.target.value);
  };

  const handleBlur = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === KEY_ESCAPE) {
      setMemo(value);
    }
  };

  return (
    <Root data-replicated-value={memo}>
      <StyledTextArea
        placeholder="Description"
        value={memo || undefined}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    </Root>
  );
};

export default EditableText;
