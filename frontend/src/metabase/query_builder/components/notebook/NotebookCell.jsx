/* eslint-disable react/prop-types */
import React from "react";

import { Flex } from "grid-styled";
import styled from "styled-components";

import Icon from "metabase/components/Icon";

import { alpha } from "metabase/lib/colors";

export const NotebookCell = styled(Flex).attrs({
  align: "center",
  flexWrap: "wrap",
})`
  border-radius: 8px;
  background-color: ${props => alpha(props.color, 0.1)};
`;

NotebookCell.defaultProps = {
  px: 2,
  pt: 2,
  pb: 1,
};

NotebookCell.displayName = "NotebookCell";

export const NotebookCellItem = styled(Flex).attrs({
  align: "center",
})`
  font-weight: bold;
  border: 2px solid transparent;
  border-radius: 6px;
  color: ${props => (props.inactive ? props.color : "white")};
  background-color: ${props => (props.inactive ? "transparent" : props.color)};
  border-color: ${props =>
    props.inactive ? alpha(props.color, 0.25) : "transparent"};
  &:hover {
    background-color: ${props => !props.inactive && alpha(props.color, 0.8)};
    border-color: ${props => props.inactive && alpha(props.color, 0.8)};
  }
  transition: background 300ms linear, border 300ms linear;
  > .Icon {
    opacity: 0.6;
  }
`;

NotebookCellItem.defaultProps = {
  p: 1,
  mr: 1,
  mb: 1,
};

NotebookCellItem.displayName = "NotebookCellItem";

export const NotebookCellAdd = styled(NotebookCellItem).attrs({
  inactive: ({ initialAddText }) => initialAddText,
  // eslint-disable-next-line react/display-name
  children: ({ initialAddText }) =>
    initialAddText || <Icon name="add" className="text-white" />,
})`
  > .Icon {
    opacity: 1;
  }
`;

NotebookCellAdd.defaultProps = {
  mb: 1,
};

NotebookCellAdd.displayName = "NotebookCellAdd";
