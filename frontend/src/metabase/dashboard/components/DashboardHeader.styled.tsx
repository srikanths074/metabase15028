import styled from "@emotion/styled";
import { css } from "@emotion/react";

import EditableText from "metabase/core/components/EditableText";
import LastEditInfoLabel from "metabase/components/LastEditInfoLabel";

import { color } from "metabase/lib/colors";
import {
  breakpointMaxSmall,
  breakpointMinSmall,
  breakpointMaxMedium,
} from "metabase/styled-components/theme";
import { FullWidthContainer } from "metabase/styled-components/layout/FullWidthContainer";
import { DATA_APPS_MAX_WIDTH } from "metabase/lib/dashboard_grid";

import DataAppPageTitle from "metabase/data-apps/containers/DataAppPageTitle";

interface TypeForItemsThatRespondToNavBarOpen {
  isNavBarOpen: boolean;
  isDataApp?: boolean;
}

export const HeaderRoot = styled(
  FullWidthContainer,
)<TypeForItemsThatRespondToNavBarOpen>`
  display: flex;
  align-items: center;

  ${breakpointMaxMedium} {
    ${props =>
      props.isNavBarOpen &&
      css`
        flex-direction: column;
        align-items: baseline;
      `}
  }

  ${props =>
    props.isDataApp &&
    css`
      box-sizing: content-box;
      max-width: ${DATA_APPS_MAX_WIDTH}px;
      margin: 0 auto;
      padding: 0 2rem;
    `}

  ${breakpointMaxSmall} {
    flex-direction: column;
    align-items: baseline;
    padding-left: 0;
    padding-right: 0;
  }
`;

export const HeaderCaptionContainer = styled.div`
  position: relative;
  transition: top 400ms ease;
  display: flex;
  padding-right: 2rem;
  right: 0.25rem;
`;

const headerCaptionStyle = css`
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.5rem;
  min-width: 200px;
`;

export const HeaderCaption = styled(EditableText)`
  ${headerCaptionStyle};
`;

export const DataAppPageCaption = styled(DataAppPageTitle)`
  ${headerCaptionStyle};
`;

export const HeaderBadges = styled.div`
  display: flex;
  align-items: center;
  padding-left: 0.25rem;
  border-left: 1px solid transparent;

  ${breakpointMaxSmall} {
    flex-direction: column;
    align-items: baseline;
  }
`;

export const HeaderLastEditInfoLabel = styled(LastEditInfoLabel)`
  transition: opacity 400ms ease;
  ${breakpointMaxSmall} {
    margin-top: 4px;
  }
`;

interface HeaderContentProps {
  showSubHeader: boolean;
  hasSubHeader: boolean;
}

export const HeaderContent = styled.div<HeaderContentProps>`
  padding: 1rem 0;

  ${HeaderCaptionContainer} {
    top: ${props => (props.showSubHeader ? "0px" : "10px")};
  }
  ${HeaderLastEditInfoLabel} {
    opacity: ${props => (props.showSubHeader ? "1x" : "0")};
  }

  ${({ hasSubHeader }) =>
    hasSubHeader &&
    css`
      &:hover,
      &:focus-within {
        ${HeaderCaptionContainer} {
          top: 0;
        }
        ${HeaderLastEditInfoLabel} {
          opacity: 1;
        }
      }
    `}

  ${breakpointMaxSmall} {
    padding-top: 0;
    padding-left: 1rem;
    padding-right: 1rem;

    ${HeaderCaptionContainer} {
      top: 0;
    }
    ${HeaderLastEditInfoLabel} {
      opacity: 1;
    }
  }
`;

export const HeaderButtonsContainer = styled.div<TypeForItemsThatRespondToNavBarOpen>`
  display: flex;
  align-items: center;
  color: ${color("text-dark")};
  margin-right: -1rem;

  ${breakpointMinSmall} {
    margin-left: auto;
  }

  ${breakpointMaxMedium} {
    ${props =>
      props.isNavBarOpen &&
      css`
        width: 100%;
        margin-bottom: 6px;
      `}
  }

  ${breakpointMaxSmall} {
    width: 100%;
    margin-bottom: 6px;
    padding-top: 0.375rem;
    padding-left: 1rem;
    padding-right: 1rem;
    border-top: 1px solid ${color("border")};
  }
`;

export const HeaderButtonSection = styled.div<TypeForItemsThatRespondToNavBarOpen>`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  ${breakpointMaxMedium} {
    ${props =>
      props.isNavBarOpen &&
      css`
        width: 100%;
        justify-content: space-between;
      `}
  }

  ${breakpointMaxSmall} {
    width: 100%;
    justify-content: space-between;
  }
`;
