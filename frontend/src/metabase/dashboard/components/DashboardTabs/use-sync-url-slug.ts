import { usePrevious } from "react-use";
import { replace } from "react-router-redux";

import { useEffect } from "react";
import { useDispatch, useSelector } from "metabase/lib/redux";
import type { SelectedTabId } from "metabase-types/store";
import { getSelectedTabId, getTabs } from "metabase/dashboard/selectors";

export function getSlug({
  tabId,
  name,
}: {
  tabId: SelectedTabId;
  name: string | undefined;
}) {
  if (tabId === null || tabId < 0 || !name) {
    return "";
  }
  return [tabId, ...name.toLowerCase().split(" ")].join("-");
}

function getPathnameBeforeSlug(pathname: string) {
  const match = pathname.match(/(.*\/dashboard\/[^\/]*)\/?/);
  if (match === null) {
    throw Error("No match with pathname before dashboard tab slug.");
  }
  return match[1];
}

function useUpdateURLSlug({ pathname: oldPathname }: { pathname: string }) {
  const dispatch = useDispatch();

  return {
    updateURLSlug: (slug: string) => {
      const pathname = slug
        ? `${getPathnameBeforeSlug(oldPathname)}/${slug}`
        : getPathnameBeforeSlug(oldPathname);

      dispatch(replace({ pathname }));
    },
  };
}

export function useSyncURLSlug({ pathname }: { pathname: string }) {
  const tabs = useSelector(getTabs);
  const selectedTabId = useSelector(getSelectedTabId);

  const prevTabs = usePrevious(tabs);
  const prevSelectedTabId = usePrevious(selectedTabId);

  const { updateURLSlug } = useUpdateURLSlug({ pathname });

  useEffect(() => {
    const tabSelected = selectedTabId !== prevSelectedTabId;
    const tabRenamed =
      tabs.find(t => t.id === selectedTabId)?.name !==
      prevTabs?.find(t => t.id === selectedTabId)?.name;
    const penultimateTabDeleted = tabs.length === 1 && prevTabs?.length === 2;

    if (tabSelected || tabRenamed || penultimateTabDeleted) {
      updateURLSlug(
        tabs.length === 1
          ? ""
          : getSlug({
              tabId: selectedTabId,
              name: tabs.find(t => t.id === selectedTabId)?.name,
            }),
      );
    }
  }, [selectedTabId, tabs, prevSelectedTabId, prevTabs, updateURLSlug]);
}
