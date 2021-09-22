// Find a text field by label text, type it in, then blur the field.
// Commonly used in our Admin section as we auto-save settings.
export function typeAndBlurUsingLabel(label, value) {
  cy.findByLabelText(label)
    .clear()
    .type(value)
    .blur();
}

export function visitAlias(alias) {
  cy.get(alias).then(url => {
    cy.visit(url);
  });
}

/**
 * Open native (SQL) editor and alias it.
 *
 * @param {string} alias - The alias that can be used later in the test as `cy.get("@" + alias)`.
 * @example
 * openNativeEditor().type("SELECT 123");
 */
export function openNativeEditor(alias = "editor") {
  cy.visit("/");
  cy.icon("sql").click();
  return cy
    .get(".ace_content")
    .as(alias)
    .should("be.visible");
}

/**
 * Executes native query and waits for the results to load.
 * Makes sure that the question is not "dirty" after the query successfully ran.
 * @param {string} [xhrAlias ="dataset"]
 */
export function runNativeQuery(xhrAlias = "dataset") {
  cy.get(".NativeQueryEditor .Icon-play").click();
  cy.wait("@" + xhrAlias);
  cy.icon("play").should("not.exist");
}

/**
 * Intercepts a request and returns resolve function that allows
 * the request to continue
 *
 * @param {string} method - Request method ("GET", "POST", etc)
 * @param {string} path - Request URL to intercept
 * @example
 * let req = interceptPromise("GET", "/dashboard/1");
 * // ... do something before request is allowed to go through ...
 * req.resolve();
 */
export function interceptPromise(method, path) {
  let state = {};
  const promise = new Promise(resolve => {
    state.resolve = resolve;
  });
  cy.intercept(method, path, req => {
    return promise.then(() => {
      req.continue();
    });
  });
  return state;
}
