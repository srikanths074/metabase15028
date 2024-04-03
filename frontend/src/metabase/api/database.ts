import type {
  Database,
  CreateDatabaseRequest,
  DatabaseId,
  ListDatabaseIdFieldsRequest,
  ListDatabasesRequest,
  ListDatabasesResponse,
  GetDatabaseMetadataRequest,
  GetDatabaseRequest,
  UpdateDatabaseRequest,
  Field,
  Table,
  ListDatabaseSchemaTablesRequest,
  ListDatabaseSchemasRequest,
  ListVirtualDatabaseTablesRequest,
} from "metabase-types/api";

import { Api } from "./api";
import { tag, idTag, listTag, invalidateTags } from "./tags";

export const databaseApi = Api.injectEndpoints({
  endpoints: builder => ({
    listDatabases: builder.query<
      ListDatabasesResponse,
      ListDatabasesRequest | void
    >({
      query: body => ({
        method: "GET",
        url: "/api/database",
        body,
      }),
      providesTags: response => [
        listTag("database"),
        ...(response?.data?.map(({ id }) => idTag("database", id)) ?? []),
      ],
    }),
    getDatabase: builder.query<Database, GetDatabaseRequest>({
      query: ({ id, ...body }) => ({
        method: "GET",
        url: `/api/database/${id}`,
        body,
      }),
      providesTags: (_, error, { id }) => [idTag("database", id)],
    }),
    getDatabaseMetadata: builder.query<Database, GetDatabaseMetadataRequest>({
      query: ({ id, ...body }) => ({
        method: "GET",
        url: `/api/database/${id}/metadata`,
        body,
      }),
      providesTags: database => [
        ...(database ? [idTag("database", database.id)] : []),
        ...(database?.tables ?? []).map(table => idTag("table", table.id)),
        listTag("field"),
      ],
    }),
    listDatabaseSchemas: builder.query<string[], ListDatabaseSchemasRequest>({
      query: ({ id, ...body }) => ({
        method: "GET",
        url: `/api/database/${id}/schemas`,
        body,
      }),
      providesTags: (schemas = []) => [
        listTag("schema"),
        ...schemas.map(schema => idTag("schema", schema)),
      ],
    }),
    listSyncableDatabaseSchemas: builder.query<string[], DatabaseId>({
      query: id => ({
        method: "GET",
        url: `/api/database/${id}/syncable_schemas`,
      }),
      providesTags: (schemas = []) => [
        listTag("schema"),
        ...schemas.map(schema => idTag("schema", schema)),
      ],
    }),
    listDatabaseSchemaTables: builder.query<
      Table[],
      ListDatabaseSchemaTablesRequest
    >({
      query: ({ id, schema, ...body }) => ({
        method: "GET",
        url: `/api/database/${id}/schema/${schema}`,
        body,
      }),
      providesTags: (tables = []) => [
        listTag("table"),
        ...tables.map(table => idTag("table", table.id)),
      ],
    }),
    listVirtualDatabaseTables: builder.query<
      Table[],
      ListVirtualDatabaseTablesRequest
    >({
      query: ({ id, schema, ...body }) => ({
        method: "GET",
        url: `/api/database/${id}/datasets/${schema}`,
        body,
      }),
      providesTags: (tables = []) => [
        listTag("table"),
        ...tables.map(table => idTag("table", table.id)),
      ],
    }),
    listDatabaseIdFields: builder.query<Field[], ListDatabaseIdFieldsRequest>({
      query: ({ id, ...body }) => ({
        method: "GET",
        url: `/api/database/${id}/idfields`,
        body,
      }),
      providesTags: [listTag("field")],
    }),
    createDatabase: builder.mutation<Database, CreateDatabaseRequest>({
      query: body => ({
        method: "POST",
        url: "/api/database",
        body,
      }),
      invalidatesTags: (_, error) =>
        invalidateTags(error, [listTag("database")]),
    }),
    updateDatabase: builder.mutation<Database, UpdateDatabaseRequest>({
      query: ({ id, ...body }) => ({
        method: "PUT",
        url: `/api/database/${id}`,
        body,
      }),
      invalidatesTags: (_, error, { id }) =>
        invalidateTags(error, [
          listTag("database"),
          idTag("database", id),
          tag("table"),
          tag("field"),
          tag("field-values"),
          tag("card"),
        ]),
    }),
    deleteDatabase: builder.mutation<void, DatabaseId>({
      query: id => ({
        method: "DELETE",
        url: `/api/database/${id}`,
      }),
      invalidatesTags: (_, error, id) =>
        invalidateTags(error, [
          listTag("database"),
          idTag("database", id),
          tag("table"),
          tag("field"),
          tag("field-values"),
          tag("card"),
        ]),
    }),
    syncDatabaseSchema: builder.mutation<void, DatabaseId>({
      query: databaseId => ({
        method: "POST",
        url: `/api/database/${databaseId}/sync_schema`,
      }),
      invalidatesTags: (_, error) =>
        invalidateTags(error, [
          tag("schema"),
          tag("table"),
          tag("field"),
          tag("field-values"),
          tag("card"),
        ]),
    }),
    rescanDatabaseFieldValues: builder.mutation<void, DatabaseId>({
      query: databaseId => ({
        method: "POST",
        url: `/api/database/${databaseId}/rescan_values`,
      }),
      invalidatesTags: (_, error) =>
        invalidateTags(error, [tag("field-values")]),
    }),
    discardDatabaseFieldValues: builder.mutation<void, DatabaseId>({
      query: databaseId => ({
        method: "POST",
        url: `/api/database/${databaseId}/discard_values`,
      }),
      invalidatesTags: (_, error) =>
        invalidateTags(error, [tag("field-values")]),
    }),
  }),
});

export const {
  useListDatabasesQuery,
  useGetDatabaseQuery,
  useListDatabaseSchemasQuery,
  useListSyncableDatabaseSchemasQuery,
  useListDatabaseSchemaTablesQuery,
  useListVirtualDatabaseTablesQuery,
  useListDatabaseIdFieldsQuery,
  useCreateDatabaseMutation,
  useUpdateDatabaseMutation,
  useDeleteDatabaseMutation,
  useSyncDatabaseSchemaMutation,
  useRescanDatabaseFieldValuesMutation,
  useDiscardDatabaseFieldValuesMutation,
} = databaseApi;
