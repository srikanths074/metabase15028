import React from "react";
import { t } from "ttag";
import type { InputType } from "metabase-types/api/writeback";

import Input from "metabase/core/components/Input";
import Select from "metabase/core/components/Select";
import FormTextArea from "metabase/admin/datamodel/components/FormTextArea";
import NumericInput from "metabase/core/components/NumericInput";
import DateInput from "metabase/core/components/DateInput";
import Radio from "metabase/core/components/Radio";

const sampleOptions = [
  { name: t`Option One`, value: 1 },
  { name: t`Option Two`, value: 2 },
  { name: t`Option Three`, value: 3 },
];
// sample form fields
export function FormField({ type }: { type: InputType }) {
  switch (type) {
    case "text":
      return <Input />;
    case "longtext":
      return <FormTextArea />;
    case "number":
      return <NumericInput />;
    case "date":
      return <DateInput />;
    case "dropdown":
      return <Select options={sampleOptions} />;
    case "inline-select":
      return <Radio options={sampleOptions} variant="bubble" />;
    default:
      return <div>no input selected</div>;
  }
}
