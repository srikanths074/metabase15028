import type { ComputedVisualizationSettings } from "metabase/visualizations/types";
import type { RawSeries, VisualizationSettings } from "metabase-types/api";
import { getDefaultDimensionAndMetric } from "metabase/visualizations/lib/utils";
import { getCommonStaticVizSettings } from "metabase/static-viz/lib/settings";

export const computeFunnelBarChartSettings = (
  rawSeries: RawSeries,
  dashcardSettings: VisualizationSettings,
): ComputedVisualizationSettings => {
  const defaultColumns = getDefaultDimensionAndMetric(rawSeries);

  const settings = getCommonStaticVizSettings(rawSeries, dashcardSettings);

  settings["funnel.dimension"] ??= defaultColumns.dimension;
  settings["funnel.metric"] ??= defaultColumns.metric;

  return settings;
};
