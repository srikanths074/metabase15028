import { useMemo } from "react";
import type { DashCardId, DashboardTabId } from "metabase-types/api";
import { moveDashCardToTab } from "metabase/dashboard/actions";
import {
  getLastSelectedTabId,
  getSelectedTabId,
  getTabs,
} from "metabase/dashboard/selectors";
import { useDispatch, useSelector } from "metabase/lib/redux";

export function useDashCardTabMenu(dashCardId: DashCardId) {
  const dispatch = useDispatch();
  const tabs = useSelector(getTabs);
  const selectedTabId = useSelector(getSelectedTabId);
  const lastSelectedTabId = useSelector(getLastSelectedTabId);

  const orderedTabs = useMemo(() => {
    const lastSelectedTab = tabs.find(t => t.id === lastSelectedTabId);

    const withLastSelectedOnTop = lastSelectedTab
      ? [lastSelectedTab, ...tabs.filter(t => t.id !== lastSelectedTabId)]
      : tabs;

    return withLastSelectedOnTop.filter(t => t.id !== selectedTabId);
  }, [lastSelectedTabId, selectedTabId, tabs]);

  return {
    showMenu: tabs.length > 1,
    tabs: orderedTabs,
    moveToTab: (destTabId: DashboardTabId) =>
      dispatch(moveDashCardToTab({ dashCardId, destTabId })),
  };
}
