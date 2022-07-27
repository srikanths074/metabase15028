import styled from "@emotion/styled";
import { color } from "metabase/lib/colors";
import {
  space,
  breakpointMinHeightMedium,
} from "metabase/styled-components/theme";

export const ListRoot = styled.div`
  margin-bottom: 1rem;
`;

export const ListRow = styled.div`
  padding: 1.5rem 3rem;
  ${breakpointMinHeightMedium} {
    padding: 2.5rem 3rem;
  }
  border-bottom: 1px solid ${color("border")};
  &:last-of-type {
    border-bottom: none;
  }
`;

export const FilterContainer = styled.div`
  &:not(:last-of-type) {
    border-bottom: 1px solid ${color("border")};
    margin-bottom: ${space(2)};
    padding-bottom: ${space(2)};
  }
`;
