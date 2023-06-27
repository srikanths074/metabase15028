import { styled } from "metabase/ui/utils";
import { color } from "metabase/lib/colors";

export const TimeLabel = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;

  &:hover {
    color: ${color("filter")};
  }
`;
