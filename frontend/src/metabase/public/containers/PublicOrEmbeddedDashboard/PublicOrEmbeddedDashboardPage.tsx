import type { WithRouterProps } from "react-router";

import { useSyncURLSlug } from "metabase/dashboard/components/DashboardTabs/use-sync-url-slug";
import {
  useDashboardNav,
  useDashboardUrlParams,
  useRefreshDashboard,
} from "metabase/dashboard/hooks";

import { PublicOrEmbeddedDashboard } from "./PublicOrEmbeddedDashboard";
import { usePublicDashboardEndpoints } from "./WithPublicDashboardEndpoints";

export const PublicOrEmbeddedDashboardPage = (props: WithRouterProps) => {
  const { location } = props;
  const parameterQueryParams = props.location.query;

  const { dashboardId } = usePublicDashboardEndpoints(props);

  const { refreshDashboard } = useRefreshDashboard({
    dashboardId,
    parameterQueryParams,
  });

  const {
    bordered,
    hasNightModeToggle,
    hideDownloadButton,
    hideParameters,
    isFullscreen,
    isNightMode,
    onNightModeChange,
    refreshPeriod,
    onFullscreenChange,
    setRefreshElapsedHook,
    onRefreshPeriodChange,
    theme,
    titled,
    font,
  } = useDashboardUrlParams({ location, onRefresh: refreshDashboard });

  useDashboardNav({ isFullscreen });

  useSyncURLSlug({ location });

  return (
    <PublicOrEmbeddedDashboard
      dashboardId={dashboardId}
      isFullscreen={isFullscreen}
      refreshPeriod={refreshPeriod}
      // TODO: fix
      hideParameters={hideParameters ?? null}
      isNightMode={isNightMode}
      hasNightModeToggle={hasNightModeToggle}
      setRefreshElapsedHook={setRefreshElapsedHook}
      onNightModeChange={onNightModeChange}
      onFullscreenChange={onFullscreenChange}
      onRefreshPeriodChange={onRefreshPeriodChange}
      bordered={bordered}
      // TODO: fix
      hideDownloadButton={hideDownloadButton ?? null}
      theme={theme}
      titled={titled}
      font={font}
      parameterQueryParams={parameterQueryParams}
      cardTitled={true}
    />
  );
};
