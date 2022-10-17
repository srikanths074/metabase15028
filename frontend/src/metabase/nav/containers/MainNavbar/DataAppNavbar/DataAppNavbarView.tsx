import React, { useCallback, useMemo } from "react";
import { t } from "ttag";
import _ from "underscore";

import type { DataApp, DataAppNavItem } from "metabase-types/api";

import Link from "metabase/core/components/Link";
import Icon from "metabase/components/Icon";
import Tooltip from "metabase/components/Tooltip";

import * as Urls from "metabase/lib/urls";

import { MainNavbarProps, SelectedItem } from "../types";
import DataAppPageLink from "./DataAppPageLink";
import DataAppActionPanel from "./DataAppActionPanel";

interface Props extends Omit<MainNavbarProps, "location" | "params"> {
  dataApp: DataApp;
  pages: any[];
  selectedItems: SelectedItem[];
  onEditAppSettings: () => void;
  onAddData: () => void;
  onNewPage: () => void;
}

function DataAppNavbarView({
  dataApp,
  pages,
  selectedItems,
  onEditAppSettings,
  onAddData,
  onNewPage,
}: Props) {
  const { "data-app-page": dataAppPage } = _.indexBy(
    selectedItems,
    item => item.type,
  );

  const pageMap = useMemo(() => _.indexBy(pages, "id"), [pages]);

  const pagesWithoutNavItems = useMemo(() => {
    const pageIds = pages.map(page => page.id);
    const navItemPageIds = dataApp.nav_items
      .filter(navItem => navItem.page_id)
      .map(navItem => navItem.page_id);
    const pagesWithoutNavItems = _.difference(pageIds, navItemPageIds);
    return pagesWithoutNavItems.map(pageId => pageMap[pageId]);
  }, [dataApp.nav_items, pages, pageMap]);

  const navItems = useMemo(() => {
    const items = dataApp.nav_items.filter(
      navItem => !navItem.hidden && pageMap[navItem.page_id],
    );

    items.push(...pagesWithoutNavItems.map(page => ({ page_id: page.id })));

    return items;
  }, [dataApp, pagesWithoutNavItems, pageMap]);

  const renderNavItem = useCallback(
    (navItem: DataAppNavItem) => (
      <DataAppPageLink
        key={navItem.page_id}
        dataApp={dataApp}
        page={pageMap[navItem.page_id]}
        isSelected={dataAppPage?.id === navItem.page_id}
      />
    ),
    [dataApp, pageMap, dataAppPage],
  );

  const exitAppPath = Urls.dataApp(dataApp, { mode: "preview" });

  return (
    <div className="flex align-center">
      {navItems.map(renderNavItem)}
      <div className="flex align-center ml-auto">
        <DataAppActionPanel
          dataApp={dataApp}
          onAddData={onAddData}
          onNewPage={onNewPage}
          onEditAppSettings={onEditAppSettings}
        />
        <Tooltip tooltip={t`App elements`}>
          <Link to={exitAppPath} className="ml2">
            <Icon name="list" />
          </Link>
        </Tooltip>
      </div>
    </div>
  );
}

export default DataAppNavbarView;
