import { capitalize } from "metabase/lib/formatting";
import { isDimension, isMetric, isNumeric, isAny } from "metabase/lib/schema_metadata";
import { t } from 'c-3po';
import { getDefaultColumns, getOptionFromColumn } from "metabase/visualizations/lib/settings";
import { columnsAreValid, getCardColors, getFriendlyName } from "metabase/visualizations/lib/utils";
import { dimensionIsNumeric } from "metabase/visualizations/lib/numeric";
import { dimensionIsTimeseries } from "metabase/visualizations/lib/timeseries";

import _ from "underscore";

function getSeriesTitles(series, vizSettings) {
    return series.map(s => s.card.name);
}

export const GRAPH_DATA_SETTINGS = {
  "graph._dimension_filter": {
      getDefault: ([{ card }]) => card.display === "scatter" ? isAny : isDimension,
      useRawSeries: true
  },
  "graph._metric_filter": {
      getDefault: ([{ card }]) => card.display === "scatter" ? isNumeric : isMetric,
      useRawSeries: true
  },
  "graph.dimensions": {
      section: "Data",
      title: t`X-axis`,
      widget: "fields",
      isValid: ([{ card, data }], vizSettings) =>
          columnsAreValid(card.visualization_settings["graph.dimensions"], data, vizSettings["graph._dimension_filter"]) &&
          columnsAreValid(card.visualization_settings["graph.metrics"], data, vizSettings["graph._metric_filter"]),
      getDefault: (series, vizSettings) =>
          getDefaultColumns(series).dimensions,
      getProps: ([{ card, data }], vizSettings) => {
          const value = vizSettings["graph.dimensions"];
          const options = data.cols.filter(vizSettings["graph._dimension_filter"]).map(getOptionFromColumn);
          return {
              options,
              addAnother: (options.length > value.length && value.length < 2 && vizSettings["graph.metrics"].length < 2) ?
                  t`Add a series breakout...` : null
          };
      },
      readDependencies: ["graph._dimension_filter", "graph._metric_filter"],
      writeDependencies: ["graph.metrics"],
      dashboard: false,
      useRawSeries: true
  },
  "graph.metrics": {
      section: "Data",
      title: t`Y-axis`,
      widget: "fields",
      isValid: ([{ card, data }], vizSettings) =>
          columnsAreValid(card.visualization_settings["graph.dimensions"], data, vizSettings["graph._dimension_filter"]) &&
          columnsAreValid(card.visualization_settings["graph.metrics"], data, vizSettings["graph._metric_filter"]),
      getDefault: (series, vizSettings) =>
          getDefaultColumns(series).metrics,
      getProps: ([{ card, data }], vizSettings) => {
          const value = vizSettings["graph.dimensions"];
          const options = data.cols.filter(vizSettings["graph._metric_filter"]).map(getOptionFromColumn);
          return {
              options,
              addAnother: options.length > value.length && vizSettings["graph.dimensions"].length < 2 ?
                  t`Add another series...` : null
          };
      },
      readDependencies: ["graph._dimension_filter", "graph._metric_filter"],
      writeDependencies: ["graph.dimensions"],
      dashboard: false,
      useRawSeries: true
  },
};

export const GRAPH_BUBBLE_SETTINGS = {
    "scatter.bubble": {
        section: "Data",
        title: t`Bubble size`,
        widget: "field",
        isValid: ([{ card, data }], vizSettings) =>
            columnsAreValid([card.visualization_settings["scatter.bubble"]], data, isNumeric),
        getDefault: (series) =>
            getDefaultColumns(series).bubble,
        getProps: ([{ card, data }], vizSettings, onChange) => {
            const options = data.cols.filter(isNumeric).map(getOptionFromColumn);
            return {
                options,
                onRemove: vizSettings["scatter.bubble"] ? () => onChange(null) : null
            };
        },
        writeDependencies: ["graph.dimensions"],
        dashboard: false,
        useRawSeries: true
    },
}

export const LINE_SETTINGS = {
  "line.interpolate": {
      section: "Display",
      title: t`Style`,
      widget: "select",
      props: {
          options: [
              { name: t`Line`, value: "linear" },
              { name: t`Curve`, value: "cardinal" },
              { name: t`Step`, value: "step-after" },
          ]
      },
      getDefault: () => "linear"
  },
  "line.marker_enabled": {
      section: "Display",
      title: t`Show point markers on lines`,
      widget: "toggle"
  },
}

export const STACKABLE_SETTINGS = {
  "stackable.stack_type": {
      section: "Display",
      title: t`Stacking`,
      widget: "radio",
      getProps: (series, vizSettings) => ({
          options: [
              { name: t`Don't stack`, value: null },
              { name: t`Stack`, value: "stacked" },
              { name: t`Stack - 100%`, value: "normalized" }
          ]
      }),
      getDefault: ([{ card, data }], vizSettings) =>
          // legacy setting and default for D-M-M+ charts
          vizSettings["stackable.stacked"] || (card.display === "area" && vizSettings["graph.metrics"].length > 1) ?
              "stacked" : null,
      getHidden: (series) =>
          series.length < 2,
      readDependencies: ["graph.metrics"]
  }
}

export const GRAPH_GOAL_SETTINGS = {
  "graph.show_goal": {
      section: "Display",
      title: t`Show goal`,
      widget: "toggle",
      default: false
  },
  "graph.goal_value": {
      section: "Display",
      title: t`Goal value`,
      widget: "number",
      default: 0,
      getHidden: (series, vizSettings) => vizSettings["graph.show_goal"] !== true,
      readDependencies: ["graph.show_goal"]
  },
}

export const LINE_SETTINGS_2 = {
  "line.missing": {
      section: "Display",
      title: t`Replace missing values with`,
      widget: "select",
      default: "interpolate",
      getProps: (series, vizSettings) => ({
          options: [
              { name: t`Zero`, value: "zero" },
              { name: t`Nothing`, value: "none" },
              { name: t`Linear Interpolated`, value: "interpolate" },
          ]
      })
  },
}

export const GRAPH_COLORS_SETTINGS = {
  "graph.colors": {
      section: "Display",
      getTitle: ([{ card: { display } }]) =>
          capitalize(display === "scatter" ? "bubble" : display) + " colors",
      widget: "colors",
      readDependencies: ["graph.dimensions", "graph.metrics"],
      getDefault: ([{ card, data }], vizSettings) => {
          return getCardColors(card);
      },
      getProps: (series, vizSettings) => {
          return { seriesTitles: getSeriesTitles(series, vizSettings) };
      }
  }
}

export const GRAPH_AXIS_SETTINGS = {
  "graph.x_axis._is_timeseries": {
      readDependencies: ["graph.dimensions"],
      getDefault: ([{ data }], vizSettings) =>
          dimensionIsTimeseries(data, _.findIndex(data.cols, (c) => c.name === vizSettings["graph.dimensions"].filter(d => d)[0]))
  },
  "graph.x_axis._is_numeric": {
      readDependencies: ["graph.dimensions"],
      getDefault: ([{ data }], vizSettings) =>
          dimensionIsNumeric(data, _.findIndex(data.cols, (c) => c.name === vizSettings["graph.dimensions"].filter(d => d)[0]))
  },
  "graph.x_axis._is_histogram": {
      getDefault: ([{ data: { cols } }], vizSettings) =>
        cols[0].binning_info != null
  },
  "graph.x_axis.scale": {
      section: "Axes",
      title: t`X-axis scale`,
      widget: "select",
      default: "ordinal",
      readDependencies: [
          "graph.x_axis._is_timeseries",
          "graph.x_axis._is_numeric",
          "graph.x_axis._is_histogram"
      ],
      getDefault: (series, vizSettings) =>
          vizSettings["graph.x_axis._is_histogram"] ? "histogram" :
          vizSettings["graph.x_axis._is_timeseries"] ? "timeseries" :
          vizSettings["graph.x_axis._is_numeric"] ? "linear" :
          "ordinal",
      getProps: (series, vizSettings) => {
          const options = [];
          if (vizSettings["graph.x_axis._is_timeseries"]) {
              options.push({ name: t`Timeseries`, value: "timeseries" });
          }
          if (vizSettings["graph.x_axis._is_numeric"]) {
              options.push({ name: t`Linear`, value: "linear" });
              if (!vizSettings["graph.x_axis._is_histogram"]) {
                  options.push({ name: t`Power`, value: "pow" });
                  options.push({ name: t`Log`, value: "log" });
              }
              options.push({ name: t`Histogram`, value: "histogram" });
          }
          options.push({ name: t`Ordinal`, value: "ordinal" });
          return { options };
      }
  },
  "graph.y_axis.scale": {
      section: "Axes",
      title: t`Y-axis scale`,
      widget: "select",
      default: "linear",
      getProps: (series, vizSettings) => ({
          options: [
              { name: t`Linear`, value: "linear" },
              { name: t`Power`, value: "pow" },
              { name: t`Log`, value: "log" }
          ]
      })
  },
  "graph.x_axis.axis_enabled": {
      section: "Axes",
      title: t`Show x-axis line and marks`,
      widget: "toggle",
      default: true
  },
  "graph.y_axis.axis_enabled": {
      section: "Axes",
      title: t`Show y-axis line and marks`,
      widget: "toggle",
      default: true
  },
  "graph.y_axis.auto_range": {
      section: "Axes",
      title: t`Auto y-axis range`,
      widget: "toggle",
      default: true
  },
  "graph.y_axis.min": {
      section: "Axes",
      title: t`Min`,
      widget: "number",
      default: 0,
      getHidden: (series, vizSettings) => vizSettings["graph.y_axis.auto_range"] !== false
  },
  "graph.y_axis.max": {
      section: "Axes",
      title: t`Max`,
      widget: "number",
      default: 100,
      getHidden: (series, vizSettings) => vizSettings["graph.y_axis.auto_range"] !== false
  },
/*
  "graph.y_axis_right.auto_range": {
      section: "Axes",
      title: t`Auto right-hand y-axis range`,
      widget: "toggle",
      default: true
  },
  "graph.y_axis_right.min": {
      section: "Axes",
      title: t`Min`,
      widget: "number",
      default: 0,
      getHidden: (series, vizSettings) => vizSettings["graph.y_axis_right.auto_range"] !== false
  },
  "graph.y_axis_right.max": {
      section: "Axes",
      title: t`Max`,
      widget: "number",
      default: 100,
      getHidden: (series, vizSettings) => vizSettings["graph.y_axis_right.auto_range"] !== false
  },
*/
  "graph.y_axis.auto_split": {
      section: "Axes",
      title: t`Use a split y-axis when necessary`,
      widget: "toggle",
      default: true,
      getHidden: (series) => series.length < 2
  },
  "graph.x_axis.labels_enabled": {
      section: "Labels",
      title: t`Show label on x-axis`,
      widget: "toggle",
      default: true
  },
  "graph.x_axis.title_text": {
      section: "Labels",
      title: t`X-axis label`,
      widget: "input",
      getHidden: (series, vizSettings) =>
          vizSettings["graph.x_axis.labels_enabled"] === false,
      getDefault: (series, vizSettings) =>
          series.length === 1 ? getFriendlyName(series[0].data.cols[0]) : null
  },
  "graph.y_axis.labels_enabled": {
      section: "Labels",
      title: t`Show label on y-axis`,
      widget: "toggle",
      default: true
  },
  "graph.y_axis.title_text": {
      section: "Labels",
      title: t`Y-axis label`,
      widget: "input",
      getHidden: (series, vizSettings) =>
          vizSettings["graph.y_axis.labels_enabled"] === false,
      getDefault: (series, vizSettings) =>
          series.length === 1 ? getFriendlyName(series[0].data.cols[1]) : null
  },
}
