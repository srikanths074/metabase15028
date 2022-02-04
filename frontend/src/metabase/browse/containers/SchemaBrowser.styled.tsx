import styled from "styled-components";
import {
  breakpointMinMedium,
  breakpointMinSmall,
} from "metabase/styled-components/theme";

export const SchemaGridItem = styled.div`
  width: 100%;

  ${breakpointMinSmall} {
    width: 50%;
  }

  ${breakpointMinMedium} {
    width: 33.33%;
  }
`;

export const SchemaCardContent = styled.div`
  display: flex;
  align-items: center;
`;

export const SchemaCardActions = styled.div`
  margin-left: auto;
`;
