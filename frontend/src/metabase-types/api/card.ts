import type { EmbeddingParameters } from "metabase/public/lib/types";
import type { PieRow } from "metabase/visualizations/echarts/pie/model/types";

import type { Collection, CollectionId, LastEditInfo } from "./collection";
import type { DashCardId, DashboardId } from "./dashboard";
import type { Database, DatabaseId } from "./database";
import type { BaseEntityId } from "./entity-id";
import type { Field } from "./field";
import type { PaginationRequest, PaginationResponse } from "./pagination";
import type { Parameter } from "./parameters";
import type { DatasetQuery, FieldReference, PublicDatasetQuery } from "./query";
import type { CollectionEssentials } from "./search";
import type { Table } from "./table";
import type { UserInfo } from "./user";
import type { CardDisplayType, VisualizationDisplay } from "./visualization";
import type { SmartScalarComparison } from "./visualization-settings";
export type CardType = "model" | "question" | "metric";

type CreatorInfo = Pick<
  UserInfo,
  "first_name" | "last_name" | "email" | "id" | "common_name"
>;

export interface Card<Q extends DatasetQuery = DatasetQuery>
  extends UnsavedCard<Q> {
  id: CardId;
  entity_id: CardEntityId;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  type: CardType;
  public_uuid: string | null;

  /* Indicates whether static embedding for this card has been published */
  enable_embedding: boolean;
  embedding_params: EmbeddingParameters | null;
  can_write: boolean;
  can_restore: boolean;
  can_delete: boolean;
  initially_published_at: string | null;

  database_id?: DatabaseId;
  collection?: Collection | null;
  collection_id: number | null;
  collection_position: number | null;

  result_metadata: Field[];
  moderation_reviews?: ModerationReview[];
  persisted?: boolean;

  query_average_duration?: number | null;
  last_query_start: string | null;
  average_query_time: number | null;
  cache_ttl: number | null;
  based_on_upload?: number | null; // table id of upload table, if any

  archived: boolean;

  creator?: CreatorInfo;
  "last-edit-info"?: LastEditInfo;
}

export interface PublicCard {
  id: CardId;
  name: string;
  description: string | null;
  display: CardDisplayType;
  visualization_settings: VisualizationSettings;
  parameters?: Parameter[];
  dataset_query: PublicDatasetQuery;
}

export interface UnsavedCard<Q extends DatasetQuery = DatasetQuery> {
  display: VisualizationDisplay;
  dataset_query: Q;
  parameters?: Parameter[];
  visualization_settings: VisualizationSettings;

  // If coming from dashboard
  dashboardId?: DashboardId;
  dashcardId?: DashCardId;

  // Not part of the card API contract, a field used by query builder for showing lineage
  original_card_id?: number;
}

export type LineSize = "S" | "M" | "L";

export type SeriesSettings = {
  title?: string;
  color?: string;
  show_series_values?: boolean;
  display?: string;
  axis?: string;
  "line.size"?: LineSize;
  "line.style"?: "solid" | "dashed" | "dotted";
  "line.interpolate"?: string;
  "line.marker_enabled"?: boolean;
  "line.missing"?: string;
};

export type SeriesOrderSetting = {
  name: string;
  key: string;
  enabled: boolean;
  color?: string;
};

export type ColumnFormattingSetting = {
  columns: string[]; // column names
  color?: string;
  type?: string;
  operator?: string;
  value?: string | number;
  highlight_row?: boolean;
};

export type PivotTableCollapsedRowsSetting = {
  rows: FieldReference[];
  value: string[]; // identifiers for collapsed rows
};

export type TableColumnOrderSetting = {
  name: string;
  enabled: boolean;
  fieldRef?: FieldReference;
};

export type StackType = "stacked" | "normalized" | null;
export type StackValuesDisplay = "total" | "all" | "series";

export const numericScale = ["linear", "pow", "log"] as const;
export type NumericScale = (typeof numericScale)[number];

export type XAxisScale = "ordinal" | "histogram" | "timeseries" | NumericScale;

export type YAxisScale = NumericScale;

export interface ColumnSettings {
  column_title?: string;
  number_separators?: string;
  currency?: string;

  // some options are untyped
  [key: string]: any;
}

export type VisualizationSettings = {
  "graph.show_values"?: boolean;
  "stackable.stack_type"?: StackType;
  "graph.show_stack_values"?: StackValuesDisplay;

  // Table
  "table.columns"?: TableColumnOrderSetting[];
  // Keys here can be modern (returned by `getColumnKey`) or legacy (`getLegacyColumnKey`).
  // Use `getColumnSettings` which checks for both keys.
  column_settings?: Record<string, ColumnSettings>;

  // X-axis
  "graph.x_axis.title_text"?: string;
  "graph.x_axis.scale"?: XAxisScale;
  "graph.x_axis.axis_enabled"?:
    | true
    | false
    | "compact"
    | "rotate-45"
    | "rotate-90";

  // Y-axis
  "graph.y_axis.title_text"?: string;
  "graph.y_axis.scale"?: YAxisScale;
  "graph.y_axis.axis_enabled"?: boolean;

  "graph.y_axis.min"?: number;
  "graph.y_axis.max"?: number;

  // Goal
  "graph.goal_value"?: number;
  "graph.show_goal"?: boolean;
  "graph.goal_label"?: string;

  // Trend
  "graph.show_trendline"?: boolean;

  // Series
  "graph.dimensions"?: string[];
  "graph.metrics"?: string[];

  // Series settings
  series_settings?: Record<string, SeriesSettings>;

  "graph.series_order"?: SeriesOrderSetting[];

  // Scatter plot settings
  "scatter.bubble"?: string; // col name

  // Waterfall settings
  "waterfall.increase_color"?: string;
  "waterfall.decrease_color"?: string;
  "waterfall.total_color"?: string;
  "waterfall.show_total"?: boolean;

  // Funnel settings
  "funnel.rows"?: SeriesOrderSetting[];

  "table.column_formatting"?: ColumnFormattingSetting[];
  "pivot_table.collapsed_rows"?: PivotTableCollapsedRowsSetting;

  // Scalar Settings
  "scalar.comparisons"?: SmartScalarComparison[];
  "scalar.field"?: string;
  "scalar.switch_positive_negative"?: boolean;
  "scalar.compact_primary_number"?: boolean;

  // Pie Settings
  "pie.dimension"?: string | string[];
  "pie.middle_dimension"?: string;
  "pie.outer_dimension"?: string;
  "pie.rows"?: PieRow[];
  "pie.metric"?: string;
  "pie.sort_rows"?: boolean;
  "pie.show_legend"?: boolean;
  "pie.show_total"?: boolean;
  "pie.show_labels"?: boolean;
  "pie.percent_visibility"?: "off" | "legend" | "inside" | "both";
  "pie.decimal_places"?: number;
  "pie.slice_threshold"?: number;
  "pie.colors"?: Record<string, string>;

  [key: string]: any;
};

export interface ModerationReview {
  status: ModerationReviewStatus;
  moderator_id: number;
  created_at: string;
  most_recent?: boolean;
}

export type CardId = number;
export type CardEntityId = BaseEntityId;
export type ModerationReviewStatus = "verified" | null;

export type CardFilterOption =
  | "all"
  | "mine"
  | "bookmarked"
  | "database"
  | "table"
  | "recent"
  | "popular"
  | "using_model"
  | "archived";

export type CardQueryMetadata = {
  databases: Database[];
  tables: Table[];
  fields: Field[];
};

export interface ListCardsRequest {
  f?: CardFilterOption;
  model_id?: CardId;
}

export interface GetCardRequest {
  id: CardId;
  ignore_view?: boolean;
  ignore_error?: boolean;
}

export interface CreateCardRequest {
  name: string;
  dataset_query: DatasetQuery;
  display: string;
  visualization_settings: VisualizationSettings;
  type?: CardType;
  parameters?: Parameter[];
  parameter_mappings?: unknown;
  description?: string;
  collection_id?: CollectionId;
  collection_position?: number;
  result_metadata?: Field[];
  cache_ttl?: number;
}

export interface UpdateCardRequest {
  id: CardId;
  name?: string;
  parameters?: Parameter[];
  dataset_query?: DatasetQuery;
  type?: CardType;
  display?: string;
  description?: string;
  visualization_settings?: VisualizationSettings;
  archived?: boolean;
  enable_embedding?: boolean;
  embedding_params?: EmbeddingParameters;
  collection_id?: CollectionId;
  collection_position?: number;
  result_metadata?: Field[];
  cache_ttl?: number;
  collection_preview?: boolean;
}

export type CardError = {
  field?: string;
  table: string;
  type: "inactive-field" | "inactive-table" | "unknown-field" | "unknown-table";
};

export type InvalidCard = Pick<
  Card,
  | "archived"
  | "collection_id"
  | "collection_position"
  | "dataset_query"
  | "description"
  | "id"
  | "name"
  | "updated_at"
  | "creator"
> & {
  collection: CollectionEssentials;
  collection_preview: boolean;
  entity_id: string;
  errors: CardError[];
  display: CardDisplayType;
};

export type InvalidCardResponse = {
  data: InvalidCard[];
} & PaginationResponse;

export type InvalidCardRequest = {
  sort_direction?: "asc" | "desc";
  sort_column?: string;
  collection_id?: CollectionId | null;
} & PaginationRequest;

export type CardQueryRequest = {
  cardId: CardId;
  dashboardId?: DashboardId;
  collection_preview?: boolean;
  ignore_cache?: boolean;
  parameters?: unknown[];
};

export type GetPublicOrEmbeddableCard = Pick<
  Card,
  "id" | "name" | "public_uuid"
>;
