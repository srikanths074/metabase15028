import styled from "@emotion/styled";
import { color } from "metabase/lib/colors";
import Icon from "metabase/components/Icon";
import IconButtonWrapper from "metabase/components/IconButtonWrapper";

export const SqlButton = styled(IconButtonWrapper)`
  color: ${color("text-dark")};
  padding: 0.5rem;

  &:hover {
    color: ${color("brand")};
  }
`;

export const SqlIcon = styled(Icon)`
  width: 1rem;
  height: 1rem;
`;
