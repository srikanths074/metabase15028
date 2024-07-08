import { push } from "react-router-redux";
import { t } from "ttag";
import _ from "underscore";

import { useDispatch } from "metabase/lib/redux";
import { PLUGIN_ADMIN_SETTINGS_AUTH_TABS } from "metabase/plugins";
import { Tabs } from "metabase/ui";

PLUGIN_ADMIN_SETTINGS_AUTH_TABS.push({
  name: t`Authentication`,
  key: "authentication",
  to: "/admin/settings/authentication",
});

PLUGIN_ADMIN_SETTINGS_AUTH_TABS.push({
  name: t`API Keys`,
  key: "api-keys",
  to: "/admin/settings/authentication/api-keys",
});

interface AuthTabsProps {
  activeKey: string;
}

export const AuthTabs = ({ activeKey }: AuthTabsProps) => {
  const dispatch = useDispatch();

  return (
    <Tabs value={activeKey}>
      <Tabs.List mx="1rem" mb="1rem">
        {_.sortBy(PLUGIN_ADMIN_SETTINGS_AUTH_TABS, "order").map(tab => {
          return (
            <Tabs.Tab
              key={tab.key}
              value={tab.key}
              onClick={() => dispatch(push(tab.to))}
            >
              {tab.name}
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs>
  );
};
