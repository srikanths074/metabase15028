import { t } from "ttag";
import { IconProps } from "metabase/components/Icon";

import { color } from "metabase/lib/colors";

import { getUserPersonalCollectionId } from "metabase/selectors/user";
import {
  isRootCollection,
  isPersonalCollection,
  isInstanceAnalyticsCollection,
} from "metabase/collections/utils";

import { PLUGIN_COLLECTIONS } from "metabase/plugins";

import type { Collection, CollectionContentModel } from "metabase-types/api";
import type { State } from "metabase-types/store";

import { ROOT_COLLECTION, PERSONAL_COLLECTIONS } from "./constants";

export function normalizedCollection(collection: Collection) {
  return isRootCollection(collection) ? ROOT_COLLECTION : collection;
}

export function getCollectionIcon(
  collection: Partial<Collection>,
  { tooltip = "default" } = {},
) {
  if (collection.id === PERSONAL_COLLECTIONS.id) {
    return { name: "group" };
  }
  if (isPersonalCollection(collection)) {
    return { name: "person" };
  }

  if (isInstanceAnalyticsCollection(collection)) {
    return { name: "beaker" };
  }

  const authorityLevel =
    PLUGIN_COLLECTIONS.AUTHORITY_LEVEL[collection.authority_level as string];

  return authorityLevel
    ? {
        name: authorityLevel.icon,
        color: authorityLevel.color ? color(authorityLevel.color) : undefined,
        tooltip: authorityLevel.tooltips?.[tooltip],
      }
    : { name: "folder" };
}

const collectionIconTooltipNameMap = {
  collection: t`collection`,
  question: t`question`,
  model: t`model`,
};

export const getCollectionTooltip = (
  collection: Partial<Collection>,
  entity: "collection" | "question" | "model" = "collection",
) => {
  const entityText = collectionIconTooltipNameMap[entity];

  switch (collection.type) {
    case "instance-analytics":
      return t`This is a read-only Instance Analytics ${entityText}.`;
    default:
      return undefined;
  }
};

export function getCollectionType(
  collectionId: Collection["id"] | undefined,
  state: State,
) {
  if (collectionId === null || collectionId === "root") {
    return "root";
  }
  if (collectionId === getUserPersonalCollectionId(state)) {
    return "personal";
  }
  return collectionId !== undefined ? "other" : null;
}

export interface CollectionTreeItem extends Collection {
  icon: string | IconProps;
  children: CollectionTreeItem[];
  schemaName?: string;
}

export function buildCollectionTree(
  collections: Collection[] = [],
  modelFilter?: (model: CollectionContentModel) => boolean,
): CollectionTreeItem[] {
  return collections.flatMap(collection => {
    const isPersonalRoot = collection.id === PERSONAL_COLLECTIONS.id;
    const isMatchedByFilter =
      !modelFilter ||
      collection.here?.some(modelFilter) ||
      collection.below?.some(modelFilter);

    if (!isPersonalRoot && !isMatchedByFilter) {
      return [];
    }

    const children = buildCollectionTree(
      collection.children?.filter(child => !child.archived) || [],
      modelFilter,
    );

    if (isPersonalRoot && children.length === 0) {
      return [];
    }

    return {
      ...collection,
      schemaName: collection.originalName || collection.name,
      icon: getCollectionIcon(collection),
      children,
    };
  });
}
