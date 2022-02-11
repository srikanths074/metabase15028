import {
  restore,
  downloadAndAssert,
  runNativeQuery,
} from "__support__/e2e/cypress";

let questionId;

const testCases = ["csv", "xlsx"];

describe("issue 10803", () => {
  beforeEach(() => {
    cy.intercept("POST", "/api/dataset").as("dataset");

    restore();
    cy.signInAsAdmin();

    cy.createNativeQuestion(
      {
        name: "10803",
        native: {
          query:
            "SELECT PARSEDATETIME('2020-06-03', 'yyyy-MM-dd') AS \"birth_date\", PARSEDATETIME('2020-06-03 23:41:23', 'yyyy-MM-dd hh:mm:ss') AS \"created_at\"",
          "template-tags": {},
        },
      },
      { loadMetadata: true },
    );
  });

  testCases.forEach(fileType => {
    it(`should format the date properly for ${fileType} in saved questions (metabase#10803)`, () => {
      downloadAndAssert(
        { fileType, questionId, logResults: true, raw: true },
        testWorkbookDatetimes,
      );
    });

    it(`should format the date properly for ${fileType} in unsaved questions`, () => {
      // Add a space at the end of the query to make it "dirty"
      cy.contains(/open editor/i).click();
      cy.get(".ace_editor").type("{movetoend} ");

      runNativeQuery();
      downloadAndAssert({ fileType, raw: true }, testWorkbookDatetimes);
    });

    function testWorkbookDatetimes(sheet) {
      expect(sheet["A1"].v).to.eq("birth_date");
      expect(sheet["B1"].v).to.eq("created_at");

      // Excel and CSV will have different formats
      if (fileType === "csv") {
        expect(sheet["A2"].v).to.eq("2020-06-03");
        expect(sheet["B2"].v).to.eq("2020-06-03T23:41:23");
      } else if (fileType === "xlsx") {
        // We tell the xlsx library to read raw and not parse dates
        // So for the _date_ format we expect an integer
        // And for timestamp, we expect a float
        expect(sheet["A2"].v).to.eq(43985);
        expect(sheet["B2"].v).to.eq(43985.98707175926);
      }
    }
  });
});
