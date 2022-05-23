import styled from "@emotion/styled";

export interface ColorGridProps {
  colors: string[];
}

export const ColorGrid = styled.div<ColorGridProps>`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.75rem;
`;
