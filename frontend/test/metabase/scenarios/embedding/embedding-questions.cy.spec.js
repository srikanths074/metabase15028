import { restore, visitQuestion, popover } from "__support__/e2e/cypress";
import { SAMPLE_DATABASE } from "__support__/e2e/cypress_sample_database";

import { regularQuestion } from "./embedding-questions";

const { ORDERS, PRODUCTS } = SAMPLE_DATABASE;

describe("scenarios > embedding > questions ", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();

    // Remap Product ID -> Product Title
    cy.request("POST", `/api/field/${ORDERS.PRODUCT_ID}/dimension`, {
      name: "Product ID as Title",
      type: "external",
      human_readable_field_id: PRODUCTS.TITLE,
    });

    // Do not include Subtotal anywhere
    cy.request("PUT", `/api/field/${ORDERS.SUBTOTAL}`, {
      visibility_type: "sensitive",
    });
  });

  it("should display the regular GUI question correctly", () => {
    const { name: title, description } = regularQuestion;

    cy.createQuestion(regularQuestion).then(({ body: { id } }) => {
      cy.request("PUT", `/api/card/${id}`, { enable_embedding: true });

      visitQuestion(id);
    });

    cy.icon("share").click();
    cy.findByText("Embed this question in an application").click();

    cy.document().then(doc => {
      const iframe = doc.querySelector("iframe");
      cy.visit(iframe.src);
    });

    cy.findByText(title);

    cy.icon("info").realHover();
    popover().contains(description);

    // Data model: Renamed column
    cy.findByText("Product ID as Title");
    // Data model: Display value changed to show FK
    cy.findByText("Awesome Concrete Shoes");
    // Custom column
    cy.findByText("Math");
    // Question settings: Renamed column
    cy.findByText("Billed");
    // Question settings: Column formating
    cy.findByText("€39.72");
    // Question settings: Abbreviated date, day enabled, 24H clock with seconds
    cy.findByText("Mon, Feb 11, 2019, 21:40:27");
    // Question settings: Show mini-bar
    cy.findAllByTestId("mini-bar");

    // Data model: Subtotal is turned off globally
    cy.findByText("Subtotal").should("not.exist");
  });
});
