/**
 * AWS SQS Client Error Handling Tests
 *
 * This file contains comprehensive tests for error handling in the SQS client implementation,
 * focusing on various error scenarios and error types using different mocking approaches.
 *
 * Test coverage includes:
 * - AWS SDK initialization error handling
 * - Error object vs non-Error value handling in catch blocks
 * - Command execution error propagation
 * - String error message handling
 * - Module-level mocking for AWS SDK interactions
 * - Direct method mocking for protected methods
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SqsClient } from "../../../src/clients/aws/aws-sqs";

/**
 * Mock the AWS SDK SQS client to test error handling scenarios
 * This mock allows us to control whether the SQSClient constructor throws
 * an Error object or a non-Error value
 */
vi.mock("@aws-sdk/client-sqs", () => {
  return {
    SQSClient: vi.fn(() => {
      if (shouldThrowErrorObject) {
        // Throw an Error object to test the error.message branch
        throw new Error(TEST_FIXTURES.ERROR_AWS_SDK_ERROR);
      } else {
        // Throw a non-Error value to test the String(error) branch
        throw nonErrorValue;
      }
    }),
    // Mock the command classes used by the SQS client
    SendMessageCommand: vi.fn(),
    ReceiveMessageCommand: vi.fn(),
    DeleteMessageCommand: vi.fn(),
    PurgeQueueCommand: vi.fn(),
  };
});

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client identifiers and configuration
  CLIENT_ID: "test-client",
  QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
  REGION: "us-east-1",

  // Test message values
  MESSAGE_BODY: "Test message body",

  // Error message constants
  ERROR_AWS_SDK_ERROR: "AWS SDK Error",
  ERROR_STRING_ERROR: "String Error Message",

  // Error message functions
  ERROR_INITIALIZATION_ERROR: (error: string) => `Failed to initialize SQS client: ${error}`,
  ERROR_SEND_MESSAGE_ERROR: (error: string) => `Failed to send message to queue : ${error}`,
  ERROR_RECEIVE_MESSAGES_ERROR: (error: string) =>
    `Failed to receive messages from queue : ${error}`,
};

/**
 * Control variables for mock behavior
 * These determine how the mocked AWS SDK will behave during tests
 */
let shouldThrowErrorObject = true;
let nonErrorValue: unknown = TEST_FIXTURES.ERROR_STRING_ERROR;

/**
 * Tests for SqsClient error handling
 */
describe("SQS Client Error Handling", () => {
  beforeEach(() => {
    // Reset the mock state before each test
    shouldThrowErrorObject = true;
    nonErrorValue = TEST_FIXTURES.ERROR_STRING_ERROR;
    vi.restoreAllMocks();
  });

  /**
   * Tests for initialization error handling
   */
  describe("initialization error coverage", () => {
    /**
     * Tests using module-level mocking approach
     * This approach mocks the AWS SDK at the module level
     */
    describe("module-level mocking approach", () => {
      it("should handle Error objects in initialization", async () => {
        // Ensure we throw an Error object
        shouldThrowErrorObject = true;

        const client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
          queueUrl: TEST_FIXTURES.QUEUE_URL,
          region: TEST_FIXTURES.REGION,
        });

        await expect(client.init()).rejects.toThrow(
          TEST_FIXTURES.ERROR_INITIALIZATION_ERROR(TEST_FIXTURES.ERROR_AWS_SDK_ERROR),
        );
      });

      it("should handle string literals in initialization", async () => {
        // Switch to throwing a string literal
        shouldThrowErrorObject = false;
        nonErrorValue = TEST_FIXTURES.ERROR_STRING_ERROR;

        const client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
          queueUrl: TEST_FIXTURES.QUEUE_URL,
          region: TEST_FIXTURES.REGION,
        });

        await expect(client.init()).rejects.toThrow(
          TEST_FIXTURES.ERROR_INITIALIZATION_ERROR(TEST_FIXTURES.ERROR_STRING_ERROR),
        );
      });
    });

    /**
     * Tests for initialization error handling using direct method mocking
     * This approach directly mocks methods on the client instance
     */
    describe("direct mocking approach", () => {
      it("should handle Error objects in initialization using direct mocking", async () => {
        // Create a client with a spy on the protected initializeClient method
        const client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
          queueUrl: TEST_FIXTURES.QUEUE_URL,
          region: TEST_FIXTURES.REGION,
        });

        // Mock the initializeClient method to reject with an Error
        // @ts-expect-error - Accessing protected method for testing
        vi.spyOn(client, "initializeClient").mockImplementation(() => {
          return Promise.reject(new Error(TEST_FIXTURES.ERROR_AWS_SDK_ERROR));
        });

        await expect(client.init()).rejects.toThrow(TEST_FIXTURES.ERROR_AWS_SDK_ERROR);
      });

      it("should handle string literals in initialization using direct mocking", async () => {
        // Create a client with a spy on the protected initializeClient method
        const client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
          queueUrl: TEST_FIXTURES.QUEUE_URL,
          region: TEST_FIXTURES.REGION,
        });

        // Mock the initializeClient method to reject with a string
        // @ts-expect-error - Accessing protected method for testing
        vi.spyOn(client, "initializeClient").mockImplementation(() => {
          return Promise.reject(TEST_FIXTURES.ERROR_STRING_ERROR);
        });

        await expect(client.init()).rejects.toThrow(TEST_FIXTURES.ERROR_STRING_ERROR);
      });
    });
  });

  /**
   * Tests for sendMessage error handling
   * These tests focus on error handling during message sending operations
   */
  describe("sendMessage error coverage", () => {
    it("should handle Error objects in sendMessage", async () => {
      // Skip the constructor error to test the sendMessage error
      shouldThrowErrorObject = false;
      nonErrorValue = null; // This will make the constructor succeed

      // Create a client instance
      const client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
        queueUrl: TEST_FIXTURES.QUEUE_URL,
        region: TEST_FIXTURES.REGION,
      });

      // Mock the client's send method to throw an Error
      const mockClient = {
        send: vi.fn().mockRejectedValue(new Error(TEST_FIXTURES.ERROR_AWS_SDK_ERROR)),
      };
      // @ts-expect-error - Assigning to private property for testing
      client.client = mockClient;
      // @ts-expect-error - Marking as initialized for testing
      client.initialized = true;

      await expect(client.sendMessage(TEST_FIXTURES.MESSAGE_BODY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_SEND_MESSAGE_ERROR(TEST_FIXTURES.ERROR_AWS_SDK_ERROR),
      );
    });

    it("should handle string literals in sendMessage", async () => {
      // Skip the constructor error to test the sendMessage error
      shouldThrowErrorObject = false;
      nonErrorValue = null; // This will make the constructor succeed

      // Create a client instance
      const client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
        queueUrl: TEST_FIXTURES.QUEUE_URL,
        region: TEST_FIXTURES.REGION,
      });

      // Mock the client's send method to throw a string
      const mockClient = {
        send: vi.fn().mockRejectedValue(TEST_FIXTURES.ERROR_STRING_ERROR),
      };
      // @ts-expect-error - Assigning to private property for testing
      client.client = mockClient;
      // @ts-expect-error - Marking as initialized for testing
      client.initialized = true;

      await expect(client.sendMessage(TEST_FIXTURES.MESSAGE_BODY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_SEND_MESSAGE_ERROR(TEST_FIXTURES.ERROR_STRING_ERROR),
      );
    });
  });

  /**
   * Tests for receiveMessages error coverage
   */
  describe("receiveMessages error coverage", () => {
    it("should handle Error objects in receiveMessages", async () => {
      // Skip the constructor error to test the receiveMessages error
      shouldThrowErrorObject = false;
      nonErrorValue = null; // This will make the constructor succeed

      // Create a client instance
      const client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
        queueUrl: TEST_FIXTURES.QUEUE_URL,
        region: TEST_FIXTURES.REGION,
      });

      // Mock the client's send method to throw an Error
      const mockClient = {
        send: vi.fn().mockRejectedValue(new Error(TEST_FIXTURES.ERROR_AWS_SDK_ERROR)),
      };
      // @ts-expect-error - Assigning to private property for testing
      client.client = mockClient;
      // @ts-expect-error - Marking as initialized for testing
      client.initialized = true;

      await expect(client.receiveMessages()).rejects.toThrow(
        TEST_FIXTURES.ERROR_RECEIVE_MESSAGES_ERROR(TEST_FIXTURES.ERROR_AWS_SDK_ERROR),
      );
    });

    it("should handle string literals in receiveMessages", async () => {
      // Skip the constructor error to test the receiveMessages error
      shouldThrowErrorObject = false;
      nonErrorValue = null; // This will make the constructor succeed

      // Create a client instance
      const client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
        queueUrl: TEST_FIXTURES.QUEUE_URL,
        region: TEST_FIXTURES.REGION,
      });

      // Mock the client's send method to throw a string
      const mockClient = {
        send: vi.fn().mockRejectedValue(TEST_FIXTURES.ERROR_STRING_ERROR),
      };
      // @ts-expect-error - Assigning to private property for testing
      client.client = mockClient;
      // @ts-expect-error - Marking as initialized for testing
      client.initialized = true;

      await expect(client.receiveMessages()).rejects.toThrow(
        TEST_FIXTURES.ERROR_RECEIVE_MESSAGES_ERROR(TEST_FIXTURES.ERROR_STRING_ERROR),
      );
    });
  });
});
