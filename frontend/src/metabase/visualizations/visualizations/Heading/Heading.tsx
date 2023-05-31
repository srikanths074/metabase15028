import React, { useMemo, MouseEvent } from "react";

import cx from "classnames";
import { t } from "ttag";

import { useFocus } from "metabase/hooks/use-focus";
import type {
  BaseDashboardOrderedCard,
  VisualizationSettings,
} from "metabase-types/api";

import {
  InputContainer,
  HeadingContent,
  HeadingContainer,
  TextInput,
} from "./Heading.styled";

interface HeadingProps {
  isEditing: boolean;
  onUpdateVisualizationSettings: ({ text }: { text: string }) => void;
  dashcard: BaseDashboardOrderedCard;
  settings: VisualizationSettings;
}

export function Heading({
  settings,
  isEditing,
  onUpdateVisualizationSettings,
  dashcard,
}: HeadingProps) {
  const justAdded = useMemo(() => dashcard?.justAdded || false, [dashcard]);

  const { isFocused, toggleFocusOn, toggleFocusOff } = useFocus(justAdded);
  const isPreviewing = !isFocused;

  const handleTextChange = (text: string) =>
    onUpdateVisualizationSettings({ text });
  const preventDragging = (e: MouseEvent<HTMLInputElement>) =>
    e.stopPropagation();

  const content = settings.text;
  const hasNoContent = !content;
  const placeholder = t`Heading`;

  if (isEditing) {
    return (
      <InputContainer
        className={cx("text-edit-container", {
          "has-no-content": hasNoContent,
        })}
        isPreviewing={isPreviewing}
        onClick={toggleFocusOn}
      >
        {isPreviewing ? (
          <HeadingContent hasNoContent={hasNoContent} isEditing={isEditing}>
            {content || placeholder}
          </HeadingContent>
        ) : (
          <TextInput
            name="heading"
            placeholder={placeholder}
            value={content}
            autoFocus={justAdded || isFocused}
            onChange={e => handleTextChange(e.target.value)}
            onMouseDown={preventDragging}
            onBlur={toggleFocusOff}
          />
        )}
      </InputContainer>
    );
  }

  return (
    <HeadingContainer>
      <HeadingContent>{content}</HeadingContent>
    </HeadingContainer>
  );
}
