import { t } from "ttag";
import { createSelector } from "@reduxjs/toolkit";

import { GET } from "metabase/lib/api";
import { createEntity, undo } from "metabase/lib/entities";
import * as Urls from "metabase/lib/urls";

import { CollectionSchema } from "metabase/schema";
import { getUserPersonalCollectionId } from "metabase/selectors/user";

import { canonicalCollectionId } from "metabase/collections/utils";

import type { Collection } from "metabase-types/api";
import type { GetState, ReduxAction } from "metabase-types/store";

import getExpandedCollectionsById from "./getExpandedCollectionsById";
import getInitialCollectionId from "./getInitialCollectionId";
import { getCollectionIcon, getCollectionType } from "./utils";

const listCollectionsTree = GET("/api/collection/tree");
const listCollections = GET("/api/collection");

type EntityInCollection = {
  collection?: Collection;
};

// TODO FIXME DELETE THIS - mock for development only
const addTypesToCollections = (collections: Collection[]) => {
  const reservedNames = ["Instance analytics", "Audit", "Usage", "Performance"];

  for (const col of collections) {
    if (reservedNames.includes(col.name)) {
      col.type = "instance-analytics";
      col.can_write = false;
    }

    if (col.children) {
      col.children = addTypesToCollections(col.children);
    }
  }

  return collections;
};

const FAKE_ListCollections = async (params: any, ...args: any) => {
  const fetchedCollections = await (params?.tree
    ? listCollectionsTree(params, ...args)
    : listCollections(params, ...args));

  return addTypesToCollections(fetchedCollections);
};

const Collections = createEntity({
  name: "collections",
  path: "/api/collection",
  schema: CollectionSchema,

  displayNameOne: t`collection`,
  displayNameMany: t`collections`,

  api: {
    get: async (...params: any[]) => {
      const response = await GET("/api/collection/:id")(params[0]);
      return addTypesToCollections([response as unknown as Collection])[0];
    },
    list: async (params: { tree?: boolean }, ...args: any) =>
      params?.tree
        ? FAKE_ListCollections(params, ...args)
        : FAKE_ListCollections(params, ...args),
    // ? listCollectionsTree(params, ...args)
    // : listCollections(params, ...args),
  },

  objectActions: {
    setArchived: (
      { id }: Collection,
      archived: boolean,
      opts: Record<string, unknown>,
    ) =>
      Collections.actions.update(
        { id },
        { archived },
        undo(opts, "collection", archived ? "archived" : "unarchived"),
      ),

    setCollection: (
      { id }: Collection,
      collection: Collection,
      opts: Record<string, unknown>,
    ) =>
      Collections.actions.update(
        { id },
        { parent_id: canonicalCollectionId(collection?.id) },
        undo(opts, "collection", "moved"),
      ),

    delete: null,
  },

  objectSelectors: {
    getName: (collection?: Collection) => collection?.name,
    getUrl: (collection?: Collection) => Urls.collection(collection),
    getIcon: (
      item: Collection | EntityInCollection,
      opts: { tooltip?: string },
    ) => {
      const collection =
        (item as EntityInCollection).collection || (item as Collection);
      return getCollectionIcon(collection, opts);
    },
  },

  selectors: {
    getExpandedCollectionsById: createSelector(
      [
        state => state.entities.collections || {},
        getUserPersonalCollectionId,
        (state, props) => props?.collectionFilter,
      ],
      (collections, currentUserPersonalCollectionId, collectionFilter) =>
        getExpandedCollectionsById(
          Object.values(collections),
          currentUserPersonalCollectionId,
          collectionFilter,
        ),
    ),
    getInitialCollectionId,
  },

  getAnalyticsMetadata(
    [object]: [Collection],
    { action }: { action: ReduxAction },
    getState: GetState,
  ) {
    const type = object && getCollectionType(object.parent_id, getState());
    return type && `collection=${type}`;
  },
});

export { getExpandedCollectionsById };

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default Collections;
