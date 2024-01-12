import type { ComponentStory } from "@storybook/react";
import { color } from "metabase/lib/colors";
import { formatStaticValue } from "metabase/static-viz/lib/format";
import { measureTextWidth } from "metabase/static-viz/lib/text";
import type { RenderingContext } from "metabase/visualizations/types";

import { FunnelBarChart } from "./FunnelBarChart";
import { data } from "./stories-data";

export default {
  title: "static-viz/FunnelBarChart",
  component: FunnelBarChart,
};

const Template: ComponentStory<typeof FunnelBarChart> = args => {
  return (
    <div style={{ border: "1px solid black", display: "inline-block" }}>
      <FunnelBarChart {...args} />
    </div>
  );
};

const renderingContext: RenderingContext = {
  getColor: color,
  formatValue: formatStaticValue as any,
  measureText: (text, style) =>
    measureTextWidth(text, style.size, style.weight),
  fontFamily: "Lato",
};

export const Default = Template.bind({});
Default.args = {
  rawSeries: data.funnelBarCategorical as any,
  dashcardSettings: {},
  renderingContext,
};
