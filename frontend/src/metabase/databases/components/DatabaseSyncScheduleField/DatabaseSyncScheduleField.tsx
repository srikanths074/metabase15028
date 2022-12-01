import React, { ReactNode, useCallback } from "react";
import { useField } from "formik";
import { t } from "ttag";
import SchedulePicker from "metabase/components/SchedulePicker";
import { ScheduleSettings, ScheduleType } from "metabase-types/api";
import FormField from "metabase/core/components/FormField";

const DEFAULT_SCHEDULE: ScheduleSettings = {
  schedule_day: "mon",
  schedule_frame: null,
  schedule_hour: 0,
  schedule_type: "daily",
};

const SCHEDULE_OPTIONS: ScheduleType[] = ["hourly", "daily"];

export interface DatabaseSyncScheduleFieldProps {
  name: string;
  title?: string;
  description?: ReactNode;
  timezone: string;
}

const DatabaseSyncScheduleField = ({
  name,
  title,
  description,
  timezone,
}: DatabaseSyncScheduleFieldProps): JSX.Element => {
  const [{ value }, , { setValue }] = useField(name);

  const handleScheduleChange = useCallback(
    (value: ScheduleSettings) => {
      setValue(value);
    },
    [setValue],
  );

  return (
    <FormField title={title} description={description}>
      <SchedulePicker
        schedule={value ?? DEFAULT_SCHEDULE}
        scheduleOptions={SCHEDULE_OPTIONS}
        timezone={timezone}
        textBeforeInterval={t`Scan`}
        minutesOnHourPicker
        onScheduleChange={handleScheduleChange}
      />
    </FormField>
  );
};

export default DatabaseSyncScheduleField;
