import type { DatabaseCandidate, DatabaseId } from "metabase-types/api";

import { Api } from "./api";
import { idTag, listTag } from "./tags";

function databaseCandidateTags(candidate: DatabaseCandidate) {
  return [idTag("schema", candidate.schema)];
}

// a "database candidate" is a set of sample x-rays we suggest for new users
export const automagicDashboardsApi = Api.injectEndpoints({
  endpoints: builder => ({
    listDatabaseCandidates: builder.query<DatabaseCandidate[], DatabaseId>({
      query: id => `/api/automagic-dashboards/database/${id}/candidates`,
      providesTags: (candidates = []) => [
        listTag("schema"),
        ...candidates.flatMap(databaseCandidateTags),
      ],
    }),
  }),
});

export const { useListDatabaseCandidatesQuery } = automagicDashboardsApi;
