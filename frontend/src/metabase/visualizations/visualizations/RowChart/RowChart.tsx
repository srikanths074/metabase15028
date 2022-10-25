import React, { useEffect, useMemo } from "react";
import { t } from "ttag";

import _ from "underscore";
import {
  GRAPH_DATA_SETTINGS,
  GRAPH_GOAL_SETTINGS,
} from "metabase/visualizations/lib/settings/graph";
import {
  Dataset,
  DatasetData,
  VisualizationSettings,
} from "metabase-types/api";

import {
  getChartColumns,
  hasValidColumnsSelected,
} from "metabase/visualizations/lib/graph/columns";
import {
  formatColumnValue,
  getFormatters,
  getLabelsFormatter,
} from "metabase/visualizations/visualizations/RowChart/utils/format";
import { measureText } from "metabase/lib/measure-text";
import ExplicitSize from "metabase/components/ExplicitSize";
import {
  getClickData,
  getHoverData,
  getLegendClickData,
} from "metabase/visualizations/visualizations/RowChart/utils/events";

import { getChartTheme } from "metabase/visualizations/visualizations/RowChart/utils/theme";
import { getComputedSettingsForSeries } from "metabase/visualizations/lib/settings/visualization";
import {
  ChartSettingsError,
  MinRowsError,
} from "metabase/visualizations/lib/errors";
import {
  RowChart,
  RowChartProps,
} from "metabase/visualizations/shared/components/RowChart";
import {
  getGroupedDataset,
  getSeries,
  trimData,
} from "metabase/visualizations/shared/utils/data";
import { getChartGoal } from "metabase/visualizations/lib/settings/goal";
import { getTwoDimensionalChartSeries } from "metabase/visualizations/shared/utils/series";
import { getStackOffset } from "metabase/visualizations/lib/settings/stacking";
import { GroupedDatum } from "metabase/visualizations/shared/types/data";
import { IconProps } from "metabase/components/Icon";
import { isDimension, isMetric } from "metabase-lib/lib/types/utils/isa";
import { getChartWarnings } from "./utils/warnings";
import {
  RowVisualizationRoot,
  RowChartContainer,
  RowChartLegendLayout,
  RowLegendCaption,
} from "./RowChart.styled";
import { getLegendItems } from "./utils/legend";
import {
  getAxesVisibility,
  getLabelledSeries,
  getLabels,
  getXValueRange,
} from "./utils/settings";
import { ROW_CHART_AXIS_SETTINGS } from "./utils/settings-definitions";

const RowChartRenderer = ExplicitSize({
  wrapped: true,
  refreshMode: "throttle",
  selector: false,
})((props: RowChartProps<GroupedDatum>) => (
  <RowChartContainer>
    <RowChart {...props} />
  </RowChartContainer>
));

interface RowChartVisualizationProps {
  className: string;
  width: number;
  height: number;
  data: DatasetData;
  settings: VisualizationSettings;
  visualizationIsClickable: (data: Record<string, unknown>) => boolean;
  onVisualizationClick: (data: Record<string, unknown>) => void;
  card: any;
  isPlaceholder?: boolean;
  hovered: any;
  headerIcon: IconProps;
  actionButtons: React.ReactNode;
  isFullscreen: boolean;
  isQueryBuilder: boolean;
  showTitle: boolean;
  onRender: (data: Record<string, unknown>) => void;
  onHoverChange: (data: Record<string, unknown> | null) => void;
  onChangeCardAndRun: (data: Record<string, unknown>) => void;
}

const RowChartVisualization = ({
  card,
  className,
  settings,
  data,
  visualizationIsClickable,
  onVisualizationClick,
  isPlaceholder,
  hovered,
  headerIcon,
  actionButtons,
  isFullscreen,
  isQueryBuilder,
  onRender,
  onHoverChange,
  showTitle,
  onChangeCardAndRun,
}: RowChartVisualizationProps) => {
  const { chartColumns, series, seriesColors } = useMemo(
    () => getTwoDimensionalChartSeries(data, settings, formatColumnValue),
    [data, settings],
  );

  const groupedData = useMemo(
    () => getGroupedDataset(data, chartColumns, formatColumnValue),
    [chartColumns, data],
  );
  const goal = useMemo(() => getChartGoal(settings), [settings]);
  const theme = useMemo(getChartTheme, []);
  const stackOffset = getStackOffset(settings);

  const chartWarnings = useMemo(
    () => getChartWarnings(chartColumns, data.rows),
    [chartColumns, data.rows],
  );

  useEffect(
    function warnOnRendered() {
      !isPlaceholder && onRender({ warnings: chartWarnings });
    },
    [chartWarnings, isPlaceholder, onRender],
  );

  const tickFormatters = useMemo(
    () => getFormatters(chartColumns, settings),
    [chartColumns, settings],
  );

  const labelsFormatter = useMemo(
    () => getLabelsFormatter(chartColumns, settings),
    [chartColumns, settings],
  );

  const handleClick = (
    event: React.MouseEvent,
    seriesIndex: number,
    datumIndex: number,
  ) => {
    const clickData = getClickData(
      seriesIndex,
      datumIndex,
      series,
      groupedData,
      settings,
      chartColumns,
      data.cols,
    );

    if (!visualizationIsClickable(clickData)) {
      return;
    }

    onVisualizationClick({ ...clickData, element: event.target });
  };

  const handleHover = (
    event: React.MouseEvent,
    seriesIndex: number | null,
    datumIndex: number | null,
  ) => {
    if (seriesIndex == null || datumIndex == null) {
      onHoverChange(null);
      return;
    }
    const hoverData = getHoverData(
      seriesIndex,
      datumIndex,
      series,
      groupedData,
      settings,
      chartColumns,
      data.cols,
    );
    onHoverChange({
      ...hoverData,
      event: event.nativeEvent,
      element: event.target,
    });
  };

  const openQuestion = () => {
    if (onChangeCardAndRun) {
      onChangeCardAndRun({
        nextCard: card,
        seriesIndex: 0,
      });
    }
  };

  const handleSelectSeries = (event: React.MouseEvent, seriesIndex: number) => {
    const clickData = getLegendClickData(
      seriesIndex,
      series,
      settings,
      chartColumns,
    );

    if ("breakout" in chartColumns && visualizationIsClickable(clickData)) {
      onVisualizationClick({
        ...clickData,
        element: event.currentTarget,
      });
    } else {
      openQuestion();
    }
  };

  const hoverData =
    hovered?.index != null
      ? {
          seriesIndex: hovered?.index,
          datumIndex: hovered?.datumIndex,
        }
      : null;

  const hasTitle = showTitle && settings["card.title"];
  const title = settings["card.title"] || card.name;
  const description = settings["card.description"];
  const canSelectTitle = !!onChangeCardAndRun;

  const { labels, colors } = useMemo(
    () => getLegendItems(series, seriesColors, settings),
    [series, seriesColors, settings],
  );

  const { xLabel, yLabel } = useMemo(() => getLabels(settings), [settings]);

  const xValueRange = useMemo(() => getXValueRange(settings), [settings]);

  const labelledSeries = useMemo(
    () => getLabelledSeries(settings, series),
    [series, settings],
  );

  const { hasXAxis, hasYAxis } = useMemo(
    () => getAxesVisibility(settings),
    [settings],
  );

  return (
    <RowVisualizationRoot className={className} isQueryBuilder={isQueryBuilder}>
      {hasTitle && (
        <RowLegendCaption
          title={title}
          description={description}
          icon={headerIcon}
          actionButtons={actionButtons}
          onSelectTitle={canSelectTitle ? openQuestion : undefined}
        />
      )}
      <RowChartLegendLayout
        hasLegend={series.length > 1}
        labels={labels}
        colors={colors}
        actionButtons={!hasTitle ? actionButtons : undefined}
        hovered={hovered}
        onHoverChange={onHoverChange}
        isFullscreen={isFullscreen}
        isQueryBuilder={isQueryBuilder}
        onSelectSeries={handleSelectSeries}
      >
        <RowChartRenderer
          className="flex-full"
          data={groupedData}
          trimData={trimData}
          series={series}
          seriesColors={seriesColors}
          goal={goal}
          theme={theme}
          stackOffset={stackOffset}
          tickFormatters={tickFormatters}
          labelsFormatter={labelsFormatter}
          measureText={measureText}
          hoveredData={hoverData}
          onClick={handleClick}
          onHover={handleHover}
          xLabel={xLabel}
          yLabel={yLabel}
          xScaleType={settings["graph.y_axis.scale"]}
          xValueRange={xValueRange}
          labelledSeries={labelledSeries}
          hasXAxis={hasXAxis}
          hasYAxis={hasYAxis}
        />
      </RowChartLegendLayout>
    </RowVisualizationRoot>
  );
};

RowChartVisualization.uiName = t`Row`;
RowChartVisualization.identifier = "row";
RowChartVisualization.iconName = "horizontal_bar";
RowChartVisualization.noun = t`row chart`;

RowChartVisualization.noHeader = true;
RowChartVisualization.minSize = { width: 5, height: 4 };

const stackingSettings = {
  "stackable.stack_type": {
    section: t`Display`,
    title: t`Stacking`,
    widget: "radio",
    default: null,
    props: {
      options: [
        { name: t`Don't stack`, value: null },
        { name: t`Stack`, value: "stacked" },
        { name: t`Stack - 100%`, value: "normalized" },
      ],
    },
  },
};

RowChartVisualization.settings = {
  ...stackingSettings,
  "graph.show_values": {
    section: t`Display`,
    title: t`Show values on data points`,
    widget: "toggle",
    getHidden: (_series: any[], vizSettings: VisualizationSettings) =>
      vizSettings["stackable.stack_type"] === "normalized",
    default: false,
  },
  "graph.label_value_formatting": {
    section: t`Display`,
    title: t`Value labels formatting`,
    widget: "segmentedControl",
    getHidden: (_series: any, vizSettings: any) =>
      vizSettings["graph.show_values"] !== true ||
      vizSettings["stackable.stack_type"] === "normalized",
    props: {
      options: [
        { name: t`Compact`, value: "compact" },
        { name: t`Full`, value: "full" },
      ],
    },
    default: "full",
    readDependencies: ["graph.show_values"],
  },
  ...GRAPH_GOAL_SETTINGS,
  ...GRAPH_DATA_SETTINGS,
  ...ROW_CHART_AXIS_SETTINGS,
};

RowChartVisualization.isSensible = ({ cols, rows }: DatasetData) => {
  return (
    rows.length > 1 &&
    cols.length >= 2 &&
    cols.filter(isDimension).length > 0 &&
    cols.filter(isMetric).length > 0
  );
};

RowChartVisualization.isLiveResizable = (series: any[]) => {
  const totalRows = series.reduce((sum, s) => sum + s.data.rows.length, 0);
  return totalRows < 10;
};

RowChartVisualization.settings["graph.metrics"] = {
  ...RowChartVisualization.settings["graph.metrics"],
  title: t`X-axis`,
};
RowChartVisualization.settings["graph.dimensions"] = {
  ...RowChartVisualization.settings["graph.dimensions"],
  title: t`Y-axis`,
};

/**
 * Required to make it compatible with series settings without rewriting them fully
 * It expands a single card + dataset into multiple "series" and sets _seriesKey which is needed for settings to work
 */
RowChartVisualization.transformSeries = (originalMultipleSeries: any) => {
  const [series] = originalMultipleSeries;
  const settings: any = getComputedSettingsForSeries(originalMultipleSeries);
  const { card, data } = series;

  if (series.card._transformed || !hasValidColumnsSelected(settings, data)) {
    return originalMultipleSeries;
  }

  const chartColumns = getChartColumns(data, settings);

  const computedSeries = getSeries(data, chartColumns, formatColumnValue).map(
    ({ seriesKey, seriesName }) => {
      const seriesCard = {
        ...card,
        name: seriesName,
        _seriesKey: seriesKey,
        _transformed: true,
      };
      return { card: seriesCard, data };
    },
  );

  return computedSeries.length > 0 ? computedSeries : originalMultipleSeries;
};

RowChartVisualization.checkRenderable = (
  series: any[],
  settings: VisualizationSettings,
) => {
  if (!hasValidColumnsSelected(settings, series[0].data)) {
    throw new ChartSettingsError(
      t`Which fields do you want to use for the Y and X axes?`,
      { section: t`Data` },
      t`Choose fields`,
    );
  }

  if (
    settings["stackable.stack_type"] === "normalized" &&
    settings["graph.y_axis.scale"] === "log"
  ) {
    throw new Error(
      t`It is not possible to use the Log scale with a stacked percentage scale`,
    );
  }

  const singleSeriesHasNoRows = ({ data: { rows } }: Dataset) =>
    rows.length < 1;
  if (_.every(series, singleSeriesHasNoRows)) {
    throw new MinRowsError(1, 0);
  }
};

RowChartVisualization.placeholderSeries = [
  {
    card: {
      display: "row",
      visualization_settings: {
        "graph.metrics": ["x"],
        "graph.dimensions": ["y"],
      },
      dataset_query: { type: "null" },
    },
    data: {
      rows: _.range(0, 11).map(i => [i, i]),
      cols: [
        { name: "x", base_type: "type/Integer" },
        { name: "y", base_type: "type/Integer" },
      ],
    },
  },
];

export default RowChartVisualization;
