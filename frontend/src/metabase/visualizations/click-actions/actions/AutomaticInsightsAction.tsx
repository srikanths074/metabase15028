import { t } from "ttag";
import type {
  ClickActionBase,
  ClickActionProps,
  PopoverClickAction,
} from "metabase/visualizations/click-actions/types";
import {
  ClickActionPopoverProps,
  UrlClickAction,
} from "metabase/visualizations/click-actions/types";
import MetabaseSettings from "metabase/lib/settings";
import { ClickActionsView } from "metabase/visualizations/components/ClickActions";
import {
  automaticDashboardDrillUrl,
  automaticInsightsDrill,
  compareToRestDrillUrl,
} from "metabase-lib/queries/drills/automatic-insights-drill";

export const AutomaticInsightsAction = ({
  question,
  clicked,
}: ClickActionProps): PopoverClickAction[] => {
  const enableXrays = MetabaseSettings.get("enable-xrays");

  if (!automaticInsightsDrill({ question, clicked, enableXrays })) {
    return [];
  }

  const baseClickAction: ClickActionBase = {
    name: "automatic-insights",
    title: t`Automatic insights…`,
    section: "auto",
    icon: "bolt",
    buttonType: "horizontal",
  };

  const drillOptions: UrlClickAction[] = [
    {
      ...baseClickAction,
      name: "exploratory-dashboard",
      title: t`X-ray`,
      section: "auto-popover",
      icon: "bolt",
      url: () => automaticDashboardDrillUrl({ question, clicked }),
    },
    {
      ...baseClickAction,
      name: "compare-dashboard",
      title: t`Compare to the rest`,
      section: "auto-popover",
      icon: "segment",
      url: () => compareToRestDrillUrl({ question, clicked }) as string,
    },
  ];

  const Component = ({ onClick }: ClickActionPopoverProps) => {
    return <ClickActionsView clickActions={drillOptions} onClick={onClick} />;
  };

  return [
    {
      ...baseClickAction,
      popover: Component,
    },
  ];
};
