import {
  restore,
  popover,
  openOrdersTable,
  remapDisplayValueToFK,
  visitQuestion,
  visitQuestionAdhoc,
  visualize,
  getDimensionByName,
  summarize,
  startNewQuestion,
  filter,
  filterField,
} from "__support__/e2e/helpers";

import { SAMPLE_DB_ID } from "__support__/e2e/cypress_data";
import { SAMPLE_DATABASE } from "__support__/e2e/cypress_sample_database";

const { ORDERS, ORDERS_ID, PRODUCTS, PRODUCTS_ID } = SAMPLE_DATABASE;

describe("scenarios > question > nested", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("should allow 'Distribution' and 'Sum over time' on nested questions (metabase#12568)", () => {
    cy.intercept("POST", "/api/dataset").as("dataset");

    // Make sure it works for a GUI question
    const guiQuestionDetails = {
      name: "GH_12568: Simple",
      query: {
        "source-table": ORDERS_ID,
        aggregation: [["count"]],
        breakout: [["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }]],
      },
      display: "line",
    };

    createNestedQuestion(
      {
        baseQuestionDetails: guiQuestionDetails,
        nestedQuestionDetails: { name: "Nested GUI" },
      },
      { loadBaseQuestionMetadata: true },
    );

    cy.contains("Count").click();
    cy.contains("Distribution").click();
    cy.wait("@dataset");
    cy.contains("Count by Count: Auto binned");
    cy.get(".bar").should("have.length.of.at.least", 8);

    // Go back to the nested question and make sure Sum over time works
    cy.findByText("Nested GUI").click();

    cy.contains("Count").click();
    cy.contains("Sum over time").click();
    cy.contains("Sum of Count");
    cy.findByText("137");

    // Make sure it works for a SQL question
    const sqlQuestionDetails = {
      name: "GH_12568: SQL",
      native: {
        query:
          "SELECT date_trunc('year', CREATED_AT) as date, COUNT(*) as count FROM ORDERS GROUP BY date_trunc('year', CREATED_AT)",
      },
      display: "scalar",
    };

    createNestedQuestion(
      {
        baseQuestionDetails: sqlQuestionDetails,
        nestedQuestionDetails: { name: "Nested SQL" },
      },
      { loadBaseQuestionMetadata: true },
    );

    cy.contains("COUNT").click();
    cy.contains("Distribution").click();
    cy.wait("@dataset");
    cy.contains("Count by COUNT: Auto binned");
    cy.get(".bar").should("have.length.of.at.least", 5);

    cy.findByText("Nested SQL").click();

    cy.contains("COUNT").click();
    cy.contains("Sum over time").click();
    cy.wait("@dataset");
    cy.contains("Sum of COUNT");
    cy.findByText("744");
  });

  it("should handle duplicate column names in nested queries (metabase#10511)", () => {
    cy.createQuestion(
      {
        name: "10511",
        query: {
          filter: [">", ["field", "count", { "base-type": "type/Integer" }], 5],
          "source-query": {
            "source-table": ORDERS_ID,
            aggregation: [["count"]],
            breakout: [
              ["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }],
              [
                "field",
                PRODUCTS.CREATED_AT,
                { "temporal-unit": "month", "source-field": ORDERS.PRODUCT_ID },
              ],
            ],
          },
        },
      },
      { visitQuestion: true },
    );

    cy.findByText("10511");
    cy.findAllByText("June, 2016");
    cy.findAllByText("13");
  });

  it.skip("should display granularity for aggregated fields in nested questions (metabase#13764)", () => {
    openOrdersTable({ mode: "notebook" });

    // add initial aggregation ("Average of Total by Order ID")
    summarize({ mode: "notebook" });
    cy.findByText("Average of ...").click();
    cy.findByText("Total").click();
    cy.findByText("Pick a column to group by").click();
    cy.findByText("ID").click();

    // add another aggregation ("Count by Average of Total")
    summarize({ mode: "notebook" });
    cy.findByText("Count of rows").click();
    cy.findByText("Pick a column to group by").click();
    cy.log("Reported failing on v0.34.3 - v0.37.0.2");
    popover()
      .contains("Average of Total")
      .closest(".List-item")
      .contains("Auto binned");
  });

  it("should apply metrics including filter to the nested question (metabase#12507)", () => {
    const METRIC_NAME = "Sum of discounts";

    cy.log("Create a metric with a filter");
    cy.request("POST", "/api/metric", {
      name: METRIC_NAME,
      description: "Discounted orders.",
      table_id: ORDERS_ID,
      definition: {
        "source-table": ORDERS_ID,
        aggregation: [["count"]],
        filter: ["!=", ["field", ORDERS.DISCOUNT, null], 0],
      },
    }).then(({ body: { id: metricId } }) => {
      // "capture" the original query because we will need to re-use it later in a nested question as "source-query"
      const ORIGINAL_QUERY = {
        "source-table": ORDERS_ID,
        aggregation: [["metric", metricId]],
        breakout: [
          ["field", ORDERS.TOTAL, { binning: { strategy: "default" } }],
        ],
      };

      // Create new question which uses previously defined metric
      cy.createQuestion({
        name: "12507",
        query: ORIGINAL_QUERY,
      }).then(({ body: { id: questionId } }) => {
        cy.log("Create and visit a nested question based on the previous one");
        visitQuestionAdhoc({
          dataset_query: {
            type: "query",
            query: {
              "source-table": `card__${questionId}`,
              filter: [">", ["field", ORDERS.TOTAL, null], 50],
            },
            database: SAMPLE_DB_ID,
          },
        });

        cy.log("Reported failing since v0.35.2");
        cy.get(".cellData").contains(METRIC_NAME);
      });
    });
  });

  it("should handle remapped display values in a base QB question (metabase#10474)", () => {
    cy.log(
      "Related issue [#14629](https://github.com/metabase/metabase/issues/14629)",
    );

    cy.intercept("POST", "/api/dataset").as("dataset");

    cy.log("Remap Product ID's display value to `title`");
    remapDisplayValueToFK({
      display_value: ORDERS.PRODUCT_ID,
      name: "Product ID",
      fk: PRODUCTS.TITLE,
    });

    cy.createQuestion({
      name: "Orders (remapped)",
      query: { "source-table": ORDERS_ID },
    });

    // Try to use saved question as a base for a new / nested question
    startNewQuestion();
    cy.findByText("Saved Questions").click();
    cy.findByText("Orders (remapped)").click();

    visualize(response => {
      expect(response.body.error).not.to.exist;
    });

    cy.findAllByText("Awesome Concrete Shoes");
  });

  ["remapped", "default"].forEach(test => {
    describe(`${test.toUpperCase()} version: question with joins as a base for new quesiton(s) (metabase#14724)`, () => {
      const QUESTION_NAME = "14724";
      const SECOND_QUESTION_NAME = "14724_2";

      beforeEach(() => {
        if (test === "remapped") {
          cy.log("Remap Product ID's display value to `title`");
          remapDisplayValueToFK({
            display_value: ORDERS.PRODUCT_ID,
            name: "Product ID",
            fk: PRODUCTS.TITLE,
          });
        }

        cy.server();
        cy.route("POST", "/api/dataset").as("dataset");
      });

      it("should handle single-level nesting", () => {
        ordersJoinProducts(QUESTION_NAME);

        // Start new question from a saved one
        startNewQuestion();
        cy.findByText("Saved Questions").click();
        cy.findByText(QUESTION_NAME).click();

        visualize(response => {
          expect(response.body.error).not.to.exist;
        });

        cy.contains("37.65");
      });

      it("should handle multi-level nesting", () => {
        // Use the original question qith joins, then save it again
        ordersJoinProducts(QUESTION_NAME).then(
          ({ body: { id: ORIGINAL_QUESTION_ID } }) => {
            cy.createQuestion({
              name: SECOND_QUESTION_NAME,
              query: { "source-table": `card__${ORIGINAL_QUESTION_ID}` },
            });
          },
        );

        // Start new question from already saved nested question
        startNewQuestion();
        cy.findByText("Saved Questions").click();
        cy.findByText(SECOND_QUESTION_NAME).click();

        visualize(response => {
          expect(response.body.error).not.to.exist;
        });

        cy.contains("37.65");
      });
    });
  });

  it("'distribution' should work on a joined table from a saved question (metabase#14787)", () => {
    // Set the display really wide and really tall to avoid any scrolling
    cy.viewport(1600, 1200);

    ordersJoinProducts("14787");
    // This repro depends on these exact steps - it has to be opened from the saved questions
    startNewQuestion();
    cy.findByText("Saved Questions").click();
    cy.findByText("14787").click();

    visualize();

    // The column title
    cy.findByText("Products → Category").click();
    cy.findByText("Distribution").click();
    cy.wait("@dataset");

    summarize();

    cy.findByText("Group by")
      .parent()
      .within(() => {
        cy.log("Regression that worked on 0.37.9");
        isSelected("Products → Category");
      });

    // Although the test will fail on the previous step, we're including additional safeguards against regressions once the issue is fixed
    // It can potentially fail at two more places. See [1] and [2]
    cy.icon("notebook").click();
    cy.findAllByTestId("notebook-cell-item")
      .contains(/^Products → Category$/) /* [1] */
      .click();
    popover().within(() => {
      isSelected("Products → Category"); /* [2] */
    });

    /**
     * Helper function related to this test only
     * TODO:
     *  Extract it if we have the need for it anywhere else
     */
    function isSelected(text) {
      getDimensionByName({ name: text }).should(
        "have.attr",
        "aria-selected",
        "true",
      );
    }
  });

  ["count", "average"].forEach(test => {
    it(`${test.toUpperCase()}:\n should be able to use aggregation functions on saved native question (metabase#15397)`, () => {
      cy.createNativeQuestion(
        {
          name: "15397",
          native: {
            query:
              "select count(*), orders.product_id from orders group by orders.product_id;",
          },
        },
        { loadMetadata: true },
      );

      startNewQuestion();
      cy.findByText("Saved Questions").click();
      cy.findByText("15397").click();

      visualize();
      summarize();

      if (test === "average") {
        cy.findByTestId("sidebar-right")
          .should("be.visible")
          .findByText("Count")
          .click();
        cy.findByText("Average of ...").click();
        popover().findByText("COUNT(*)").click();
        cy.wait("@dataset");
      }

      cy.findByText("Group by").parent().findByText("COUNT(*)").click();

      cy.wait("@dataset").then(xhr => {
        expect(xhr.response.body.error).not.to.exist;
      });
      cy.get(".bar").should("have.length.of.at.least", 5);
    });
  });

  describe("should use the same query for date filter in both base and nested questions (metabase#15352)", () => {
    it("should work with 'between' date filter (metabase#15352-1)", () => {
      assertOnFilter({
        name: "15352-1",
        filter: [
          "between",
          ["field-id", ORDERS.CREATED_AT],
          "2020-02-01",
          "2020-02-29",
        ],
        value: "543",
      });
    });

    it("should work with 'after/before' date filter (metabase#15352-2)", () => {
      assertOnFilter({
        name: "15352-2",
        filter: [
          "and",
          [">", ["field-id", ORDERS.CREATED_AT], "2020-01-31"],
          ["<", ["field-id", ORDERS.CREATED_AT], "2020-03-01"],
        ],
        value: "543",
      });
    });

    it("should work with 'on' date filter (metabase#15352-3)", () => {
      assertOnFilter({
        name: "15352-3",
        filter: ["=", ["field-id", ORDERS.CREATED_AT], "2020-02-01"],
        value: "17",
      });
    });

    function assertOnFilter({ name, filter, value } = {}) {
      cy.createQuestion(
        {
          name,
          query: {
            "source-table": ORDERS_ID,
            filter,
            aggregation: [["count"]],
          },
          type: "query",
          display: "scalar",
        },
        { visitQuestion: true },
      );

      cy.get(".ScalarValue").findByText(value);

      // Start new question based on the saved one
      startNewQuestion();
      cy.findByText("Saved Questions").click();
      cy.findByText(name).click();
      visualize();
      cy.get(".ScalarValue").findByText(value);
    }
  });

  describe("should not remove user defined metric when summarizing based on saved question (metabase#15725)", () => {
    beforeEach(() => {
      cy.intercept("POST", "/api/dataset").as("dataset");
      cy.createNativeQuestion({
        name: "15725",
        native: { query: "select 'A' as cat, 5 as val" },
      });
      // Window object gets recreated for every `cy.visit`
      // See: https://stackoverflow.com/a/65218352/8815185
      cy.visit("/", {
        onBeforeLoad(win) {
          cy.spy(win.console, "warn").as("consoleWarn");
        },
      });
      cy.findByText("New").click();
      cy.findByText("Question").should("be.visible").click();
      cy.findByText("Saved Questions").click();
      cy.findByText("15725").click();
      cy.findByText("Pick the metric you want to see").click();
      cy.findByText("Count of rows").click();
    });

    it("Count of rows AND Sum of VAL by CAT (metabase#15725-1)", () => {
      cy.icon("add").last().click();
      cy.findByText(/^Sum of/).click();
      cy.findByText("VAL").click();
      cy.findByText("Sum of VAL");
      cy.findByText("Pick a column to group by").click();
      cy.findByText("CAT").click();

      visualize();

      cy.get("@consoleWarn").should(
        "not.be.calledWith",
        "Removing invalid MBQL clause",
      );
      cy.findByText("Sum of VAL");
    });

    it("Count of rows by CAT + add sum of VAL later from the sidebar (metabase#15725-2)", () => {
      cy.findByText("Pick a column to group by").click();
      cy.findByText("CAT").click();

      visualize();

      summarize();
      cy.findByTestId("add-aggregation-button").click();
      cy.findByText(/^Sum of/).click();
      popover().findByText("VAL").click();
      cy.wait("@dataset").then(xhr => {
        expect(xhr.response.body.error).not.to.exist;
      });
      cy.get("@consoleWarn").should(
        "not.be.calledWith",
        "Removing invalid MBQL clause",
      );
    });
  });

  it("should be able to use integer filter on a nested query based on a saved native question (metabase#15808)", () => {
    cy.createNativeQuestion({
      name: "15808",
      native: { query: "select * from products" },
    });
    startNewQuestion();
    cy.findByText("Saved Questions").click();
    cy.findByText("15808").click();
    visualize();

    filter();
    filterField("RATING", {
      operator: "Equal to",
      value: "4",
    });
    cy.findByTestId("apply-filters").click();

    cy.findByText("Synergistic Granite Chair");
    cy.findByText("Rustic Paper Wallet").should("not.exist");
  });
});

function ordersJoinProducts(name) {
  return cy.createQuestion({
    name,
    query: {
      "source-table": ORDERS_ID,
      joins: [
        {
          fields: "all",
          "source-table": PRODUCTS_ID,
          condition: [
            "=",
            ["field", ORDERS.PRODUCT_ID, null],
            ["field", PRODUCTS.ID, { "join-alias": "Products" }],
          ],
          alias: "Products",
        },
      ],
    },
  });
}

function createNestedQuestion(
  { baseQuestionDetails, nestedQuestionDetails },
  { loadBaseQuestionMetadata = false, visitNestedQuestion = true },
) {
  createBaseQuestion(baseQuestionDetails).then(({ body: { id } }) => {
    loadBaseQuestionMetadata && visitQuestion(id);

    return cy.createQuestion(
      {
        name: "Nested Question",
        query: {
          "source-table": `card__${id}`,
        },
        ...nestedQuestionDetails,
      },
      { visitQuestion: visitNestedQuestion },
    );
  });

  function createBaseQuestion(query) {
    return query.native
      ? cy.createNativeQuestion(query)
      : cy.createQuestion(query);
  }
}
