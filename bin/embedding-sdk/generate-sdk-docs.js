const path = require("path");
const {
  Extractor,
  ExtractorConfig,
  ExtractorResult,
} = require("@microsoft/api-extractor");

console.log("Extracting APIs from codebase...");

const apiExtractorJsonPath = path.join(__dirname, "./api-extractor.jsonc");

try {
  // Load and parse the api-extractor.json file
  const extractorConfig =
    ExtractorConfig.loadFileAndPrepare(apiExtractorJsonPath);

  // Invoke API Extractor
  const extractorResult = Extractor.invoke(extractorConfig, {
    // Equivalent to the "--local" command-line parameter
    localBuild: true,

    // Equivalent to the "--verbose" command-line parameter
    showVerboseMessages: true,
  });

  if (extractorResult.succeeded) {
    console.log(`API Extractor completed successfully`);
    process.exitCode = 0;
  } else {
    console.error(
      `API Extractor completed with ${extractorResult.errorCount} errors` +
      ` and ${extractorResult.warningCount} warnings`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error("API Extractor raised an error:");
  console.error(error);
}


