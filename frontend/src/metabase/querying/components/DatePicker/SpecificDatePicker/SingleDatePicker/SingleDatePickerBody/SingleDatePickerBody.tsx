import { useState } from "react";
import { t } from "ttag";

import type { DateValue } from "metabase/ui";
import { DateInput, DatePicker, Stack, TimeInput } from "metabase/ui";

import {
  DATE_PICKER_STYLES,
  MIN_DATE_PICKER_HEIGHT,
  MIN_DATE_PICKER_WIDTH,
} from "../../constants";
import { setDatePart, setTimePart } from "../../utils";

interface SingleDatePickerBodyProps {
  value: Date;
  hasTime: boolean;
  onChange: (value: Date) => void;
}

export function SingleDatePickerBody({
  value,
  hasTime,
  onChange,
}: SingleDatePickerBodyProps) {
  const [date, setDate] = useState<Date>(value);

  const handleDateChange = (newDate: DateValue) => {
    newDate && onChange(setDatePart(value, newDate));
  };

  const handleTimeChange = (newTime: Date | null) => {
    newTime && onChange(setTimePart(value, newTime));
  };

  return (
    <Stack>
      <DateInput
        value={value}
        date={date}
        popoverProps={{ opened: false }}
        aria-label={t`Date`}
        onChange={handleDateChange}
        onDateChange={setDate}
      />
      {hasTime && (
        <TimeInput
          value={value}
          aria-label={t`Time`}
          onChange={handleTimeChange}
        />
      )}
      <DatePicker
        value={value}
        date={date}
        miw={MIN_DATE_PICKER_WIDTH}
        mih={MIN_DATE_PICKER_HEIGHT}
        styles={DATE_PICKER_STYLES}
        onChange={handleDateChange}
        onDateChange={setDate}
      />
    </Stack>
  );
}
