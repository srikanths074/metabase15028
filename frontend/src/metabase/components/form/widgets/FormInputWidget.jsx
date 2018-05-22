import React from "react";

import cx from "classnames";

const FormInputWidget = ({ type = "text", placeholder, field, offset }) => (
  <input
    className={cx("Form-input full", { "Form-offset": offset })}
    type={type}
    placeholder={placeholder}
    {...field}
  />
);

export default FormInputWidget;
