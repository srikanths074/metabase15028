import _ from "underscore";

import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import {
  appBar,
  createQuestion,
  describeEE,
  navigationSidebar,
  popover,
  restore,
  setTokenFeatures,
  visitMetric,
} from "e2e/support/helpers";

const { ORDERS_ID } = SAMPLE_DATABASE;

const ORDERS_SCALAR_METRIC = {
  name: "Count of orders",
  type: "metric",
  query: {
    "source-table": ORDERS_ID,
    aggregation: [["count"]],
  },
  display: "scalar",
};

describe("scenarios > metrics > search", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
    cy.intercept("POST", "/api/dataset").as("dataset");
    cy.intercept("GET", "/api/search?q=*").as("search");
  });

  it("should be able to search for metrics in global search", () => {
    createQuestion(ORDERS_SCALAR_METRIC);
    cy.visit("/");
    appBar().findByPlaceholderText("Search…").type(ORDERS_SCALAR_METRIC.name);
    cy.wait("@search");
    cy.findByTestId("search-results-floating-container")
      .findByText(ORDERS_SCALAR_METRIC.name)
      .click();
    cy.wait("@dataset");
    cy.findByTestId("scalar-container").should("be.visible");
  });

  it("should be able to search for metrics on the search page", () => {
    createQuestion(ORDERS_SCALAR_METRIC);
    cy.visit("/");
    appBar().findByPlaceholderText("Search…").type("orders{enter}");
    cy.wait("@search");
    cy.findByTestId("search-app").within(() => {
      cy.findByText(ORDERS_SCALAR_METRIC.name).should("be.visible");
      cy.findByText("Orders in a dashboard").should("be.visible");
      cy.findByTestId("type-search-filter").click();
    });
    popover().within(() => {
      cy.findByText("Metric").click();
      cy.findByText("Apply").click();
    });
    cy.wait("@search");
    cy.findByTestId("search-app").within(() => {
      cy.findByText("1 result").should("be.visible");
      cy.findByText(ORDERS_SCALAR_METRIC.name).click();
    });
    cy.wait("@dataset");
    cy.findByTestId("scalar-container").should("be.visible");
  });

  it("should see metrics in recent items in global search", () => {
    createQuestion(ORDERS_SCALAR_METRIC).then(({ body: card }) => {
      visitMetric(card.id);
      cy.wait("@dataset");
    });
    navigationSidebar().findByText("Home").click();
    appBar().findByPlaceholderText("Search…").click();
    cy.findByTestId("search-results-floating-container")
      .findByText(ORDERS_SCALAR_METRIC.name)
      .click();
    cy.wait("@dataset");
    cy.findByTestId("scalar-container").should("be.visible");
  });

  it("should see metrics in recent items on the home page", () => {
    createQuestion(ORDERS_SCALAR_METRIC).then(({ body: card }) => {
      visitMetric(card.id);
      cy.wait("@dataset");
    });
    navigationSidebar().findByText("Home").click();
    cy.findByTestId("home-page").within(() => {
      cy.findByText("Pick up where you left off").should("be.visible");
      cy.findByText(ORDERS_SCALAR_METRIC.name).click();
      cy.wait("@dataset");
    });
    cy.findByTestId("scalar-container").should("be.visible");
  });
});

describeEE("scenarios > metrics > search", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    cy.intercept("POST", "/api/dataset").as("dataset");
    setTokenFeatures("all");
  });

  it.skip("should see metrics in popular items on the homepage (metabase#42607)", () => {
    createQuestion(ORDERS_SCALAR_METRIC).then(({ body: card }) => {
      visitMetric(card.id);
      cy.wait("@dataset");
    });
    cy.signInAsNormalUser();
    cy.visit("/");
    cy.findByTestId("home-page").within(() => {
      cy.findByText("Here are some popular metrics").should("be.visible");
      cy.findByText(ORDERS_SCALAR_METRIC.name).click();
      cy.wait("@dataset");
    });
    cy.findByTestId("scalar-container").should("be.visible");
  });
});
