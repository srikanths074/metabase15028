import _ from "underscore";
import type { ScaleContinuousNumeric } from "d3-scale";
import { ValueFormatter } from "metabase/visualizations/shared/types/format";
import { TextMeasurer } from "metabase/visualizations/shared/types/measure-text";
import { ContinuousScaleType } from "metabase/visualizations/shared/types/scale";
import { ChartFont } from "metabase/visualizations/shared/types/style";

const TICK_SPACING = 4;

const getWidthBasedTickInterval = (innerWidth: number) => innerWidth / 8;

const omitOverlappingTicks = (
  ticks: number[],
  tickFont: ChartFont,
  xScale: ScaleContinuousNumeric<number, number, never>,
  tickFormatter: ValueFormatter,
  measureText: TextMeasurer,
) => {
  if (ticks.length <= 1) {
    return ticks;
  }

  const [_min, max] = xScale.range();

  const nonOverlappingTicks: number[] = [];
  let nextAvailableX = Infinity;

  for (let i = ticks.length - 1; i >= 0; i--) {
    const currentTick = ticks[i];
    const currentTickWidth = measureText(tickFormatter(currentTick), tickFont);
    const currentTickX = xScale(currentTick);

    const currentTickEnd = currentTickX + currentTickWidth / 2;
    const currentTickStart = currentTickX - currentTickWidth / 2;

    if (currentTickEnd > nextAvailableX || currentTickEnd > max) {
      continue;
    }

    nonOverlappingTicks.push(currentTick);
    nextAvailableX = currentTickStart + TICK_SPACING;
  }

  nonOverlappingTicks.sort((a, b) => a - b);
  return nonOverlappingTicks;
};

const getMaxTickWidth = (
  scale: ScaleContinuousNumeric<number, number, never>,
  measureText: TextMeasurer,
  tickFormatter: ValueFormatter,
  tickFont: ChartFont,
) => {
  // Assume border ticks on a continuous scale are the widest
  const borderTicksWidths = scale
    .domain()
    .map(tick => measureText(tickFormatter(tick), tickFont) + TICK_SPACING);

  return Math.max(...borderTicksWidths);
};

const getMinTicksInterval = (
  scale: ScaleContinuousNumeric<number, number, never>,
  measureText: TextMeasurer,
  tickFormatter: ValueFormatter,
  tickFont: ChartFont,
  innerWidth: number,
) => {
  const maxTickWidth = getMaxTickWidth(
    scale,
    measureText,
    tickFormatter,
    tickFont,
  );
  return Math.max(maxTickWidth, getWidthBasedTickInterval(innerWidth));
};

const getEvenlySpacedTicks = (
  scale: ScaleContinuousNumeric<number, number, never>,
  ticksInterval: number,
  ticksCount: number,
) => {
  const [startCoordinate] = scale.range();

  return _.range(ticksCount).map(i => {
    const tickCoordinate = startCoordinate + i * ticksInterval;
    return scale.invert(tickCoordinate);
  });
};

export const getXTicks = (
  tickFont: ChartFont,
  innerWidth: number,
  xScale: ScaleContinuousNumeric<number, number, never>,
  tickFormatter: ValueFormatter,
  measureText: TextMeasurer,
  scaleType: ContinuousScaleType,
) => {
  const ticksInterval = getMinTicksInterval(
    xScale,
    measureText,
    tickFormatter,
    tickFont,
    innerWidth,
  );

  const ticksCount = Math.floor(innerWidth / ticksInterval);

  const ticks =
    scaleType === "log"
      ? getEvenlySpacedTicks(xScale, ticksInterval, ticksCount)
      : xScale.ticks(ticksCount);

  return omitOverlappingTicks(
    ticks,
    tickFont,
    xScale,
    tickFormatter,
    measureText,
  );
};
