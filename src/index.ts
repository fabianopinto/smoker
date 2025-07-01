/**
 * Main entry point for the application
 * Runs cucumber tests based on provided configuration
 *
 * @author Fabiano Pinto <fabianopinto@gmail.com>
 */

import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";

/**
 * Main function to run cucumber tests
 * @returns {Promise<void>} Promise resolving when tests are completed
 */
export async function main(): Promise<void> {
  const { runConfiguration } = await loadConfiguration({
    provided: {
      paths: ["dist/features/**/*.feature"],
      require: ["dist/**/*.cjs"],
      format: ["progress"],
    },
  });

  const { success } = await runCucumber(runConfiguration);
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
