/**
 * Vitest configuration
 * This file configures the test environment, coverage reporting, and test patterns
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Define patterns for test files
    include: ["test/**/*.test.ts"],

    // Setup files that run before each test
    setupFiles: ["test/setup.ts"],

    // Environment settings
    environment: "node",
    environmentOptions: {
      // Avoid console output pollution during tests
      mockConsole: true,
    },

    // Test behavior configuration
    passWithNoTests: false, // Fail if no tests are found
    clearMocks: true, // Auto-clear mocks between tests
    restoreMocks: true, // Auto-restore mocks after each test

    // Code coverage settings
    coverage: {
      // Report formats
      reporter: ["text", "lcov", "html"],

      // Files to include/exclude from coverage
      include: ["src/**/*"],
      exclude: [
        "src/index.ts", // Entry point file
        "**/*.d.ts", // Type declaration files
        "**/*.test.ts", // Test files
        "**/node_modules/**", // Dependencies
      ],

      // Coverage requirements can be set in a separate configuration file
      // or through command-line arguments if needed
    },
  },
});
