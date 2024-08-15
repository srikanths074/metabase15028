import getInitialCollectionId from "metabase/entities/collections/getInitialCollectionId";
import { useSelector } from "metabase/lib/redux";
import { PLUGIN_COLLECTIONS } from "metabase/plugins";
import type { CollectionId } from "metabase-types/api";

const _useGetDefaultCollectionId = (
  sourceCollectionId?: CollectionId | null,
): CollectionId | null => {
  // TODO: refactor this selector to be this hook and fetch the necessary collections
  // right now we assume that the root collection and any other relevant collections are already
  // in the redux store
  const initialCollectionId = useSelector(state =>
    getInitialCollectionId(state, {
      collectionId: sourceCollectionId ?? undefined,
    }),
  );

  return initialCollectionId;
};

export const useGetDefaultCollectionId =
  PLUGIN_COLLECTIONS.useGetDefaultCollectionId ?? _useGetDefaultCollectionId;
