import { useCallback, useMemo, useState } from "react";
import { t } from "ttag";

import { useSetting } from "metabase/common/hooks";
import { getQuestionVirtualTableId } from "metabase-lib/v1/metadata/utils/saved-questions";
import type {
  CollectionItemModel,
  DatabaseId,
  RecentContexts,
  RecentItem,
  TableId,
} from "metabase-types/api";

import type { EntityTab } from "../../EntityPicker";
import { EntityPickerModal, defaultOptions } from "../../EntityPicker";
import { useLogRecentItem } from "../../EntityPicker/hooks/use-log-recent-item";
import type { QuestionPickerItem } from "../../QuestionPicker";
import { QuestionPicker } from "../../QuestionPicker";
import { useAvailableData } from "../hooks";
import type {
  DataPickerModalOptions,
  DataPickerValue,
  NotebookDataPickerFolderItem,
  NotebookDataPickerItem,
  NotebookDataPickerValueItem,
} from "../types";
import {
  createShouldShowItem,
  isFolderItem,
  isMetricItem,
  isModelItem,
  isQuestionItem,
  isTableItem,
  isValueItem,
} from "../utils";

import { TablePicker } from "./TablePicker";

interface Props {
  /**
   * Limit selection to a particular database
   */
  databaseId?: DatabaseId;
  title: string;
  value: DataPickerValue | undefined;
  models?: DataPickerValue["model"][];
  onChange: (value: TableId) => void;
  onClose: () => void;
}

const QUESTION_PICKER_MODELS: CollectionItemModel[] = ["card"];

const MODEL_PICKER_MODELS: CollectionItemModel[] = ["dataset"];

const METRIC_PICKER_MODELS: CollectionItemModel[] = ["metric"];

const RECENTS_CONTEXT: RecentContexts[] = ["selections"];

const options: DataPickerModalOptions = {
  ...defaultOptions,
  hasConfirmButtons: false,
  showPersonalCollections: true,
  showRootCollection: true,
  hasRecents: true,
};

export const DataPickerModal = ({
  databaseId,
  title,
  value,
  models = ["table", "card", "dataset"],
  onChange,
  onClose,
}: Props) => {
  const hasNestedQueriesEnabled = useSetting("enable-nested-queries");
  const { hasQuestions, hasModels, hasMetrics } = useAvailableData({
    databaseId,
  });
  const [tab, setTab] = useState<string>();
  const [folderItem, setFolderItem] = useState<NotebookDataPickerFolderItem>();
  const { tryLogRecentItem } = useLogRecentItem();

  const modelsShouldShowItem = useMemo(() => {
    return createShouldShowItem(["dataset"], databaseId);
  }, [databaseId]);

  const metricsShouldShowItem = useMemo(() => {
    return createShouldShowItem(["metric"], databaseId);
  }, [databaseId]);

  const questionsShouldShowItem = useMemo(() => {
    return createShouldShowItem(["card"], databaseId);
  }, [databaseId]);

  const recentFilter = useCallback(
    (recentItems: RecentItem[]) => {
      if (databaseId) {
        return recentItems.filter(
          item => "database_id" in item && item.database_id === databaseId,
        );
      }

      return recentItems;
    },
    [databaseId],
  );

  const searchParams = useMemo(() => {
    return databaseId ? { table_db_id: databaseId } : undefined;
  }, [databaseId]);

  const handleItemSelect = useCallback(
    (item: NotebookDataPickerItem) => {
      if (isFolderItem(item)) {
        setFolderItem(item);
      } else if (isValueItem(item)) {
        const id =
          item.model === "table" ? item.id : getQuestionVirtualTableId(item.id);
        onChange(id);
        tryLogRecentItem(item);
        onClose();
      }
    },
    [onChange, onClose, tryLogRecentItem],
  );

  const handleCardSelect = useCallback(
    (item: QuestionPickerItem) => {
      // see comment for QuestionPickerItem type definition to see why we need this cast
      handleItemSelect(item as NotebookDataPickerItem);
    },
    [handleItemSelect],
  );

  const tabs: EntityTab<NotebookDataPickerValueItem["model"]>[] = [
    hasModels && hasNestedQueriesEnabled
      ? {
          displayName: t`Models`,
          model: "dataset" as const,
          icon: "model",
          element: (
            <QuestionPicker
              initialValue={isModelItem(value) ? value : undefined}
              models={MODEL_PICKER_MODELS}
              options={options}
              shouldShowItem={modelsShouldShowItem}
              onItemSelect={handleCardSelect}
            />
          ),
        }
      : undefined,
    hasMetrics && hasNestedQueriesEnabled
      ? {
          displayName: t`Metrics`,
          model: "metric" as const,
          icon: "metric",
          element: (
            <QuestionPicker
              initialValue={isMetricItem(value) ? value : undefined}
              models={METRIC_PICKER_MODELS}
              options={options}
              shouldShowItem={metricsShouldShowItem}
              onItemSelect={handleCardSelect}
            />
          ),
        }
      : undefined,
    {
      displayName: t`Tables`,
      model: "table" as const,
      icon: "table",
      element: (
        <TablePicker
          databaseId={databaseId}
          value={isTableItem(value) ? value : undefined}
          onItemSelect={handleItemSelect}
        />
      ),
    },
    hasQuestions && hasNestedQueriesEnabled
      ? {
          displayName: t`Saved questions`,
          model: "card" as const,
          icon: "folder",
          element: (
            <QuestionPicker
              initialValue={isQuestionItem(value) ? value : undefined}
              models={QUESTION_PICKER_MODELS}
              options={options}
              shouldShowItem={questionsShouldShowItem}
              onItemSelect={handleCardSelect}
            />
          ),
        }
      : undefined,
  ].filter(
    (tab): tab is EntityTab<NotebookDataPickerValueItem["model"]> =>
      tab != null && models.includes(tab.model),
  );

  return (
    <EntityPickerModal
      canSelectItem
      defaultToRecentTab={false}
      initialValue={value}
      options={options}
      recentsContext={RECENTS_CONTEXT}
      recentFilter={recentFilter}
      searchParams={searchParams}
      selectedItem={value ?? null}
      tabs={tabs}
      title={title}
      onClose={onClose}
      onItemSelect={handleItemSelect}
      onTabChange={setTab}
    />
  );
};
