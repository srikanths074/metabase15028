import { restore } from "e2e/support/helpers";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";

const { ORDERS, ORDERS_ID } = SAMPLE_DATABASE;

describe("scenarios > reference > metrics", () => {
  const METRIC_NAME = "orders < 100";
  const METRIC_DESCRIPTION = "Count of orders with a total under $100.";

  beforeEach(() => {
    restore();
    cy.signInAsAdmin();

    cy.request("POST", "/api/metric", {
      definition: {
        aggregation: ["count"],
        filter: ["<", ["field", ORDERS.TOTAL, null], 100],
        "source-table": ORDERS_ID,
      },
      name: METRIC_NAME,
      description: METRIC_DESCRIPTION,
      table_id: ORDERS_ID,
    });
  });

  // QUESTION - do we still want to check this?
  it("should see the listing", () => {
    cy.visit("/reference/metrics");
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText(METRIC_NAME);
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText(METRIC_DESCRIPTION);
  });

  // QUESTION - should we check this via the admin panel instead?
  it("should let an admin edit details about the metric", () => {
    cy.visit("/reference/metrics");
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText(METRIC_NAME).click();

    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Edit").click();
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Description")
      .parent()
      .parent()
      .find("textarea")
      .clear()
      .type("Count of orders under $100");
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Save").click();
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Reason for changes")
      .parent()
      .parent()
      .find("textarea")
      .type("Renaming the description");
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Save changes").click();

    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Count of orders under $100");
  });

  // QUESTION - should we check this in the admin panel instead?
  it("should let an admin start to edit and cancel without saving", () => {
    cy.visit("/reference/metrics");
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText(METRIC_NAME).click();

    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Edit").click();
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Why this metric is interesting")
      .parent()
      .parent()
      .find("textarea")
      .type("Because it's very nice");
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Cancel").click();

    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Because it's very nice").should("have.length", 0);
  });
});
