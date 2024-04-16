import type { FocusEvent } from "react";
import { useState, useMemo } from "react";
import { t } from "ttag";

import { QueryColumnPicker } from "metabase/common/components/QueryColumnPicker";
import {
  Button,
  Flex,
  Icon,
  Select,
  TextInput,
  Text,
  Popover,
  FocusTrap,
} from "metabase/ui";
import * as Lib from "metabase-lib";

import {
  toSelectValue,
  label,
  formatSeparator,
  getColumnOptions,
} from "../util";

import styles from "./ColumnAndSeparatorRow.module.css";

interface Props {
  query: Lib.Query;
  stageIndex: number;
  column: Lib.ColumnMetadata | null;
  index: number;
  columns: Lib.ColumnMetadata[];
  separator: string;
  showRemove: boolean;
  showSeparator: boolean;
  onChange: (
    index: number,
    column: Lib.ColumnMetadata | null,
    separator: string,
  ) => void;
  onRemove: (index: number) => void;
}

export const ColumnAndSeparatorRow = ({
  query,
  stageIndex,
  columns,
  column,
  index,
  separator,
  showRemove,
  showSeparator,
  onChange,
  onRemove,
}: Props) => {
  return (
    <Flex align="flex-end" gap={12} pos="relative">
      <SeparatorInput
        showSeparator={showSeparator}
        value={separator}
        onChange={separator => {
          onChange(index, column, separator);
        }}
      />

      <ColumnInput
        query={query}
        stageIndex={stageIndex}
        columns={columns}
        value={column}
        label={label(index)}
        onChange={column => {
          onChange(index, column, separator);
        }}
      />

      {showRemove && (
        <Button
          classNames={{
            root: styles.remove,
          }}
          aria-label={t`Remove column`}
          leftIcon={<Icon name="close" />}
          variant="default"
          onClick={() => {
            onRemove(index);
          }}
        />
      )}
    </Flex>
  );
};

function SeparatorInput({
  showSeparator,
  value,
  onChange,
}: {
  value: string;
  showSeparator: boolean;
  onChange: (value: string) => void;
}) {
  const [hasFocus, setHasFocus] = useState(false);

  if (!showSeparator) {
    return null;
  }

  function handleFocus(evt: FocusEvent<HTMLInputElement>) {
    setHasFocus(true);
    evt.target.selectionStart = 0;
    evt.target.selectionEnd = evt.target.value.length;
  }

  function handleBlur() {
    setHasFocus(false);
  }

  return (
    <>
      <TextInput
        className={styles.separator}
        label={t`Separator`}
        value={value}
        w={110}
        onChange={event => onChange(event.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {!hasFocus && formatSeparator(value) !== value && (
        <Text color="text-light" className={styles.placeholder}>
          {formatSeparator(value)}
        </Text>
      )}
    </>
  );
}

type ColumnInputProps = {
  query: Lib.Query;
  stageIndex: number;
  columns: Lib.ColumnMetadata[];
  label: string;
  value: Lib.ColumnMetadata | null;
  onChange: (column: Lib.ColumnMetadata | null) => void;
};

export function ColumnInput({
  query,
  stageIndex,
  columns,
  label,
  value,
  onChange,
}: ColumnInputProps) {
  const columnGroups = useMemo(() => Lib.groupColumns(columns), [columns]);
  const options = useMemo(
    () => getColumnOptions(query, stageIndex, columns),
    [query, stageIndex, columns],
  );

  const [open, setOpen] = useState(false);

  function handleFocus() {
    setOpen(true);
  }

  function handleBlur(evt) {}

  function handleOpen() {
    setOpen(true);
  }

  function handleInputClick(evt) {
    evt.preventDefault();
    if (!open) {
      // setOpen(true);
    }
  }

  function handleClose() {
    setOpen(false);
  }

  const dropdown = (
    <FocusTrap active={open}>
      <div>
        <QueryColumnPicker
          query={query}
          stageIndex={stageIndex}
          columnGroups={columnGroups}
          onSelect={onChange}
          onClose={handleClose}
          checkIsColumnSelected={item => item.column === value}
          width="100%"
        />
      </div>
    </FocusTrap>
  );

  return (
    <Popover
      opened={open}
      onClose={handleClose}
      onOpen={handleOpen}
      closeOnEscape
      closeOnClickOutside
      width="target"
    >
      <Popover.Target>
        <div onClick={handleInputClick}>
          <Select
            classNames={{
              wrapper: styles.wrapper,
              dropdown: styles.dropdown,
              root: styles.root,
            }}
            onDropdownOpen={handleOpen}
            label={label}
            data={options}
            placeholder={t`Select a column...`}
            value={toSelectValue(options, value)}
            dropdownComponent="div"
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>
      </Popover.Target>
      <Popover.Dropdown>{dropdown}</Popover.Dropdown>
    </Popover>
  );
}
