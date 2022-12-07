import styled from "@emotion/styled";
import { css } from "@emotion/react";
import { color } from "metabase/lib/colors";
import InputBlurChange from "metabase/components/InputBlurChange";
import { focusOutlineStyle } from "metabase/core/style/input";

interface VisibilityTypeProps {
  isSelected: boolean;
}

export const VisibilityType = styled.span<VisibilityTypeProps>`
  margin: 0 0.5rem;
  font-weight: bold;
  cursor: pointer;

  color: ${props => (props.isSelected ? color("brand") : color("text-dark"))};

  &:hover {
    color: ${color("brand")};
  }
`;

const headerInputsStyles = css`
  background-color: ${color("bg-light")};
  padding: 0.75rem 1.5rem;
  z-index: 1;
  outline: none;
  border-color: ${color("border")};

  &:hover,
  &:focus {
    z-index: 2;
  }

  ${focusOutlineStyle("brand")};
`;

export const TableNameInput = styled(InputBlurChange)`
  //${headerInputsStyles}

  ${InputBlurChange.Field} {
    width: 100%;
    font-weight: 700;
    font-size: 20px;
    color: ${color("text-dark")};
    border-radius: 8px 8px 0 0;
    background-color: ${color("bg-light")};
    padding: 0.75rem 1.5rem;
  }
`;

export const TableDescriptionInput = styled(InputBlurChange)`
  //${headerInputsStyles}
  ${InputBlurChange.Field} {
    width: 100%;
    color: ${color("text-dark")};
    margin-top: -1px;
    border-radius: 0 0 8px 8px;
    font-weight: 400;
    font-size: 14px;
    background-color: ${color("bg-light")};
    padding: 0.75rem 1.5rem;
  }
`;

export const TableName = styled.div`
  font-weight: 700;
  font-size: 20px;
  padding: 0.75rem 0.5rem;
  border: 1px solid transparent;
`;

export const TableDescription = styled.div`
  font-weight: 400;
  font-size: 14px;
  padding: 0.75rem 0.5rem;
  border: 1px solid transparent;
  margin-top: -1px;
`;
