import { restore, focusNativeEditor } from "e2e/support/helpers";

const questionDetails = {
  name: "REVIEWS SQL",
  native: { query: "select REVIEWER from REVIEWS" },
};

describe("issue 35344", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should not allow the user to undo to the empty editor (metabase#35344)", () => {
    cy.createNativeQuestion(questionDetails, { visitQuestion: true });

    cy.findByTestId("query-builder-main").findByText("Open Editor").click();

    focusNativeEditor().type("{meta}z");
    expect(focusNativeEditor().findByText("select")).to.exist;
  });
});
