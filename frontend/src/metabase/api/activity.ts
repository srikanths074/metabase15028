import type { PopularItem, RecentItem } from "metabase-types/api";

import { Api } from "./api";
import { activityItemListTags } from "./tags";

export const activityApi = Api.injectEndpoints({
  endpoints: builder => ({
    listRecentItems: builder.query<RecentItem[], void>({
      query: () => ({
        method: "GET",
        url: "/api/activity/recent_views",
      }),
      providesTags: (items = []) => activityItemListTags(items),
    }),
    listPopularItems: builder.query<PopularItem[], void>({
      query: () => ({
        method: "GET",
        url: "/api/activity/popular_items",
      }),
      providesTags: (items = []) => activityItemListTags(items),
    }),
  }),
});

export const { useListRecentItemsQuery, useListPopularItemsQuery } =
  activityApi;
