import { SAMPLE_DB_ID } from "e2e/support/cypress_data";
import type { Card, DatasetQuery } from "metabase-types/api";

type QueryType = "query" | "native";

interface QuestionDetails {
  /**
   * Defaults to "test question".
   */
  name?: Card["name"];
  description?: Card["description"];
  /**
   * Entity type.
   * Defaults to "question".
   */
  type?: Card["type"];
  native: any; // TODO: make its presence depend on type
  query: any; // TODO: make its presence depend on type
  /**
   * Defaults to SAMPLE_DB_ID.
   */
  database?: DatasetQuery["database"];
  /**
   * Defaults to "table".
   */
  display?: Card["display"];
  parameters?: Card["parameters"];
  visualization_settings?: Card["visualization_settings"];
  /**
   * Parent collection in which to store this question.
   */
  collection_id?: Card["collection_id"];
  /**
   * Used on the frontend to determine whether the question is pinned or not.
   */
  collection_position?: Card["collection_position"];
  embedding_params?: Card["embedding_params"]; // TODO: make its presence depend on type only for models
  /**
   * Defaults to false.
   */
  enable_embedding?: Card["enable_embedding"];
}

interface Options {
  /**
   * Whether to visit the question in order to load its metadata.
   * Defaults to false.
   */
  loadMetadata?: boolean;
  /**
   * Whether to visit the question after the creation or not.
   * Defaults to false.
   */
  visitQuestion?: boolean;
  /**
   * Whether to wrap a question id, to make it available outside of this scope.
   * Defaults to false.
   */
  wrapId?: boolean;
  /**
   * Alias a question id in order to use it later with `cy.get("@" + alias).
   * Defaults to "questionid".
   */
  idAlias?: string;
  /**
   * We need distinctive endpoint aliases for cases where we have multiple questions or nested questions.
   * Defaults to "cardQuery".
   */
  interceptAlias?: string;
}

Cypress.Commands.add("createQuestion", (questionDetails, customOptions) => {
  const { name, query } = questionDetails;

  if (!query) {
    throw new Error('"query" attribute missing in questionDetails');
  }

  logAction("Create a QB question", name);
  return question("query", questionDetails, customOptions);
});

Cypress.Commands.add("archiveQuestion", id => {
  cy.log(`Archiving a question with id: ${id}`);
  return cy.request("PUT", `/api/card/${id}`, {
    archived: true,
  });
});

Cypress.Commands.add(
  "createNativeQuestion",
  (questionDetails, customOptions) => {
    const { name, native } = questionDetails;

    if (!native) {
      throw new Error('"native" attribute missing in questionDetails');
    }

    logAction("Create a native question", name);
    question("native", questionDetails, customOptions);
  },
);

function question(
  queryType: QueryType,
  {
    name = "test question",
    description,
    type = "question",
    native,
    query,
    database = SAMPLE_DB_ID,
    display = "table",
    parameters,
    visualization_settings = {},
    collection_id,
    collection_position,
    embedding_params,
    enable_embedding = false,
  }: QuestionDetails,
  {
    loadMetadata = false,
    visitQuestion = false,
    wrapId = false,
    idAlias = "questionId",
    interceptAlias = "cardQuery",
  }: Options = {},
) {
  return cy
    .request("POST", "/api/card", {
      name,
      description,
      dataset_query: {
        type: queryType,
        [queryType]: queryType === "native" ? native : query,
        database,
      },
      display,
      parameters,
      visualization_settings,
      collection_id,
      collection_position,
    })
    .then(({ body }) => {
      /**
       * Optionally, if you need question's id later in the test, outside the scope of this function,
       * you can use it like this:
       *
       * `cy.get("@questionId").then(id=> {
       *   doSomethingWith(id);
       * })
       */
      if (wrapId) {
        cy.wrap(body.id).as(idAlias);
      }

      if (type === "model" || enable_embedding) {
        cy.request("PUT", `/api/card/${body.id}`, {
          type,
          enable_embedding,
          embedding_params,
        });
      }

      if (loadMetadata || visitQuestion) {
        if (type === "model") {
          cy.intercept("POST", "/api/dataset").as("dataset");
          cy.visit(`/model/${body.id}`);
          cy.wait("@dataset"); // Wait for `result_metadata` to load
        } else {
          // We need to use the wildcard because endpoint for pivot tables has the following format: `/api/card/pivot/${id}/query`
          cy.intercept("POST", `/api/card/**/${body.id}/query`).as(
            interceptAlias,
          );
          cy.visit(`/question/${body.id}`);
          cy.wait("@" + interceptAlias); // Wait for `result_metadata` to load
        }
      }
    });
}

function logAction(
  /**
   * A title used to log the Cypress action/request that follows it.
   */
  title: string,
  /**
   * Optional question name.
   */
  questionName?: string,
) {
  const fullTitle = `${title}: ${questionName}`;
  const message = questionName ? fullTitle : title;

  cy.log(message);
}
