import { CardId, DatabaseId } from "metabase-types/api";

export const modelMetabot = (id: CardId) => {
  return `/metabot/model/${id}`;
};

export const databaseMetabot = (id: DatabaseId) => {
  return `/metabot/database/${id}`;
};

export const mbqlMetabot = () => {
  return `/metabot/mbql`;
};
