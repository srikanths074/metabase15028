import {
  restore,
  visualize,
  visitQuestionAdhoc,
  enterCustomColumnDetails,
} from "__support__/e2e/helpers";

import { SAMPLE_DB_ID } from "__support__/e2e/cypress_data";
import { SAMPLE_DATABASE } from "__support__/e2e/cypress_sample_database";

const { REVIEWS, REVIEWS_ID, PRODUCTS, ORDERS, ORDERS_ID } = SAMPLE_DATABASE;

const questionDetails = {
  name: "20809",
  query: {
    "source-table": REVIEWS_ID,
    filter: [
      "=",
      ["field", PRODUCTS.CATEGORY, { "source-field": REVIEWS.PRODUCT_ID }],
      "Doohickey",
    ],
    aggregation: [["count"]],
    breakout: [["field", REVIEWS.PRODUCT_ID, null]],
  },
};

describe.skip("issue 20809", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();

    cy.createQuestion(questionDetails).then(({ body: { id } }) => {
      const nestedQuestion = {
        dataset_query: {
          database: SAMPLE_DB_ID,
          query: {
            "source-table": ORDERS_ID,
            joins: [
              {
                fields: "all",
                "source-table": `card__${id}`,
                condition: [
                  "=",
                  ["field", ORDERS.PRODUCT_ID, null],
                  [
                    "field",
                    REVIEWS.PRODUCT_ID,
                    { "join-alias": `Question ${id}` },
                  ],
                ],
                alias: `Question ${id}`,
              },
            ],
          },
          type: "query",
        },
      };

      visitQuestionAdhoc(nestedQuestion, { mode: "notebook" });
    });
  });

  it("nesting should work on a saved question with a filter to implicit/explicit table (metabase#20809)", () => {
    cy.findByTextEnsureVisible("Custom column").click();

    enterCustomColumnDetails({
      formula: "1 + 1",
      name: "Two",
    });

    cy.button("Done").click();

    visualize(response => {
      expect(response.body.error).to.not.exist;
    });

    cy.contains("37.65");
  });
});
