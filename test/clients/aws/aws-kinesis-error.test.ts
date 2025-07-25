/**
 * AWS Kinesis Client Error Handling Tests
 *
 * This file contains tests for error handling in the AWS Kinesis client implementation,
 * focusing on various error scenarios and error types using module-level mocking.
 *
 * Test coverage includes:
 * - Error handling during client initialization
 * - Error propagation in AWS SDK operations
 * - Error message formatting for different error types
 * - String vs Error object error handling
 * - Edge cases and parameter validation
 */

import { describe, expect, it, vi } from "vitest";
import { KinesisClient } from "../../../src/clients/aws/aws-kinesis";

/**
 * Mocks the AWS SDK KinesisClient module
 * This mock allows us to control whether the KinesisClient constructor throws
 * an Error object or a non-Error value
 */
vi.mock("@aws-sdk/client-kinesis", () => {
  return {
    KinesisClient: vi.fn(() => {
      // Throw a non-Error value to test the String(error) branch of the ternary
      throw nonErrorValue;
    }),
    GetRecordsCommand: vi.fn(),
    GetShardIteratorCommand: vi.fn(),
    ListShardsCommand: vi.fn(),
    PutRecordCommand: vi.fn(),
  };
});

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client identifiers and configuration
  CLIENT_ID: "test-client",
  STREAM_NAME: "test-stream",
  REGION: "us-east-1",

  // Shard and record identifiers
  SHARD_ID: "shard-0001",
  ITERATOR: "test-iterator",
  PARTITION_KEY: "test-key",

  // Data values
  DATA: "test data",

  // Error messages for different scenarios
  ERROR_STRING_VALUE: "error-string-value",
  ERROR_ACCESS_DENIED: "access-denied",
  ERROR_RESOURCE_NOT_FOUND: "resource-not-found",
  ERROR_INTERNAL_SERVER_ERROR: "internal-server-error",
  ERROR_PERMISSION_DENIED: "permission-denied",
  ERROR_THROTTLING_EXCEPTION: "throttling-exception",
  ERROR_ITERATOR_EXPIRED: "iterator-expired",
  ERROR_SERVICE_UNAVAILABLE: "service-unavailable",
  ERROR_NOT_FOUND: "not-found",
  ERROR_SERVICE_NOT_IMPLEMENTED: "service-not-implemented",
  ERROR_NO_PERMISSIONS: "No permissions to access stream",

  // Error message functions
  ERROR_PUT_RECORD: (streamName: string, errorMsg: string) =>
    `Failed to put record into stream ${streamName}: ${errorMsg}`,
  ERROR_GET_RECORDS: (streamName: string, errorMsg: string) =>
    `Failed to get records from stream ${streamName}: ${errorMsg}`,
  ERROR_GET_SHARD_ITERATOR: (streamName: string, errorMsg: string) =>
    `Failed to get shard iterator for stream ${streamName}: ${errorMsg}`,
  ERROR_LIST_SHARDS: (streamName: string, errorMsg: string) =>
    `Failed to list shards for stream ${streamName}: ${errorMsg}`,
  ERROR_WAIT_FOR_RECORDS: (streamName: string, errorMsg: string) =>
    `Error waiting for records in stream ${streamName}: ${errorMsg}`,
  ERROR_INITIALIZATION: (errorMsg: string) => `Failed to initialize Kinesis client: ${errorMsg}`,
};

/**
 * Mock the AWS SDK module to test error handling - this must be at the top level
 */
let nonErrorValue: unknown = TEST_FIXTURES.ERROR_STRING_VALUE; // String primitive to test String(error) branch

/**
 * Tests for KinesisClient error handling
 */
describe("KinesisClient error handling", () => {
  /**
   * Tests for initialization error coverage
   */
  describe("initialization error coverage", () => {
    it("should handle string values in init method", async () => {
      // Create a client with valid config
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Test with a string value (non-Error object)
      // This will trigger the AWS SDK mock which throws our nonErrorValue
      await expect(client.init()).rejects.toThrow(
        TEST_FIXTURES.ERROR_INITIALIZATION(TEST_FIXTURES.ERROR_STRING_VALUE),
      );

      // Also verify the client is not initialized
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle different string error values", async () => {
      // Test with another string value
      nonErrorValue = TEST_FIXTURES.ERROR_ACCESS_DENIED;

      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      await expect(client.init()).rejects.toThrow(
        TEST_FIXTURES.ERROR_INITIALIZATION(TEST_FIXTURES.ERROR_ACCESS_DENIED),
      );

      // Test with a different string value
      nonErrorValue = TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND;

      await expect(client.init()).rejects.toThrow(
        TEST_FIXTURES.ERROR_INITIALIZATION(TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND),
      );
    });
  });

  /**
   * Tests for putRecord error handling
   */
  describe("putRecord error coverage", () => {
    it("should handle string values in putRecord method", async () => {
      // For this test, we need to mock the client.send method to throw a string value
      // First create a client with valid config
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Skip initialization and set up the client manually
      // Using Record<string, unknown> for better type safety
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME; // Set the streamName property
      clientInternal.client = {
        send: () => {
          // Throw a string value to test the String(error) branch
          throw TEST_FIXTURES.ERROR_INTERNAL_SERVER_ERROR;
        },
      };

      // Now call putRecord which should trigger the error
      await expect(
        client.putRecord(TEST_FIXTURES.DATA, TEST_FIXTURES.PARTITION_KEY),
      ).rejects.toThrow(
        // Verify the error message contains the stringified error value
        TEST_FIXTURES.ERROR_PUT_RECORD(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it("should handle different string values in putRecord", async () => {
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Setup client for testing
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME; // Set the streamName property

      // Test with first string value
      clientInternal.client = {
        send: () => {
          throw TEST_FIXTURES.ERROR_PERMISSION_DENIED;
        },
      };

      await expect(
        client.putRecord(TEST_FIXTURES.DATA, TEST_FIXTURES.PARTITION_KEY),
      ).rejects.toThrow(
        TEST_FIXTURES.ERROR_PUT_RECORD(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_PERMISSION_DENIED,
        ),
      );

      // Test with another string value
      clientInternal.client = {
        send: () => {
          throw TEST_FIXTURES.ERROR_THROTTLING_EXCEPTION;
        },
      };

      await expect(
        client.putRecord(TEST_FIXTURES.DATA, TEST_FIXTURES.PARTITION_KEY),
      ).rejects.toThrow(
        TEST_FIXTURES.ERROR_PUT_RECORD(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_THROTTLING_EXCEPTION,
        ),
      );
    });
  });

  /**
   * Tests for getRecords error handling
   */
  describe("getRecords error coverage", () => {
    it("should handle string values in getRecords method", async () => {
      // Create a client with valid config
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Skip initialization and set up the client manually
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;
      clientInternal.client = {
        send: () => {
          // Throw a string value to test the String(error) branch
          throw TEST_FIXTURES.ERROR_NOT_FOUND;
        },
      };

      // Now call getRecords which should trigger the error
      await expect(client.getRecords(TEST_FIXTURES.ITERATOR)).rejects.toThrow(
        // Verify the error message contains the stringified error value
        TEST_FIXTURES.ERROR_GET_RECORDS(TEST_FIXTURES.STREAM_NAME, TEST_FIXTURES.ERROR_NOT_FOUND),
      );
    });

    it("should handle different string values in getRecords", async () => {
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Setup client for testing
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;

      // Test with first string value
      clientInternal.client = {
        send: () => {
          throw TEST_FIXTURES.ERROR_ITERATOR_EXPIRED;
        },
      };

      await expect(client.getRecords(TEST_FIXTURES.ITERATOR)).rejects.toThrow(
        TEST_FIXTURES.ERROR_GET_RECORDS(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_ITERATOR_EXPIRED,
        ),
      );

      // Test with another string value
      clientInternal.client = {
        send: () => {
          throw TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND;
        },
      };

      await expect(client.getRecords(TEST_FIXTURES.ITERATOR)).rejects.toThrow(
        TEST_FIXTURES.ERROR_GET_RECORDS(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND,
        ),
      );
    });
  });

  /**
   * Tests for getShardIterator error handling
   */
  describe("getShardIterator error coverage", () => {
    it("should handle string values in getShardIterator method", async () => {
      // Create a client with valid config
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Skip initialization and set up the client manually
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;
      clientInternal.client = {
        send: () => {
          // Throw a string value to test the String(error) branch
          throw TEST_FIXTURES.ERROR_SERVICE_UNAVAILABLE;
        },
      };

      // Now call getShardIterator which should trigger the error
      await expect(client.getShardIterator(TEST_FIXTURES.SHARD_ID)).rejects.toThrow(
        // Verify the error message contains the stringified error value
        TEST_FIXTURES.ERROR_GET_SHARD_ITERATOR(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_SERVICE_UNAVAILABLE,
        ),
      );
    });

    it("should handle different string values in getShardIterator", async () => {
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Setup client for testing
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;

      // Test with first string value
      clientInternal.client = {
        send: () => {
          throw TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND;
        },
      };

      await expect(client.getShardIterator(TEST_FIXTURES.SHARD_ID)).rejects.toThrow(
        TEST_FIXTURES.ERROR_GET_SHARD_ITERATOR(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND,
        ),
      );

      // Test with another string value
      clientInternal.client = {
        send: () => {
          throw TEST_FIXTURES.ERROR_THROTTLING_EXCEPTION;
        },
      };

      await expect(client.getShardIterator(TEST_FIXTURES.SHARD_ID)).rejects.toThrow(
        TEST_FIXTURES.ERROR_GET_SHARD_ITERATOR(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_THROTTLING_EXCEPTION,
        ),
      );
    });
  });

  /**
   * Tests for listShards error handling
   */
  describe("listShards error coverage", () => {
    it("should handle string values in listShards method", async () => {
      // Create a client with valid config
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Skip normal initialization and set up the client manually
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;
      clientInternal.client = {
        send: () => {
          // Throw a string value to test the String(error) branch
          throw TEST_FIXTURES.ERROR_THROTTLING_EXCEPTION;
        },
      };

      // This should trigger our mocked error
      await expect(client.listShards()).rejects.toThrow(
        // Verify the error message contains the stringified error value
        TEST_FIXTURES.ERROR_LIST_SHARDS(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_THROTTLING_EXCEPTION,
        ),
      );
    });

    it("should handle Error objects in listShards method", async () => {
      // Create a client with valid config
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Skip normal initialization and set up the client manually
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;
      clientInternal.client = {
        send: () => {
          // Throw an Error object to test the error.message branch
          throw new Error("ResourceNotFoundException");
        },
      };

      // This should trigger our mocked error
      await expect(client.listShards()).rejects.toThrow(
        // Verify the error message contains the original error message
        TEST_FIXTURES.ERROR_LIST_SHARDS(TEST_FIXTURES.STREAM_NAME, "ResourceNotFoundException"),
      );
    });
  });

  /**
   * Tests for waitForRecords error handling
   */
  describe("waitForRecords error coverage", () => {
    it("should handle string values in waitForRecords method", async () => {
      // Create a client with valid config
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Skip normal initialization and set up the client manually
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true; // This is crucial - we need to bypass ensureInitialized()
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;
      clientInternal.client = {}; // Need to satisfy this.assertNotNull(this.client)

      // Force an error by making listShards throw a string value
      // We override the client's listShards method directly to have precise control
      client.listShards = vi.fn().mockImplementation(() => {
        throw TEST_FIXTURES.ERROR_SERVICE_NOT_IMPLEMENTED; // Service not implemented error
      });

      // This should trigger our mocked error
      await expect(client.waitForRecords(TEST_FIXTURES.PARTITION_KEY)).rejects.toThrow(
        // Verify the error message contains the stringified error value
        TEST_FIXTURES.ERROR_WAIT_FOR_RECORDS(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_SERVICE_NOT_IMPLEMENTED,
        ),
      );
    });

    it("should handle different string values in waitForRecords", async () => {
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Setup client for testing
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;
      clientInternal.client = {}; // Need to satisfy this.assertNotNull(this.client)

      // Save original method
      const originalListShards = client.listShards.bind(client);

      // Test with first string value
      client.listShards = vi.fn().mockImplementation(() => {
        throw TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND;
      });

      await expect(client.waitForRecords(TEST_FIXTURES.PARTITION_KEY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_WAIT_FOR_RECORDS(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND,
        ),
      );

      // Test with another string value
      client.listShards = vi.fn().mockImplementation(() => {
        throw TEST_FIXTURES.ERROR_ACCESS_DENIED;
      });

      await expect(client.waitForRecords(TEST_FIXTURES.PARTITION_KEY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_WAIT_FOR_RECORDS(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_ACCESS_DENIED,
        ),
      );

      // Restore original method
      client.listShards = originalListShards;
    });

    it("should handle Error objects in waitForRecords", async () => {
      const client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        streamName: TEST_FIXTURES.STREAM_NAME,
        region: TEST_FIXTURES.REGION,
      });

      // Setup client for testing
      const clientInternal = client as unknown as Record<string, unknown>;
      clientInternal.initialized = true;
      clientInternal.streamName = TEST_FIXTURES.STREAM_NAME;
      clientInternal.client = {}; // Need to satisfy this.assertNotNull(this.client)

      // Store original method
      const originalListShards = client.listShards.bind(client);

      // Test with standard Error object
      client.listShards = vi.fn().mockImplementation(() => {
        throw new Error(TEST_FIXTURES.ERROR_NO_PERMISSIONS);
      });

      await expect(client.waitForRecords(TEST_FIXTURES.PARTITION_KEY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_WAIT_FOR_RECORDS(
          TEST_FIXTURES.STREAM_NAME,
          TEST_FIXTURES.ERROR_NO_PERMISSIONS,
        ),
      );

      // Restore original method
      client.listShards = originalListShards;
    });
  });
});
