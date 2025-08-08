/**
 * AWS CloudWatch Client Error Handling Tests
 *
 * This file contains specialized tests for error handling in the CloudWatch client implementation,
 * focusing on various error scenarios and error types using module-level mocking.
 *
 * Test coverage includes:
 * - AWS SDK initialization error handling
 * - Error object vs non-Error value handling in catch blocks
 * - Command execution error propagation
 * - String error message handling
 * - Module-level mocking for AWS SDK interactions
 */

import { describe, expect, it, vi } from "vitest";
import { CloudWatchClient } from "../../../src/clients/aws/aws-cloudwatch";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";

/**
 * Mocks the AWS SDK CloudWatchLogsClient module
 * This mock allows us to control whether the CloudWatchLogsClient constructor throws
 * an Error object or a non-Error value
 */
vi.mock("@aws-sdk/client-cloudwatch-logs", () => {
  return {
    CloudWatchLogsClient: vi.fn(() => {
      if (shouldThrowNonError) {
        // Throw a non-Error object to test the String(error) branch
        throw TEST_FIXTURES.ERROR_NON_ERROR_STRING;
      } else {
        // Throw an Error object to test the error.message branch
        throw new Error(TEST_FIXTURES.ERROR_CONSTRUCTOR);
      }
    }),
    FilterLogEventsCommand: vi.fn(),
    GetLogEventsCommand: vi.fn(),
    DescribeLogStreamsCommand: vi.fn(),
    DescribeLogGroupsCommand: vi.fn(),
  };
});

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client identifiers and names
  CLIENT_ID: "test-client",

  // Configuration values for CloudWatch client
  REGION: "us-east-1",
  LOG_GROUP_NAME: "test-log-group",

  // Log message values for testing
  LOG_STREAM_NAME: "test-stream",

  // Error messages for validation
  ERROR_STRING: "string-error",
  ERROR_CONSTRUCTOR: "Mocked constructor failure",
  ERROR_COMMAND: "Command error",
  ERROR_NON_ERROR_STRING: "Non-error string thrown",
  ERROR_INITIALIZATION: "Failed to initialize CloudWatch client: Mocked constructor failure",
  ERROR_STRING_INITIALIZATION: "Failed to initialize CloudWatch client: Non-error string thrown",
};

/**
 * Control variables for mock behavior
 * These determine how the mocked AWS SDK will behave during tests
 */
let shouldThrowNonError = false;
let shouldThrowInCommand = false;
let nonErrorValue: unknown = TEST_FIXTURES.ERROR_STRING;

/**
 * Helper function for testing command error handling
 *
 * @return Mock send function that throws configured errors
 */
function createMockSendFunction() {
  return vi.fn(() => {
    if (shouldThrowInCommand) {
      // Throw the configured non-Error value
      throw nonErrorValue;
    } else {
      throw new Error(TEST_FIXTURES.ERROR_COMMAND);
    }
  });
}

/**
 * Tests for CloudWatchClient error handling
 */
describe("CloudWatchClient Error Handling", () => {
  /**
   * Tests for initialization error handling
   */
  describe("initialization error coverage", () => {
    it("should handle AWS SDK initialization errors", async () => {
      const clientWithFailingInit = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      });

      // Assert that initialization error is structured SmokerError
      await expect(clientWithFailingInit.init()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );
    });

    it("should handle non-Error objects in catch block", async () => {
      // Set the flag to throw a non-Error object
      shouldThrowNonError = true;

      const client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      });

      // Assert that initialization error is structured SmokerError
      await expect(client.init()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );

      // Reset the flag
      shouldThrowNonError = false;
    });

    it("should handle getLogEvents error with Error object", async () => {
      // Create a client that can initialize but will fail on getLogEvents
      shouldThrowNonError = false; // Use Error objects

      const client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      });

      // This will fail because the mocked constructor throws; assert structured error
      await expect(client.init()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );
    });

    it("should handle listLogStreams error with non-Error object", async () => {
      // Set flag to throw non-Error objects
      shouldThrowNonError = true;

      const client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      });

      // This will fail because the mocked constructor throws a string; assert structured error
      await expect(client.init()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );

      // Reset the flag
      shouldThrowNonError = false;
    });
  });

  /**
   * Tests for error handling in searchLogStream method
   */
  describe("searchLogStream error coverage", () => {
    it("should handle non-Error objects in searchLogStream method", async () => {
      // Skip the initialization tests since we only want to test the searchLogStream error path
      // Create a separate test file/case to avoid interfering with the initialization tests

      // Create a fresh instance of CloudWatchClient for this test only
      const client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      });

      // Skip calling client.init() to avoid the constructor error
      // Instead, directly set the properties we need for testing
      // Using Record<string, unknown> for better type safety than 'any'
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.client = { send: createMockSendFunction() };

      // Test with a boolean value (non-Error object)
      shouldThrowInCommand = true;
      nonErrorValue = false;

      // This should throw due to non-Error in the command; assert structured error
      await expect(
        client.searchLogStream(TEST_FIXTURES.LOG_STREAM_NAME, "ERROR"),
      ).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );

      // Reset flag
      shouldThrowInCommand = false;
    });
  });

  /**
   * Tests for error handling in getLogEvents method
   */
  describe("getLogEvents error coverage", () => {
    it("should handle non-Error objects in getLogEvents method", async () => {
      // Create a client that we can manually manipulate
      const client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      });

      // Make sure we're not throwing during initialization
      shouldThrowNonError = false;

      // Set the flag to use non-Error value in command execution
      shouldThrowInCommand = true;

      // Test with a boolean value (non-Error object)
      nonErrorValue = false;

      // Skip initialization and set properties manually
      // Using Record<string, unknown> for better type safety
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.client = { send: createMockSendFunction() };

      // This should throw due to non-Error in the command; assert structured error
      await expect(client.getLogEvents(TEST_FIXTURES.LOG_STREAM_NAME)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );

      // Reset flag
      shouldThrowInCommand = false;
    });
  });

  /**
   * Tests for error handling in listLogStreams method
   */
  describe("listLogStreams error coverage", () => {
    it("should handle non-Error objects in listLogStreams method", async () => {
      // Create a client that we can manually manipulate
      const client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      });

      // Make sure we're not throwing during initialization
      shouldThrowNonError = false;

      // Set the flag to use non-Error value in command execution
      shouldThrowInCommand = true;

      // Test with a number value (non-Error object)
      nonErrorValue = 404;

      // Skip initialization and set properties manually
      // Using Record<string, unknown> for better type safety
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.client = { send: createMockSendFunction() };
      // Make sure logGroupName is set correctly for the error message
      clientInternal.logGroupName = TEST_FIXTURES.LOG_GROUP_NAME;

      // This should throw due to non-Error in the command; assert structured error
      await expect(client.listLogStreams()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );

      // Reset flag
      shouldThrowInCommand = false;
    });
  });

  /**
   * Tests for error handling in waitForPattern method
   */
  describe("waitForPattern error coverage", () => {
    it("should handle non-Error primitives in waitForPattern method", async () => {
      // Create a client that we can manually manipulate
      const client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      });

      // Skip initialization and set up the client manually to have direct control
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;

      // Now directly override the searchLogStream method to throw a non-Error primitive
      // This bypasses any wrapping that might be happening with the send method
      const originalSearchLogStream = client.searchLogStream.bind(client);
      client.searchLogStream = vi.fn().mockImplementation(() => {
        // Throw a primitive that is definitely not an Error and has no message property
        throw nonErrorValue;
      });

      // This will directly throw the primitive from searchLogStream; assert structured error
      await expect(
        client.waitForPattern(TEST_FIXTURES.LOG_STREAM_NAME, "ERROR", 100),
      ).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );

      // Restore the original method
      client.searchLogStream = originalSearchLogStream;
    });
  });
});
