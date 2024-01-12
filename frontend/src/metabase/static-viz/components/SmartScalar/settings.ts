import type { RawSeries, VisualizationSettings } from "metabase-types/api";
import { getCommonStaticVizSettings } from "metabase/static-viz/lib/settings";
import type { ComputedVisualizationSettings } from "metabase/visualizations/types";
import { getDefaultColumn } from "metabase/visualizations/lib/settings/utils";
import { VIZ_SETTINGS_DEFAULTS } from "metabase/visualizations/visualizations/SmartScalar/constants";
import {
  getDefaultComparison,
  isSuitableScalarColumn,
} from "metabase/visualizations/visualizations/SmartScalar/utils";

export const computeSmartScalarSettings = (
  rawSeries: RawSeries,
  dashcardSettings: VisualizationSettings,
): ComputedVisualizationSettings => {
  const settings = getCommonStaticVizSettings(rawSeries, dashcardSettings);

  settings["scalar.field"] ??= getDefaultColumn(
    rawSeries,
    settings,
    isSuitableScalarColumn,
  );

  settings["scalar.comparisons"] ??= getDefaultComparison(rawSeries, settings);

  settings["scalar.switch_positive_negative"] ??=
    VIZ_SETTINGS_DEFAULTS["scalar.switch_positive_negative"];

  settings["scalar.compact_primary_number"] ??=
    VIZ_SETTINGS_DEFAULTS["scalar.compact_primary_number"];

  return settings;
};
