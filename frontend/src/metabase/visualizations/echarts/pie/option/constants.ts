import type { RegisteredSeriesOption } from "echarts";

import { DIMENSIONS, TOTAL_TEXT } from "../constants";

export const SUNBURST_SERIES_OPTION: RegisteredSeriesOption["sunburst"] = {
  type: "sunburst",
  sort: undefined,
  label: {
    rotate: 0,
    overflow: "none",
    fontSize: 20, // placeholder for ts, it will be overriden later
    fontWeight: DIMENSIONS.slice.label.fontWeight,
  },
  labelLayout: {
    hideOverlap: true,
  },
};

export const TOTAL_GRAPHIC_OPTION = {
  type: "group",
  top: "center",
  left: "center",
  children: [
    {
      type: "text",
      cursor: "text",
      style: {
        fontSize: "22px",
        fontWeight: "700",
        textAlign: "center",
        // placeholder values to keep typescript happy
        fontFamily: "",
        fill: "",
      },
    },
    {
      type: "text",
      cursor: "text",
      top: 26,
      style: {
        fontSize: "14px",
        fontWeight: "700",
        textAlign: "center",
        text: TOTAL_TEXT,
      },
    },
  ],
};
