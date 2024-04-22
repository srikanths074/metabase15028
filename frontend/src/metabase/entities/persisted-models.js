import { createSelector } from "@reduxjs/toolkit";

import { persistApi } from "metabase/api";
import { createEntity, entityCompatibleQuery } from "metabase/lib/entities";
import { PersistedModelSchema } from "metabase/schema";
import { CardApi } from "metabase/services";

const REFRESH_CACHE = "metabase/entities/persistedModels/REFRESH_CACHE";

const getPersistedModelInfoByModelId = createSelector(
  [state => state.entities.persistedModels, (state, props) => props.entityId],
  (persistedModels, modelId) =>
    Object.values(persistedModels).find(info => info.card_id === modelId),
);

/**
 * @deprecated use "metabase/api" instead
 */
const PersistedModels = createEntity({
  name: "persistedModels",
  nameOne: "persistedModel",
  path: "/api/persist",
  schema: PersistedModelSchema,

  api: {
    get: ({ id, type }, dispatch) => {
      return type === "byModelId"
        ? entityCompatibleQuery(
            id,
            dispatch,
            persistApi.endpoints.getPersistedInfoByCard,
          )
        : entityCompatibleQuery(
            id,
            dispatch,
            persistApi.endpoints.getPersistedInfo,
          );
    },
    list: (entityQuery, dispatch) =>
      entityCompatibleQuery(
        entityQuery,
        dispatch,
        persistApi.endpoints.listTasks,
      ),
    create: () => {
      throw new TypeError("PersistedModels.api.create is not supported");
    },
    update: () => {
      throw new TypeError("PersistedModels.api.update is not supported");
    },
    delete: () => {
      throw new TypeError("PersistedModels.api.delete is not supported");
    },
  },

  objectActions: {
    refreshCache: async job => {
      await CardApi.refreshModelCache({ id: job.card_id });
      return { type: REFRESH_CACHE, payload: job };
    },
  },

  selectors: {
    getByModelId: getPersistedModelInfoByModelId,
  },

  reducer: (state = {}, { type, payload, error }) => {
    if (type === REFRESH_CACHE && !error) {
      return {
        ...state,
        [payload.id]: {
          ...state[payload.id],
          state: "refreshing",
          refresh_begin: new Date().toUTCString(),
          refresh_end: null,
        },
      };
    }
    return state;
  },
});

export default PersistedModels;
