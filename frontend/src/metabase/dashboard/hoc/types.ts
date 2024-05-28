import type { Location } from "history";

import type { DashboardId, ParameterValueOrArray } from "metabase-types/api";

import type { DashboardDisplayOptionControls } from "../types";

export type DashboardControlsProps = {
  location: Location;
  dashboardId: DashboardId;
};

export type DashboardControlsPassedProps = DashboardDisplayOptionControls &
  DashboardControlsProps & {
    queryParams: Record<string, ParameterValueOrArray | null>;
  };
