import type { CardId, ConcreteTableId } from "metabase-types/api";

export type BrowseDataModelClickedEvent = {
  event: "browse_data_model_clicked";
  model_id: CardId;
};

export type BrowseDataTableClickedEvent = {
  event: "browse_data_table_clicked";
  table_id: ConcreteTableId;
};

export type BrowseDataEvent =
  | BrowseDataModelClickedEvent
  | BrowseDataTableClickedEvent;
