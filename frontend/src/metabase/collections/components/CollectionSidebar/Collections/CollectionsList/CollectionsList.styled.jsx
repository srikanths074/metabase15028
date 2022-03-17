import styled from "@emotion/styled";
import { PLUGIN_COLLECTIONS } from "metabase/plugins";
import {
  ROOT_COLLECTION,
  PERSONAL_COLLECTIONS,
} from "metabase/entities/collections";
import { CollectionIcon } from "metabase/collections/components/CollectionIcon";

const { isRegularCollection } = PLUGIN_COLLECTIONS;

import { SIDEBAR_SPACER, SIDEBAR_WIDTH } from "metabase/collections/constants";
import { color } from "metabase/lib/colors";

import IconButtonWrapper from "metabase/components/IconButtonWrapper";

function getOpacity(collection) {
  if (
    collection.id === ROOT_COLLECTION.id ||
    collection.id === PERSONAL_COLLECTIONS.id
  ) {
    return 1;
  }
  return isRegularCollection(collection) ? 0.4 : 1;
}

export const CollectionListIcon = styled(CollectionIcon)`
  margin-right: 6px;
  opacity: ${props => getOpacity(props.collection)};
`;

export const ChildrenContainer = styled.div`
  box-sizing: border-box;
  margin-left: -${SIDEBAR_SPACER}px;
  padding-left: ${SIDEBAR_SPACER + 10}px;
`;

export const ExpandCollectionButton = styled(IconButtonWrapper)`
  align-items: center;
  color: ${color("white")};
  cursor: pointer;
  left: -20px;
  position: absolute;
`;

const COLLECTION_NAME_LABEL_WIDTH = Math.round(
  parseInt(SIDEBAR_WIDTH, 10) * 0.75,
);

export const LabelContainer = styled.div`
  display: flex;
  align-items: center;
  position: relative;
`;

export const LabelText = styled.span`
  width: ${COLLECTION_NAME_LABEL_WIDTH}px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
