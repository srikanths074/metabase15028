/* eslint-disable react/prop-types */
import React from "react";
import { t } from "ttag";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { scaleLinear, scaleOrdinal, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { formatDate, formatNumber } from "../lib/formatting";
import { bottomAxisTickStyles, leftAxisTickStyles } from "../lib/styling";

export default function TimeseriesLine(
  { data, accessors, labels, settings },
  layout,
) {
  const leftMargin = 55;
  let multiScale, categories;

  const xAxisScale = scaleTime({
    domain: [
      Math.min(...data.map(accessors.x)),
      Math.max(...data.map(accessors.x)),
    ],
    range: [leftMargin, layout.xMax],
  });

  // Y scale
  const yAxisScale = scaleLinear({
    domain: [0, Math.max(...data.map(accessors.y))],
    range: [layout.yMax, 0],
    nice: true,
  });

  if (accessors.multi) {
    multiScale = scaleOrdinal({
      domain: data.map(accessors.multi),
      range: ["#509ee3", "#EF8C8C", "#88BF4D", "#98D9D9", "#7173AD"],
    });
    categories = data.map(accessors.multi);
  }

  return (
    <svg width={layout.width} height={layout.height}>
      <GridRows
        scale={yAxisScale}
        width={layout.xMax - leftMargin}
        left={leftMargin}
        strokeDasharray="4"
      />
      {multiScale ? (
        categories.map(c => {
          return (
            <LinePath
              key={`series-${c}`}
              data={data.filter(d => {
                return accessors.multi(d) === c;
              })}
              stroke={multiScale(accessors.multi(c))}
              x={d => xAxisScale(accessors.x(d))}
              y={d => yAxisScale(accessors.y(d))}
            />
          );
        })
      ) : (
        <LinePath
          data={data}
          stroke={"#509ee3"}
          strokeWidth={2}
          x={d => xAxisScale(accessors.x(d))}
          y={d => yAxisScale(accessors.y(d))}
        />
      )}
      <AxisLeft
        label={labels.left || t`Metric`}
        hideTicks
        hideAxisLine
        left={leftMargin}
        scale={yAxisScale}
        tickFormat={d => formatNumber(d, settings?.y)}
        tickLabelProps={() => leftAxisTickStyles(layout)}
      />
      <AxisBottom
        label={labels.bottom || t`Dimension`}
        hideTicks={false}
        tickStroke={layout.colors.axis.stroke}
        numTicks={5}
        top={layout.yMax}
        stroke={layout.colors.axis.stroke}
        scale={xAxisScale}
        tickFormat={d => formatDate(d, settings?.x)}
        tickLabelProps={() => bottomAxisTickStyles(layout)}
      />
    </svg>
  );
}
