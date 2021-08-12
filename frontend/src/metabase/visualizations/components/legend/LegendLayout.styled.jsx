import styled from "styled-components";

export const LegendLayoutRoot = styled.div`
  display: flex;
  flex: 1 0 auto;
  flex-direction: ${({ isVertical }) => (isVertical ? "row" : "column")};
`;

export const LegendContainer = styled.div`
  flex: 0 0 auto;
  max-width: ${({ isVertical }) => (isVertical ? "25%" : "")};
  max-width: ${({ isVertical }) => (isVertical ? "min(25%, 20rem)" : "")};
  margin-right: ${({ isVertical }) => (isVertical ? "0.5rem" : "")};
  margin-bottom: ${({ isVertical }) => (isVertical ? "" : "0.5rem")};
`;

export const ChartContainer = styled.div`
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
`;
