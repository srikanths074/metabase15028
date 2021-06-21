import { restore, popover } from "__support__/e2e/cypress";
import { SAMPLE_DATASET } from "__support__/e2e/cypress_sample_dataset";

const {
  ORDERS_ID,
  ORDERS,
  PEOPLE_ID,
  PEOPLE,
  PRODUCTS_ID,
  PRODUCTS,
} = SAMPLE_DATASET;

describe("scenarios > binning > from a saved QB question with explicit joins", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    cy.createQuestion({
      name: "QB Binning",
      query: {
        "source-table": ORDERS_ID,
        joins: [
          {
            fields: [
              ["field", PEOPLE.LONGITUDE, { "join-alias": "People" }],
              [
                "field",
                PEOPLE.BIRTH_DATE,
                { "temporal-unit": "default", "join-alias": "People" },
              ],
            ],
            "source-table": PEOPLE_ID,
            condition: [
              "=",
              ["field", ORDERS.USER_ID, null],
              ["field", PEOPLE.ID, { "join-alias": "People" }],
            ],
            alias: "People",
          },
          {
            fields: [["field", PRODUCTS.PRICE, { "join-alias": "Products" }]],
            "source-table": PRODUCTS_ID,
            condition: [
              "=",
              ["field", ORDERS.PRODUCT_ID, null],
              ["field", PRODUCTS.ID, { "join-alias": "Products" }],
            ],
            alias: "Products",
          },
        ],
        fields: [["field", ORDERS.ID, null]],
      },
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
        openPopoverFromDefaultBucketSize("People → Birth Date", "by month");
      });

      chooseBucketAndAssert({
        bucketSize: "Year",
        columnType: "time",
        title: "Count by People → Birth Date: Year",
        values: ["1960", "1965", "2000"],
      });

      // Make sure time series chooseBucketAndAssertter works as well
      cy.get(".AdminSelect-content")
        .contains("Year")
        .click();
      cy.findByText("Quarter").click();

      cy.wait("@dataset");
      cy.get(".axis.x").within(() => {
        cy.findByText("Q1 - 1960");
        cy.findByText("Q1 - 1965");
        cy.findByText("Q1 - 2000");
      });
    });

    it("should work for number", () => {
      cy.findByTestId("sidebar-right").within(() => {
        openPopoverFromDefaultBucketSize("Products → Price", "Auto bin");
      });

      chooseBucketAndAssert({
        bucketSize: "50 bins",
        title: "Count by Products → Price: 50 bins",
        values: ["14", "18", "20", "100"],
      });
    });

    it("should work for longitude", () => {
      cy.findByTestId("sidebar-right").within(() => {
        openPopoverFromDefaultBucketSize("People → Longitude", "Auto bin");
      });

      chooseBucketAndAssert({
        bucketSize: "Bin every 20 degrees",
        title: "Count by People → Longitude: 20°",
        values: ["180° W", "160° W", "60° W"],
      });
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
        openPopoverFromDefaultBucketSize("People → Birth Date", "by month");
      });

      chooseBucketAndAssert({
        bucketSize: "Year",
        columnType: "time",
        mode: "notebook",
        title: "Count by People → Birth Date: Year",
        values: ["1960", "1965", "2000"],
      });

      // Make sure time series chooseBucketAndAssertter works as well
      cy.get(".AdminSelect-content")
        .contains("Year")
        .click();
      cy.findByText("Quarter").click();

      cy.wait("@dataset");
      cy.get(".axis.x").within(() => {
        cy.findByText("Q1 - 1960");
        cy.findByText("Q1 - 1965");
        cy.findByText("Q1 - 2000");
      });
    });

    it("should work for number", () => {
      popover().within(() => {
        openPopoverFromDefaultBucketSize("Products → Price", "Auto bin");
      });

      chooseBucketAndAssert({
        bucketSize: "50 bins",
        mode: "notebook",
        title: "Count by Products → Price: 50 bins",
        values: ["14", "18", "20", "100"],
      });
    });

    it("should work for longitude", () => {
      popover().within(() => {
        openPopoverFromDefaultBucketSize("People → Longitude", "Auto bin");
      });

      chooseBucketAndAssert({
        bucketSize: "Bin every 20 degrees",
        mode: "notebook",
        title: "Count by People → Longitude: 20°",
        values: ["180° W", "160° W", "60° W"],
      });
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

function chooseBucketAndAssert({
  bucketSize,
  columnType,
  title,
  mode = null,
  values,
} = {}) {
  popover()
    .last()
    .within(() => {
      cy.findByText(bucketSize).click();
    });

  if (mode === "notebook") {
    cy.button("Visualize").click();
  }

  waitAndAssertOnRequest("@dataset");

  const visualizaitonSelector = columnType === "time" ? "circle" : ".bar";
  cy.get(visualizaitonSelector);

  cy.findByText(title);

  values &&
    cy.get(".axis.x").within(() => {
      values.forEach(value => {
        cy.findByText(value);
      });
    });
}
