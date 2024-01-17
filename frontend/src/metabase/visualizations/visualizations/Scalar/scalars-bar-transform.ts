import { t } from "ttag";
import type { TransformSeries } from "metabase/visualizations/components/TransformedVisualization";
import type { RawSeries } from "metabase-types/api";
import { TYPE } from "metabase-lib/types/constants";

export const scalarToBarTransform: TransformSeries = rawSeries => {
  return rawSeries.map(({ card, data }) => {
    let metricColumnIndex = data.cols.findIndex(
      col => col.name === card.visualization_settings["scalar.field"],
    );

    // If not found, set default
    metricColumnIndex = metricColumnIndex === -1 ? 0 : metricColumnIndex;

    const transformedDataset = {
      ...data,
      cols: [
        {
          base_type: TYPE.Text,
          display_name: t`Name`,
          name: "name",
          source: "query-transform",
        },
        { ...data.cols[metricColumnIndex] },
      ],
      rows: [[card.name, data.rows[0][metricColumnIndex]]],
    };

    const transformedCard = {
      ...card,
      display: "bar",
      visualization_settings: {
        "graph.tooltip_type": "default",
        "graph.x_axis.labels_enabled": false,
        "stackable.stack_type": "stacked",
        "graph.dimensions": [transformedDataset.cols[0].name],
        "graph.metrics": [transformedDataset.cols[1].name],
      },
    };

    return {
      card: transformedCard,
      data: transformedDataset,
    };
  }) as RawSeries;
};
