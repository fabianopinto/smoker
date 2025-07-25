/**
 * AWS S3 Client Error Handling Tests
 *
 * This file contains comprehensive tests for error handling in the S3Client class,
 * focusing on initialization failures and proper error propagation.
 *
 * Test coverage includes:
 * - Client initialization failures
 * - Configuration validation errors
 * - AWS SDK error handling
 * - Error type handling (Error objects vs string errors)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { S3Client } from "../../../src/clients/aws/aws-s3";

/**
 * Mocks the AWS SDK S3Client module
 * This mock allows us to control whether the S3Client constructor throws
 * an Error object or a non-Error value
 */
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => {
    if (shouldThrowNonError) {
      // Throw a non-Error object to test the String(error) branch
      throw nonErrorValue;
    } else if (shouldThrowInCommand) {
      // Throw an Error object to test error handling
      throw new Error(TEST_FIXTURES.ERROR_AWS_CREDENTIALS);
    }
    // Return a mock client with a send method
    return {
      send: vi.fn().mockImplementation(() => {
        if (shouldThrowInCommand) {
          throw nonErrorValue;
        } else {
          throw new Error(TEST_FIXTURES.ERROR_AWS_CREDENTIALS);
        }
      }),
    };
  }),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client configuration
  CLIENT_ID: "test-client",
  BUCKET: "test-bucket",
  REGION: "us-east-1",

  // Error message constants
  ERROR_AWS_CREDENTIALS: "AWS credentials not found",
  ERROR_NETWORK_DISCONNECTED: "Network disconnected",
  ERROR_MISSING_BUCKET_MSG: "S3 client requires a 'bucket' name to be provided in configuration",
};

/**
 * Control variables for mock behavior
 * These determine how the mocked AWS SDK will behave during tests
 */
let shouldThrowNonError = false;
let shouldThrowInCommand = false;
let nonErrorValue: unknown = TEST_FIXTURES.ERROR_AWS_CREDENTIALS;

/**
 * Tests for S3Client error handling
 */
describe("S3Client Error Handling", () => {
  let client: S3Client;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a new client instance for each test
    client = new S3Client(TEST_FIXTURES.CLIENT_ID, {
      bucket: TEST_FIXTURES.BUCKET,
      region: TEST_FIXTURES.REGION,
    });
  });

  /**
   * Tests for client initialization error handling
   */
  describe("initialization", () => {
    it("should throw error when bucket is missing", async () => {
      const clientWithoutBucket = new S3Client("test-client");
      await expect(clientWithoutBucket.init()).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_BUCKET_MSG,
      );
    });

    it("should handle AWS SDK client creation failure", async () => {
      // Set up the mock to throw an error during client creation
      shouldThrowNonError = false;
      shouldThrowInCommand = true; // This will make the S3Client throw an error

      await expect(client.init()).rejects.toThrow(TEST_FIXTURES.ERROR_AWS_CREDENTIALS);
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle non-Error objects during client creation", async () => {
      // Set up the mock to throw a non-Error value during client creation
      shouldThrowNonError = true;
      nonErrorValue = "Custom error string";

      await expect(client.init()).rejects.toThrow("Custom error string");
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle Error objects thrown during initialization", async () => {
      // For this test, we need to reset our mock to allow the actual validation to happen
      // Reset the mock implementation
      vi.resetModules();
      vi.resetAllMocks();

      // We need to reimport S3Client to get a fresh instance without mocking
      // Use dynamic import to get a fresh copy
      const { S3Client: ActualS3Client } = await import("../../../src/clients/aws/aws-s3");

      // Create an S3 client with invalid configuration (missing bucket)
      const client = new ActualS3Client(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        // bucket is deliberately missing to trigger validation error
      });

      // Initialization should fail with the proper error message
      await expect(client.init()).rejects.toThrow(TEST_FIXTURES.ERROR_MISSING_BUCKET_MSG);

      // Verify the client is not initialized
      expect(client.isInitialized()).toBe(false);

      // Restore the mocking for subsequent tests
      vi.resetModules();
    });

    it("should handle errors thrown from AWS S3Client constructor", async () => {
      // Set up the mock to throw an error during client creation
      shouldThrowNonError = false;

      // Create S3Client with valid config
      const client = new S3Client(TEST_FIXTURES.CLIENT_ID, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });

      // Test the initialization which should properly wrap the error message
      await expect(client.init()).rejects.toThrow(TEST_FIXTURES.ERROR_AWS_CREDENTIALS);

      // Verify the client is not initialized
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle string values thrown from AWS constructor", async () => {
      // Set up the mock to throw a string during client creation
      shouldThrowNonError = true;
      nonErrorValue = TEST_FIXTURES.ERROR_NETWORK_DISCONNECTED;

      // Create S3Client with valid config
      const client = new S3Client(TEST_FIXTURES.CLIENT_ID, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });

      // Test the initialization which should properly handle non-Error values
      await expect(client.init()).rejects.toThrow(TEST_FIXTURES.ERROR_NETWORK_DISCONNECTED);

      // Verify the client is not initialized
      expect(client.isInitialized()).toBe(false);
    });
  });

  /**
   * Tests for operation error handling
   */
  describe("operation error handling", () => {
    let client: S3Client;

    beforeEach(async () => {
      // Reset mock behavior before each test
      shouldThrowNonError = false;
      shouldThrowInCommand = false;
      nonErrorValue = TEST_FIXTURES.ERROR_AWS_CREDENTIALS;

      // Create a new client instance for each test
      client = new S3Client(TEST_FIXTURES.CLIENT_ID, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });
      await client.init();
    });

    it("should handle errors during read operation", async () => {
      const error = new Error("Read failed");
      nonErrorValue = error;
      shouldThrowInCommand = true;

      await expect(client.read("test-file.txt")).rejects.toThrow(
        `Failed to read object test-file.txt from bucket ${TEST_FIXTURES.BUCKET}: ${error.message}`,
      );
    });

    it("should handle non-Error objects during read operation", async () => {
      nonErrorValue = "Custom read error";
      shouldThrowInCommand = true;

      await expect(client.read("test-file.txt")).rejects.toThrow(
        `Failed to read object test-file.txt from bucket ${TEST_FIXTURES.BUCKET}: ${nonErrorValue}`,
      );
    });

    it("should handle errors during write operation", async () => {
      const error = new Error("Write failed");
      nonErrorValue = error;
      shouldThrowInCommand = true;

      await expect(client.write("test-file.txt", "test content")).rejects.toThrow(
        `Failed to write object test-file.txt to bucket ${TEST_FIXTURES.BUCKET}: ${error.message}`,
      );
    });

    it("should handle errors during delete operation", async () => {
      const error = new Error("Delete failed");
      nonErrorValue = error;
      shouldThrowInCommand = true;

      await expect(client.delete("test-file.txt")).rejects.toThrow(
        `Failed to delete object test-file.txt from bucket ${TEST_FIXTURES.BUCKET}: ${error.message}`,
      );
    });
  });
});
