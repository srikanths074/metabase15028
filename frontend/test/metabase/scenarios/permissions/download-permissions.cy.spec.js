import {
  restore,
  modal,
  describeEE,
  assertPermissionForItem,
  modifyPermission,
  downloadAndAssert,
  assertSheetRowsCount,
  sidebar,
  visitQuestion,
} from "__support__/e2e/cypress";

import { SAMPLE_DATABASE } from "__support__/e2e/cypress_sample_database";

import { SAMPLE_DB_ID, USER_GROUPS } from "__support__/e2e/cypress_data";

const { ALL_USERS_GROUP } = USER_GROUPS;

const { PRODUCTS_ID, ORDERS_ID, PEOPLE_ID, REVIEWS_ID } = SAMPLE_DATABASE;

const DATA_ACCESS_PERMISSION_INDEX = 0;
const DOWNLOAD_PERMISSION_INDEX = 2;

describeEE("scenarios > admin > permissions > data > downloads", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("setting downloads permission UI flow should work", () => {
    cy.log("allows changing download results permission for a database");

    cy.visit(`/admin/permissions/data/database/${SAMPLE_DB_ID}`);

    modifyPermission("All Users", DOWNLOAD_PERMISSION_INDEX, "No");

    cy.button("Save changes").click();

    modal().within(() => {
      cy.findByText("Save permissions?");
      cy.findByText("Are you sure you want to do this?");
      cy.button("Yes").click();
    });

    assertPermissionForItem("All Users", DOWNLOAD_PERMISSION_INDEX, "No");

    cy.log("Make sure we can change download results permission for a table");

    sidebar()
      .contains("Orders")
      .click();

    modifyPermission("All Users", DOWNLOAD_PERMISSION_INDEX, "1 million rows");

    cy.button("Save changes").click();

    modal().within(() => {
      cy.findByText("Save permissions?");
      cy.findByText("Are you sure you want to do this?");
      cy.button("Yes").click();
    });

    assertPermissionForItem(
      "All Users",
      DOWNLOAD_PERMISSION_INDEX,
      "1 million rows",
    );

    cy.log(
      "Make sure the download permissions are set to `No` when data access is revoked",
    );

    cy.get("a")
      .contains("Sample Database")
      .click();

    modifyPermission("All Users", DATA_ACCESS_PERMISSION_INDEX, "Block");

    cy.button("Save changes").click();

    modal().within(() => {
      cy.findByText("Save permissions?");
      cy.findByText("Are you sure you want to do this?");
      cy.button("Yes").click();
    });

    assertPermissionForItem("All Users", DOWNLOAD_PERMISSION_INDEX, "No");
  });

  it("restricts users from downloading questions", () => {
    // Restrict downloads for All Users
    cy.updatePermissionsGraph({
      [ALL_USERS_GROUP]: {
        [SAMPLE_DB_ID]: {
          download: { schemas: "none" },
        },
      },
    });

    cy.signInAsNormalUser();
    visitQuestion("1");

    cy.findByText("Showing first 2,000 rows");
    cy.icon("download").should("not.exist");
  });

  it("limits users from downloading all results", () => {
    const questionId = 1;

    // Restrict downloads for All Users
    cy.updatePermissionsGraph({
      [ALL_USERS_GROUP]: {
        [SAMPLE_DB_ID]: {
          download: { schemas: "limited" },
        },
      },
    });

    cy.signInAsNormalUser();
    visitQuestion(questionId);

    cy.icon("download").click();

    downloadAndAssert(
      { fileType: "xlsx", questionId },
      assertSheetRowsCount(10000),
    );
  });

  describe("native questions", () => {
    beforeEach(() => {
      cy.intercept("POST", "/api/dataset").as("dataset");

      cy.createNativeQuestion(
        {
          name: "Native Orders",
          native: {
            query: "select * from orders",
          },
        },
        { wrapId: true, idAlias: "nativeQuestionId" },
      );
    });

    it("prevents user from downloading a native question even if only one table doesn't have download permissions", () => {
      setDownloadPermissionsForProductsTable("none");

      cy.signInAsNormalUser();

      cy.get("@nativeQuestionId").then(id => {
        visitQuestion(id);

        cy.findByText("Showing first 2,000 rows");
        cy.icon("download").should("not.exist");

        // Ad-hoc nested query also shouldn't be downloadable
        cy.findByText("Explore results").click();
        cy.wait("@dataset");

        cy.findByText("Showing first 2,000 rows");
        cy.icon("download").should("not.exist");

        // Convert question to a model, which also shouldn't be downloadable
        cy.request("PUT", `/api/card/${id}`, { name: "Native Model" });

        visitQuestion(id);

        cy.findByText("Showing first 2,000 rows");
        cy.icon("download").should("not.exist");
      });
    });

    it("limits download results for a native question even if even one table has `limited` download permissions", () => {
      setDownloadPermissionsForProductsTable("limited");

      cy.signInAsNormalUser();

      cy.get("@nativeQuestionId").then(id => {
        visitQuestion(id);

        cy.icon("download").click();

        downloadAndAssert(
          { fileType: "xlsx", questionId: id },
          assertSheetRowsCount(10000),
        );

        // Ad-hoc nested query based on a native question should also have a download row limit
        cy.findByText("Explore results").click();
        cy.wait("@dataset");

        cy.icon("download").click();

        downloadAndAssert({ fileType: "xlsx" }, assertSheetRowsCount(10000));

        // Convert question to a model, which should also have a download row limit
        cy.request("PUT", `/api/card/${id}`, { name: "Native Model" });

        visitQuestion(id);

        cy.icon("download").click();

        downloadAndAssert(
          { fileType: "xlsx", questionId: id },
          assertSheetRowsCount(10000),
        );
      });
    });
  });
});

function setDownloadPermissionsForProductsTable(permission) {
  cy.updatePermissionsGraph({
    [ALL_USERS_GROUP]: {
      [SAMPLE_DB_ID]: {
        download: {
          schemas: {
            PUBLIC: {
              [PRODUCTS_ID]: permission,
              [ORDERS_ID]: "full",
              [PEOPLE_ID]: "full",
              [REVIEWS_ID]: "full",
            },
          },
        },
      },
    },
  });
}
