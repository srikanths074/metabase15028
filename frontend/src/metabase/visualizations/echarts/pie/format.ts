import { computeMaxDecimalsForValues } from "metabase/visualizations/lib/utils";
import type {
  ComputedVisualizationSettings,
  RenderingContext,
} from "metabase/visualizations/types";

import type { PieChartModel } from "./model/types";

export interface PieChartFormatters {
  formatMetric: (value: unknown) => string;
  formatPercent: (value: unknown) => string;
}

export function getPieChartFormatters(
  chartModel: PieChartModel,
  settings: ComputedVisualizationSettings,
  renderingContext: RenderingContext,
): PieChartFormatters {
  const { column: getColumnSettings } = settings;
  if (!getColumnSettings) {
    throw Error(`"settings.column" is undefined`);
  }
  const metricColSettings = getColumnSettings(
    chartModel.colDescs.metricDesc.column,
  );

  const formatMetric = (value: unknown) =>
    renderingContext.formatValue(value, {
      ...metricColSettings,
    });

  const formatPercent = (value: unknown) =>
    renderingContext.formatValue(value, {
      column: metricColSettings.column,
      number_separators: metricColSettings.number_separators as string,
      number_style: "percent",
      decimals: computeMaxDecimalsForValues(
        chartModel.slices.map(s => s.normalizedPercentage),
        {
          style: "percent",
          maximumSignificantDigits: 2,
        },
      ),
    });

  return { formatMetric, formatPercent };
}
