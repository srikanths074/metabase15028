import { styled } from "metabase/ui/utils";

import { color } from "metabase/lib/colors";
import {
  MODERATION_STATUS,
  getStatusIcon,
} from "metabase-enterprise/moderation/service";

import Button from "metabase/core/components/Button";

const { color: verifiedIconColor } = getStatusIcon(MODERATION_STATUS.verified);

export const VerifyButton = styled(Button)`
  color: ${color(verifiedIconColor)};
  border: none;
  padding: 8px;

  &:disabled {
    color: ${color("text-medium")};
  }

  position: relative;
  right: 8px;
`;

VerifyButton.defaultProps = {
  iconSize: 20,
};
