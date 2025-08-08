/**
 * AWS Kinesis Client Tests
 *
 * This file contains comprehensive tests for the KinesisClient implementation,
 * covering initialization, record operations, and AWS SDK interactions.
 *
 * Test coverage includes:
 * - Client initialization and configuration validation
 * - Record operations (put, get, format)
 * - Shard management (list shards, get iterators)
 * - Error handling and validation
 * - Record waiting and processing
 * - Data formatting and transformation
 * - Lifecycle management
 */

import {
  KinesisClient as AwsKinesisClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListShardsCommand,
  PutRecordCommand,
} from "@aws-sdk/client-kinesis";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KinesisClient } from "../../../src/clients/aws/aws-kinesis";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";

/**
 * Test fixtures and constants for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client identifiers and configuration
  CLIENT_ID: "test-kinesis-client",
  REGION: "us-east-1",
  STREAM_NAME: "test-stream",
  PARTITION_KEY: "test-partition",

  // Shard information
  SHARD_ID: "shardId-000000000001",
  SHARD_ITERATOR: "test-shard-iterator",

  // Record data
  RECORD_DATA: "test-record-data",
  SEQUENCE_NUMBER: "49598630142999655949899915322284437913396586742768975874",

  // Time values
  TIMESTAMP: new Date("2024-01-01T10:00:00Z").getTime(),
  TIMESTAMP_LATER: new Date("2024-01-01T10:01:00Z").getTime(),

  // Error messages - string constants
  ERROR_MISSING_STREAM_NAME:
    "Failed to initialize Kinesis client: Kinesis client requires a stream name",
  ERROR_MISSING_PARTITION_KEY: "Kinesis putRecord requires a partition key",
  ERROR_MISSING_SHARD_ID: "Kinesis getShardIterator requires a shard ID",
  ERROR_MISSING_SHARD_ITERATOR: "Kinesis getRecords requires a shard iterator",
  ERROR_MISSING_DATA: "Kinesis putRecord requires data content",
  ERROR_MISSING_WAIT_PARTITION_KEY: "Kinesis waitForRecords requires a partition key",
  ERROR_RESOURCE_NOT_FOUND: "ResourceNotFoundException",
  ERROR_EXPIRED_ITERATOR: "ExpiredIteratorException",

  // Error message functions
  ERROR_NOT_INITIALIZED: (clientId: string) => `${clientId} is not initialized. Call init() first`,

  // Client configuration options
  CONFIG_BASIC: { streamName: "test-stream", region: "us-east-1" },
};

/**
 * Create mock for Kinesis client
 */
const kinesisMock = mockClient(AwsKinesisClient);

/**
 * Tests for KinesisClient
 */
describe("KinesisClient", () => {
  let client: KinesisClient;

  beforeEach(() => {
    // Reset all mocks before each test
    kinesisMock.reset();
    vi.clearAllMocks();

    // Create a new client instance for each test
    client = new KinesisClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
  });

  /**
   * Tests for client initialization and configuration validation
   */
  describe("initialization", () => {
    it("should initialize successfully with valid configuration", async () => {
      await expect(client.init()).resolves.not.toThrow();
      expect(client.isInitialized()).toBe(true);
    });

    it("should throw error when streamName is missing", async () => {
      const clientWithoutStreamName = new KinesisClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
      });

      await expect(clientWithoutStreamName.init()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );
    });

    it("should return client name", () => {
      expect(client.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });
  });

  /**
   * Tests for putting records into Kinesis stream
   */
  describe("putRecord", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should put record successfully with string data", async () => {
      kinesisMock.on(PutRecordCommand).resolves({ SequenceNumber: TEST_FIXTURES.SEQUENCE_NUMBER });

      const result = await client.putRecord(TEST_FIXTURES.RECORD_DATA, TEST_FIXTURES.PARTITION_KEY);

      expect(result).toBe(TEST_FIXTURES.SEQUENCE_NUMBER);
      expect(kinesisMock).toHaveReceivedCommandWith(PutRecordCommand, {
        StreamName: TEST_FIXTURES.STREAM_NAME,
        Data: expect.any(Uint8Array),
        PartitionKey: TEST_FIXTURES.PARTITION_KEY,
      });
    });

    it("should put record successfully with Buffer data", async () => {
      const data = Buffer.from(TEST_FIXTURES.RECORD_DATA);
      kinesisMock.on(PutRecordCommand).resolves({ SequenceNumber: TEST_FIXTURES.SEQUENCE_NUMBER });

      const result = await client.putRecord(data, TEST_FIXTURES.PARTITION_KEY);

      expect(result).toBe(TEST_FIXTURES.SEQUENCE_NUMBER);
      expect(kinesisMock).toHaveReceivedCommandWith(PutRecordCommand, {
        StreamName: TEST_FIXTURES.STREAM_NAME,
        Data: expect.any(Uint8Array),
        PartitionKey: TEST_FIXTURES.PARTITION_KEY,
      });
    });

    it("should throw structured error for empty data", async () => {
      await expect(client.putRecord("", TEST_FIXTURES.PARTITION_KEY)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );
    });

    it("should throw structured error when partition key is missing or empty", async () => {
      // Test with empty string partition key
      await expect(client.putRecord("test data", "")).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );

      // Create a function that passes an explicit empty string to test the validation
      const testWithEmptyPartitionKey = () => client.putRecord("test data", "");
      await expect(testWithEmptyPartitionKey()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );
    });

    it("should throw structured error when client is not initialized", async () => {
      const uninitializedClient = new KinesisClient(
        TEST_FIXTURES.CLIENT_ID,
        TEST_FIXTURES.CONFIG_BASIC,
      );

      await expect(
        uninitializedClient.putRecord("data", TEST_FIXTURES.PARTITION_KEY),
      ).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });

    it("should handle AWS API errors with structured error", async () => {
      kinesisMock.on(PutRecordCommand).rejects(new Error(TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND));

      await expect(client.putRecord("data", TEST_FIXTURES.PARTITION_KEY)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );
    });

    it("should return fallback sequence number when SequenceNumber is missing from response", async () => {
      kinesisMock.on(PutRecordCommand).resolves({});

      const result = await client.putRecord("data", TEST_FIXTURES.PARTITION_KEY);

      expect(result).toMatch(/^sequence-\d+$/);
    });
  });

  /**
   * Tests for retrieving records from Kinesis stream
   */
  describe("getRecords", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should throw error when shard iterator is missing or empty", async () => {
      // Test with empty string shard iterator
      await expect(client.getRecords("")).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_SHARD_ITERATOR,
      );

      // Test with null shardIterator (will be treated as falsy by the validation)
      // Using a simple function to bypass TypeScript type checking in a safer way
      const testWithNullIterator = () => {
        // Using a non-null assertion with an empty string that will fail validation
        // This is type-safe while still testing the validation logic
        return client.getRecords("");
      };

      await expect(testWithNullIterator()).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_SHARD_ITERATOR,
      );
    });

    it("should get records successfully", async () => {
      const mockRecords = [
        {
          Data: new Uint8Array(Buffer.from("record 1 data")),
          PartitionKey: `${TEST_FIXTURES.PARTITION_KEY}-1`,
          SequenceNumber: "49590338271490256608559692538361571095921575989136588801",
          ApproximateArrivalTimestamp: new Date(TEST_FIXTURES.TIMESTAMP),
        },
        {
          Data: new Uint8Array(Buffer.from("record 2 data")),
          PartitionKey: `${TEST_FIXTURES.PARTITION_KEY}-2`,
          SequenceNumber: "49590338271490256608559692538361571095921575989136588802",
          ApproximateArrivalTimestamp: new Date(TEST_FIXTURES.TIMESTAMP_LATER),
        },
      ];

      kinesisMock
        .on(GetRecordsCommand)
        .resolves({ Records: mockRecords, NextShardIterator: "next-shard-iterator" });

      const result = await client.getRecords(TEST_FIXTURES.SHARD_ITERATOR);

      expect(result).toEqual([
        {
          data: "record 1 data",
          partitionKey: `${TEST_FIXTURES.PARTITION_KEY}-1`,
          sequenceNumber: "49590338271490256608559692538361571095921575989136588801",
          approximateArrivalTimestamp: new Date(TEST_FIXTURES.TIMESTAMP),
        },
        {
          data: "record 2 data",
          partitionKey: `${TEST_FIXTURES.PARTITION_KEY}-2`,
          sequenceNumber: "49590338271490256608559692538361571095921575989136588802",
          approximateArrivalTimestamp: new Date(TEST_FIXTURES.TIMESTAMP_LATER),
        },
      ]);
      expect(kinesisMock).toHaveReceivedCommandWith(GetRecordsCommand, {
        ShardIterator: TEST_FIXTURES.SHARD_ITERATOR,
        Limit: 10,
      });
    });

    it("should get records with custom limit", async () => {
      const limit = 5;
      kinesisMock.on(GetRecordsCommand).resolves({ Records: [] });

      await client.getRecords(TEST_FIXTURES.SHARD_ITERATOR, limit);

      expect(kinesisMock).toHaveReceivedCommandWith(GetRecordsCommand, {
        ShardIterator: TEST_FIXTURES.SHARD_ITERATOR,
        Limit: limit,
      });
    });

    it("should return empty array when no records available", async () => {
      kinesisMock.on(GetRecordsCommand).resolves({ Records: [] });

      const result = await client.getRecords("shard-iterator");

      expect(result).toEqual([]);
    });

    it("should handle undefined Records in response", async () => {
      kinesisMock.on(GetRecordsCommand).resolves({});

      const result = await client.getRecords("shard-iterator");

      expect(result).toEqual([]);
    });

    it("should handle records with missing optional fields", async () => {
      const mockRecords = [
        {
          Data: new Uint8Array(Buffer.from("minimal record")),
          PartitionKey: TEST_FIXTURES.PARTITION_KEY,
          SequenceNumber: "49590338271490256608559692538361571095921575989136588801",
          // Missing ApproximateArrivalTimestamp
        },
      ];

      kinesisMock.on(GetRecordsCommand).resolves({ Records: mockRecords });

      const result = await client.getRecords("shard-iterator");

      expect(result).toEqual([
        {
          data: "minimal record",
          partitionKey: TEST_FIXTURES.PARTITION_KEY,
          sequenceNumber: "49590338271490256608559692538361571095921575989136588801",
          approximateArrivalTimestamp: undefined,
        },
      ]);
    });

    it("should throw structured error when client is not initialized", async () => {
      const uninitializedClient = new KinesisClient(
        TEST_FIXTURES.CLIENT_ID,
        TEST_FIXTURES.CONFIG_BASIC,
      );

      await expect(uninitializedClient.getRecords("shard-iterator")).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });

    it("should handle AWS API errors with structured error", async () => {
      kinesisMock.on(GetRecordsCommand).rejects(new Error(TEST_FIXTURES.ERROR_EXPIRED_ITERATOR));

      await expect(client.getRecords(TEST_FIXTURES.SHARD_ITERATOR)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );
    });
  });

  /**
   * Tests for obtaining shard iterators for reading stream data
   */
  describe("getShardIterator", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should throw error when shard ID is missing or empty", async () => {
      // Test with empty string shard ID
      await expect(client.getShardIterator("")).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_SHARD_ID,
      );

      // Test with empty string shard ID using a function approach
      const testWithEmptyShardId = () => client.getShardIterator("");
      await expect(testWithEmptyShardId()).rejects.toThrow(TEST_FIXTURES.ERROR_MISSING_SHARD_ID);
    });

    it("should get shard iterator successfully with default type", async () => {
      kinesisMock
        .on(GetShardIteratorCommand)
        .resolves({ ShardIterator: TEST_FIXTURES.SHARD_ITERATOR });

      const result = await client.getShardIterator(TEST_FIXTURES.SHARD_ID);

      expect(result).toBe(TEST_FIXTURES.SHARD_ITERATOR);
      expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
        StreamName: TEST_FIXTURES.STREAM_NAME,
        ShardId: TEST_FIXTURES.SHARD_ID,
        ShardIteratorType: "LATEST",
      });
    });

    it("should get shard iterator with custom type", async () => {
      const iteratorType = "TRIM_HORIZON";
      const shardIterator = "custom-shard-iterator";

      kinesisMock.on(GetShardIteratorCommand).resolves({ ShardIterator: shardIterator });

      const result = await client.getShardIterator(TEST_FIXTURES.SHARD_ID, iteratorType);

      expect(result).toBe(shardIterator);
      expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
        StreamName: TEST_FIXTURES.STREAM_NAME,
        ShardId: TEST_FIXTURES.SHARD_ID,
        ShardIteratorType: iteratorType,
      });
    });

    it("should get shard iterator with sequence number", async () => {
      const iteratorType = "AT_SEQUENCE_NUMBER";
      const shardIterator = "sequence-shard-iterator";

      kinesisMock.on(GetShardIteratorCommand).resolves({ ShardIterator: shardIterator });

      const result = await client.getShardIterator(
        TEST_FIXTURES.SHARD_ID,
        iteratorType,
        TEST_FIXTURES.SEQUENCE_NUMBER,
      );

      expect(result).toBe(shardIterator);
      expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
        StreamName: TEST_FIXTURES.STREAM_NAME,
        ShardId: TEST_FIXTURES.SHARD_ID,
        ShardIteratorType: iteratorType,
        StartingSequenceNumber: TEST_FIXTURES.SEQUENCE_NUMBER,
      });
    });

    it("should throw structured error when client is not initialized", async () => {
      const uninitializedClient = new KinesisClient(
        TEST_FIXTURES.CLIENT_ID,
        TEST_FIXTURES.CONFIG_BASIC,
      );

      await expect(uninitializedClient.getShardIterator("shard-id")).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });

    it("should handle AWS API errors with structured error", async () => {
      kinesisMock
        .on(GetShardIteratorCommand)
        .rejects(new Error(TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND));

      await expect(client.getShardIterator("invalid-shard")).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );
    });

    it("should throw structured error when ShardIterator is missing from response", async () => {
      const shardId = "non-existent-shard-id";
      kinesisMock.on(GetRecordsCommand); // ensure no side-effect
      kinesisMock.on(GetShardIteratorCommand).resolves({});

      await expect(client.getShardIterator(shardId)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );
    });
  });

  /**
   * Tests for listing available shards in a stream
   */
  describe("listShards", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should list shards successfully", async () => {
      const mockShards = [
        {
          ShardId: TEST_FIXTURES.SHARD_ID,
          HashKeyRange: { StartingHashKey: "0", EndingHashKey: "100" },
          SequenceNumberRange: { StartingSequenceNumber: "start-1" },
        },
        {
          ShardId: "shardId-000000000002",
          HashKeyRange: { StartingHashKey: "101", EndingHashKey: "200" },
          SequenceNumberRange: { StartingSequenceNumber: "start-2" },
        },
        {
          ShardId: "shardId-000000000003",
          HashKeyRange: { StartingHashKey: "201", EndingHashKey: "300" },
          SequenceNumberRange: { StartingSequenceNumber: "start-3" },
        },
      ];
      kinesisMock.on(ListShardsCommand).resolves({ Shards: mockShards });

      const result = await client.listShards();

      expect(result).toEqual([
        TEST_FIXTURES.SHARD_ID,
        "shardId-000000000002",
        "shardId-000000000003",
      ]);
      expect(kinesisMock).toHaveReceivedCommandWith(ListShardsCommand, {
        StreamName: TEST_FIXTURES.STREAM_NAME,
      });
    });

    it("should handle shards with missing ShardId", async () => {
      // We need to use type assertion to avoid TypeScript errors while still testing the runtime behavior
      // Type is narrowed to 'any' first to bypass TypeScript's type checking for testing purposes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockShards: any = [
        {
          ShardId: TEST_FIXTURES.SHARD_ID,
          HashKeyRange: { StartingHashKey: "0", EndingHashKey: "100" },
          SequenceNumberRange: { StartingSequenceNumber: "start-1" },
        },
        {
          // Set ShardId to undefined instead of null to satisfy TypeScript
          // Runtime behavior will be the same - both will trigger the || "" short-circuit
          ShardId: undefined,
          HashKeyRange: { StartingHashKey: "101", EndingHashKey: "200" },
          SequenceNumberRange: { StartingSequenceNumber: "start-2" },
        },
        {
          ShardId: "shardId-000000000003",
          HashKeyRange: { StartingHashKey: "201", EndingHashKey: "300" },
          SequenceNumberRange: { StartingSequenceNumber: "start-3" },
        },
        {
          // No ShardId at all - also triggers the short-circuit
          HashKeyRange: { StartingHashKey: "301", EndingHashKey: "400" },
          SequenceNumberRange: { StartingSequenceNumber: "start-4" },
        },
      ];
      kinesisMock.on(ListShardsCommand).resolves({ Shards: mockShards });

      const result = await client.listShards();

      // The second and fourth elements should be empty strings due to the || "" short-circuit
      expect(result).toEqual([TEST_FIXTURES.SHARD_ID, "", "shardId-000000000003", ""]);
      expect(kinesisMock).toHaveReceivedCommandWith(ListShardsCommand, {
        StreamName: TEST_FIXTURES.STREAM_NAME,
      });
    });

    it("should return empty array when no shards found", async () => {
      kinesisMock.on(ListShardsCommand).resolves({ Shards: [] });

      const result = await client.listShards();

      expect(result).toEqual([]);
    });

    it("should handle undefined Shards in response", async () => {
      kinesisMock.on(ListShardsCommand).resolves({});

      const result = await client.listShards();

      expect(result).toEqual([]);
    });

    it("should throw structured error when client is not initialized", async () => {
      const uninitializedClient = new KinesisClient(
        TEST_FIXTURES.CLIENT_ID,
        TEST_FIXTURES.CONFIG_BASIC,
      );

      await expect(uninitializedClient.listShards()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });

    it("should handle AWS API errors with structured error", async () => {
      kinesisMock.on(ListShardsCommand).rejects(new Error(TEST_FIXTURES.ERROR_RESOURCE_NOT_FOUND));

      await expect(client.listShards()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "kinesis",
      );
    });
  });

  /**
   * This tests a private method via type assertions, but we need this for coverage
   */
  describe("internal record formatting", () => {
    beforeEach(async () => {
      await client.init();
    });

    // Define interfaces to match the expected input/output types of the private formatRecords method
    interface KinesisAwsRecord {
      Data?: Uint8Array;
      PartitionKey?: string;
      SequenceNumber?: string;
      ApproximateArrivalTimestamp?: Date;
    }

    interface KinesisFormattedRecord {
      data: string;
      partitionKey: string;
      sequenceNumber: string;
      approximateArrivalTimestamp?: Date;
    }

    /**
     * Helper function to access private formatRecords method safely with proper type annotation
     *
     * @param client - KinesisClient instance
     * @param records - Array of KinesisAwsRecord
     * @return Array of KinesisFormattedRecord
     */
    function callFormatRecords(
      client: KinesisClient,
      records: KinesisAwsRecord[],
    ): KinesisFormattedRecord[] {
      // We need to access a private method, but we use a specific type assertion to maintain type safety
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (client as any).formatRecords(records);
    }

    it("should format AWS records correctly", () => {
      const timestamp = new Date(TEST_FIXTURES.TIMESTAMP);
      const awsRecords = [
        {
          Data: new Uint8Array(Buffer.from("record 1")),
          PartitionKey: `${TEST_FIXTURES.PARTITION_KEY}-1`,
          SequenceNumber: "seq-1",
          ApproximateArrivalTimestamp: timestamp,
        },
        {
          Data: new Uint8Array(Buffer.from("record 2")),
          PartitionKey: `${TEST_FIXTURES.PARTITION_KEY}-2`,
          SequenceNumber: "seq-2",
          // Missing ApproximateArrivalTimestamp
        },
      ];

      const result = callFormatRecords(client, awsRecords);

      expect(result).toEqual([
        {
          data: "record 1",
          partitionKey: `${TEST_FIXTURES.PARTITION_KEY}-1`,
          sequenceNumber: "seq-1",
          approximateArrivalTimestamp: timestamp,
        },
        {
          data: "record 2",
          partitionKey: `${TEST_FIXTURES.PARTITION_KEY}-2`,
          sequenceNumber: "seq-2",
          approximateArrivalTimestamp: undefined,
        },
      ]);
    });

    it("should handle empty records array", () => {
      const result = callFormatRecords(client, []);
      expect(result).toEqual([]);
    });

    it("should handle records with missing Data", () => {
      // Using KinesisAwsRecord[] interface for type safety
      const awsRecords: KinesisAwsRecord[] = [
        {
          // First record has Data
          Data: new Uint8Array(Buffer.from("record with data")),
          PartitionKey: `${TEST_FIXTURES.PARTITION_KEY}-1`,
          SequenceNumber: "seq-1",
        },
        {
          // Second record has undefined Data (for TypeScript compatibility)
          Data: undefined,
          PartitionKey: `${TEST_FIXTURES.PARTITION_KEY}-2`,
          SequenceNumber: "seq-2",
        },
        {
          // Third record is missing Data completely
          PartitionKey: `${TEST_FIXTURES.PARTITION_KEY}-3`,
          SequenceNumber: "seq-3",
        },
      ];

      const result = callFormatRecords(client, awsRecords);

      expect(result).toEqual([
        {
          data: "record with data",
          partitionKey: `${TEST_FIXTURES.PARTITION_KEY}-1`,
          sequenceNumber: "seq-1",
          approximateArrivalTimestamp: undefined,
        },
        {
          // When Data is undefined, the ternary should return empty string
          data: "",
          partitionKey: `${TEST_FIXTURES.PARTITION_KEY}-2`,
          sequenceNumber: "seq-2",
          approximateArrivalTimestamp: undefined,
        },
        {
          // When Data is missing completely, the ternary should return empty string
          data: "",
          partitionKey: `${TEST_FIXTURES.PARTITION_KEY}-3`,
          sequenceNumber: "seq-3",
          approximateArrivalTimestamp: undefined,
        },
      ]);
    });

    it("should handle records with missing required fields", () => {
      const awsRecords: KinesisAwsRecord[] = [
        { Data: new Uint8Array(Buffer.from("incomplete record")) }, // Missing PartitionKey and SequenceNumber
      ];

      const result = callFormatRecords(client, awsRecords);

      expect(result).toEqual([
        {
          data: "incomplete record",
          partitionKey: "",
          sequenceNumber: "",
          approximateArrivalTimestamp: undefined,
        },
      ]);
    });
  });

  /**
   * Tests for waiting and processing records
   */
  describe("waitForRecords", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should throw error when partition key is missing or empty", async () => {
      // Test with empty string partition key
      await expect(client.waitForRecords("")).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_WAIT_PARTITION_KEY,
      );

      // Test with empty string partition key using a function approach for clarity
      const testWithEmptyPartitionKey = () => client.waitForRecords("");
      await expect(testWithEmptyPartitionKey()).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_WAIT_PARTITION_KEY,
      );
    });

    it("should return empty array when no shards are available", async () => {
      // Mock listShards to return empty array (no shards)
      kinesisMock.on(ListShardsCommand).resolves({ Shards: [] });

      // Call waitForRecords with a valid partition key
      const result = await client.waitForRecords(TEST_FIXTURES.PARTITION_KEY);

      // Verify that an empty array is returned when no shards are found
      expect(result).toEqual([]);

      // Verify that the ListShardsCommand was called
      expect(kinesisMock).toHaveReceivedCommandWith(ListShardsCommand, {
        StreamName: TEST_FIXTURES.STREAM_NAME,
      });

      // Verify that GetShardIteratorCommand was NOT called (execution should not reach this point)
      expect(kinesisMock).not.toHaveReceivedCommand(GetShardIteratorCommand);
    });

    it("should find records with matching partition key", async () => {
      const partitionKey = "target-partition";
      const mockShards = [
        {
          ShardId: TEST_FIXTURES.SHARD_ID,
          HashKeyRange: { StartingHashKey: "0", EndingHashKey: "100" },
          SequenceNumberRange: { StartingSequenceNumber: "start-1" },
        },
      ];
      const mockRecords = [
        {
          Data: new Uint8Array(Buffer.from("matching record")),
          PartitionKey: partitionKey,
          SequenceNumber: "seq-1",
        },
      ];
      kinesisMock.on(ListShardsCommand).resolves({ Shards: mockShards });
      kinesisMock
        .on(GetShardIteratorCommand)
        .resolves({ ShardIterator: TEST_FIXTURES.SHARD_ITERATOR });
      kinesisMock.on(GetRecordsCommand).resolves({ Records: mockRecords });

      const result = await client.waitForRecords(partitionKey, 5000);

      expect(result).toEqual([
        {
          data: "matching record",
          partitionKey: partitionKey,
          sequenceNumber: "seq-1",
          approximateArrivalTimestamp: undefined,
        },
      ]);
    });

    it("should timeout when no matching records found", async () => {
      const partitionKey = "non-existent-partition";
      const mockShards = [
        {
          ShardId: TEST_FIXTURES.SHARD_ID,
          HashKeyRange: { StartingHashKey: "0", EndingHashKey: "100" },
          SequenceNumberRange: { StartingSequenceNumber: "start-1" },
        },
      ];

      kinesisMock.on(ListShardsCommand).resolves({ Shards: mockShards });
      kinesisMock
        .on(GetShardIteratorCommand)
        .resolves({ ShardIterator: TEST_FIXTURES.SHARD_ITERATOR });
      kinesisMock.on(GetRecordsCommand).resolves({ Records: [] });

      const result = await client.waitForRecords(partitionKey, 100);

      expect(result).toEqual([]);
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new KinesisClient(
        TEST_FIXTURES.CLIENT_ID,
        TEST_FIXTURES.CONFIG_BASIC,
      );

      await expect(uninitializedClient.waitForRecords(TEST_FIXTURES.PARTITION_KEY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.CLIENT_ID),
      );
    });
  });

  /**
   * Tests for lifecycle management
   */
  describe("lifecycle management", () => {
    it("should cleanup successfully", async () => {
      await client.init();
      await expect(client.destroy()).resolves.not.toThrow();
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle cleanup when client is not initialized", async () => {
      await expect(client.destroy()).resolves.not.toThrow();
    });

    it("should handle multiple cleanup calls", async () => {
      await client.init();
      await client.destroy();
      await expect(client.destroy()).resolves.not.toThrow();
    });
  });
});
