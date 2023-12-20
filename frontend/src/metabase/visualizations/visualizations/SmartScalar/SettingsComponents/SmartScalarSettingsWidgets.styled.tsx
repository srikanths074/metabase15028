import styled from "@emotion/styled";
import { Button } from "metabase/ui";
import type { ButtonProps } from "metabase/ui";

export const ButtonStyled = styled(Button)<ButtonProps>`
  padding-right: 0;
  padding-left: 1rem;
  width: 100%;

  span {
    width: 100%;
    height: 100%;
  }
`;
