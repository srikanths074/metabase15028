import type { QueryClickActionsMode } from "../../types";
import { ColumnFormattingAction } from "../actions/ColumnFormattingAction";
import { DashboardClickAction } from "../actions/DashboardClickAction";
import { HideColumnAction } from "../actions/HideColumnAction";
import { hideSeriesAction } from "../actions/HideSeriesAction";
import { NativeQueryClickFallback } from "../actions/NativeQueryClickFallback";

export const DefaultMode: QueryClickActionsMode = {
  name: "default",
  hasDrills: true,
  clickActions: [
    HideColumnAction,
    ColumnFormattingAction,
    DashboardClickAction,
    hideSeriesAction,
  ],
  fallback: NativeQueryClickFallback,
};
