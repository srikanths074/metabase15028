/* eslint-disable react/prop-types */
import React from "react";
import { t } from "ttag";
import { Bar } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Text } from "@visx/text";
import { formatNumber } from "../lib/formatting";
import { bottomAxisTickStyles, leftAxisTickStyles } from "../lib/styling";

export default function CategoricalBar(
  { data, accessors, labels, settings },
  layout,
) {
  const leftMargin = 55;
  const isVertical = data.length > 10;
  const leftLabel = labels.left || t`Count`;
  const bottomLabel = !isVertical ? labels.bottom || t`Category` : undefined;
  const tickMargin = 5;

  const xAxisScale = scaleBand({
    domain: data.map(accessors.x),
    range: [leftMargin, layout.xMax],
    round: true,
    padding: 0.2,
  });

  const yAxisScale = scaleLinear({
    domain: [0, Math.max(...data.map(accessors.y))],
    range: [layout.yMax, 0],
    nice: true,
  });

  return (
    <svg width={layout.width} height={layout.height}>
      <GridRows
        scale={yAxisScale}
        width={layout.xMax - leftMargin}
        left={leftMargin}
        strokeDasharray="4"
      />
      {data.map((d, index) => {
        const barWidth = xAxisScale.bandwidth();
        const barHeight = layout.yMax - yAxisScale(accessors.y(d));
        const x = xAxisScale(accessors.x(d));
        const y = layout.yMax - barHeight;

        return (
          <Bar
            key={index}
            width={barWidth}
            height={barHeight}
            x={x}
            y={y}
            fill="#509ee3"
          />
        );
      })}
      <AxisLeft
        hideTicks
        hideAxisLine
        left={leftMargin}
        label={leftLabel}
        scale={yAxisScale}
        tickFormat={d => formatNumber(d, settings?.y)}
        tickLabelProps={() => leftAxisTickStyles(layout)}
      />
      <AxisBottom
        hideTicks={false}
        tickStroke={layout.colors.axis.stroke}
        numTicks={data.length}
        top={layout.yMax}
        scale={xAxisScale}
        stroke={layout.colors.axis.stroke}
        label={bottomLabel}
        tickComponent={props => {
          const transform = isVertical
            ? `rotate(45, ${props.x} ${props.y}) translate(${-tickMargin} 0)`
            : undefined;
          const textAnchor = isVertical ? "start" : "middle";

          return (
            <Text {...props} transform={transform} textAnchor={textAnchor}>
              {props.formattedValue}
            </Text>
          );
        }}
        tickLabelProps={() => bottomAxisTickStyles(layout)}
      />
    </svg>
  );
}
