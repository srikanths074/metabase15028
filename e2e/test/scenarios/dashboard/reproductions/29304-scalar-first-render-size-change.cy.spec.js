import { restore } from "e2e/support/helpers";

import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";

const { ORDERS, ORDERS_ID } = SAMPLE_DATABASE;

const SCALAR_QUESTION = {
  name: "Scalar question",
  query: {
    "source-table": ORDERS_ID,
    aggregation: [["count"]],
  },
  display: "scalar",
};

const SCALAR_QUESTION_CARD = { size_x: 4, size_y: 3, row: 0, col: 0 };

const SMART_SCALAR_QUESTION = {
  name: "Smart scalar question",
  query: {
    "source-table": ORDERS_ID,
    aggregation: [["count"]],
    breakout: [
      [
        "field",
        ORDERS.CREATED_AT,
        {
          "base-type": "type/DateTime",
          "temporal-unit": "month",
        },
      ],
    ],
  },
  display: "smartscalar",
};

const SMART_SCALAR_QUESTION_CARD = SCALAR_QUESTION_CARD;

describe("issue 29304", () => {
  describe("display: scalar", () => {
    beforeEach(() => {
      restore();
      cy.signInAsAdmin();
      cy.intercept("api/dashboard/*/dashcard/*/card/*/query").as(
        "getDashcardQuery",
      );
      cy.intercept("api/dashboard/*").as("getDashboard");
      cy.clock();
    });

    it("should render scalar with correct size on the first render (metabase#29304)", () => {
      cy.createDashboard().then(({ body: dashboard }) => {
        cy.createQuestionAndAddToDashboard(
          SCALAR_QUESTION,
          dashboard.id,
          SCALAR_QUESTION_CARD,
        );

        visitFullAppEmbeddingUrl({ url: `/dashboard/${dashboard.id}` });

        cy.wait("@getDashboard");
        cy.wait("@getDashcardQuery");
        // The timeout necessary to make sure the dashcard is rendered.
        const DASHCARD_FIRST_RENDER_TIMEOUT = 400;
        cy.tick(DASHCARD_FIRST_RENDER_TIMEOUT);
        cy.findByTestId("scalar-value").then(([$scalarValue]) => {
          // Before the fix the width would be around 50px
          expect($scalarValue.offsetWidth).to.be.greaterThan(100);
        });
      });
    });

    it("should render smart scalar with correct size on the first render (metabase#29304)", () => {
      cy.createDashboard().then(({ body: dashboard }) => {
        cy.createQuestionAndAddToDashboard(
          SMART_SCALAR_QUESTION,
          dashboard.id,
          SMART_SCALAR_QUESTION_CARD,
        );

        visitFullAppEmbeddingUrl({ url: `/dashboard/${dashboard.id}` });

        cy.wait("@getDashboard");
        cy.wait("@getDashcardQuery");
        // The timeout necessary to make sure the dashcard is rendered.
        const DASHCARD_FIRST_RENDER_TIMEOUT = 400;
        cy.tick(DASHCARD_FIRST_RENDER_TIMEOUT);
        cy.findByTestId("scalar-value").then(([$scalarValue]) => {
          // Before the fix the width would be around 30px
          expect($scalarValue.offsetWidth).to.be.greaterThan(60);
        });
      });
    });
  });
});

// Use full-app embedding to test because `ExplicitSize` checks for `isCypressActive`,
// which checks `window.Cypress`, and will disable the refresh mode on Cypress test.
// If we test by simply visiting the dashboard, the refresh mode will be disabled,
// and we won't be able to reproduce the problem.
const visitFullAppEmbeddingUrl = ({ url }) => {
  cy.visit({
    url,
    onBeforeLoad(window) {
      // cypress runs all tests in an iframe and the app uses this property to avoid embedding mode for all tests
      // by removing the property the app would work in embedding mode
      window.Cypress = undefined;
    },
  });
};
