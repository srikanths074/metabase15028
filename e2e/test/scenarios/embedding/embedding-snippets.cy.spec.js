import {
  restore,
  popover,
  visitDashboard,
  visitQuestion,
  setTokenFeatures,
  openStaticEmbeddingModal,
  modal,
} from "e2e/support/helpers";
import {
  ORDERS_QUESTION_ID,
  ORDERS_DASHBOARD_ID,
} from "e2e/support/cypress_sample_instance_data";

import { JS_CODE, IFRAME_CODE } from "./shared/embedding-snippets";

const features = ["none", "all"];

features.forEach(feature => {
  describe("scenarios > embedding > code snippets", () => {
    beforeEach(() => {
      restore();
      cy.signInAsAdmin();
      setTokenFeatures(feature);
    });

    it("dashboard should have the correct embed snippet", () => {
      visitDashboard(ORDERS_DASHBOARD_ID);
      console.log("feature", feature);
      openStaticEmbeddingModal({ acceptTerms: false });

      modal().within(() => {
        cy.findByText(
          "To embed this dashboard in your application you’ll just need to publish it, and paste these code snippets in the proper places in your app.",
        );

        cy.findByText(
          "Insert this code snippet in your server code to generate the signed embedding URL",
        );

        cy.get(".ace_content")
          .first()
          .invoke("text")
          .should(
            "match",
            JS_CODE({ type: "dashboard", id: ORDERS_DASHBOARD_ID }),
          );

        cy.findAllByTestId("embed-backend-select-button")
          .should("contain", "Node.js")
          .click();
      });

      popover()
        .should("contain", "Node.js")
        .and("contain", "Ruby")
        .and("contain", "Python")
        .and("contain", "Clojure");

      modal().within(() => {
        cy.findAllByTestId("embed-frontend-select-button")
          .should("contain", "Mustache")
          .click();
      });

      popover()
        .should("contain", "Mustache")
        .and("contain", "Pug / Jade")
        .and("contain", "ERB")
        .and("contain", "JSX");

      modal().within(() => {
        cy.findByRole("tab", { name: "Appearance" }).click();

        // set transparent background metabase#23477
        cy.findByText("Transparent").click();
        cy.get(".ace_content")
          .first()
          .invoke("text")
          .should(
            "match",
            JS_CODE({
              type: "dashboard",
              id: ORDERS_DASHBOARD_ID,
              theme: "transparent",
            }),
          );

        cy.get(".ace_content").last().should("have.text", IFRAME_CODE);
      });
    });

    it("question should have the correct embed snippet", () => {
      visitQuestion(ORDERS_QUESTION_ID);
      console.log("feature", feature);
      openStaticEmbeddingModal({ acceptTerms: false });

      modal().within(() => {
        cy.findByText(
          "To embed this question in your application you’ll just need to publish it, and paste these code snippets in the proper places in your app.",
        );
        cy.findByText(
          "Insert this code snippet in your server code to generate the signed embedding URL",
        );

        cy.get(".ace_content")
          .first()
          .invoke("text")
          .should(
            "match",
            JS_CODE({ type: "question", id: ORDERS_QUESTION_ID }),
          );

        cy.findByRole("tab", { name: "Appearance" }).click();

        // set transparent background metabase#23477
        cy.findByText("Transparent").click();
        cy.get(".ace_content")
          .first()
          .invoke("text")
          .should(
            "match",
            JS_CODE({
              type: "question",
              id: ORDERS_QUESTION_ID,
              theme: "transparent",
            }),
          );

        // hide download button for pro/enterprise users metabase#23477
        if (feature === "all") {
          cy.findByText(
            "Enable users to download data from this embed?",
          ).click();

          cy.get(".ace_content")
            .first()
            .invoke("text")
            .should(
              "match",
              JS_CODE({
                type: "question",
                id: ORDERS_QUESTION_ID,
                theme: "transparent",
                hideDownloadButton: true,
              }),
            );
        }

        cy.get(".ace_content").last().should("have.text", IFRAME_CODE);

        cy.findAllByTestId("embed-backend-select-button")
          .should("contain", "Node.js")
          .click();
      });

      popover()
        .should("contain", "Node.js")
        .and("contain", "Ruby")
        .and("contain", "Python")
        .and("contain", "Clojure");

      cy.findAllByTestId("embed-frontend-select-button")
        .should("contain", "Mustache")
        .click();

      popover()
        .should("contain", "Mustache")
        .and("contain", "Pug / Jade")
        .and("contain", "ERB")
        .and("contain", "JSX");
    });
  });
});
