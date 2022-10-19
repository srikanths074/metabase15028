import React from "react";
import { t } from "ttag";

import EmptyState from "metabase/components/EmptyState";

import type { DataPickerProps, DataPickerDataType } from "./types";
import type { DataTypeInfoItem } from "./utils";

import CardPicker from "./CardPicker";
import DataTypePicker from "./DataTypePicker";
import RawDataPicker from "./RawDataPicker";

interface DataPickerViewProps extends DataPickerProps {
  dataTypes: DataTypeInfoItem[];
  hasDataAccess: boolean;
  onDataTypeChange: (type: DataPickerDataType) => void;
  onBack?: () => void;
}

function DataPickerView({
  dataTypes,
  hasDataAccess,
  onDataTypeChange,
  ...props
}: DataPickerViewProps) {
  const { value } = props;

  if (!hasDataAccess) {
    return (
      <EmptyState
        message={t`To pick some data, you'll need to add some first`}
        icon="database"
      />
    );
  }

  if (!value.type) {
    return <DataTypePicker types={dataTypes} onChange={onDataTypeChange} />;
  }

  if (value.type === "raw-data") {
    return <RawDataPicker {...props} />;
  }

  if (value.type === "models") {
    return <CardPicker {...props} targetModel="model" />;
  }

  if (value.type === "questions") {
    return <CardPicker {...props} targetModel="question" />;
  }

  return null;
}

export default DataPickerView;
