import { forwardRef, RefObject } from "react";
import { t } from "ttag";

import { Text } from "metabase/ui";
import TippyPopoverWithTrigger, {
  TippyPopoverWithTriggerRef,
} from "metabase/components/PopoverWithTrigger/TippyPopoverWithTrigger";
import {
  QueryColumnPickerProps,
  ColumnListItem,
} from "metabase/common/components/QueryColumnPicker";

import * as Lib from "metabase-lib";

import {
  JoinConditionCellItem,
  StyledQueryColumnPicker,
} from "./JoinConditionColumnPicker.styled";

interface JoinConditionColumnPickerProps
  extends Omit<QueryColumnPickerProps, "checkIsColumnSelected"> {
  column?: Lib.ColumnMetadata;
  label?: string;
  isInitiallyVisible?: boolean;
  readOnly?: boolean;
  popoverRef?: RefObject<TippyPopoverWithTriggerRef>;
}

function checkIsColumnSelected(item: ColumnListItem) {
  return !!item.selected;
}

export type JoinConditionColumnPickerRef = TippyPopoverWithTriggerRef;

export function JoinConditionColumnPicker({
  query,
  stageIndex,
  column,
  label,
  isInitiallyVisible = false,
  readOnly = false,
  popoverRef,
  ...props
}: JoinConditionColumnPickerProps) {
  const columnInfo = column ? Lib.displayInfo(query, stageIndex, column) : null;

  return (
    <TippyPopoverWithTrigger
      isInitiallyVisible={isInitiallyVisible}
      renderTrigger={({ visible, onClick }) => (
        <ColumnNotebookCellItem
          isOpen={visible}
          tableName={columnInfo?.table?.displayName}
          columnName={columnInfo?.displayName}
          label={label}
          readOnly={readOnly}
          onClick={onClick}
        />
      )}
      popoverContent={({ closePopover }) => (
        <StyledQueryColumnPicker
          {...props}
          query={query}
          stageIndex={stageIndex}
          hasTemporalBucketing
          checkIsColumnSelected={checkIsColumnSelected}
          onClose={closePopover}
        />
      )}
      popoverRef={popoverRef}
    />
  );
}

interface ColumnNotebookCellItemProps {
  tableName?: string;
  columnName?: string;
  label?: string;
  isOpen?: boolean;
  readOnly?: boolean;
  onClick: () => void;
}

const ColumnNotebookCellItem = forwardRef<
  HTMLDivElement,
  ColumnNotebookCellItemProps
>(function ColumnNotebookCellItem(
  { tableName, columnName, label, isOpen, readOnly, onClick },
  ref,
) {
  const hasColumnSelected = !!columnName;
  const hasTableLabel = !!tableName || hasColumnSelected;
  return (
    <JoinConditionCellItem
      isOpen={isOpen}
      hasColumnSelected={hasColumnSelected}
      aria-label={label}
      readOnly={readOnly}
      onClick={onClick}
      ref={ref}
    >
      {hasTableLabel && (
        <Text display="block" size={11} lh={1} color="white" weight={400}>
          {tableName || t`Previous results`}
        </Text>
      )}
      <Text
        display="block"
        color="white"
        weight={hasColumnSelected ? 600 : 400}
        lh={1}
      >
        {columnName || t`Pick a column…`}
      </Text>
    </JoinConditionCellItem>
  );
});
