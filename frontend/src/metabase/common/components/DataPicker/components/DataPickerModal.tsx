import { skipToken } from "@reduxjs/toolkit/dist/query";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "ttag";
import _ from "underscore";

import { tableApi } from "metabase/api";

import type { EntityPickerOptions, EntityTab } from "../../EntityPicker";
import { EntityPickerModal, defaultOptions } from "../../EntityPicker";
import type {
  NotebookDataPickerItem,
  NotebookDataPickerValueItem,
  Value,
} from "../types";

import { TablePicker } from "./TablePicker";

interface Props {
  title?: string;
  onChange: (item: Value) => void;
  onClose: () => void;
  options?: EntityPickerOptions;
  value: Value | null;
}

export const DataPickerModal = ({
  options = defaultOptions,
  title = t`Pick your starting data`,
  value,
  onChange,
  onClose,
}: Props) => {
  const [selectedItem, setSelectedItem] =
    useState<NotebookDataPickerValueItem | null>(null);
  const [valueId, setValueId] = useState<
    NotebookDataPickerValueItem["id"] | undefined
  >(value?.id);

  const shouldFetchNewMetadata = valueId != null && valueId !== value?.id;
  const { data: table } = tableApi.useFetchMetadataQuery(
    shouldFetchNewMetadata ? { id: valueId } : skipToken,
  );

  useEffect(() => {
    if (table) {
      onChange(table);
      onClose();
    }
  }, [table, onChange, onClose]);

  const pickerRef = useRef<{
    onFolderSelect: (item: { folder: NotebookDataPickerItem }) => void;
  }>();

  const handleItemSelect = useCallback(
    (item: NotebookDataPickerValueItem) => {
      if (options.hasConfirmButtons) {
        setSelectedItem(item);
      } else {
        setValueId(item.id);
      }
    },
    [options],
  );

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
          ref={pickerRef}
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
      title={title}
      onClose={onClose}
      onConfirm={_.noop}
      onItemSelect={handleItemSelect}
    />
  );
};
