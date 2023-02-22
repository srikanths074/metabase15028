import { IconProps } from "metabase/components/Icon";

import { color } from "metabase/lib/colors";

import { getUserPersonalCollectionId } from "metabase/selectors/user";
import {
  isRootCollection,
  isPersonalCollection,
} from "metabase/collections/utils";

import { PLUGIN_COLLECTIONS } from "metabase/plugins";

import type { Collection, CollectionContentModel } from "metabase-types/api";
import type { State } from "metabase-types/store";

import { ROOT_COLLECTION, PERSONAL_COLLECTIONS } from "./constants";

export function normalizedCollection(collection: Collection) {
  return isRootCollection(collection) ? ROOT_COLLECTION : collection;
}

export function getCollectionIcon(
  collection: Collection,
  { tooltip = "default" } = {},
) {
  if (collection.id === PERSONAL_COLLECTIONS.id) {
    return { name: "group" };
  }
  if (isPersonalCollection(collection)) {
    return { name: "person" };
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
}

export interface CollectionTreeOpts {
  targetModels?: CollectionContentModel[];
}

export function buildCollectionTree(
  collections: Collection[],
  { targetModels }: CollectionTreeOpts = {},
): CollectionTreeItem[] {
  const targetModelSet = new Set(targetModels);

  return collections.flatMap(collection => {
    const isPersonalRoot = collection.id === PERSONAL_COLLECTIONS.id;
    const hasTargetModels =
      !targetModelSet.size ||
      collection.here?.some(model => targetModelSet.has(model)) ||
      collection.below?.some(model => targetModelSet.has(model));

    if (!isPersonalRoot && !hasTargetModels) {
      return [];
    }

    const children = buildCollectionTree(
      collection.children?.filter(child => !child.archived) || [],
      { targetModels },
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
