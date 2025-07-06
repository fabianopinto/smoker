/**
 * Main entry point for the application
 * Runs cucumber tests based on provided configuration
 * Can be executed directly or as an AWS Lambda function
 *
 * @author Fabiano Pinto <fabianopinto@gmail.com>
 */

import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";
import {
  addConfigurationFile,
  addConfigurationObject,
  type ConfigObject,
  loadConfigurations,
} from "./support";

/**
 * AWS Lambda event type definition
 */
export interface LambdaEvent {
  // Optional parameters that can be passed to customize test execution
  paths?: string[];
  formats?: string[];
  tags?: string;
  environment?: Record<string, string>;

  // Configuration options
  configFiles?: string[]; // Paths to JSON configuration files
  configObjects?: ConfigObject[]; // Configuration objects to be loaded directly
  config?: ConfigObject; // Single configuration object
}

/**
 * AWS Lambda response type definition
 */
export interface LambdaResponse {
  statusCode: number;
  body: string;
}

/**
 * Main function to run cucumber tests
 * @param {LambdaEvent} event - Optional event parameters for customizing test execution
 * @returns {Promise<object>} Promise resolving with test results
 */
export async function main(
  event: LambdaEvent = {}
): Promise<{ success: boolean; statusCode: number }> {
  try {
    console.log(`Starting Smoker tests with event:`, JSON.stringify(event, null, 2));

    // Apply environment variables from event if provided
    if (event.environment) {
      Object.entries(event.environment).forEach(([key, value]) => {
        process.env[key] = value;
      });
    }

    // Load configuration from various sources if provided
    await loadTestConfigurations(event);

    // Load configuration with options from event or defaults
    const { runConfiguration } = await loadConfiguration({
      provided: {
        paths: event.paths || ["dist/features/**/*.feature"],
        require: ["dist/**/*.cjs"],
        format: event.formats || ["progress"],
        tags: event.tags,
      },
    });

    // Run cucumber tests
    const { success } = await runCucumber(runConfiguration);
    console.log(`Tests completed with ${success ? "SUCCESS" : "FAILURE"}`);

    return { success, statusCode: success ? 200 : 400 };
  } catch (error) {
    console.error("Test execution failed:", error);
    return { success: false, statusCode: 500 };
  }
}

/**
 * AWS Lambda context type definition
 */
export interface LambdaContext {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  identity?: Record<string, unknown>;
  clientContext?: Record<string, unknown>;
  getRemainingTimeInMillis: () => number;
  done: (error?: Error, result?: unknown) => void;
  fail: (error: Error | string) => void;
  succeed: (messageOrObject: unknown) => void;
}

/**
 * AWS Lambda handler function
 * @param {LambdaEvent} event - Lambda event object
 * @param {LambdaContext} context - Lambda context object
 * @returns {Promise<LambdaResponse>} Lambda response
 */
export async function handler(event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> {
  console.log(
    "Lambda execution context:",
    JSON.stringify({
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      awsRequestId: context.awsRequestId,
      remainingTime: context.getRemainingTimeInMillis(),
    })
  );

  try {
    const result = await main(event);

    return {
      statusCode: result.statusCode,
      body: JSON.stringify({
        success: result.success,
        message: result.success ? "All tests passed" : "Some tests failed",
      }),
    };
  } catch (error) {
    console.error("Lambda handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Test execution failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * Load test configurations from various sources
 * @param event Lambda event object with configuration sources
 */
async function loadTestConfigurations(event: LambdaEvent): Promise<void> {
  try {
    // Add configuration files if provided
    if (event.configFiles && Array.isArray(event.configFiles)) {
      console.log(`Loading configuration from ${event.configFiles.length} files`);
      event.configFiles.forEach((filePath) => {
        addConfigurationFile(filePath);
      });
    }

    // Add configuration objects if provided
    if (event.configObjects && Array.isArray(event.configObjects)) {
      console.log(`Loading ${event.configObjects.length} configuration objects`);
      event.configObjects.forEach((configObject) => {
        addConfigurationObject(configObject);
      });
    }

    // Add single configuration object if provided
    if (event.config) {
      console.log("Loading configuration from event.config");
      addConfigurationObject(event.config);
    }

    // Load all configurations from added sources
    await loadConfigurations();
  } catch (error) {
    console.error("Error loading test configurations:", error);
  }
}

// Execute directly when not running in Lambda environment
if (require.main === module) {
  main()
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Test execution failed:", error);
      process.exit(1);
    });
}
