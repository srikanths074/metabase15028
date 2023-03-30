/* eslint-disable react/prop-types */
import React from "react";
import cx from "classnames";

import Select, { Option } from "metabase/core/components/Select";

const SettingSelect = ({
  className,
  setting,
  options = setting.options,
  onChange,
  disabled,
}) => {
  const { placeholder, value, defaultValue, searchProp, key } = setting;

  return (
    <Select
      className={cx("SettingsInput", className)}
      placeholder={placeholder}
      value={value}
      defaultValue={defaultValue}
      searchProp={searchProp}
      onChange={e => onChange(e.target.value)}
      buttonProps={{
        dataTestId: key,
      }}
    >
      {options.map(option => {
        const name = typeof option === "object" ? option.name : option;
        const value = typeof option === "object" ? option.value : option;
        return (
          <Option key={value} name={name} value={value}>
            {name}
          </Option>
        );
      })}
    </Select>
  );
};

export default SettingSelect;
