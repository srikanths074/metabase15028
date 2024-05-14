import { USER_GROUPS } from "e2e/support/cypress_data";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import {
  FIRST_COLLECTION_ID,
  ORDERS_DASHBOARD_ID,
  ORDERS_MODEL_ID,
} from "e2e/support/cypress_sample_instance_data";
import {
  createQuestion,
  echartsContainer,
  filterWidget,
  getDashboardCard,
  modal,
  popover,
  restore,
  saveDashboard,
  visitDashboard,
} from "e2e/support/helpers";

const { ORDERS_ID, ORDERS, PRODUCTS_ID, PRODUCTS } = SAMPLE_DATABASE;

const ORDERS_SCALAR_METRIC = {
  name: "Count of orders",
  type: "metric",
  query: {
    "source-table": ORDERS_ID,
    aggregation: [["count"]],
  },
  display: "scalar",
};

const ORDERS_SCALAR_MODEL_METRIC = {
  name: "Orders model metric",
  type: "metric",
  query: {
    "source-table": `card__${ORDERS_MODEL_ID}`,
    aggregation: [["count"]],
  },
  display: "scalar",
};

const ORDERS_TIMESERIES_METRIC = {
  name: "Count of orders over time",
  type: "metric",
  query: {
    "source-table": ORDERS_ID,
    aggregation: [["count"]],
    breakout: [
      [
        "field",
        ORDERS.CREATED_AT,
        { "base-type": "type/DateTime", "temporal-unit": "month" },
      ],
    ],
  },
  display: "line",
};

const PRODUCTS_SCALAR_METRIC = {
  name: "Count of products",
  type: "metric",
  query: {
    "source-table": PRODUCTS_ID,
    aggregation: [["count"]],
  },
  display: "scalar",
};

const PRODUCTS_TIMESERIES_METRIC = {
  name: "Count of products over time",
  type: "metric",
  query: {
    "source-table": PRODUCTS_ID,
    aggregation: [["count"]],
    breakout: [
      [
        "field",
        PRODUCTS.CREATED_AT,
        { "base-type": "type/DateTime", "temporal-unit": "month" },
      ],
    ],
  },
  display: "line",
};

describe("scenarios > metrics > dashboard", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should be possible to add metrics to a dashboard", () => {
    createQuestion(ORDERS_SCALAR_METRIC);
    createQuestion(ORDERS_TIMESERIES_METRIC);
    visitDashboard(ORDERS_DASHBOARD_ID);
    cy.findByTestId("dashboard-header").within(() => {
      cy.findByLabelText("Edit dashboard").click();
      cy.findByLabelText("Add questions").click();
    });
    cy.findByTestId("add-card-sidebar").within(() => {
      cy.findByText(ORDERS_SCALAR_METRIC.name).click();
      cy.findByPlaceholderText("Search…").type(ORDERS_TIMESERIES_METRIC.name);
      cy.findByText(ORDERS_SCALAR_METRIC.name).should("not.exist");
      cy.findByText(ORDERS_TIMESERIES_METRIC.name).click();
    });
    getDashboardCard(1).within(() => {
      cy.findByText(ORDERS_SCALAR_METRIC.name).should("be.visible");
      cy.findByText("18,760").should("be.visible");
    });
    getDashboardCard(2).within(() => {
      cy.findByText(ORDERS_TIMESERIES_METRIC.name).should("be.visible");
      echartsContainer().should("be.visible");
    });
  });

  it("should be able to add a filter and drill thru", () => {
    cy.createDashboardWithQuestions({
      questions: [ORDERS_SCALAR_METRIC],
    }).then(({ dashboard }) => {
      visitDashboard(dashboard.id);
    });
    getDashboardCard().findByText("18,760").should("be.visible");
    cy.findByTestId("dashboard-header").within(() => {
      cy.findByLabelText("Edit dashboard").click();
      cy.findByLabelText("Add a filter").click();
    });
    popover().findByText("Text or Category").click();
    getDashboardCard().findByText("Select…").click();
    popover().findByText("Category").click();
    saveDashboard();
    filterWidget().click();
    popover().within(() => {
      cy.findByText("Gadget").click();
      cy.button("Add filter").click();
    });
    getDashboardCard().within(() => {
      cy.findByText("4,939").should("be.visible");
      cy.findByText(ORDERS_SCALAR_METRIC.name).click();
    });
    cy.findByTestId("qb-filters-panel")
      .findByText("Product → Category is Gadget")
      .should("be.visible");
    cy.findByTestId("scalar-container")
      .findByText("4,939")
      .should("be.visible");
  });

  it("should be able to combine scalar metrics on a dashcard", () => {
    combineAndVerifyMetrics(ORDERS_SCALAR_METRIC, PRODUCTS_SCALAR_METRIC);
  });

  it.skip("should be able to combine timeseries metrics on a dashcard (metabase#42575)", () => {
    combineAndVerifyMetrics(
      ORDERS_TIMESERIES_METRIC,
      PRODUCTS_TIMESERIES_METRIC,
    );
  });

  it("should be able to view a model-based metric without collection access to the source model", () => {
    cy.signInAsAdmin();
    cy.updateCollectionGraph({
      [USER_GROUPS.ALL_USERS_GROUP]: {
        root: "none",
        [FIRST_COLLECTION_ID]: "read",
      },
    });
    cy.createDashboardWithQuestions({
      dashboardDetails: { collection_id: FIRST_COLLECTION_ID },
      questions: [
        {
          ...ORDERS_SCALAR_MODEL_METRIC,
          collection_id: FIRST_COLLECTION_ID,
        },
      ],
    }).then(({ dashboard }) => {
      cy.signIn("nocollection");
      visitDashboard(dashboard.id);
    });
    getDashboardCard()
      .findByTestId("scalar-container")
      .findByText("18,760")
      .should("be.visible");
  });
});

function combineAndVerifyMetrics(metric1, metric2) {
  cy.createDashboardWithQuestions({ questions: [metric1] }).then(
    ({ dashboard }) => {
      createQuestion(metric2);
      visitDashboard(dashboard.id);
    },
  );
  cy.findByTestId("dashboard-header").within(() => {
    cy.findByLabelText("Edit dashboard").click();
    cy.findByLabelText("Add questions").click();
  });
  cy.findByTestId("add-card-sidebar").findByText(metric1.name).click();
  getDashboardCard(1).realHover().findByTestId("add-series-button").click();
  modal().within(() => {
    cy.findByText(metric2.name).click();
    cy.findByLabelText("Legend").within(() => {
      cy.findByText(metric1.name).should("be.visible");
      cy.findByText(metric2.name).should("be.visible");
    });
    cy.button("Done").click();
  });
  saveDashboard();
  getDashboardCard(1).within(() => {
    cy.findByLabelText("Legend").within(() => {
      cy.findByText(metric1.name).should("be.visible");
      cy.findByText(metric2.name).should("be.visible");
    });
  });
}
