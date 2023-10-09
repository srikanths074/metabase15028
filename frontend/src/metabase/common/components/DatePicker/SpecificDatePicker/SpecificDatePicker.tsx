import { useState } from "react";
import { t } from "ttag";
import {
  Box,
  Button,
  DatePickerInput,
  Divider,
  Group,
  Tabs,
} from "metabase/ui";
import { BackButton } from "../BackButton";
import type { DatePickerOperator, SpecificDatePickerValue } from "../types";
import { getDefaultValue, getTabs, setOperator } from "./utils";
import { TabList } from "./SpecificDatePicker.styled";

export interface SpecificDatePickerProps {
  value?: SpecificDatePickerValue;
  availableOperators: ReadonlyArray<DatePickerOperator>;
  onChange: (value: SpecificDatePickerValue) => void;
  onBack: () => void;
}

export function SpecificDatePicker({
  value: initialValue,
  availableOperators,
  onChange,
  onBack,
}: SpecificDatePickerProps) {
  const [value, setValue] = useState(initialValue ?? getDefaultValue());
  const tabs = getTabs(availableOperators);
  const isNew = initialValue == null;

  const handleTabChange = (tabValue: string | null) => {
    const tab = tabs.find(tab => tab.operator === tabValue);
    if (tab) {
      setValue(setOperator(value, tab.operator));
    }
  };

  const handleSubmit = () => {
    onChange(value);
  };

  return (
    <Tabs value={value.operator} onTabChange={handleTabChange}>
      <Group>
        <BackButton onClick={onBack} />
        <TabList>
          {tabs.map(tab => (
            <Tabs.Tab key={tab.operator} value={tab.operator}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </TabList>
      </Group>
      {tabs.map(tab => (
        <Tabs.Panel key={tab.operator} value={tab.operator}>
          <SingleDatePicker
            value={value}
            isNew={isNew}
            onChange={setValue}
            onSubmit={handleSubmit}
          />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

interface SingleDatePickerProps {
  value: SpecificDatePickerValue;
  isNew: boolean;
  onChange: (value: SpecificDatePickerValue) => void;
  onSubmit: () => void;
}

function SingleDatePicker({
  value,
  isNew,
  onChange,
  onSubmit,
}: SingleDatePickerProps) {
  const [date, setDate] = useState<Date | null>(value.values[0]);

  const handleChange = (date: Date | null) => {
    setDate(date);
    if (date) {
      onChange({ ...value, values: [date] });
    }
  };

  return (
    <div>
      <Box p="md">
        <DatePickerInput value={date} onChange={handleChange} />
      </Box>
      <Divider />
      <Group p="sm" position="right">
        <Button variant="filled" disabled={date == null} onClick={onSubmit}>
          {isNew ? t`Add filter` : t`Update filter`}
        </Button>
      </Group>
    </div>
  );
}
