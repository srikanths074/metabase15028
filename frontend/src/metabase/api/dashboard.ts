import type { Dashboard, DashboardId } from "metabase-types/api";

import { Api } from "./api";
import {
  idTag,
  invalidateTags,
  listTag,
  provideDashboardListTags,
  provideDashboardTags,
} from "./tags";

type CreateDashboardRequest = Record<string, unknown>; // TODO
type UpdateDashboardRequest = {
  id: DashboardId;
}; // TODO

export const dashboardApi = Api.injectEndpoints({
  endpoints: builder => ({
    listDashboards: builder.query<Dashboard[], void>({
      query: () => ({
        method: "GET",
        url: "/api/dashboard",
      }),
      providesTags: dashboards =>
        dashboards ? provideDashboardListTags(dashboards) : [],
    }),
    getDashboard: builder.query<Dashboard, DashboardId>({
      query: id => ({
        method: "GET",
        url: `/api/dashboard/${id}`,
      }),
      providesTags: dashboard =>
        dashboard ? provideDashboardTags(dashboard) : [],
    }),
    createDashboard: builder.mutation<Dashboard, CreateDashboardRequest>({
      query: body => ({
        method: "POST",
        url: "/api/dashboard",
        body,
      }),
      invalidatesTags: (_, error) =>
        invalidateTags(error, [listTag("dashboard")]),
    }),
    updateDashboard: builder.mutation<Dashboard, UpdateDashboardRequest>({
      query: ({ id, ...body }) => ({
        method: "PUT",
        url: `/api/dashboard/${id}`,
        body,
      }),
      invalidatesTags: (_, error, { id }) =>
        invalidateTags(error, [listTag("dashboard"), idTag("dashboard", id)]),
    }),
    deleteDashboard: builder.mutation<void, DashboardId>({
      query: id => ({
        method: "DELETE",
        url: `/api/dashboard/${id}`,
      }),
      invalidatesTags: (_, error, id) =>
        invalidateTags(error, [listTag("dashboard"), idTag("dashboard", id)]),
    }),
  }),
});

export const {
  useCreateDashboardMutation,
  useDeleteDashboardMutation,
  useGetDashboardQuery,
  useListDashboardsQuery,
  useUpdateDashboardMutation,
} = dashboardApi;
