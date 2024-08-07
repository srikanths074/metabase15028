import { forwardRef, isValidElement } from "react";
import { t } from "ttag";

import CS from "metabase/css/core/index.css";
import { METAKEY } from "metabase/lib/browser";
import { Icon, Tooltip } from "metabase/ui";

import type { BorderSide } from "./NotebookCell.styled";
import {
  NotebookCell as _NotebookCell,
  NotebookCellItemContainer,
  NotebookCellItemContentContainer,
  CONTAINER_PADDING,
} from "./NotebookCell.styled";

export const NotebookCell = Object.assign(_NotebookCell, {
  displayName: "NotebookCell",
  CONTAINER_PADDING,
});

interface NotebookCellItemProps {
  color: string;
  inactive?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  right?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  rightContainerStyle?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler;
  "data-testid"?: string;
  ref?: React.Ref<HTMLDivElement>;
  hasTooltip?: boolean;
}

export const NotebookCellItem = forwardRef<
  HTMLDivElement,
  NotebookCellItemProps
>(function NotebookCellItem(
  {
    inactive,
    disabled,
    color,
    containerStyle,
    right,
    rightContainerStyle,
    children,
    readOnly,
    hasTooltip,
    ...restProps
  },
  ref,
) {
  const hasRightSide = isValidElement(right) && !readOnly;
  const mainContentRoundedCorners: BorderSide[] = ["left"];
  if (!hasRightSide) {
    mainContentRoundedCorners.push("right");
  }
  return (
    <NotebookCellItemContainer
      inactive={inactive}
      readOnly={readOnly}
      disabled={disabled}
      color={color}
      {...restProps}
      data-testid={restProps["data-testid"] ?? "notebook-cell-item"}
      ref={ref}
    >
      <Tooltip
        label={t`${METAKEY}+click to open in new tab`}
        hidden={!hasTooltip}
      >
        <NotebookCellItemContentContainer
          inactive={inactive}
          disabled={disabled}
          readOnly={readOnly}
          color={color}
          roundedCorners={mainContentRoundedCorners}
          style={containerStyle}
        >
          {children}
        </NotebookCellItemContentContainer>
      </Tooltip>
      {hasRightSide && (
        <NotebookCellItemContentContainer
          inactive={inactive}
          color={color}
          border="left"
          roundedCorners={["right"]}
          style={rightContainerStyle}
        >
          {right}
        </NotebookCellItemContentContainer>
      )}
    </NotebookCellItemContainer>
  );
});

interface NotebookCellAddProps extends NotebookCellItemProps {
  initialAddText?: React.ReactNode;
}

export const NotebookCellAdd = forwardRef<HTMLDivElement, NotebookCellAddProps>(
  function NotebookCellAdd({ initialAddText, ...props }, ref) {
    return (
      <NotebookCellItem {...props} inactive={!!initialAddText} ref={ref}>
        {initialAddText || <Icon name="add" className={CS.textWhite} />}
      </NotebookCellItem>
    );
  },
);
