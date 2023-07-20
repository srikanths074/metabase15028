import { SAMPLE_DB_ID } from "e2e/support/cypress_data";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import { restore } from "e2e/support/helpers";

const { ORDERS_ID } = SAMPLE_DATABASE;

const ORDERS_MODEL = {
  name: "Order",
  dataset: true,
  display: "table",
  database: SAMPLE_DB_ID,
  query: {
    "source-table": ORDERS_ID,
  },
};

describe("Model actions in object detail view", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
    cy.createQuestion(ORDERS_MODEL, {
      wrapId: true,
      idAlias: "modelId",
    });
    cy.signOut();
  });

  it("scenario", () => {
    cy.get("@modelId").then(modelId => {
      /* Step 1: as a normal user, verify that actions are not visible */
      asNormalUser(() => {
        assertActionsTabNotExists(modelId);
        assertActionsDropdownNotExists(modelId);
      });

      /* Step 2: as an admin, verify actions are not visible and then enable actions in the model */
      asAdmin(() => {
        assertActionsTabNotExists(modelId);
        assertActionsDropdownNotExists(modelId);

        enableDatabaseActions();

        assertActionsTabExists(modelId);
        assertActionsDropdownNotExists(modelId);
      });

      asNormalUser(() => {
        assertActionsTabExists(modelId);
        assertActionsDropdownNotExists(modelId);
      });

      asAdmin(() => {
        createBasicModelActions();
        assertActionsDropdownExists(modelId);
      });

      asNormalUser(() => {
        assertActionsDropdownExists(modelId);
      });
    });
  });
});

function asAdmin(callback) {
  cy.signInAsAdmin();
  callback();
  cy.signOut();
}

function asNormalUser(callback) {
  cy.signInAsNormalUser();
  callback();
  cy.signOut();
}

function enableDatabaseActions() {
  cy.visit(`/admin/databases/${SAMPLE_DB_ID}`);
  const actionsToggle = cy.findByLabelText("Model actions");
  cy.log("actions should be disabled in model page");
  actionsToggle.should("not.be.checked");

  actionsToggle.click();

  cy.log("actions should be enabled in model detail page");
  actionsToggle.should("be.checked");
}

function createBasicModelActions(modelId) {
  cy.visit(`/model/${modelId}/detail/actions`);
  cy.findByText("Create basic actions").click();
}

function assertActionsDropdownExists(modelId) {
  cy.visit(`/model/${modelId}/detail/1`);
  cy.log("actions dropdown should be shown in object details modal");
  cy.findByTestId("actions-menu").should("exist");
}

function assertActionsDropdownNotExists(modelId) {
  cy.visit(`/model/${modelId}/detail/1`);
  cy.log("actions dropdown should not be shown in object details modal");
  cy.findByTestId("actions-menu").should("not.exist");
}

function assertActionsTabExists(modelId) {
  cy.visit(`/model/${modelId}/detail`);
  cy.log("actions tab should be shown in model detail page");
  cy.findByText("Actions").should("exist");
}

function assertActionsTabNotExists(modelId) {
  cy.visit(`/model/${modelId}/detail`);
  cy.log("actions tab should be shown in model detail page");
  cy.findByText("Actions").should("not.exist");
}
