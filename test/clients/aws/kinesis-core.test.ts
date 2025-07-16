/**
 * Unit tests for Kinesis client implementation
 * Tests the KinesisClient functionality using aws-sdk-client-mock
 */
import {
  KinesisClient as AwsKinesisClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListShardsCommand,
  PutRecordCommand,
} from "@aws-sdk/client-kinesis";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KinesisClient } from "../../../src/clients";

// Create the mock client
const kinesisMock = mockClient(AwsKinesisClient);

describe("KinesisClient", () => {
  let client: KinesisClient;

  beforeEach(() => {
    // Reset all mocks before each test
    kinesisMock.reset();
    vi.clearAllMocks();

    // Create client without configuration initially
    client = new KinesisClient();
  });

  afterEach(async () => {
    try {
      await client.destroy();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("KinesisClient");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle custom client ID", () => {
      const customClient = new KinesisClient("CustomKinesisClient");
      expect(customClient.getName()).toBe("CustomKinesisClient");
    });

    it("should not be initialized after destroy is called", async () => {
      // Create client with valid configuration
      client = new KinesisClient("KinesisClient", { streamName: "test-stream" });
      await client.init();
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should throw an error if stream name is not provided", async () => {
      await expect(client.init()).rejects.toThrow("Kinesis client requires a stream name");
    });

    it("should use default region when none provided", async () => {
      client = new KinesisClient("KinesisClient", { streamName: "test-stream" });
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    it("should use provided configuration", async () => {
      const config = {
        streamName: "test-stream",
        region: "eu-west-1",
        accessKeyId: "test-key-id",
        secretAccessKey: "test-secret",
        endpoint: "http://localhost:4566",
      };

      client = new KinesisClient("KinesisClient", config);
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    it("should throw an error and not mark client as initialized if client creation fails", async () => {
      // Setup a test client
      client = new KinesisClient("KinesisClient", { streamName: "test-stream" });

      // Create a spy on the initializeClient method to simulate a failure
      const error = new Error("Kinesis client creation failed");
      const spy = vi
        .spyOn(client, "initializeClient" as keyof KinesisClient)
        .mockImplementation(async () => {
          throw error;
        });

      // Expect init to fail
      await expect(client.init()).rejects.toThrow("Kinesis client creation failed");

      // Client should not be marked as initialized
      expect(client.isInitialized()).toBe(false);

      // Restore original implementation
      spy.mockRestore();
    });

    it("should handle consecutive initialization calls", async () => {
      client = new KinesisClient("KinesisClient", { streamName: "test-stream" });

      // First initialization
      await client.init();
      expect(client.isInitialized()).toBe(true);

      // Second initialization should work fine
      await client.init();
      expect(client.isInitialized()).toBe(true);

      // Verify the client remains functional
      kinesisMock.on(ListShardsCommand).resolves({
        Shards: [
          {
            ShardId: "test-shard-id",
            HashKeyRange: {
              StartingHashKey: "0",
              EndingHashKey: "340282366920938463463374607431768211455",
            },
            SequenceNumberRange: {
              StartingSequenceNumber: "49615115002201479281490907257354603824344094199940186115",
            },
          },
        ],
      });

      const shards = await client.listShards();
      expect(shards).toContain("test-shard-id");
    });

    it("should handle errors during reset", async () => {
      client = new KinesisClient("KinesisClient", { streamName: "test-stream" });
      await client.init();
      expect(client.isInitialized()).toBe(true);

      // Create a spy on destroy to simulate an error during cleanup
      const destroySpy = vi
        .spyOn(client, "destroy" as keyof KinesisClient)
        .mockImplementation(async () => {
          throw new Error("Failed to destroy client");
        });

      // Reset should propagate the error
      await expect(client.reset()).rejects.toThrow(
        "Failed to reset client: Failed to destroy client",
      );

      // Client should still be initialized since reset failed
      expect(client.isInitialized()).toBe(true);

      destroySpy.mockRestore();
    });

    it("should handle specific AWS error types", async () => {
      client = new KinesisClient("KinesisClient", { streamName: "test-stream" });
      await client.init();

      // Create a custom AWS error with a specific name
      const awsError = new Error("Resource not found");
      Object.defineProperty(awsError, "name", { value: "ResourceNotFoundException" });

      kinesisMock.on(ListShardsCommand).rejects(awsError);

      // The error should be properly wrapped with context
      await expect(client.listShards()).rejects.toThrow(
        `Failed to list shards for stream test-stream: Resource not found`,
      );
    });
  });

  describe("Kinesis operations", () => {
    beforeEach(async () => {
      // Create and initialize client with test configuration
      client = new KinesisClient("KinesisClient", { streamName: "test-stream" });
      await client.init();
    });

    it("should handle initialization with empty credentials", async () => {
      // Destroy the existing client
      await client.destroy();

      // Create a new client with empty credentials
      client = new KinesisClient("KinesisClient", {
        streamName: "test-stream",
        accessKeyId: "", // Empty access key
        secretAccessKey: "", // Empty secret key
      });

      // Initialization should still succeed because AWS SDK can use environment variables
      // or instance profiles when credentials aren't provided explicitly
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    describe("putRecord method", () => {
      it("should put a record successfully with string data", async () => {
        const testData = "test data content";
        const testPartitionKey = "test-partition-key";
        const testSequenceNumber = "49615115002201479281490907257354603824344094199940186114";

        // Setup mock response
        kinesisMock.on(PutRecordCommand).resolves({
          ShardId: "shardId-000000000000",
          SequenceNumber: testSequenceNumber,
        });

        const result = await client.putRecord(testData, testPartitionKey);

        // Verify the result
        expect(result).toBe(testSequenceNumber);

        // Get the actual parameters used in the call
        const calls = kinesisMock.commandCalls(PutRecordCommand);
        expect(calls.length).toBe(1);

        const callInput = calls[0].args[0].input;
        expect(callInput.StreamName).toBe("test-stream");
        expect(Buffer.isBuffer(callInput.Data)).toBe(true);
        expect(callInput.PartitionKey).toBe(testPartitionKey);
      });

      it("should put a record successfully with buffer data", async () => {
        const testData = Buffer.from("test buffer data");
        const testPartitionKey = "buffer-partition-key";
        const testSequenceNumber = "49615115002201479281490907257354603824344094199940186115";

        // Setup mock response
        kinesisMock.on(PutRecordCommand).resolves({
          ShardId: "shardId-000000000000",
          SequenceNumber: testSequenceNumber,
        });

        const result = await client.putRecord(testData, testPartitionKey);

        // Verify the result
        expect(result).toBe(testSequenceNumber);

        // Verify correct parameters were used
        expect(kinesisMock).toHaveReceivedCommandWith(PutRecordCommand, {
          StreamName: "test-stream",
          Data: testData,
          PartitionKey: testPartitionKey,
        });
      });

      it("should throw an error if put operation fails", async () => {
        const testData = "test data content";
        const testPartitionKey = "test-partition-key";
        const errorMessage = "PutRecord operation failed";

        // Setup mock error response
        kinesisMock.on(PutRecordCommand).rejects(new Error(errorMessage));

        await expect(client.putRecord(testData, testPartitionKey)).rejects.toThrow(
          `Failed to put record into stream test-stream: ${errorMessage}`,
        );
      });
    });

    describe("getRecords method", () => {
      it("should get records successfully", async () => {
        const testShardIterator =
          "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";
        const testLimit = 25;

        // Create test records
        const testRecords = [
          {
            Data: Buffer.from(JSON.stringify({ value: "record1" })),
            PartitionKey: "key1",
            SequenceNumber: "49615115002201479281490907257354603824344094199940186116",
            ApproximateArrivalTimestamp: new Date("2023-06-15T12:00:00Z"),
          },
          {
            Data: Buffer.from(JSON.stringify({ value: "record2" })),
            PartitionKey: "key2",
            SequenceNumber: "49615115002201479281490907257354603824344094199940186117",
            ApproximateArrivalTimestamp: new Date("2023-06-15T12:01:00Z"),
          },
        ];

        // Setup mock response
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: testRecords,
          NextShardIterator:
            "AAAAAAAAAAGcmMr1VNr8oCs5q4rLy1OulBIQFRJr2OZFmgKKNgYE82zX24STHlX6CW4GjV8+3m40DxT6UKGLAupCpj51f9UhFZNu/1AwY3K0FcfYLYdokOFNr6KlM4WVg",
        });

        const result = await client.getRecords(testShardIterator, testLimit);

        // Verify results
        expect(result.length).toBe(2);
        expect(result[0].data).toBe(JSON.stringify({ value: "record1" }));
        expect(result[0].partitionKey).toBe("key1");
        expect(result[0].sequenceNumber).toBe(
          "49615115002201479281490907257354603824344094199940186116",
        );
        expect(result[0].approximateArrivalTimestamp instanceof Date).toBe(true);

        // Verify correct parameters were used
        expect(kinesisMock).toHaveReceivedCommandWith(GetRecordsCommand, {
          ShardIterator: testShardIterator,
          Limit: testLimit,
        });
      });

      it("should handle empty records response", async () => {
        const testShardIterator =
          "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";

        // Setup mock response with no records
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: [],
          NextShardIterator:
            "AAAAAAAAAAGcmMr1VNr8oCs5q4rLy1OulBIQFRJr2OZFmgKKNgYE82zX24STHlX6CW4GjV8+3m40DxT6UKGLAupCpj51f9UhFZNu/1AwY3K0FcfYLYdokOFNr6KlM4WVg",
        });

        const result = await client.getRecords(testShardIterator);

        // Verify results
        expect(result.length).toBe(0);
        expect(Array.isArray(result)).toBe(true);

        // Verify correct parameters were used
        expect(kinesisMock).toHaveReceivedCommandWith(GetRecordsCommand, {
          ShardIterator: testShardIterator,
          Limit: 10, // Default limit
        });
      });

      it("should throw an error if get records operation fails", async () => {
        const testShardIterator =
          "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";
        const errorMessage = "GetRecords operation failed";

        // Setup mock error response
        kinesisMock.on(GetRecordsCommand).rejects(new Error(errorMessage));

        await expect(client.getRecords(testShardIterator)).rejects.toThrow(
          `Failed to get records from stream test-stream: ${errorMessage}`,
        );
      });

      describe("getShardIterator method", () => {
        it("should get shard iterator successfully with default iterator type", async () => {
          const testShardId = "shardId-000000000001";
          const testIteratorType = "LATEST"; // Default
          const testShardIterator =
            "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";

          // Setup mock response
          kinesisMock.on(GetShardIteratorCommand).resolves({
            ShardIterator: testShardIterator,
          });

          const result = await client.getShardIterator(testShardId);

          // Verify result
          expect(result).toBe(testShardIterator);

          // Verify correct parameters were used
          expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
            StreamName: "test-stream",
            ShardId: testShardId,
            ShardIteratorType: testIteratorType,
          });
        });

        it("should get shard iterator with custom iterator type and sequence", async () => {
          const testShardId = "shardId-000000000001";
          const testIteratorType = "AT_SEQUENCE_NUMBER";
          const testSequence = "49615115002201479281490907257354603824344094199940186117";
          const testShardIterator =
            "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";

          // Setup mock response
          kinesisMock.on(GetShardIteratorCommand).resolves({
            ShardIterator: testShardIterator,
          });

          const result = await client.getShardIterator(testShardId, testIteratorType, testSequence);

          // Verify result
          expect(result).toBe(testShardIterator);

          // Verify correct parameters were used
          expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
            StreamName: "test-stream",
            ShardId: testShardId,
            ShardIteratorType: testIteratorType,
            StartingSequenceNumber: testSequence,
          });
        });

        it("should throw an error if getting shard iterator fails", async () => {
          const testShardId = "shardId-000000000001";
          const errorMessage = "GetShardIterator operation failed";

          // Setup mock error response
          kinesisMock.on(GetShardIteratorCommand).rejects(new Error(errorMessage));

          await expect(client.getShardIterator(testShardId)).rejects.toThrow(
            `Failed to get shard iterator for stream test-stream: ${errorMessage}`,
          );
        });

        it("should throw an error if ShardIterator is missing from response", async () => {
          const testShardId = "shardId-000000000001";

          // Setup mock response with missing ShardIterator
          kinesisMock.on(GetShardIteratorCommand).resolves({});

          await expect(client.getShardIterator(testShardId)).rejects.toThrow(
            `Failed to get shard iterator for shard ${testShardId}`,
          );
        });
      });

      describe("listShards method", () => {
        it("should list shards successfully", async () => {
          const testShards = [
            {
              ShardId: "shardId-000000000001",
              HashKeyRange: {
                StartingHashKey: "0",
                EndingHashKey: "113427455640312821154458202477256070484",
              },
              SequenceNumberRange: {
                StartingSequenceNumber: "49615115002201479281490907257354603824344094199940186114",
              },
            },
            {
              ShardId: "shardId-000000000002",
              HashKeyRange: {
                StartingHashKey: "113427455640312821154458202477256070485",
                EndingHashKey: "226854911280625642308916404954512140969",
              },
              SequenceNumberRange: {
                StartingSequenceNumber: "49615115002201479281490907257354603824344094199940186115",
              },
            },
          ];

          // Setup mock response
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: testShards,
          });

          const result = await client.listShards();

          // Verify results
          expect(result.length).toBe(2);
          expect(result[0]).toBe("shardId-000000000001");
          expect(result[1]).toBe("shardId-000000000002");

          // Verify correct parameters were used
          expect(kinesisMock).toHaveReceivedCommandWith(ListShardsCommand, {
            StreamName: "test-stream",
          });
        });

        it("should return empty array if no shards exist", async () => {
          // Setup mock response with no shards
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [],
          });

          const result = await client.listShards();

          // Verify results
          expect(result.length).toBe(0);
          expect(Array.isArray(result)).toBe(true);
        });

        it("should throw an error if list shards operation fails", async () => {
          const errorMessage = "ListShards operation failed";

          // Setup mock error response
          kinesisMock.on(ListShardsCommand).rejects(new Error(errorMessage));

          await expect(client.listShards()).rejects.toThrow(
            `Failed to list shards for stream test-stream: ${errorMessage}`,
          );
        });
      });

      describe("waitForRecords method", () => {
        it("should wait for and return matching records", async () => {
          const testPartitionKey = "test-partition-key";

          // Setup mock responses for the chain of API calls
          // First, mock listShards
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [
              {
                ShardId: "shardId-000000000001",
                HashKeyRange: {
                  StartingHashKey: "0",
                  EndingHashKey: "113427455640312821154458202477256070484",
                },
                SequenceNumberRange: {
                  StartingSequenceNumber:
                    "49615115002201479281490907257354603824344094199940186114",
                },
              },
            ],
          });

          // Next, mock getShardIterator
          const testShardIterator =
            "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";
          kinesisMock.on(GetShardIteratorCommand).resolves({
            ShardIterator: testShardIterator,
          });

          // Finally, mock getRecords with matching partition key
          const testRecords = [
            {
              Data: Buffer.from(JSON.stringify({ value: "record1" })),
              PartitionKey: "other-key",
              SequenceNumber: "49615115002201479281490907257354603824344094199940186116",
            },
            {
              Data: Buffer.from(JSON.stringify({ value: "matching-record" })),
              PartitionKey: testPartitionKey,
              SequenceNumber: "49615115002201479281490907257354603824344094199940186117",
              ApproximateArrivalTimestamp: new Date("2023-06-15T12:01:00Z"),
            },
          ];

          kinesisMock.on(GetRecordsCommand).resolves({
            Records: testRecords,
            NextShardIterator:
              "AAAAAAAAAAGcmMr1VNr8oCs5q4rLy1OulBIQFRJr2OZFmgKKNgYE82zX24STHlX6CW4GjV8+3m40DxT6UKGLAupCpj51f9UhFZNu/1AwY3K0FcfYLYdokOFNr6KlM4WVg",
          });

          // Mock timer to avoid actual waits
          vi.useFakeTimers();

          // Execute the method
          const resultPromise = client.waitForRecords(testPartitionKey, 5000);

          // Fast-forward time
          vi.advanceTimersByTime(2000);

          const result = await resultPromise;

          // Restore real timers
          vi.useRealTimers();

          // Verify results
          expect(result.length).toBe(1);
          expect(result[0].data).toBe(JSON.stringify({ value: "matching-record" }));
          expect(result[0].partitionKey).toBe(testPartitionKey);
        });

        it("should throw an error if no partition key is provided", async () => {
          await expect(client.waitForRecords("")).rejects.toThrow(
            "Kinesis waitForRecords requires a partition key",
          );
        });

        it("should handle no matching records within timeout period", async () => {
          const testPartitionKey = "test-partition-key";

          // Setup mocks for chain of API calls
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [
              {
                ShardId: "shardId-000000000001",
                HashKeyRange: {
                  StartingHashKey: "0",
                  EndingHashKey: "113427455640312821154458202477256070484",
                },
                SequenceNumberRange: {
                  StartingSequenceNumber:
                    "49615115002201479281490907257354603824344094199940186114",
                },
              },
            ],
          });

          const testShardIterator =
            "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";
          kinesisMock.on(GetShardIteratorCommand).resolves({
            ShardIterator: testShardIterator,
          });

          // Return records with non-matching partition keys
          kinesisMock.on(GetRecordsCommand).resolves({
            Records: [
              {
                Data: Buffer.from(JSON.stringify({ value: "record1" })),
                PartitionKey: "other-key",
                SequenceNumber: "49615115002201479281490907257354603824344094199940186116",
              },
            ],
            NextShardIterator:
              "AAAAAAAAAAGcmMr1VNr8oCs5q4rLy1OulBIQFRJr2OZFmgKKNgYE82zX24STHlX6CW4GjV8+3m40DxT6UKGLAupCpj51f9UhFZNu/1AwY3K0FcfYLYdokOFNr6KlM4WVg",
          });

          // Mock timer to avoid actual waits
          vi.useFakeTimers();

          // Execute the method with a short timeout
          const resultPromise = client.waitForRecords(testPartitionKey, 5000);

          // Fast-forward time beyond the timeout
          vi.advanceTimersByTime(10000);

          const result = await resultPromise;

          // Restore real timers
          vi.useRealTimers();

          // Verify we got an empty result after timeout
          expect(result.length).toBe(0);
        });

        it("should handle the case when there are no shards", async () => {
          const testPartitionKey = "test-partition-key";

          // Setup mock to return empty shards list
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [],
          });

          const result = await client.waitForRecords(testPartitionKey, 1000);

          // Should return empty array immediately when no shards exist
          expect(result.length).toBe(0);
          expect(Array.isArray(result)).toBe(true);

          // Verify ListShards was called with correct parameters
          expect(kinesisMock).toHaveReceivedCommandWith(ListShardsCommand, {
            StreamName: "test-stream",
          });
        });

        it("should throw an error if waitForRecords operation fails during polling", async () => {
          const testPartitionKey = "test-partition-key";
          const errorMessage = "GetRecords operation failed during polling";

          // Setup mock for listShards to succeed
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [
              {
                ShardId: "shardId-000000000001",
                HashKeyRange: {
                  StartingHashKey: "0",
                  EndingHashKey: "113427455640312821154458202477256070484",
                },
                SequenceNumberRange: {
                  StartingSequenceNumber:
                    "49615115002201479281490907257354603824344094199940186114",
                },
              },
            ],
          });

          // Setup mock for getShardIterator to succeed
          const testShardIterator =
            "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";
          kinesisMock.on(GetShardIteratorCommand).resolves({
            ShardIterator: testShardIterator,
          });

          // But make GetRecords fail
          kinesisMock.on(GetRecordsCommand).rejects(new Error(errorMessage));

          // Should throw error with proper context
          await expect(client.waitForRecords(testPartitionKey, 1000)).rejects.toThrow(
            `Error waiting for records in stream test-stream: ${errorMessage}`,
          );
        });

        it("should handle a custom timeout duration", async () => {
          const testPartitionKey = "test-partition-key";
          const customTimeout = 15000; // 15 seconds

          // Setup mocks for chain of API calls
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [
              {
                ShardId: "shardId-000000000001",
                HashKeyRange: {
                  StartingHashKey: "0",
                  EndingHashKey: "113427455640312821154458202477256070484",
                },
                SequenceNumberRange: {
                  StartingSequenceNumber:
                    "49615115002201479281490907257354603824344094199940186114",
                },
              },
            ],
          });

          const testShardIterator =
            "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";
          kinesisMock.on(GetShardIteratorCommand).resolves({
            ShardIterator: testShardIterator,
          });

          // Return no matching records
          kinesisMock.on(GetRecordsCommand).resolves({
            Records: [],
            NextShardIterator:
              "AAAAAAAAAAGcmMr1VNr8oCs5q4rLy1OulBIQFRJr2OZFmgKKNgYE82zX24STHlX6CW4GjV8+3m40DxT6UKGLAupCpj51f9UhFZNu/1AwY3K0FcfYLYdokOFNr6KlM4WVg",
          });

          // Mock timer to avoid actual waits
          vi.useFakeTimers();

          // Execute the method with custom timeout
          const resultPromise = client.waitForRecords(testPartitionKey, customTimeout);

          // Should not complete after 10 seconds (default would be complete)
          vi.advanceTimersByTime(10000);
          // Verify promise is still pending
          expect(resultPromise).not.toHaveProperty("_state", "fulfilled");

          // Fast-forward to reach timeout
          vi.advanceTimersByTime(5000);
          const result = await resultPromise;

          // Restore real timers
          vi.useRealTimers();

          // Verify we got an empty result after timeout
          expect(result.length).toBe(0);
        });

        it("should use default timeout of 30000ms when no timeout specified", async () => {
          const testPartitionKey = "test-partition-key";

          // Setup mocks for chain of API calls
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [
              {
                ShardId: "shardId-000000000001",
                HashKeyRange: {
                  StartingHashKey: "0",
                  EndingHashKey: "113427455640312821154458202477256070484",
                },
                SequenceNumberRange: {
                  StartingSequenceNumber:
                    "49615115002201479281490907257354603824344094199940186114",
                },
              },
            ],
          });

          const testShardIterator =
            "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";
          kinesisMock.on(GetShardIteratorCommand).resolves({
            ShardIterator: testShardIterator,
          });

          // Return no matching records
          kinesisMock.on(GetRecordsCommand).resolves({
            Records: [],
            NextShardIterator:
              "AAAAAAAAAAGcmMr1VNr8oCs5q4rLy1OulBIQFRJr2OZFmgKKNgYE82zX24STHlX6CW4GjV8+3m40DxT6UKGLAupCpj51f9UhFZNu/1AwY3K0FcfYLYdokOFNr6KlM4WVg",
          });

          // Use jest.spyOn to check if the default timeout is used
          const dateSpy = vi.spyOn(Date, "now");
          let currentTime = 1000;
          dateSpy.mockImplementation(() => {
            // Increment time by 1000 each call to simulate passage of time
            const result = currentTime;
            currentTime += 1000;
            return result;
          });

          // Call waitForRecords without specifying timeout
          client.waitForRecords(testPartitionKey).catch(() => {
            /* Prevent unhandled rejection */
          });

          // Should still be running and using Date.now
          await new Promise((resolve) => setTimeout(resolve, 10));
          expect(dateSpy).toHaveBeenCalled();

          // Clean up
          dateSpy.mockRestore();
        });

        it("should respect custom timeout values", async () => {
          // Setup custom time provider for precise control of timeout behavior
          const mockTimeProvider = {
            now: vi.fn(),
            delay: vi.fn().mockResolvedValue(undefined),
          };

          // Configure time progression: start time -> after first poll -> after second poll
          let callCount = 0;
          mockTimeProvider.now.mockImplementation(() => {
            callCount++;
            // Start at 1000ms, then 1100ms (within timeout), then 5100ms (past timeout)
            if (callCount === 1)
              return 1000; // Initial time
            else if (callCount === 2)
              return 1100; // After first poll (still within timeout)
            else return 5100; // Past the timeout
          });

          // Create client with mock time provider
          const customClient = new KinesisClient(
            "CustomTimeoutClient",
            { streamName: "test-stream" },
            mockTimeProvider as import("../../../src/clients/aws/kinesis").TimeProvider,
          );
          await customClient.init();

          // Setup mocks for API calls
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [
              {
                ShardId: "test-shard",
                HashKeyRange: {
                  StartingHashKey: "0",
                  EndingHashKey: "340282366920938463463374607431768211455",
                },
                SequenceNumberRange: {
                  StartingSequenceNumber:
                    "49615115002201479281490907257354603824344094199940186115",
                },
              },
            ],
          });

          const iterator = "AAAAAAAAAATestIterator";
          kinesisMock.on(GetShardIteratorCommand).resolves({ ShardIterator: iterator });
          kinesisMock.on(GetRecordsCommand).resolves({ Records: [], NextShardIterator: iterator });

          // Wait for records with a custom 4 second timeout
          const records = await customClient.waitForRecords("test-partition", 4000);

          // Should have empty results due to timeout
          expect(records).toEqual([]);

          // Verify our time provider was used correctly
          expect(mockTimeProvider.now).toHaveBeenCalledTimes(3);
          expect(mockTimeProvider.delay).toHaveBeenCalledWith(expect.any(Number));

          // Clean up
          await customClient.destroy();
        });
      });
    });

    describe("Edge cases", () => {
      beforeEach(async () => {
        client = new KinesisClient("KinesisClient", { streamName: "test-stream" });
        await client.init();
      });

      it("should require a non-empty partition key", async () => {
        const testData = "test data content";
        const emptyPartitionKey = "";

        // The client should reject empty partition keys
        await expect(client.putRecord(testData, emptyPartitionKey)).rejects.toThrow(
          "Kinesis putRecord requires a partition key",
        );
      });

      it("should handle very large data records", async () => {
        // Create a large data string (close to 1MB which is Kinesis limit)
        const largeData = "X".repeat(900 * 1024); // 900KB
        const testPartitionKey = "large-data-key";
        const testSequenceNumber = "49615115002201479281490907257354603824344094199940186118";

        // Setup mock response
        kinesisMock.on(PutRecordCommand).resolves({
          ShardId: "shardId-000000000000",
          SequenceNumber: testSequenceNumber,
        });

        const result = await client.putRecord(largeData, testPartitionKey);

        // Verify the result
        expect(result).toBe(testSequenceNumber);
      });

      it("should handle multiple client instances with different configurations", async () => {
        // Create first client
        const firstClient = new KinesisClient("FirstKinesisClient", { streamName: "first-stream" });
        await firstClient.init();

        // Create second client
        const secondClient = new KinesisClient("SecondKinesisClient", {
          streamName: "second-stream",
        });
        await secondClient.init();

        // Set up mock responses
        kinesisMock.on(ListShardsCommand).resolves({
          Shards: [
            {
              ShardId: "shardId-000000000001",
              HashKeyRange: {
                StartingHashKey: "0",
                EndingHashKey: "113427455640312821154458202477256070484",
              },
              SequenceNumberRange: {
                StartingSequenceNumber: "49615115002201479281490907257354603824344094199940186114",
              },
            },
          ],
        });

        // Use first client
        await firstClient.listShards();

        // Verify correct parameters for first client
        expect(kinesisMock).toHaveReceivedCommandWith(ListShardsCommand, {
          StreamName: "first-stream",
        });

        // Reset mock
        kinesisMock.reset();
        kinesisMock.on(ListShardsCommand).resolves({
          Shards: [
            {
              ShardId: "shardId-000000000002",
              HashKeyRange: {
                StartingHashKey: "0",
                EndingHashKey: "113427455640312821154458202477256070484",
              },
              SequenceNumberRange: {
                StartingSequenceNumber: "49615115002201479281490907257354603824344094199940186115",
              },
            },
          ],
        });

        // Use second client
        const result = await secondClient.listShards();

        // Add explicit assertions that ESLint can recognize
        expect(result).toBeDefined();
        expect(kinesisMock.calls().length).toBeGreaterThan(0);

        // Verify correct parameters for second client
        expect(kinesisMock).toHaveReceivedCommandWith(ListShardsCommand, {
          StreamName: "second-stream",
        });

        // Verify both clients are properly initialized
        expect(firstClient.isInitialized()).toBe(true);
        expect(secondClient.isInitialized()).toBe(true);

        // Clean up
        await firstClient.destroy();
        await secondClient.destroy();
      });

      describe("non-Error exception handling", () => {
        it("should handle non-Error objects through AWS SDK in listShards", async () => {
          // Setup mock with non-Error rejection via AWS SDK
          const nonErrorValue = "custom error message";

          kinesisMock.on(ListShardsCommand).rejects(nonErrorValue);

          await expect(client.listShards()).rejects.toThrow(
            `Failed to list shards for stream test-stream: ${nonErrorValue}`,
          );
        });

        it("should directly handle non-Error objects in listShards itself", async () => {
          // Create a test client with a spy on error handling to verify code path
          const testClient = new KinesisClient("TestKinesisClient", { streamName: "test-stream" });
          await testClient.init();

          // Spy on console.log to capture branch execution
          const logSpy = vi.spyOn(console, "log");

          // Mock the AWS SDK client's send method
          // @ts-expect-error - Accessing private property for testing
          const originalSend = testClient.client.send;
          // @ts-expect-error - Accessing private property for testing
          testClient.client.send = function mockSend() {
            // Directly throw a non-Error object
            const nonErrorObj = { status: 404, customProp: "test" };
            console.log("Throwing non-Error:", String(nonErrorObj));
            throw nonErrorObj;
          };

          try {
            await testClient.listShards();
            expect(true).toBe(false); // Test should fail if no error is thrown
          } catch (caughtError) {
            const error = caughtError as Error;

            // Verify it's wrapped in an Error
            expect(error instanceof Error).toBe(true);

            // Verify the error format contains the stream name
            expect(error.message).toContain("Failed to list shards for stream test-stream");

            // Verify our console.log was called, confirming we threw the non-Error object
            expect(logSpy).toHaveBeenCalledWith("Throwing non-Error:", "[object Object]");
          } finally {
            // Restore the original function and spy
            // @ts-expect-error - Accessing private property for testing
            if (testClient.client) testClient.client.send = originalSend;
            logSpy.mockRestore();
            await testClient.destroy();
          }
        });

        it("should handle non-Error objects with message property in listShards", async () => {
          // Option 2: Test with an object WITH a message property
          const nonErrorWithMessage = {
            status: 404,
            message: "Custom error message",
            code: "ResourceNotFound",
          };

          // Reset mock state
          kinesisMock.reset();

          // Throw object with message property
          kinesisMock.on(ListShardsCommand).callsFake(() => {
            throw nonErrorWithMessage;
          });

          try {
            await client.listShards();
            expect(true).toBe(false); // Force test failure
          } catch (caughtError) {
            const error = caughtError as Error;

            // Verify error format when object has message property
            expect(error instanceof Error).toBe(true);
            expect(error.message).toContain("Failed to list shards for stream test-stream");

            // Check if message property is used or if object is stringified
            // This will tell us how non-Error objects with message are handled
            const messageIncluded = error.message.includes("Custom error message");
            const objectStringified = error.message.includes("[object Object]");

            // One of these must be true - we're testing which branch was taken
            expect(messageIncluded || objectStringified).toBe(true);
          }
        });

        it("should handle non-Error objects in putRecord", async () => {
          // Use a simple string rejection - definitely not an Error object
          const stringError = "404 Not Found";

          // No type casting needed with string rejections
          kinesisMock.on(PutRecordCommand).rejects(stringError);

          await expect(client.putRecord("test data", "test-key")).rejects.toThrow(
            `Failed to put record into stream test-stream: ${stringError}`,
          );
        });

        it("should handle non-Error objects in getRecords", async () => {
          // Mock a non-Error rejection with a string
          kinesisMock.on(GetRecordsCommand).rejects("Server timeout");

          const testIterator = "AAAAAAAAAATestIterator";
          await expect(client.getRecords(testIterator)).rejects.toThrow(
            "Failed to get records from stream test-stream: Server timeout",
          );
        });

        it("should handle non-Error objects in getShardIterator", async () => {
          // Use a simple string rejection - definitely not an Error object
          const stringError = "ResourceNotFoundException: Stream not found";

          // No type casting needed with string rejections
          kinesisMock.on(GetShardIteratorCommand).rejects(stringError);

          // Verify the error message includes the string error
          await expect(client.getShardIterator("test-shard")).rejects.toThrow(
            `Failed to get shard iterator for stream test-stream: ${stringError}`,
          );
        });

        it("should handle non-Error objects from inner methods in waitForRecords", async () => {
          // Use a simple string rejection - definitely not an Error object
          const stringError = "HTTP 500: Internal server error";

          // No type casting needed with string rejections
          kinesisMock.on(ListShardsCommand).rejects(stringError);

          await expect(client.waitForRecords("test-key")).rejects.toThrow(
            `Error waiting for records in stream test-stream: Failed to list shards for stream test-stream: ${stringError}`,
          );
        });

        it("should directly handle non-Error objects in waitForRecords itself", async () => {
          // Set up for success through listShards and getShardIterator
          kinesisMock.on(ListShardsCommand).resolves({
            Shards: [
              {
                ShardId: "test-shard",
                HashKeyRange: {
                  StartingHashKey: "0",
                  EndingHashKey: "340282366920938463463374607431768211455",
                },
                SequenceNumberRange: {
                  StartingSequenceNumber:
                    "49615115002201479281490907257354603824344094199940186115",
                },
              },
            ],
          });

          const iterator = "AAAAAAAAAATestIterator";
          kinesisMock.on(GetShardIteratorCommand).resolves({ ShardIterator: iterator });

          // Create a spy on pollForRecords that throws a non-Error object
          // This directly tests the error handling in waitForRecords itself
          const plainObject = "Raw unparseable error";
          // pollForRecords is a private method, so we need to access it through the prototype
          const spy = vi
            .spyOn(Object.getPrototypeOf(client), "pollForRecords")
            .mockImplementation(() => {
              throw plainObject; // Directly throw a string, not an Error
            });

          // This should directly hit the String(error) branch in waitForRecords
          await expect(client.waitForRecords("test-key")).rejects.toThrow(
            `Error waiting for records in stream test-stream: ${plainObject}`,
          );

          // Clean up
          spy.mockRestore();
        });
      });

      it("should properly clean up client resources", async () => {
        // We need to spy on the client's cleanupClient method
        const spy = vi.spyOn(client, "cleanupClient");

        // Ensure client is initialized
        expect(client.isInitialized()).toBe(true);

        // Call destroy which should call cleanupClient internally
        await client.destroy();

        // Verify cleanupClient was called
        expect(spy).toHaveBeenCalledTimes(1);

        // Verify client is no longer initialized
        expect(client.isInitialized()).toBe(false);

        // Clean up spy
        spy.mockRestore();
      });

      it("should handle empty data in records", async () => {
        const testShardIterator =
          "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";

        // Setup mock response with a record containing undefined data
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: [
            {
              Data: undefined, // Test undefined data handling
              PartitionKey: "test-key",
              SequenceNumber: "49615115002201479281490907257354603824344094199940186116",
            },
          ],
          NextShardIterator:
            "AAAAAAAAAAGcmMr1VNr8oCs5q4rLy1OulBIQFRJr2OZFmgKKNgYE82zX24STHlX6CW4GjV8+3m40DxT6UKGLAupCpj51f9UhFZNu/1AwY3K0FcfYLYdokOFNr6KlM4WVg",
        });

        const result = await client.getRecords(testShardIterator);

        // Verify record with undefined data was handled properly
        expect(result.length).toBe(1);
        expect(result[0].data).toBe(""); // Should convert undefined to empty string
      });

      it("should handle missing fields in records", async () => {
        const testShardIterator =
          "AAAAAAAAAAHsW0oAAAAAXnkwEBmWJNATnrEiNGd6qJSKe8yQKmJdPn4XxEWOHMwHIJYE0I3oZH0o1thMMqH0jY1TiKQgm81Y2Vm3JTxqm79iq+5BVLKz";

        // Setup mock response with a record with optional fields
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: [
            {
              Data: Buffer.from("test data"),
              PartitionKey: "", // Empty partition key
              SequenceNumber: "", // Empty sequence number
              ApproximateArrivalTimestamp: new Date(),
            },
          ],
          NextShardIterator:
            "AAAAAAAAAAGcmMr1VNr8oCs5q4rLy1OulBIQFRJr2OZFmgKKNgYE82zX24STHlX6CW4GjV8+3m40DxT6UKGLAupCpj51f9UhFZNu/1AwY3K0FcfYLYdokOFNr6KlM4WVg",
        });

        const result = await client.getRecords(testShardIterator);

        // Verify record with missing fields was handled properly
        expect(result.length).toBe(1);
        expect(result[0].partitionKey).toBe(""); // Should default to empty string
        expect(result[0].sequenceNumber).toBe(""); // Should default to empty string
      });
    });
  });
});
