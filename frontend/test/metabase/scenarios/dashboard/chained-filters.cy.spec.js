import { signIn, restore, popover } from "__support__/cypress";
import { SAMPLE_DATASET } from "__support__/cypress_sample_dataset";

const { PEOPLE } = SAMPLE_DATASET;

function createDashboardWithQuestion(
  { dashboardName = "dashboard" } = {},
  callback,
) {
  createQuestion({}, questionId => {
    createDashboard({ dashboardName, questionId }, callback);
  });
}

function createQuestion(options, callback) {
  cy.request("POST", "/api/card", {
    name: "Count of People by State (SQL)",
    dataset_query: {
      type: "native",
      native: {
        query:
          'SELECT "PUBLIC"."PEOPLE"."STATE" AS "STATE", count(*) AS "count" FROM "PUBLIC"."PEOPLE" WHERE 1=1 [[ AND {{city}}]] [[ AND {{state}}]] GROUP BY "PUBLIC"."PEOPLE"."STATE" ORDER BY "count" DESC, "PUBLIC"."PEOPLE"."STATE" ASC',
        "template-tags": {
          city: {
            id: "6b8b10ef-0104-1047-1e1b-2492d5954555",
            name: "city",
            "display-name": "City",
            type: "dimension",
            dimension: ["field-id", PEOPLE.CITY],
            "widget-type": "category",
          },
          state: {
            id: "6b8b10ef-0104-1047-1e1b-2492d5954555",
            name: "state",
            "display-name": "State",
            type: "dimension",
            dimension: ["field-id", PEOPLE.STATE],
            "widget-type": "category",
          },
        },
      },
      database: 1,
    },
    display: "bar",
    visualization_settings: {},
  }).then(({ body: { id: questionId } }) => {
    callback(questionId);
  });
}

function createDashboard({ dashboardName, questionId }, callback) {
  cy.request("POST", "/api/dashboard", {
    name: dashboardName,
  }).then(({ body: { id: dashboardId } }) => {
    cy.request("PUT", `/api/dashboard/${dashboardId}`, {
      parameters: [
        {
          name: "State",
          slug: "state",
          id: "e8f79be9",
          type: "location/state",
        },
        {
          name: "City",
          slug: "city",
          id: "170b8e99",
          type: "location/city",
          filteringParameters: ["e8f79be9"],
        },
      ],
    });

    cy.request("POST", `/api/dashboard/${dashboardId}/cards`, {
      cardId: questionId,
    }).then(({ body: { id: dashCardId } }) => {
      cy.request("PUT", `/api/dashboard/${dashboardId}/cards`, {
        cards: [
          {
            id: dashCardId,
            card_id: questionId,
            row: 0,
            col: 0,
            sizeX: 6,
            sizeY: 6,
            parameter_mappings: [
              {
                parameter_id: "e8f79be9",
                card_id: questionId,
                target: ["dimension", ["template-tag", "state"]],
              },
              {
                parameter_id: "170b8e99",
                card_id: questionId,
                target: ["dimension", ["template-tag", "city"]],
              },
            ],
          },
        ],
      });

      callback(dashboardId);
    });
  });
}

describe("scenarios > dashboard > chained filter", () => {
  beforeEach(() => {
    restore();
    signIn();
  });

  for (const has_field_values of ["search", "list"]) {
    it(`limit ${has_field_values} options based on linked filter`, () => {
      cy.request("PUT", `/api/field/${PEOPLE.CITY}`, { has_field_values }),
        cy.visit("/dashboard/1");
      // start editing
      cy.get(".Icon-pencil").click();

      // add a state filter
      cy.get(".Icon-filter").click();
      popover().within(() => {
        cy.findByText("Location").click();
        cy.findByText("State").click();
      });

      // connect that to people.state
      cy.findByText("Column to filter on")
        .parent()
        .within(() => {
          cy.findByText("Select…").click();
        });
      popover().within(() => {
        cy.findByText("State").click();
      });

      // open the linked filters tab, and click the click to add a City filter
      cy.findByText("Linked filters").click();
      cy.findByText("add another dashboard filter").click();
      popover().within(() => {
        cy.findByText("Location").click();
        cy.findByText("City").click();
      });

      // connect that to person.city
      cy.findByText("Column to filter on")
        .parent()
        .within(() => {
          cy.findByText("Select…").click();
        });
      popover().within(() => {
        cy.findByText("City").click();
      });

      // Link city to state
      cy.findByText("Limit this filter's choices")
        .parent()
        .within(() => {
          // turn on the toggle
          cy.findByText("State")
            .parent()
            .within(() => {
              cy.get("a").click();
            });

          // open up the list of linked columns
          cy.findByText("State").click();
          // It's hard to assert on the "table.column" pairs.
          // We just assert that the headers are there to know that something appeared.
          cy.findByText("Filtering column");
          cy.findByText("Filtered column");
        });

      cy.findByText("Save").click();
      cy.findByText("You're editing this dashboard.").should("not.exist");

      // now test that it worked!
      // Select Alaska as a state. We should see Anchorage as a option but not Anacoco
      cy.findByText("State").click();
      popover().within(() => {
        cy.findByText("AK").click();
        cy.findByText("Add filter").click();
      });
      cy.findByText("City").click();
      popover().within(() => {
        cy.findByPlaceholderText(
          has_field_values === "search" ? "Search by City" : "Search the list",
        ).type("An");
        cy.findByText("Anchorage");
        cy.findByText("Anacoco").should("not.exist");
      });
    });
  }

  context("reproduces metabase#13868", () => {
    it.only("can use a chained filter with embedded SQL questions", () => {
      createDashboardWithQuestion({}, dashboardId => {
        cy.visit(`/dashboard/${dashboardId}`);
        cy.request("PUT", `/api/dashboard/${dashboardId}`, {
          embedding_params: {
            city: "enabled",
            state: "enabled",
          },
          enable_embedding: true,
        });
      });
      // First make sure normal filtering works - we reuse the chained filter test above
      // Select Alaska as a state. We should see Anchorage as a option but not Anacoco
      cy.findByText("State").click();
      popover().within(() => {
        cy.findByText("AK").click();
        cy.findByText("Add filter").click();
      });
      cy.findByText("City").click();
      popover().within(() => {
        cy.findByPlaceholderText("Search by City").type("An");
        cy.findByText("Anacoco").should("not.exist");
        cy.findByText("Anchorage").click();
        cy.findByText("Add filter").click();
      });
      cy.contains("Count");

      // Then we make sure it works in embedded mode
      cy.visit(
        "/embed/dashboard/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXNvdXJjZSI6eyJkYXNoYm9hcmQiOjJ9LCJwYXJhbXMiOnt9LCJpYXQiOjE2MDc5NzUwMTMsIl9lbWJlZGRpbmdfcGFyYW1zIjp7InN0YXRlIjoiZW5hYmxlZCIsImNpdHkiOiJlbmFibGVkIn19.nqy_ibysLb6QB9o3loG5SNgOoE5HdexuUjCjA_KS1kM",
      );
      cy.findByText("State").click();
      popover().within(() => {
        cy.findByText("AK").click();
        cy.findByText("Add filter").click();
      });
      cy.findByText("City").click();
      popover().within(() => {
        cy.findByPlaceholderText("Search by City").type("An");
        cy.findByText("Anacoco").should("not.exist");
        cy.findByText("Anchorage").click();
        cy.findByText("Add filter").click();

        cy.contains("Count");
        cy.findByText("There was a problem").should("not.exist");
      });
    });
  });
});
