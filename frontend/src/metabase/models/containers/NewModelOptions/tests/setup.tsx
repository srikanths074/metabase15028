import { Route } from "react-router";
import type { Database, TokenFeatures } from "metabase-types/api";
import { setupDatabasesEndpoints } from "__support__/server-mocks";
import { renderWithProviders } from "__support__/ui";
import { setupEnterprisePlugins } from "__support__/enterprise";
import { createMockState } from "metabase-types/store/mocks";
import { createMockTokenFeatures } from "metabase-types/api/mocks";
import { mockSettings } from "__support__/settings";

import NewModelOptions from "../NewModelOptions";

export interface SetupOpts {
  databases: Database[];
  showMetabaseLinks?: boolean;
  hasEnterprisePlugins?: boolean;
  tokenFeatures?: Partial<TokenFeatures>;
}

export function setup({
  databases = [],
  showMetabaseLinks = true,
  hasEnterprisePlugins,
  tokenFeatures = {},
}: SetupOpts) {
  setupDatabasesEndpoints(databases);

  const state = createMockState({
    settings: mockSettings({
      "show-metabase-links": showMetabaseLinks,
      "token-features": createMockTokenFeatures(tokenFeatures),
    }),
  });

  if (hasEnterprisePlugins) {
    setupEnterprisePlugins();
  }

  renderWithProviders(<Route path="*" component={NewModelOptions}></Route>, {
    withRouter: true,
    storeInitialState: state,
  });
}
