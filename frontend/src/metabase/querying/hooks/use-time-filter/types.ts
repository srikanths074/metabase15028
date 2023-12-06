import type * as Lib from "metabase-lib";
import type { FilterOperatorOption } from "../use-filter-operator";

export interface OperatorOption
  extends FilterOperatorOption<Lib.TimeFilterOperatorName> {
  valueCount: number;
}

export type TimeValue = Date | null;
