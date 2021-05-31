import "./commands/ui/button";
import "./commands/ui/icon";

import "./commands/api/question";
import "./commands/api/dashboard";

import "./commands/user/createUser";
import "./commands/user/authentication";

import "./commands/permissions/updatePermissions";
import "./commands/permissions/sandboxTable";

import "./commands/helpers/isVisibleInPopover";
import "./commands/helpers/isInViewport";

import "./commands/overwrites/log";

/**
 * DATABASES
 */

Cypress.Commands.add(
  "addH2SampleDataset",
  ({ name, auto_run_queries = false, is_full_sync = false } = {}) => {
    cy.log(`Add another H2 sample dataset DB called "${name}"`);
    cy.request("POST", "/api/database", {
      engine: "h2",
      name,
      details: {
        db:
          "zip:./target/uberjar/metabase.jar!/sample-dataset.db;USER=GUEST;PASSWORD=guest",
      },
      auto_run_queries,
      is_full_sync,
      schedules: {},
    });
  },
);
