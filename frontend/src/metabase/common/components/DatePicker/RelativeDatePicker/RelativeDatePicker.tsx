import { useState } from "react";
import { Divider, Group, Tabs } from "metabase/ui";
import { BackButton } from "../BackButton";
import type { RelativeDatePickerValue } from "../types";
import { DEFAULT_VALUE, TABS } from "./constants";
import { getDirection, isIntervalValue, setDirection } from "./utils";
import { CurrentDatePicker } from "./CurrentDatePicker";
import { DateIntervalPicker } from "./DateIntervalPicker";
import { TabList } from "./RelativeDatePicker.styled";

interface RelativeDatePickerProps {
  value?: RelativeDatePickerValue;
  onChange: (value: RelativeDatePickerValue) => void;
  onBack: () => void;
}

export function RelativeDatePicker({
  value: initialValue,
  onChange,
  onBack,
}: RelativeDatePickerProps) {
  const [value, setValue] = useState(initialValue ?? DEFAULT_VALUE);
  const direction = getDirection(value);
  const isNew = initialValue == null;

  const handleTabChange = (tabValue: string | null) => {
    const tab = TABS.find(tab => tab.direction === tabValue);
    if (tab) {
      setValue(setDirection(value, tab.direction));
    }
  };

  const handleSubmit = () => {
    onChange(value);
  };

  return (
    <Tabs value={direction} onTabChange={handleTabChange}>
      <Group>
        <BackButton onClick={onBack} />
        <TabList>
          {TABS.map(tab => (
            <Tabs.Tab key={tab.direction} value={tab.direction}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </TabList>
      </Group>
      <Divider />
      {TABS.map(tab => (
        <Tabs.Panel key={tab.direction} value={tab.direction}>
          {isIntervalValue(value) ? (
            <DateIntervalPicker
              value={value}
              isNew={isNew}
              onChange={setValue}
              onSubmit={handleSubmit}
            />
          ) : (
            <CurrentDatePicker value={value} onChange={onChange} />
          )}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
