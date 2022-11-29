import React, { useCallback, useMemo, useRef } from "react";
import { t } from "ttag";
import FormSelect from "metabase/core/components/FormSelect";
import { Engine } from "metabase-types/api";
import { SelectChangeEvent } from "metabase/core/components/Select";

export interface DatabaseEngineFieldProps {
  engineKey?: string;
  engines: Record<string, Engine>;
  onChange: (engine: string) => void;
}

const DatabaseEngineField = ({
  engineKey,
  engines,
  onChange,
}: DatabaseEngineFieldProps): JSX.Element => {
  const { current: isDisabled } = useRef(engineKey != null);

  const options = useMemo(() => {
    return getEngineOptions(engines, engineKey);
  }, [engines, engineKey]);

  const handleChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <FormSelect
      name="engine"
      title={t`Database type`}
      placeholder={t`Select a database`}
      options={options}
      disabled={isDisabled}
      onChange={handleChange}
    />
  );
};

const getEngineOptions = (
  engines: Record<string, Engine>,
  engineKey?: string,
) => {
  return Object.entries(engines)
    .filter(([name, engine]) => name === engineKey || !engine["superseded-by"])
    .map(([name, engine]) => ({ name: engine["driver-name"], value: name }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export default DatabaseEngineField;
