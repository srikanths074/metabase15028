import type { ClickObject } from "metabase-lib";
import {
  findColumnIndexesForColumnSettings,
  findColumnSettingIndexesForColumns,
} from "metabase-lib/v1/queries/utils/dataset";
import { getColumnKey } from "metabase-lib/v1/queries/utils/get-column-key";
import type { Dataset, VisualizationSettings } from "metabase-types/api";

export function syncColumnSettings(
  settings: VisualizationSettings,
  queryResults?: Dataset,
  prevQueryResults?: Dataset,
  clicked?: ClickObject,
): VisualizationSettings {
  let newSettings = settings;

  if (queryResults && !queryResults.error) {
    newSettings = syncTableColumnSettings(newSettings, queryResults);

    if (clicked) {
      newSettings = syncTableColumnSettingsAfterClickAction(
        newSettings,
        settings,
        clicked,
      );
    }

    if (prevQueryResults && !prevQueryResults.error) {
      newSettings = syncGraphMetricSettings(
        newSettings,
        queryResults,
        prevQueryResults,
      );
    }
  }

  return newSettings;
}

function syncTableColumnSettings(
  settings: VisualizationSettings,
  { data }: Dataset,
): VisualizationSettings {
  // "table.columns" receive a value only if there are custom settings
  // e.g. some columns are hidden. If it's empty, it means everything is visible
  const columnSettings = settings["table.columns"] ?? [];
  if (columnSettings.length === 0) {
    return settings;
  }

  // remove columns used for remapping only
  const cols = data.cols.filter(col => col.remapped_from == null);
  const columnIndexes = findColumnIndexesForColumnSettings(
    cols,
    columnSettings,
  );
  const columnSettingIndexes = findColumnSettingIndexesForColumns(
    cols,
    columnSettings,
  );
  const addedColumns = cols.filter((col, colIndex) => {
    const hasVizSettings = columnSettingIndexes[colIndex] >= 0;
    return !hasVizSettings;
  });
  const existingColumnSettings = columnSettings.filter(
    (setting, settingIndex) => columnIndexes[settingIndex] >= 0,
  );
  const noColumnsRemoved =
    existingColumnSettings.length === columnSettings.length;

  if (noColumnsRemoved && addedColumns.length === 0) {
    return settings;
  }

  const addedColumnSettings = addedColumns.map(col => ({
    name: col.name,
    key: getColumnKey(col),
    fieldRef: col.field_ref,
    enabled: true,
  }));
  return {
    ...settings,
    "table.columns": [...existingColumnSettings, ...addedColumnSettings],
  };
}

function syncTableColumnSettingsAfterClickAction(
  settings: VisualizationSettings,
  prevSettings: VisualizationSettings,
  { column }: ClickObject,
): VisualizationSettings {
  if (!column) {
    return settings;
  }

  const columnSettings = settings["table.columns"] ?? [];
  const prevColumnSettings = prevSettings["table.columns"] ?? [];
  const addedColumnCount = columnSettings.length - prevColumnSettings.length;
  const [columnSettingIndex] = findColumnSettingIndexesForColumns(
    [column],
    columnSettings,
  );
  if (addedColumnCount <= 0 || columnSettingIndex < 0) {
    return settings;
  }

  return {
    ...settings,
    "table.columns": [
      ...columnSettings.slice(0, columnSettingIndex + 1), // before the selected column
      ...columnSettings.slice(-addedColumnCount), // new columns
      ...columnSettings.slice(columnSettingIndex + 1, -addedColumnCount), // after the selected column
    ],
  };
}

function syncGraphMetricSettings(
  settings: VisualizationSettings,
  { data: { cols } }: Dataset,
  { data: { cols: prevCols } }: Dataset,
): VisualizationSettings {
  const graphMetrics = settings["graph.metrics"];
  if (!graphMetrics) {
    return settings;
  }

  const hasNativeColumns =
    cols.some(column => column.source === "native") ||
    prevCols.some(column => column.source === "native");
  if (hasNativeColumns) {
    return settings;
  }

  const metricColumnNames = new Set(
    cols
      .filter(column => column.source === "aggregation")
      .map(column => column.name),
  );
  const prevMetricColumnNames = new Set(
    prevCols
      .filter(column => column.source === "aggregation")
      .map(column => column.name),
  );
  const addedMetricColumnNames = new Set(
    [...metricColumnNames].filter(name => !prevMetricColumnNames.has(name)),
  );
  const removedMetricColumnNames = new Set(
    [...prevMetricColumnNames].filter(name => !metricColumnNames.has(name)),
  );
  if (
    addedMetricColumnNames.size === 0 &&
    removedMetricColumnNames.size === 0
  ) {
    return settings;
  }

  return {
    ...settings,
    "graph.metrics": [
      ...graphMetrics.filter(name => !removedMetricColumnNames.has(name)),
      ...addedMetricColumnNames,
    ],
  };
}
