import { restore, describeEE } from "__support__/e2e/helpers";

describeEE("visual tests > admin > fonts", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    cy.intercept("GET", "/app/fonts/**").as("getFont");
  });

  it("should reload with new fonts", () => {
    cy.visit("/admin/settings/whitelabel");
    cy.findByText("Font");
    cy.percySnapshot("before-font");

    cy.findByText("Roboto Mono").click();
    cy.wait("@getFont");
    cy.percySnapshot("after-font");
  });
});
