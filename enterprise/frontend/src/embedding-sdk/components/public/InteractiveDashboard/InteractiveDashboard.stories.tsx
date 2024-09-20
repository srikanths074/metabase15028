import type { StoryFn } from "@storybook/react";

import { CommonSdkStoryWrapper } from "embedding-sdk/test/CommonSdkStoryWrapper";

import { InteractiveDashboard } from "./InteractiveDashboard";

const DASHBOARD_ID = (window as any).DASHBOARD_ID || 1;

export default {
  title: "EmbeddingSDK/InteractiveDashboard",
  component: InteractiveDashboard,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [CommonSdkStoryWrapper],
};

const Template: StoryFn<typeof InteractiveDashboard> = args => {
  return <InteractiveDashboard {...args} />;
};

export const Default = {
  render: Template,

  args: {
    dashboardId: DASHBOARD_ID,
  },
};
