import { restore, typeAndBlurUsingLabel } from "__support__/e2e/helpers";

const CLIENT_ID_SUFFIX = "apps.googleusercontent.com";

describe("scenarios > admin > settings > SSO > Google", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    cy.intercept("PUT", "/api/setting/*").as("updateSetting");
    cy.intercept("PUT", "/api/google/settings").as("updateGoogleSettings");
  });

  it("should save the client id on subsequent tries (metabase#15974)", () => {
    cy.visit("/admin/settings/authentication/google");

    typeAndBlurUsingLabel("Client ID", "example1.apps.googleusercontent.com");
    cy.button("Save and enable").click();
    cy.wait("@updateGoogleSettings");
    cy.reload();
    cy.findByDisplayValue(`example1.${CLIENT_ID_SUFFIX}`).should("be.visible");

    typeAndBlurUsingLabel("Client ID", `example2.${CLIENT_ID_SUFFIX}`);
    cy.button("Save changes").click();
    cy.wait("@updateGoogleSettings");
    cy.findByText("Success").should("be.visible");
  });

  it("should disable google auth (metabase#20442)", () => {
    setupGoogleAuth();
    cy.visit("/admin/settings/authentication");

    cy.findByRole("switch", { name: "Sign in with Google" }).click();
    cy.wait("@updateSetting");
    cy.findByRole("switch", { name: "Sign in with Google" }).should(
      "not.be.checked",
    );
    cy.findByText("Saved").should("exist");
  });

  it("should show an error message if the client id does not end with the correct suffix (metabase#15975)", () => {
    cy.visit("/admin/settings/authentication/google");

    typeAndBlurUsingLabel("Client ID", "fake-client-id");
    cy.button("Save and enable").click();
    cy.findByText(
      `Invalid Google Sign-In Client ID: must end with ".${CLIENT_ID_SUFFIX}"`,
    ).should("be.visible");
  });

  it("should show the button to sign in via google only when enabled", () => {
    setupGoogleAuth({ enabled: true });
    cy.signOut();
    cy.visit("/auth/login");
    cy.findByText("Sign in with email").should("be.visible");
    cy.findByRole("button", { name: /Google/ }).should("be.visible");

    cy.signInAsAdmin();
    setupGoogleAuth({ enabled: false });
    cy.signOut();
    cy.visit("/auth/login");
    cy.findByText("Email address").should("be.visible");
    cy.findByText("Password").should("be.visible");
    cy.findByRole("button", { name: /Google/ }).should("not.exist");
  });
});

const setupGoogleAuth = ({ enabled = true } = {}) => {
  cy.request("PUT", "/api/google/settings", {
    "google-auth-enabled": enabled,
    "google-auth-client-id": `example.${CLIENT_ID_SUFFIX}`,
    "google-auth-auto-create-accounts-domain": "example.test",
  });
};
