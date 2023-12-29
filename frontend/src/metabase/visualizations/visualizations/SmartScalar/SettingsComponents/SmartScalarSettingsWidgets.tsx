import type { MouseEvent } from "react";
import { useCallback, useState } from "react";
import { t } from "ttag";
import _ from "underscore";
import IconButtonWrapper from "metabase/components/IconButtonWrapper";
import { Button, Menu, Stack, Text } from "metabase/ui";
import type {
  DatasetColumn,
  SmartScalarComparison,
  SmartScalarComparisonType,
} from "metabase-types/api";
import { COMPARISON_TYPES } from "../constants";
import type { ComparisonMenuOption } from "../types";
import { PeriodsAgoMenuOption } from "./PeriodsAgoMenuOption";
import { StaticNumberForm } from "./StaticNumberForm";
import { AnotherColumnForm } from "./AnotherColumnForm";
import { MenuItemStyled } from "./MenuItem.styled";
import {
  ComparisonList,
  ExpandIcon,
  RemoveIcon,
} from "./SmartScalarSettingsWidgets.styled";

type SmartScalarComparisonWidgetProps = {
  onChange: (setting: SmartScalarComparison[]) => void;
  options: ComparisonMenuOption[];
  comparableColumns: DatasetColumn[];
  value: SmartScalarComparison[];
  maxComparisons: number;
};

type Tab = "anotherColumn" | "staticNumber" | null;

export function SmartScalarComparisonWidget({
  value,
  maxComparisons,
  onChange,
  ...props
}: SmartScalarComparisonWidgetProps) {
  const canAddComparison = value.length < maxComparisons;
  const canRemoveComparison = value.length > 1;

  const handleAddComparison = useCallback(() => {
    onChange([...value, { type: COMPARISON_TYPES.PREVIOUS_PERIOD }]);
  }, [value, onChange]);

  const handleChangeComparison = useCallback(
    (index: number, comparison: SmartScalarComparison) => {
      const nextValue = value.map((item, i) =>
        i === index ? comparison : item,
      );
      onChange(nextValue);
    },
    [value, onChange],
  );

  const handleRemoveComparison = useCallback(
    (index: number) => {
      const nextValue = value.filter((item, i) => i !== index);
      onChange(nextValue);
    },
    [value, onChange],
  );

  return (
    <Stack>
      <ComparisonList>
        {value.map((comparison, index) => (
          <li key={index}>
            <ComparisonPicker
              {...props}
              value={comparison}
              isRemovable={canRemoveComparison}
              onChange={nextComparison =>
                handleChangeComparison(index, nextComparison)
              }
              onRemove={() => handleRemoveComparison(index)}
            />
          </li>
        ))}
      </ComparisonList>
      <Button
        variant="subtle"
        disabled={!canAddComparison}
        onClick={handleAddComparison}
        p="0"
        style={{ alignSelf: "flex-start" }}
      >{t`Add comparison`}</Button>
    </Stack>
  );
}

interface ComparisonPickerProps {
  value: SmartScalarComparison;
  options: ComparisonMenuOption[];
  comparableColumns: DatasetColumn[];
  isRemovable?: boolean;
  onChange: (setting: SmartScalarComparison) => void;
  onRemove: () => void;
}

function ComparisonPicker({
  onChange,
  onRemove,
  options,
  isRemovable = true,
  comparableColumns,
  value: selectedValue,
}: ComparisonPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(
    getTabForComparisonType(selectedValue.type),
  );
  const [editedValue, setEditedValue] = useState(selectedValue);

  const selectedOption = options.find(
    ({ type }) => type === selectedValue.type,
  );

  const displayName = getDisplayName(selectedValue, selectedOption);
  const isDisabled = options.length === 1;

  const handleRemoveClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRemove();
    },
    [onRemove],
  );

  const handleEditedValueChange: HandleEditedValueChangeType = useCallback(
    (value: SmartScalarComparison, shouldSubmit = false) => {
      setEditedValue(value);

      if (shouldSubmit) {
        onChange(value);
        setOpen(false);
      }
    },
    [onChange, setEditedValue, setOpen],
  );

  const handleMenuStateChange = (isOpen: boolean) => {
    if (isOpen) {
      setEditedValue(selectedValue);
      setTab(getTabForComparisonType(selectedValue.type));
    } else if (!_.isEqual(selectedValue, editedValue)) {
      onChange(editedValue);
    }
    setOpen(isOpen);
  };

  const renderMenuDropdownContent = () => {
    if (tab === "anotherColumn") {
      return (
        <AnotherColumnForm
          value={
            selectedValue.type === COMPARISON_TYPES.ANOTHER_COLUMN
              ? selectedValue
              : undefined
          }
          columns={comparableColumns}
          onChange={nextValue => {
            handleEditedValueChange(nextValue, true);
          }}
          onBack={() => setTab(null)}
        />
      );
    }
    if (tab === "staticNumber") {
      return (
        <StaticNumberForm
          value={
            selectedValue.type === COMPARISON_TYPES.STATIC_NUMBER
              ? selectedValue
              : undefined
          }
          onChange={nextValue => {
            handleEditedValueChange(nextValue, true);
          }}
          onBack={() => setTab(null)}
        />
      );
    }
    return (
      <Stack spacing="sm">
        {options.map(optionArgs =>
          renderMenuOption({
            editedValue,
            selectedValue,
            optionArgs,
            onChange: handleEditedValueChange,
            onChangeTab: setTab,
          }),
        )}
      </Stack>
    );
  };

  return (
    <Menu
      opened={open}
      onChange={handleMenuStateChange}
      position="bottom-start"
      shadow="sm"
      closeOnItemClick={false}
    >
      <Menu.Target>
        <Button
          disabled={isDisabled}
          rightIcon={
            isRemovable && (
              <IconButtonWrapper
                aria-label={t`Remove`}
                onClick={handleRemoveClick}
              >
                <RemoveIcon name="close" />
              </IconButtonWrapper>
            )
          }
          px="1rem"
          fullWidth
          data-testid="comparisons-widget-button"
          styles={{
            label: { flex: 1 },
            inner: { justifyContent: "space-between" },
          }}
        >
          <span>{displayName}</span>
          <ExpandIcon name="chevrondown" size={14} />
        </Button>
      </Menu.Target>

      <Menu.Dropdown miw="18.25rem">
        {renderMenuDropdownContent()}
      </Menu.Dropdown>
    </Menu>
  );
}

function getTabForComparisonType(type: SmartScalarComparisonType): Tab {
  if (type === COMPARISON_TYPES.ANOTHER_COLUMN) {
    return "anotherColumn";
  }
  if (type === COMPARISON_TYPES.STATIC_NUMBER) {
    return "staticNumber";
  }
  return null;
}

function getDisplayName(
  value: SmartScalarComparison,
  option?: ComparisonMenuOption,
) {
  if (value.type === COMPARISON_TYPES.PERIODS_AGO) {
    return `${value.value} ${option?.name}`;
  }
  if (
    value.type === COMPARISON_TYPES.ANOTHER_COLUMN ||
    value.type === COMPARISON_TYPES.STATIC_NUMBER
  ) {
    return value.label;
  }
  return option?.name;
}

export type HandleEditedValueChangeType = (
  value: SmartScalarComparison,
  shouldSubmit?: boolean,
) => void;

type RenderMenuOptionProps = {
  editedValue: SmartScalarComparison;
  selectedValue: SmartScalarComparison;
  optionArgs: ComparisonMenuOption;
  onChange: HandleEditedValueChangeType;
  onChangeTab: (tab: Tab) => void;
};

function renderMenuOption({
  editedValue,
  selectedValue,
  optionArgs,
  onChange,
  onChangeTab,
}: RenderMenuOptionProps) {
  const { type, name } = optionArgs;

  const isSelected = selectedValue.type === type;

  if (type === COMPARISON_TYPES.PERIODS_AGO) {
    const { maxValue } = optionArgs;

    return (
      <PeriodsAgoMenuOption
        key={type}
        aria-selected={isSelected}
        type={type}
        name={name}
        onChange={onChange}
        maxValue={maxValue}
        editedValue={editedValue.type === type ? editedValue : undefined}
      />
    );
  }

  const handleClick = () => {
    if (
      type === COMPARISON_TYPES.ANOTHER_COLUMN ||
      type === COMPARISON_TYPES.STATIC_NUMBER
    ) {
      const tab = getTabForComparisonType(type);
      onChangeTab(tab);
    } else {
      onChange({ type }, true);
    }
  };

  return (
    <MenuItemStyled key={type} aria-selected={isSelected} onClick={handleClick}>
      <Text fw="bold" ml="0.5rem">
        {name}
      </Text>
    </MenuItemStyled>
  );
}
