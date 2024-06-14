import type { Query } from "history";
import { useState } from "react";

import type { SdkClickActionPluginsConfig } from "embedding-sdk";
import { InteractiveAdHocQuestion } from "embedding-sdk/components/public/InteractiveDashboard/InteractiveAdHocQuestion";
import { getNewCardUrl } from "metabase/dashboard/actions/getNewCardUrl";
import type { NavigateToNewCardFromDashboardOpts } from "metabase/dashboard/components/DashCard/types";
import { useStore } from "metabase/lib/redux";
import { getMetadata } from "metabase/selectors/metadata";
import type { DashboardId, QuestionDashboardCard } from "metabase-types/api";

import { StaticDashboard } from "../StaticDashboard";

export type InteractiveDashboardProps = {
  dashboardId: DashboardId;
  initialParameterValues?: Query;
  withTitle?: boolean;
  withDownloads?: boolean;
  hiddenParameters?: string[];
  questionHeight?: number;
  questionPlugins?: SdkClickActionPluginsConfig;
};

export const InteractiveDashboard = (props: InteractiveDashboardProps) => {
  const { dashboardId, withTitle, questionHeight, questionPlugins } = props;

  const store = useStore();

  const [adhocQuestionUrl, setAdhocQuestionUrl] = useState<string | null>(null);

  const handleNavigateToNewCardFromDashboard = ({
    nextCard,
    previousCard,
    dashcard,
    objectId,
  }: NavigateToNewCardFromDashboardOpts) => {
    const state = store.getState();
    const metadata = getMetadata(state);
    const { dashboards, parameterValues } = state.dashboard;
    const dashboard = dashboards[dashboardId];

    if (dashboard) {
      const url = getNewCardUrl({
        metadata,
        dashboard,
        parameterValues,
        nextCard,
        previousCard,
        dashcard: dashcard as QuestionDashboardCard,
        objectId,
      });

      if (url) {
        setAdhocQuestionUrl(url);
      }
    }
  };

  if (adhocQuestionUrl) {
    return (
      <InteractiveAdHocQuestion
        questionPath={adhocQuestionUrl}
        withTitle={withTitle}
        height={questionHeight}
        plugins={questionPlugins}
        onNavigateBack={() => setAdhocQuestionUrl(null)}
      />
    );
  }

  return (
    <StaticDashboard
      {...props}
      navigateToNewCardFromDashboard={handleNavigateToNewCardFromDashboard}
    />
  );
};
