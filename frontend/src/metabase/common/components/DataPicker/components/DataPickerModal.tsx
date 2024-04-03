import { useCallback, useEffect, useState } from "react";
import { t } from "ttag";
import _ from "underscore";

import { useTableQuery } from "metabase/common/hooks";
import type { CollectionId } from "metabase-types/api";

import type {
  EntityPickerModalOptions,
  EntityPickerOptions,
  EntityTab,
} from "../../EntityPicker";
import { EntityPickerModal, defaultOptions } from "../../EntityPicker";
import type { NotebookDataPickerValueItem, TablePickerValue } from "../types";

import { TablePicker } from "./TablePicker";

interface Props {
  collectionId: CollectionId | null | undefined; // TODO: use it
  onChange: (value: TablePickerValue) => void;
  onClose: () => void;
  options?: EntityPickerOptions;
  value: TablePickerValue | null;
}

const options: EntityPickerModalOptions = {
  ...defaultOptions,
  hasConfirmButtons: false,
};

const isValueEqual = (
  value1: TablePickerValue | null,
  value2: TablePickerValue | null,
) => {
  if (!value1 || !value2) {
    return value1 === value2;
  }

  return (
    value1.db_id === value2.db_id &&
    value1.id === value2.id &&
    value1.schema === value2.schema
  );
};

export const DataPickerModal = ({ value, onChange, onClose }: Props) => {
  const [selectedItem, setSelectedItem] =
    useState<NotebookDataPickerValueItem | null>(null);
  const [valueId, setValueId] = useState<
    NotebookDataPickerValueItem["id"] | undefined
  >(value?.id);

  const shouldFetchNewMetadata = valueId != null && valueId !== value?.id;
  // TODO: using RTK is difficult because parent component does not use the same cache
  // const { data: table } = tableApi.useFetchMetadataQuery(
  //   shouldFetchNewMetadata ? { id: valueId } : skipToken,
  // );
  const { data: table } = useTableQuery({
    id: valueId,
    enabled: shouldFetchNewMetadata,
  });

  useEffect(() => {
    if (table) {
      const valueFromTable = {
        db_id: table.db_id,
        id: table.id,
        schema: table.schema_name,
      };

      if (!isValueEqual(value, valueFromTable)) {
        onChange(valueFromTable);
        onClose();
      }
    }
  }, [table, value, onChange, onClose]);

  const handleItemSelect = useCallback((item: NotebookDataPickerValueItem) => {
    setValueId(item.id);
    setSelectedItem(item);
  }, []);

  const tabs: [
    EntityTab<NotebookDataPickerValueItem["model"]>,
    ...EntityTab<NotebookDataPickerValueItem["model"]>[],
  ] = [
    // {
    //   displayName: t`Models`,
    //   model: "dataset",
    //   icon: "model",
    //   element: (
    //     <NotebookDataPicker
    //       value={value}
    //       options={options}
    //       ref={pickerRef}
    //       onItemSelect={handleItemSelect}
    //     />
    //   ),
    // },
    {
      displayName: t`Tables`,
      model: "table",
      icon: "table",
      element: (
        <TablePicker
          options={options}
          value={value}
          onItemSelect={handleItemSelect}
        />
      ),
    },
    // {
    //   displayName: t`Saved questions`,
    //   model: "card",
    //   icon: "folder",
    //   element: (
    //     <NotebookDataPicker
    //       value={value}
    //       options={options}
    //       ref={pickerRef}
    //       onItemSelect={handleItemSelect}
    //     />
    //   ),
    // },
  ];

  return (
    <EntityPickerModal
      canSelectItem
      options={options}
      selectedItem={selectedItem}
      tabs={tabs}
      title={t`Pick your starting data`}
      onClose={onClose}
      onConfirm={_.noop} // TODO allow undefined
      onItemSelect={handleItemSelect}
    />
  );
};
