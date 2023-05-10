import {
  dashboardHeader,
  dashboardParametersContainer,
  filterWidget,
  getDashboardCard,
  popover,
  restore,
  rightSidebar,
  undoToast,
  visitDashboard,
} from "e2e/support/helpers";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";

const { PRODUCTS, PRODUCTS_ID } = SAMPLE_DATABASE;

const questionDetails = {
  name: "Products table",
  query: { "source-table": PRODUCTS_ID },
};

const filter = {
  name: "Category",
  slug: "category",
  id: "2a12e66c",
  type: "string/=",
  sectionId: "string",
};

const dashboardDetails = {
  parameters: [filter],
};

const TOAST_TIMEOUT = 20000;
const TOAST_MESSAGE =
  "You can make this dashboard snappier by turning off auto-applying filters.";

describe("scenarios > dashboards > filters > auto apply", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
    cy.intercept("PUT", "/api/dashboard/*").as("updateDashboard");
  });

  it("should handle toggling auto applying filters on and off", () => {
    createDashboard();
    openDashboard();
    cy.wait("@cardQuery");

    filterWidget().within(() => {
      cy.findByText(filter.name).click();
    });
    popover().within(() => {
      cy.findByText("Gadget").click();
      cy.button("Add filter").click();
      cy.wait("@cardQuery");
    });
    getDashboardCard().within(() => {
      cy.findByText("Rows 1-6 of 53").should("be.visible");
    });

    dashboardHeader().within(() => {
      cy.icon("info").click();
    });
    rightSidebar().within(() => {
      cy.findByLabelText("Auto-apply filters").click();
      cy.wait("@updateDashboard");
      cy.findByLabelText("Auto-apply filters").should("not.be.checked");
    });
    filterWidget().within(() => {
      cy.findByText("Gadget").should("be.visible");
    });
    getDashboardCard().within(() => {
      cy.findByText("Rows 1-6 of 53").should("be.visible");
    });

    filterWidget().within(() => {
      cy.findByText("Gadget").click();
    });
    popover().within(() => {
      cy.findByText("Widget").click();
      cy.button("Update filter").click();
    });
    getDashboardCard().within(() => {
      cy.findByText("Rows 1-6 of 53").should("be.visible");
    });
    dashboardParametersContainer().within(() => {
      cy.button("Apply").click();
      cy.wait("@cardQuery");
    });
    getDashboardCard().within(() => {
      cy.findByText("Rows 1-6 of 107").should("be.visible");
    });

    filterWidget().within(() => {
      cy.findByText("2 selections").click();
    });
    popover().within(() => {
      cy.findByText("Gadget").click();
      cy.button("Update filter").click();
    });
    filterWidget().within(() => {
      cy.findByText("Widget").should("be.visible");
    });
    dashboardParametersContainer().within(() => {
      cy.button("Apply").should("be.visible");
    });
    rightSidebar().within(() => {
      cy.findByLabelText("Auto-apply filters").click();
      cy.wait("@updateDashboard");
      cy.findByLabelText("Auto-apply filters").should("be.checked");
    });
    filterWidget().within(() => {
      cy.findByText("2 selections").should("be.visible");
      cy.get("@cardQuery.all").should("have.length", 3);
    });

    rightSidebar().within(() => {
      cy.findByLabelText("Auto-apply filters").click();
      cy.wait("@updateDashboard");
      cy.findByLabelText("Auto-apply filters").should("not.be.checked");
    });
    filterWidget().within(() => {
      cy.findByText("2 selections").should("be.visible");
      cy.get("@cardQuery.all").should("have.length", 3);
    });
  });

  it("should display a toast when a dashboard takes longer than 15s to load", () => {
    cy.clock();
    createDashboard();
    openSlowDashboard({ [filter.slug]: "Gadget" });

    cy.tick(TOAST_TIMEOUT);
    cy.wait("@cardQuery");
    undoToast().within(() => {
      cy.findByText(TOAST_MESSAGE).should("be.visible");
      cy.button("Turn off").click();
      cy.wait("@updateDashboard");
    });
    dashboardHeader().within(() => {
      cy.icon("info").click();
    });
    rightSidebar().within(() => {
      cy.findByLabelText("Auto-apply filters").should("not.be.checked");
    });
    filterWidget().within(() => {
      cy.findByText("Gadget").should("be.visible");
    });
    getDashboardCard().within(() => {
      cy.findByText("Rows 1-6 of 53").should("be.visible");
    });
  });

  it("should not display the toast when auto applying filters is disabled", () => {
    cy.clock();
    createDashboard({ auto_apply_filters: false });
    openSlowDashboard({ [filter.slug]: "Gadget" });

    cy.tick(TOAST_TIMEOUT);
    cy.wait("@cardQuery");
    undoToast().should("not.exist");
    filterWidget().within(() => {
      cy.findByText("Gadget").should("be.visible");
    });
    getDashboardCard().within(() => {
      cy.findByText("Rows 1-6 of 53").should("be.visible");
    });
  });

  it("should not display the toast if there are no parameter values", () => {
    cy.clock();
    createDashboard();
    openSlowDashboard();

    cy.tick(TOAST_TIMEOUT);
    cy.wait("@cardQuery");
    undoToast().should("not.exist");
  });

  it("should not display the same toast twice for a dashboard", () => {
    cy.clock();
    createDashboard();
    openSlowDashboard({ [filter.slug]: "Gadget" });

    cy.tick(TOAST_TIMEOUT);
    cy.wait("@cardQuery");
    undoToast().within(() => {
      cy.button("Turn off").should("be.visible");
      cy.icon("close").click();
    });
    filterWidget().within(() => {
      cy.findByText("Gadget").click();
    });
    popover().within(() => {
      cy.findByText("Widget").click();
      cy.findByText("Update filter").click();
    });

    cy.tick(TOAST_TIMEOUT);
    cy.wait("@cardQuery");
    undoToast().should("not.exist");
  });
});

const createDashboard = (dashboardOpts = {}) => {
  cy.createQuestionAndDashboard({
    questionDetails,
    dashboardDetails: { ...dashboardDetails, ...dashboardOpts },
  }).then(({ body: card }) => {
    cy.editDashboardCard(card, getParameterMapping(card));
    cy.wrap(card.dashboard_id).as("dashboardId");
  });
};

const getParameterMapping = ({ card_id }) => ({
  parameter_mappings: [
    {
      card_id,
      parameter_id: filter.id,
      target: ["dimension", ["field", PRODUCTS.CATEGORY, null]],
    },
  ],
});

const openDashboard = (params = {}) => {
  cy.intercept("POST", "/api/dashboard/*/dashcard/*/card/*/query").as(
    "cardQuery",
  );

  cy.get("@dashboardId").then(dashboardId => {
    visitDashboard(dashboardId, { params });
  });
};

const openSlowDashboard = (params = {}) => {
  cy.intercept("POST", "/api/dashboard/*/dashcard/*/card/*/query", req => {
    return Cypress.Promise.delay().then(() => req.reply());
  }).as("cardQuery");

  cy.get("@dashboardId").then(dashboardId => {
    return cy.visit({
      url: `/dashboard/${dashboardId}`,
      qs: params,
    });
  });

  getDashboardCard().should("be.visible");
};
