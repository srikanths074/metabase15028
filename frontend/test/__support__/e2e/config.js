import fs from "fs";
/**
 * This env var provides the token to the backend.
 * If it is not present, we skip some tests that depend on a valid token.
 *
 * @type {boolean}
 */

const hasEnterpriseToken =
  process.env["MB_PREMIUM_EMBEDDING_TOKEN"] &&
  process.env["MB_EDITION"] === "ee";

const hasSnowplowMicro = process.env["MB_SNOWPLOW_AVAILABLE"];
const snowplowMicroUrl = process.env["MB_SNOWPLOW_URL"];

const isQaDatabase = process.env["QA_DB_ENABLED"];

const sourceVersion = process.env["CROSS_VERSION_SOURCE"];
const targetVersion = process.env["CROSS_VERSION_TARGET"];

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

const createBundler = require("@bahmutov/cypress-esbuild-preprocessor");
const { Client } = require("pg");

async function connectAndQueryDB({
  connectionString,
  connectionConfig,
  query,
}) {
  const client = new Client(connectionString || connectionConfig);

  await client.connect();
  const res = await client.query(query);
  await client.end();

  return res;
}

const defaultConfig = {
  // This is the functionality of the old cypress-plugins.js file
  setupNodeEvents(on, config) {
    // Cypress analytics and the alternative to Cypress dashboard
    // Needs to be at the very top in the config!
    [on, config] = require("@deploysentinel/cypress-debugger/plugin")(
      on,
      config,
    );

    // `on` is used to hook into various events Cypress emits
    // `config` is the resolved Cypress config
    /********************************************************************
     **                        PREPROCESSOR                            **
     ********************************************************************/

    on("file:preprocessor", createBundler());

    /********************************************************************
     **                         BROWSERS                               **
     ********************************************************************/

    on("before:browser:launch", (browser = {}, launchOptions) => {
      //  Open dev tools in Chrome by default
      if (browser.name === "chrome" || browser.name === "chromium") {
        launchOptions.args.push("--auto-open-devtools-for-tabs");
      }

      // Start browsers with prefers-reduced-motion set to "reduce"
      if (browser.family === "firefox") {
        launchOptions.preferences["ui.prefersReducedMotion"] = 1;
      }

      if (browser.family === "chromium") {
        launchOptions.args.push("--force-prefers-reduced-motion");
      }

      return launchOptions;
    });

    /********************************************************************
     **                           TASKS                                **
     ********************************************************************/
    const sampleConfig = {
      user: "metabase",
      password: "metasample123",
      host: "localhost",
      database: "sample",
      ssl: false,
      port: 5432,
    };

    const actionsConfig = {
      ...sampleConfig,
      database: "actions_db",
    };

    on("task", {
      connectAndQueryDB,

      async resetActionsDb() {
        const sampleSQL = fs.readFileSync(
          "./helpers/sample_schema.sql",
          "utf8",
        );

        const sampleInsert = await connectAndQueryDB({
          connectionConfig: actionsConfig,
          query: sampleSQL,
        });

        const testSql = fs.readFileSync("./helpers/test_schema.sql", "utf8");

        const testInsert = await connectAndQueryDB({
          connectionConfig: actionsConfig,
          query: testSql,
        });

        return [...sampleInsert, ...testInsert];
      },
    });

    /********************************************************************
     **                          CONFIG                                **
     ********************************************************************/

    if (!isQaDatabase) {
      config.excludeSpecPattern =
        "frontend/test/snapshot-creators/qa-db.cy.snap.js";
    }

    // `grepIntegrationFolder` needs to point to the root!
    // See: https://github.com/cypress-io/cypress/issues/24452#issuecomment-1295377775
    config.env.grepIntegrationFolder = "../../../../";
    config.env.grepFilterSpecs = true;

    config.env.HAS_ENTERPRISE_TOKEN = hasEnterpriseToken;
    config.env.HAS_SNOWPLOW_MICRO = hasSnowplowMicro;
    config.env.SNOWPLOW_MICRO_URL = snowplowMicroUrl;
    config.env.SOURCE_VERSION = sourceVersion;
    config.env.TARGET_VERSION = targetVersion;

    require("@cypress/grep/src/plugin")(config);

    return config;
  },
  supportFile: "frontend/test/__support__/e2e/cypress.js",
  videoUploadOnPasses: false,
  chromeWebSecurity: false,
  modifyObstructiveCode: false,
};

const mainConfig = {
  ...defaultConfig,
  // New `specPattern` is the combination of the old:
  //   1. testFiles and
  //   2. integrationFolder
  specPattern: "frontend/test/**/*.cy.spec.js",
  projectId: "KetpiS",
  viewportHeight: 800,
  viewportWidth: 1280,
  reporter: "mochawesome",
  reporterOptions: {
    reportDir: "cypress/reports/mochareports",
    reportFilename: "[status]-[name]",
    quiet: true,
    html: false,
    json: true,
  },
  retries: {
    runMode: 2,
    openMode: 0,
  },
};

const snapshotsConfig = {
  ...defaultConfig,
  specPattern: "frontend/test/snapshot-creators/**/*.cy.snap.js",
};

const crossVersionSourceConfig = {
  ...defaultConfig,
  baseUrl: "http://localhost:3000",
  specPattern:
    "frontend/test/metabase/scenarios/cross-version/source/**/*.cy.spec.js",
};

const crossVersionTargetConfig = {
  ...defaultConfig,
  baseUrl: "http://localhost:3001",
  specPattern:
    "frontend/test/metabase/scenarios/cross-version/target/**/*.cy.spec.js",
};

module.exports = {
  mainConfig,
  snapshotsConfig,
  crossVersionSourceConfig,
  crossVersionTargetConfig,
};
