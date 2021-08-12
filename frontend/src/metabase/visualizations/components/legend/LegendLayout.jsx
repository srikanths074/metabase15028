import React, { useRef } from "react";
import PropTypes from "prop-types";
import _ from "underscore";
import ExplicitSize from "metabase/components/ExplicitSize";
import Legend from "./Legend";
import {
  ChartContainer,
  LegendContainer,
  LegendLayoutRoot,
} from "./LegendLayout.styled";

const MIN_ITEM_WIDTH = 100;
const MIN_ITEM_HEIGHT = 25;

const propTypes = {
  className: PropTypes.string,
  labels: PropTypes.array.isRequired,
  colors: PropTypes.array.isRequired,
  hovered: PropTypes.object,
  width: PropTypes.number,
  height: PropTypes.number,
  hasLegend: PropTypes.bool,
  actionButtons: PropTypes.node,
  children: PropTypes.node,
  onHoverChange: PropTypes.func,
  onAddSeries: PropTypes.func,
  onSelectSeries: PropTypes.func,
  onRemoveSeries: PropTypes.func,
};

const LegendLayout = ({
  className,
  labels,
  colors,
  hovered,
  width,
  height,
  hasLegend,
  actionButtons,
  children,
  onHoverChange,
  onAddSeries,
  onSelectSeries,
  onRemoveSeries,
}) => {
  const maxXItems = Math.floor(width / MIN_ITEM_WIDTH);
  const maxYItems = Math.floor(height / MIN_ITEM_HEIGHT);
  const minYItems = labels.length > maxYItems ? maxYItems - 1 : labels.length;

  const isVertical = maxXItems < labels.length;
  const visibleLength = isVertical ? minYItems : labels.length;

  return (
    <LegendLayoutRoot className={className} isVertical={isVertical}>
      {hasLegend && (
        <LegendContainer isVertical={isVertical}>
          <Legend
            labels={labels}
            colors={colors}
            hovered={hovered}
            actionButtons={actionButtons}
            visibleLength={visibleLength}
            isVertical={isVertical}
            onHoverChange={onHoverChange}
            onAddSeries={onAddSeries}
            onSelectSeries={onSelectSeries}
            onRemoveSeries={onRemoveSeries}
          />
        </LegendContainer>
      )}
      <ChartContainer>{children}</ChartContainer>
    </LegendLayoutRoot>
  );
};

LegendLayout.propTypes = propTypes;

export default _.compose(ExplicitSize())(LegendLayout);
