import React, { useState } from "react";
import Heading from "metabase/components/type/Heading";
import Subhead from "metabase/components/type/Subhead";
import Text from "metabase/components/type/Text";
import {
  STATIC_CHART_TYPES,
  STATIC_CHART_DEFAULT_OPTIONS,
} from "metabase/static-viz/containers/StaticChart/constants";
import StaticChart from "metabase/static-viz/containers/StaticChart";
import { PageRoot, PageSection } from "./StaticVizPage.styled";
import {
  TIME_SERIES_LINE_CHART_DEFAULT_OPTIONS,
  TIME_SERIES_LINE_CHART_TYPE,
} from "../../static-viz/components/TimeSeriesLineChart/constants";
import {
  TIME_SERIES_AREA_CHART_DEFAULT_OPTIONS,
  TIME_SERIES_AREA_CHART_TYPE,
} from "../../static-viz/components/TimeSeriesAreaChart/constants";
import {
  TIME_SERIES_BAR_CHART_DEFAULT_OPTIONS,
  TIME_SERIES_BAR_CHART_TYPE,
} from "../../static-viz/components/TimeSeriesBarChart/constants";
import {
  CATEGORICAL_LINE_CHART_DEFAULT_OPTIONS,
  CATEGORICAL_LINE_CHART_TYPE,
} from "../../static-viz/components/CategoricalLineChart/constants";
import {
  CATEGORICAL_AREA_CHART_DEFAULT_OPTIONS,
  CATEGORICAL_AREA_CHART_TYPE,
} from "../../static-viz/components/CategoricalAreaChart/constants";
import {
  CATEGORICAL_BAR_CHART_DEFAULT_OPTIONS,
  CATEGORICAL_BAR_CHART_TYPE,
} from "../../static-viz/components/CategoricalBarChart/constants";
import {
  CATEGORICAL_DONUT_CHART_DEFAULT_OPTIONS,
  CATEGORICAL_DONUT_CHART_TYPE,
} from "../../static-viz/components/CategoricalDonutChart/constants";
import {
  PROGRESS_BAR_DEFAULT_DATA_1,
  PROGRESS_BAR_DEFAULT_DATA_2,
  PROGRESS_BAR_DEFAULT_DATA_3,
  PROGRESS_BAR_DEFAULT_DATA_4,
  PROGRESS_BAR_TYPE,
} from "../../static-viz/components/ProgressBar/constants";
import {
  TIME_SERIES_WATERFALL_CHART_DEFAULT_OPTIONS,
  TIME_SERIES_WATERFALL_CHART_TYPE,
} from "../../static-viz/components/TimeSeriesWaterfallChart/constants";
import {
  CATEGORICAL_WATERFALL_CHART_DEFAULT_OPTIONS,
  CATEGORICAL_WATERFALL_CHART_TYPE,
} from "../../static-viz/components/CategoricalWaterfallChart/constants";
import {
  FUNNEL_CHART_DEFAULT_OPTIONS,
  FUNNEL_CHART_TYPE,
} from "../../static-viz/components/FunnelChart/constants";
import {
  LINE_AREA_BAR_CHART_TYPE,
  LINE_AREA_BAR_DEFAULT_OPTIONS_1,
  LINE_AREA_BAR_DEFAULT_OPTIONS_2,
  LINE_AREA_BAR_DEFAULT_OPTIONS_3,
  LINE_AREA_BAR_DEFAULT_OPTIONS_4,
  LINE_AREA_BAR_DEFAULT_OPTIONS_5,
  LINE_AREA_BAR_DEFAULT_OPTIONS_6,
  LINE_AREA_BAR_DEFAULT_OPTIONS_7,
} from "../../static-viz/components/LineAreaBarChart/constants";

function setAccessorsForChartOptions(index, options) {
  return {
    ...options,
    accessors: STATIC_CHART_DEFAULT_OPTIONS[index].accessors,
  };
}

export default function StaticVizPage() {
  const [staticChartTypeIndex, setStaticChartTypeIndex] = useState(-1);
  const [staticChartType, setStaticChartType] = useState(null);
  const [staticChartCustomOptions, setStaticChartCustomOptions] = useState(
    null,
  );

  return (
    <PageRoot>
      <div className="wrapper wrapper--trim">
        <Heading>Static Visualisations</Heading>
        <Text>
          These visualizations are used in dashboard subscriptions. They have no
          interactivity and get generated by the backend to be sent to Slack or
          in emails. You can use this playground to work on the source code in
          /static-viz/ and see the effects. You might need to hard refresh to
          see updates.
        </Text>

        <PageSection>
          <Subhead>Chart tester</Subhead>

          <select
            className="w-full mt1"
            onChange={e => {
              const index = parseInt(e.target.value);
              setStaticChartTypeIndex(index);
              setStaticChartType(STATIC_CHART_TYPES[index]);
              const chartOptions = { ...STATIC_CHART_DEFAULT_OPTIONS[index] };
              delete chartOptions["accessors"];
              setStaticChartCustomOptions(chartOptions);
            }}
          >
            <option id="">---</option>
            {STATIC_CHART_TYPES.map((chartType, chartTypeIndex) => (
              <option key={chartType} value={chartTypeIndex}>
                {chartType}
              </option>
            ))}
          </select>

          {staticChartType && staticChartCustomOptions && (
            <StaticChart
              type={staticChartType}
              options={setAccessorsForChartOptions(
                staticChartTypeIndex,
                staticChartCustomOptions,
              )}
            />
          )}

          {staticChartCustomOptions && (
            <textarea
              className="w-full mt1"
              value={JSON.stringify(staticChartCustomOptions, null, 2)}
              onChange={e => {
                const chartOptions = JSON.parse(e.target.value);
                delete chartOptions["accessors"];
                setStaticChartCustomOptions(chartOptions);
              }}
            />
          )}
        </PageSection>

        <PageSection>
          <Subhead>Line chart with timeseries data</Subhead>
          <StaticChart
            type={TIME_SERIES_LINE_CHART_TYPE}
            options={TIME_SERIES_LINE_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
        <PageSection>
          <Subhead>Area chart with timeseries data</Subhead>
          <StaticChart
            type={TIME_SERIES_AREA_CHART_TYPE}
            options={TIME_SERIES_AREA_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
        <PageSection>
          <Subhead>Bar chart with timeseries data</Subhead>
          <StaticChart
            type={TIME_SERIES_BAR_CHART_TYPE}
            options={TIME_SERIES_BAR_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>

        <PageSection>
          <Subhead>Line chart with categorical data</Subhead>
          <StaticChart
            type={CATEGORICAL_LINE_CHART_TYPE}
            options={CATEGORICAL_LINE_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
        <PageSection>
          <Subhead>Area chart with categorical data</Subhead>
          <StaticChart
            type={CATEGORICAL_AREA_CHART_TYPE}
            options={CATEGORICAL_AREA_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
        <PageSection>
          <Subhead>Bar chart with categorical data</Subhead>
          <StaticChart
            type={CATEGORICAL_BAR_CHART_TYPE}
            options={CATEGORICAL_BAR_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
        <PageSection>
          <Subhead>Donut chart with categorical data</Subhead>
          <StaticChart
            type={CATEGORICAL_DONUT_CHART_TYPE}
            options={CATEGORICAL_DONUT_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
        <PageSection>
          <Subhead>Progress bar</Subhead>
          <StaticChart
            type={PROGRESS_BAR_TYPE}
            options={PROGRESS_BAR_DEFAULT_DATA_1}
          />
          <StaticChart
            type={PROGRESS_BAR_TYPE}
            options={PROGRESS_BAR_DEFAULT_DATA_2}
          />
          <StaticChart
            type={PROGRESS_BAR_TYPE}
            options={PROGRESS_BAR_DEFAULT_DATA_3}
          />
          <StaticChart
            type={PROGRESS_BAR_TYPE}
            options={PROGRESS_BAR_DEFAULT_DATA_4}
          />
        </PageSection>
        <PageSection>
          <Subhead>Waterfall chart with timeseries data and no total</Subhead>
          <StaticChart
            type={TIME_SERIES_WATERFALL_CHART_TYPE}
            options={TIME_SERIES_WATERFALL_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
        <PageSection>
          <Subhead>Waterfall chart with categorical data and total</Subhead>
          <StaticChart
            type={CATEGORICAL_WATERFALL_CHART_TYPE}
            options={CATEGORICAL_WATERFALL_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
        <PageSection>
          <Subhead>Line/Area/Bar chart with multiple series</Subhead>
          <StaticChart
            type={LINE_AREA_BAR_CHART_TYPE}
            options={LINE_AREA_BAR_DEFAULT_OPTIONS_1}
          />
        </PageSection>

        <PageSection>
          <Subhead>
            Line/Area/Bar chart with negative values, different X ranges, and
            right Y-axis
          </Subhead>
          <StaticChart
            type={LINE_AREA_BAR_CHART_TYPE}
            options={LINE_AREA_BAR_DEFAULT_OPTIONS_2}
          />
        </PageSection>

        <PageSection>
          <Subhead>
            Combo chart with ordinal X-axis and more than 10 ticks
          </Subhead>
          <StaticChart
            type={LINE_AREA_BAR_CHART_TYPE}
            options={LINE_AREA_BAR_DEFAULT_OPTIONS_3}
          />
        </PageSection>

        <PageSection>
          <Subhead>Stacked area chart</Subhead>
          <StaticChart
            type={LINE_AREA_BAR_CHART_TYPE}
            options={LINE_AREA_BAR_DEFAULT_OPTIONS_4}
          />
        </PageSection>

        <PageSection>
          <Subhead>Ordinal chart with 48 items</Subhead>
          <StaticChart
            type={LINE_AREA_BAR_CHART_TYPE}
            options={LINE_AREA_BAR_DEFAULT_OPTIONS_5}
          />
        </PageSection>

        <PageSection>
          <Subhead>Ordinal chart with 200 items</Subhead>
          <StaticChart
            type={LINE_AREA_BAR_CHART_TYPE}
            options={LINE_AREA_BAR_DEFAULT_OPTIONS_6}
          />
        </PageSection>

        <PageSection>
          <Subhead>Ordinal chart with 20 items</Subhead>
          <StaticChart
            type={LINE_AREA_BAR_CHART_TYPE}
            options={LINE_AREA_BAR_DEFAULT_OPTIONS_7}
          />
        </PageSection>

        <PageSection>
          <Subhead>Funnel</Subhead>
          <StaticChart
            type={FUNNEL_CHART_TYPE}
            options={FUNNEL_CHART_DEFAULT_OPTIONS}
          />
        </PageSection>
      </div>
    </PageRoot>
  );
}
