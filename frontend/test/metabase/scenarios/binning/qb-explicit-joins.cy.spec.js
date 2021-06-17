import { restore, popover } from "__support__/e2e/cypress";

describe("scenarios > binning > from a saved QB question with explicit joins", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    cy.createQuestion({
      name: "QB Binning",
      query: {
        "source-table": 2,
        joins: [
          {
            fields: [["field", 20, { "join-alias": "People - User" }]],
            "source-table": 3,
            condition: [
              "=",
              ["field", 11, null],
              ["field", 30, { "join-alias": "People - User" }],
            ],
            alias: "People - User",
          },
        ],
        fields: [
          ["field", 15, null],
          ["field", 12, { "temporal-unit": "default" }],
        ],
      },
      visualization_settings: {
        "table.columns": [
          { name: "ID", fieldRef: ["field", 17, null], enabled: false },
          { name: "USER_ID", fieldRef: ["field", 11, null], enabled: false },
          { name: "PRODUCT_ID", fieldRef: ["field", 13, null], enabled: false },
          { name: "SUBTOTAL", fieldRef: ["field", 14, null], enabled: false },
          { name: "TAX", fieldRef: ["field", 16, null], enabled: false },
          { name: "TOTAL", fieldRef: ["field", 15, null], enabled: true },
          { name: "DISCOUNT", fieldRef: ["field", 9, null], enabled: false },
          {
            name: "CREATED_AT",
            fieldRef: ["field", 12, { "temporal-unit": "default" }],
            enabled: true,
          },
          { name: "QUANTITY", fieldRef: ["field", 10, null], enabled: false },
          {
            name: "ID_2",
            fieldRef: ["field", 30, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "ADDRESS",
            fieldRef: ["field", 21, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "EMAIL",
            fieldRef: ["field", 23, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "PASSWORD",
            fieldRef: ["field", 19, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "NAME",
            fieldRef: ["field", 22, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "CITY",
            fieldRef: ["field", 29, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "LONGITUDE",
            fieldRef: ["field", 20, { "join-alias": "People - User" }],
            enabled: true,
          },
          {
            name: "STATE",
            fieldRef: ["field", 25, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "SOURCE",
            fieldRef: ["field", 26, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "BIRTH_DATE",
            fieldRef: [
              "field",
              24,
              { "temporal-unit": "default", "join-alias": "People - User" },
            ],
            enabled: false,
          },
          {
            name: "ZIP",
            fieldRef: ["field", 28, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "LATITUDE",
            fieldRef: ["field", 27, { "join-alias": "People - User" }],
            enabled: false,
          },
          {
            name: "CREATED_AT_2",
            fieldRef: [
              "field",
              18,
              { "temporal-unit": "default", "join-alias": "People - User" },
            ],
            enabled: false,
          },
        ],
        "table.pivot_column": "LONGITUDE",
        "table.cell_column": "TOTAL",
      },
    }).then(({ body: { id: QUESTION_ID } }) => {
      cy.visit(`/question/${QUESTION_ID}`);
    });

    cy.intercept("POST", "/api/dataset").as("dataset");
  });

  context("via simple question", () => {
    beforeEach(() => {
      cy.visit("/question/new");
      cy.findByText("Simple question").click();
      cy.findByText("Saved Questions").click();
      cy.findByText("QB Binning").click();
      cy.findByText("Summarize").click();
      cy.wait("@dataset");
    });

    it("should work for time series", () => {
      cy.findByTestId("sidebar-right").within(() => {
        // This basic/default bucket seems wrong.
        // For every other scenario, the default bucker for time is "by month"
        openPopoverFromDefaultBucketSize("Created At", "by month");
      });

      popover().within(() => {
        cy.findByText("Year").click();
      });

      waitAndAssertOnRequest("@dataset");

      cy.findByText("Count by Created At: Year");
      cy.get("circle");
    });

    it("should work for number", () => {
      cy.findByTestId("sidebar-right").within(() => {
        openPopoverFromDefaultBucketSize("Total", "Auto bin");
      });

      popover().within(() => {
        cy.findByText("100 bins").click();
      });

      waitAndAssertOnRequest("@dataset");

      cy.findByText("Count by Total: 100 bins");
      cy.get(".bar");
    });

    it("should work for longitude", () => {
      cy.findByTestId("sidebar-right").within(() => {
        openPopoverFromDefaultBucketSize(
          "People - User → Longitude",
          "Auto bin",
        );
      });

      popover().within(() => {
        cy.findByText("Bin every 10 degrees").click();
      });

      waitAndAssertOnRequest("@dataset");

      cy.findByText("Count by People - User → Longitude: 10°");
      cy.get(".bar");
    });
  });

  context("via custom question", () => {
    beforeEach(() => {
      cy.visit("/question/new");
      cy.findByText("Custom question").click();
      cy.findByText("Saved Questions").click();
      cy.findByText("QB Binning").click();

      cy.findByText("Summarize").click();
      cy.findByText("Pick the metric you want to see").click();
      cy.findByText("Count of rows").click();
      cy.findByText("Pick a column to group by").click();
    });

    it("should work for time series", () => {
      popover().within(() => {
        openPopoverFromDefaultBucketSize("Created At", "by month");
      });
      cy.findByText("Year").click();

      cy.findByText("Count by Created At: Year");
      cy.button("Visualize").click();

      waitAndAssertOnRequest("@dataset");
      cy.get("circle");
    });

    it("should work for number", () => {
      popover().within(() => {
        openPopoverFromDefaultBucketSize("Total", "Auto bin");
      });
      cy.findByText("100 bins").click();

      cy.findByText("Count by Total: 100 bins");
      cy.button("Visualize").click();

      waitAndAssertOnRequest("@dataset");
      cy.get(".bar");
    });

    it("should work for longitude", () => {
      popover().within(() => {
        openPopoverFromDefaultBucketSize(
          "People - User → Longitude",
          "Auto bin",
        );
      });
      cy.findByText("Bin every 10 degrees").click();

      cy.findByText("Count by People - User → Longitude: 10°");
      cy.button("Visualize").click();

      waitAndAssertOnRequest("@dataset");
      cy.get(".bar");
    });
  });

  context("via column popover", () => {
    beforeEach(() => {
      cy.visit("/question/new");
      cy.findByText("Simple question").click();
      cy.findByText("Saved Questions").click();
      cy.findByText("QB Binning").click();
    });

    it("should work for time series", () => {
      cy.findByText("Created At").click();
      cy.findByText("Distribution").click();

      assertOnXYAxisLabels({ xLabel: "Created At", yLabel: "Count" });
      cy.findByText("Count by Created At: Month");
      cy.get("circle");

      // Open a popover with bucket options from the time series footer
      cy.get(".AdminSelect-content")
        .contains("Month")
        .click();
      cy.findByText("Quarter").click();

      cy.findByText("Count by Created At: Quarter");
      cy.findByText("Q1 - 2017");
    });

    it("should work for number", () => {
      cy.findByText("Total").click();
      cy.findByText("Distribution").click();

      assertOnXYAxisLabels({ xLabel: "Total", yLabel: "Count" });
      cy.findByText("Count by Total: Auto binned");
      // Auto bin is much more granular than it is for QB questions
      cy.get(".bar");
    });

    it.skip("should work for longitude", () => {
      cy.findByText("People - User → Longitude").click();
      cy.findByText("Distribution").click();

      assertOnXYAxisLabels({
        xLabel: "People - User → Longitude",
        yLabel: "Count",
      });
      cy.findByText("Count by People - User → Longitude: Auto binned");
      // Auto bin is much more granular than it is for QB questions
      cy.get(".bar");
    });
  });
});

function openPopoverFromDefaultBucketSize(column, bucket) {
  cy.findByText(column)
    .closest(".List-item")
    .should("be.visible")
    .as("targetListItem");

  cy.get("@targetListItem")
    .find(".Field-extra")
    .as("listItemSelectedBinning")
    .should("contain", bucket)
    .click();
}

function assertOnXYAxisLabels({ xLabel, yLabel } = {}) {
  cy.get(".x-axis-label")
    .invoke("text")
    .should("eq", xLabel);

  cy.get(".y-axis-label")
    .invoke("text")
    .should("eq", yLabel);
}

function waitAndAssertOnRequest(requestAlias) {
  cy.wait(requestAlias).then(xhr => {
    expect(xhr.response.body.error).to.not.exist;
  });
}
