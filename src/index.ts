/**
 * Application Entry Point Module
 *
 * This module serves as the main entry point for the Smoker testing framework.
 * It provides functionality to run Cucumber tests with configurable options,
 * supporting both direct execution and AWS Lambda deployment scenarios.
 *
 * Key features:
 * - Flexible test configuration through various sources (files, objects)
 * - Support for AWS Lambda execution environment
 * - Environment variable management for tests
 * - Comprehensive error handling and reporting
 * - Exit code management for CI/CD integration
 *
 * @author Fabiano Pinto <fabianopinto@gmail.com>
 */

import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";
import { BaseLogger } from "./lib/logger";
import { type ConfigObject, Configuration, ConfigurationFactory } from "./support/config";

// Create a logger instance for this module
const logger = new BaseLogger({ name: "smoker:main" });

/**
 * AWS Lambda Event Type
 *
 * Defines the structure of the event object received by the Lambda function.
 * This interface includes both test execution parameters and configuration options,
 * allowing for flexible test customization through the Lambda event payload.
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
 * AWS Lambda Response Type
 *
 * Defines the structure of the response object returned by the Lambda function.
 * This interface follows the API Gateway proxy integration format, containing
 * a status code and a JSON-formatted body with test results and messages.
 */
export interface LambdaResponse {
  statusCode: number;
  body: string;
}

/**
 * Main function to run Cucumber tests
 *
 * This function serves as the core execution engine for the Smoker testing framework.
 * It processes the provided event parameters, sets up the environment, loads configurations,
 * and runs the Cucumber tests with the specified options.
 *
 * The function handles the complete test execution lifecycle including:
 * - Environment variable setup from the event
 * - Configuration loading from multiple sources
 * - Cucumber test execution with customizable options
 * - Result processing and status code determination
 *
 * @param event - Optional event parameters for customizing test execution
 * @return Promise resolving to an object containing test success status and HTTP status code
 */
export async function main(
  event: LambdaEvent = {},
): Promise<{ success: boolean; statusCode: number }> {
  try {
    logger.info(`Starting Smoker tests with event: ${JSON.stringify(event, null, 2)}`);

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
    logger.info(`Tests completed with ${success ? "SUCCESS" : "FAILURE"}`);

    return { success, statusCode: success ? 200 : 400 };
  } catch (error) {
    logger.error(error instanceof Error ? error : String(error), "Test execution failed");
    return { success: false, statusCode: 500 };
  }
}

/**
 * AWS Lambda Context Type
 *
 * Defines the structure of the context object provided by AWS Lambda runtime.
 * This interface includes Lambda execution environment details and callback functions
 * for managing the Lambda lifecycle and response handling.
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
 *
 * This function serves as the entry point for AWS Lambda execution. It processes
 * the incoming event and context objects, executes the main test functionality,
 * and formats the response according to API Gateway requirements.
 *
 * The handler captures detailed execution context information for logging and
 * provides comprehensive error handling with appropriate status codes and
 * formatted error messages in the response body.
 *
 * @param event - Lambda event object with test parameters and configuration
 * @param context - Lambda context object with execution environment details
 * @return Promise resolving to a formatted Lambda response
 */
export async function handler(event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> {
  logger.info(
    {
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      awsRequestId: context.awsRequestId,
      remainingTime: context.getRemainingTimeInMillis(),
    },
    "Lambda execution context",
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
    logger.error(error instanceof Error ? error : String(error), "Lambda handler error");
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
 *
 * This function processes configuration sources specified in the event object
 * and builds a unified configuration using the ConfigurationFactory. It supports
 * loading configuration from files, arrays of configuration objects, and a single
 * configuration object.
 *
 * The resulting configuration is set as the global configuration instance using
 * the Configuration factory pattern, making it available throughout the application.
 *
 * @param event - Lambda event object with configuration sources
 * @return Promise that resolves when configuration is loaded
 * @throws Error if configuration loading fails
 */
async function loadTestConfigurations(event: LambdaEvent): Promise<void> {
  try {
    // Create a configuration factory
    const factory = new ConfigurationFactory();

    // Add configuration files if provided
    if (event.configFiles && Array.isArray(event.configFiles)) {
      logger.info(`Loading configuration from ${event.configFiles.length} files`);
      event.configFiles.forEach((filePath) => {
        factory.addFile(filePath);
      });
    }

    // Add configuration objects if provided
    if (event.configObjects && Array.isArray(event.configObjects)) {
      logger.info(`Loading ${event.configObjects.length} configuration objects`);
      event.configObjects.forEach((configObject) => {
        factory.addObject(configObject);
      });
    }

    // Add single configuration object if provided
    if (event.config) {
      logger.info("Loading configuration from event.config");
      factory.addObject(event.config);
    }

    // Build the configuration and set it as global
    const config = await factory.build();
    Configuration.initializeGlobalInstance(config);
  } catch (error) {
    logger.error(
      error instanceof Error ? error : String(error),
      "Error loading test configurations",
    );
    throw new Error(
      `Failed to load test configurations: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Execute directly when not running in Lambda environment
if (require.main === module) {
  main()
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error(error instanceof Error ? error : String(error), "Test execution failed");
      process.exit(1);
    });
}
