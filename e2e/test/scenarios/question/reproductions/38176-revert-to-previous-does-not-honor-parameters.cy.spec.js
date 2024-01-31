import { restore, questionInfoButton, rightSidebar } from "e2e/support/helpers";

describe("issue 38176", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
    cy.intercept("PUT", "/api/card/**").as("updateQuestion");
  });

  it("restoring a question to a previous version should preserve the variables", () => {
    cy.createNativeQuestion(
      {
        name: "30165",
        native: {
          query:
            'SELECT "COUNTRY" from "ACCOUNTS" WHERE country = {{ country }} LIMIT 5',
          "template-tags": {
            country: {
              type: "text",
              id: "dd06cd10-596b-41d0-9d6e-94e98ceaf989",
              name: "country",
              "display-name": "Country",
            },
          },
        },
      },
      { visitQuestion: true },
    );

    cy.findByPlaceholderText("Country").type("NL", { delay: 0 });
    cy.get("button[aria-label='Get Answer']").first().click();

    questionInfoButton().click();
    rightSidebar().within(() => {
      cy.findByText("History");

      cy.findByPlaceholderText("Add description")
        .type("This is a question")
        .blur();

      cy.wait("@updateQuestion");
      cy.findByText(/added a description/i);
      cy.findByTestId("question-revert-button").click();

      cy.findByText(/reverted to an earlier version/i).should("be.visible");
    });

    cy.findByTestId("TableInteractive-root").within(() => {
      cy.findByText("COUNTRY").should("be.visible");
    });
  });
});
