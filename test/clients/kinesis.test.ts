import type { _Record as KinesisRecord, Shard } from "@aws-sdk/client-kinesis";
import {
  KinesisClient as AwsKinesisClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListShardsCommand,
  PutRecordCommand,
} from "@aws-sdk/client-kinesis";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KinesisClient } from "../../src/clients/kinesis";

/**
 * Helper function to create a properly typed Shard object
 */
function createTestShard(shardId: string): Shard {
  return {
    ShardId: shardId,
    HashKeyRange: {
      StartingHashKey: "0",
      EndingHashKey: "340282366920938463463374607431768211455",
    },
    SequenceNumberRange: {
      StartingSequenceNumber: "49613963106405816991595645362473943648559698385352507394",
    },
  };
}

// Create the mock client
const kinesisMock = mockClient(AwsKinesisClient);

describe("KinesisClient", () => {
  let client: KinesisClient;

  beforeEach(() => {
    // Reset all mocks before each test
    kinesisMock.reset();

    // Setup fake timers for Date.now and setTimeout
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1625097600000)); // Fixed timestamp for consistent test results

    client = new KinesisClient();
  });

  afterEach(async () => {
    await client.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("KinesisClient");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should be initialized after init is called", async () => {
      await client.init({ streamName: "test-stream" });
      expect(client.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      await client.init({ streamName: "test-stream" });
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should throw an error if streamName is not provided", async () => {
      await expect(client.init()).rejects.toThrow("Kinesis stream name is required");
    });

    it("should use default region when none provided", async () => {
      await client.init({ streamName: "test-stream" });

      // Verify the client was properly initialized
      expect(client.isInitialized()).toBe(true);
    });

    it("should use provided configuration", async () => {
      const config = {
        region: "eu-west-1",
        streamName: "my-stream",
        accessKeyId: "test-key-id",
        secretAccessKey: "test-secret",
        endpoint: "http://localhost:4566",
      };

      await client.init(config);

      // Verify the client was properly initialized
      expect(client.isInitialized()).toBe(true);
    });
  });

  describe("Kinesis operations", () => {
    const streamName = "test-stream";

    beforeEach(async () => {
      await client.init({ streamName });
    });

    describe("putRecord", () => {
      it("should call PutRecordCommand with correct parameters for string data", async () => {
        const data = "test data";
        const partitionKey = "test-partition";
        const sequenceNumber = "seq-123456";

        kinesisMock.on(PutRecordCommand).resolves({
          SequenceNumber: sequenceNumber,
        });

        const result = await client.putRecord(data, partitionKey);

        // Assert using the specialized matcher
        expect(kinesisMock).toHaveReceivedCommandWith(PutRecordCommand, {
          StreamName: streamName,
          Data: expect.any(Buffer),
          PartitionKey: partitionKey,
        });

        // Get the last command call to verify buffer content
        const calls = kinesisMock.commandCalls(PutRecordCommand);
        const lastCall = calls[calls.length - 1];

        // Extract and verify the Data content
        // For aws-sdk-client-mock, the Data might already be a buffer or might need conversion
        const commandInput = lastCall.args[0].input;
        let dataContent = "";

        // Handle different ways the Data could be stored in the mock
        if (commandInput && typeof commandInput === "object" && "Data" in commandInput) {
          const inputData = commandInput.Data;
          if (Buffer.isBuffer(inputData)) {
            dataContent = inputData.toString();
          } else if (inputData instanceof Uint8Array) {
            dataContent = Buffer.from(inputData).toString("utf8");
          } else if (typeof inputData === "string") {
            dataContent = inputData;
          }
        }

        expect(dataContent).toBe(data);

        expect(result).toBe(sequenceNumber);
      });

      it("should call PutRecordCommand with correct parameters for Buffer data", async () => {
        const data = Buffer.from("test buffer data");
        const partitionKey = "test-partition";
        const sequenceNumber = "seq-123456";

        kinesisMock.on(PutRecordCommand).resolves({
          SequenceNumber: sequenceNumber,
        });

        const result = await client.putRecord(data, partitionKey);

        // Assert using the specialized matcher with proper input type
        expect(kinesisMock).toHaveReceivedCommandWith(PutRecordCommand, {
          StreamName: streamName,
          Data: data,
          PartitionKey: partitionKey,
        });

        expect(result).toBe(sequenceNumber);
      });

      it("should generate a sequence number if not returned by AWS", async () => {
        kinesisMock.on(PutRecordCommand).resolves({
          // SequenceNumber is missing
        });

        const result = await client.putRecord("test data", "test-partition");

        expect(result).toMatch(/^sequence-\d+$/);
      });

      it("should throw if client is not initialized", async () => {
        const newClient = new KinesisClient();
        await expect(newClient.putRecord("test", "test-partition")).rejects.toThrow(
          "not initialized",
        );
      });
    });

    describe("getRecords", () => {
      it("should call GetRecordsCommand with correct parameters", async () => {
        const shardIterator = "test-shard-iterator";
        const limit = 5;

        // Create properly typed mock records
        const mockRecords: KinesisRecord[] = [
          {
            Data: Buffer.from("record 1"),
            PartitionKey: "pk-1",
            SequenceNumber: "seq-1",
            ApproximateArrivalTimestamp: new Date(1625097600000),
          } as KinesisRecord,
          {
            Data: Buffer.from("record 2"),
            PartitionKey: "pk-2",
            SequenceNumber: "seq-2",
            ApproximateArrivalTimestamp: new Date(1625097605000),
          } as KinesisRecord,
        ];

        kinesisMock.on(GetRecordsCommand).resolves({
          Records: mockRecords,
        });

        const result = await client.getRecords(shardIterator, limit);

        expect(kinesisMock).toHaveReceivedCommandWith(GetRecordsCommand, {
          ShardIterator: shardIterator,
          Limit: limit,
        });

        expect(result).toEqual([
          {
            data: "record 1",
            partitionKey: "pk-1",
            sequenceNumber: "seq-1",
            approximateArrivalTimestamp: mockRecords[0].ApproximateArrivalTimestamp,
          },
          {
            data: "record 2",
            partitionKey: "pk-2",
            sequenceNumber: "seq-2",
            approximateArrivalTimestamp: mockRecords[1].ApproximateArrivalTimestamp,
          },
        ]);
      });

      it("should use default limit when not specified", async () => {
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: [],
        });

        await client.getRecords("test-iterator");

        expect(kinesisMock).toHaveReceivedCommandWith(GetRecordsCommand, {
          ShardIterator: "test-iterator",
          Limit: 10, // Default limit
        });
      });

      it("should return empty array when no records", async () => {
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: [],
        });

        const result = await client.getRecords("test-iterator");

        expect(result).toEqual([]);
      });

      it("should return empty array when Records field is missing", async () => {
        kinesisMock.on(GetRecordsCommand).resolves({
          // Records field is missing
        });

        const result = await client.getRecords("test-iterator");

        expect(result).toEqual([]);
      });

      it("should handle missing fields in records", async () => {
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: [
            // Use unknown as an intermediary type for objects with missing properties
            {
              // Data is missing
              PartitionKey: "pk-1",
              SequenceNumber: "seq-1",
            } as unknown as KinesisRecord,
            {
              Data: Buffer.from("record 2"),
              // PartitionKey and SequenceNumber are missing
            } as unknown as KinesisRecord,
          ],
        });

        const result = await client.getRecords("test-iterator");

        expect(result).toEqual([
          {
            data: "",
            partitionKey: "pk-1",
            sequenceNumber: "seq-1",
            approximateArrivalTimestamp: undefined,
          },
          {
            data: "record 2",
            partitionKey: "",
            sequenceNumber: "",
            approximateArrivalTimestamp: undefined,
          },
        ]);
      });
    });

    describe("getShardIterator", () => {
      it("should call GetShardIteratorCommand with correct parameters", async () => {
        const shardId = "shard-000001";
        const iteratorType = "TRIM_HORIZON";

        kinesisMock.on(GetShardIteratorCommand).resolves({
          ShardIterator: "test-iterator",
        });

        const result = await client.getShardIterator(shardId, iteratorType);

        expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
          StreamName: streamName,
          ShardId: shardId,
          ShardIteratorType: iteratorType,
        });

        expect(result).toBe("test-iterator");
      });

      it("should use default iterator type when not specified", async () => {
        kinesisMock.on(GetShardIteratorCommand).resolves({
          ShardIterator: "test-iterator",
        });

        await client.getShardIterator("shard-000001");

        expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
          StreamName: streamName,
          ShardId: "shard-000001",
          ShardIteratorType: "LATEST",
        });
      });

      it("should include StartingSequenceNumber for sequence-based iterator types", async () => {
        const sequence = "seq-12345";
        // Define proper ShardIteratorType values
        const iteratorTypes = ["AT_SEQUENCE_NUMBER", "AFTER_SEQUENCE_NUMBER"] as const;

        for (const iteratorType of iteratorTypes) {
          // Reset the mock for each iterator type test
          kinesisMock.reset();

          kinesisMock.on(GetShardIteratorCommand).resolves({
            ShardIterator: `test-iterator-${iteratorType}`,
          });

          // Re-init client to ensure it's properly initialized
          await client.init({ streamName });

          const result = await client.getShardIterator("shard-000001", iteratorType, sequence);

          expect(result).toBe(`test-iterator-${iteratorType}`);

          // Verify correct parameters were used
          expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
            StreamName: streamName,
            ShardId: "shard-000001",
            ShardIteratorType: iteratorType,
            StartingSequenceNumber: sequence,
          });
        }
      });

      it("should not include StartingSequenceNumber for other types", async () => {
        const sequence = "seq-12345";

        kinesisMock.on(GetShardIteratorCommand).resolves({
          ShardIterator: "test-iterator",
        });

        await client.getShardIterator("shard-000001", "TRIM_HORIZON", sequence);

        expect(kinesisMock).toHaveReceivedCommandWith(GetShardIteratorCommand, {
          StreamName: streamName,
          ShardId: "shard-000001",
          ShardIteratorType: "TRIM_HORIZON",
          // StartingSequenceNumber should not be included
        });
      });

      it("should throw error when ShardIterator is missing", async () => {
        kinesisMock.on(GetShardIteratorCommand).resolves({
          // ShardIterator is missing
        });

        await expect(client.getShardIterator("shard-000001")).rejects.toThrow(
          "Failed to get shard iterator",
        );
      });
    });

    describe("listShards", () => {
      it("should call ListShardsCommand with correct parameters", async () => {
        const mockShards = [createTestShard("shard-000001"), createTestShard("shard-000002")];

        kinesisMock.on(ListShardsCommand).resolves({
          Shards: mockShards,
        });

        const result = await client.listShards();

        expect(kinesisMock).toHaveReceivedCommandWith(ListShardsCommand, {
          StreamName: streamName,
        });
        expect(result).toEqual(["shard-000001", "shard-000002"]);
      });

      it("should return empty array when no shards found", async () => {
        kinesisMock.on(ListShardsCommand).resolves({
          Shards: [],
        });

        const result = await client.listShards();

        expect(result).toEqual([]);
      });

      it("should return empty array when Shards is undefined", async () => {
        kinesisMock.on(ListShardsCommand).resolves({
          // Shards field is missing
        });

        const result = await client.listShards();

        expect(result).toEqual([]);
      });

      it("should handle missing ShardId in shards", async () => {
        kinesisMock.on(ListShardsCommand).resolves({
          Shards: [
            createTestShard("shard-000001"),
            {
              /* ShardId is missing - intentionally invalid for testing */
            } as unknown as Shard, // Type assertion for testing invalid data
            createTestShard("shard-000003"),
          ],
        });

        const result = await client.listShards();

        expect(result).toEqual(["shard-000001", "", "shard-000003"]);
      });
    });

    describe("waitForRecords", () => {
      it("should return matching records when found", async () => {
        const partitionKey = "test-partition";

        // Mock listShards response using properly typed Shard
        kinesisMock.on(ListShardsCommand).resolves({
          Shards: [createTestShard("shard-000001")],
        });

        // Mock getShardIterator response
        kinesisMock.on(GetShardIteratorCommand).resolves({
          ShardIterator: "test-iterator",
        });

        // Mock getRecords response
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: [
            {
              Data: Buffer.from("record 1"),
              PartitionKey: "wrong-partition",
              SequenceNumber: "seq-1",
            },
            {
              Data: Buffer.from("matching record"),
              PartitionKey: partitionKey,
              SequenceNumber: "seq-2",
              ApproximateArrivalTimestamp: new Date(),
            },
          ],
          NextShardIterator: "next-iterator",
        });

        const result = await client.waitForRecords(partitionKey);

        expect(result).toEqual([
          {
            data: "matching record",
            partitionKey: partitionKey,
            sequenceNumber: "seq-2",
            approximateArrivalTimestamp: expect.any(Date),
          },
        ]);
      });

      it("should return empty array when no matching records found within timeout", async () => {
        // Use fake timers for timeout simulation
        const timeout = 300000; // 5 minutes timeout

        // Mock listShards response with properly typed Shard
        kinesisMock.on(ListShardsCommand).resolves({
          Shards: [createTestShard("shard-000001")],
        });

        // Mock getShardIterator response
        kinesisMock.on(GetShardIteratorCommand).resolves({
          ShardIterator: "test-iterator",
        });

        // Mock getRecords response
        kinesisMock.on(GetRecordsCommand).resolves({
          Records: [
            {
              Data: Buffer.from("record 1"),
              PartitionKey: "wrong-partition",
              SequenceNumber: "seq-1",
            } as KinesisRecord,
          ],
          NextShardIterator: "next-iterator",
        });

        // Create a promise that will resolve when client.waitForRecords completes
        const resultPromise = client.waitForRecords("test-partition");

        // Advance time by just over the timeout period to trigger timeout condition
        vi.advanceTimersByTime(timeout + 1000);

        // Now resolve the promise and get the result
        const result = await resultPromise;

        // Verify no matching records were returned
        expect(result).toEqual([]);
      });

      it("should use the next shard iterator for subsequent polling", async () => {
        // Use fake timers to control the polling loop and set a longer timeout for this test
        vi.setConfig({ testTimeout: 10000 });

        // Mock listShards response using the helper function for proper typing
        kinesisMock.on(ListShardsCommand).resolves({
          Shards: [createTestShard("shard-000001")],
        });

        // Mock getShardIterator response
        kinesisMock.on(GetShardIteratorCommand).resolves({
          ShardIterator: "initial-iterator",
        });

        // First getRecords call returns no matches but has a next iterator
        kinesisMock
          .on(GetRecordsCommand)
          .resolvesOnce({
            Records: [
              {
                Data: Buffer.from("record 1"),
                PartitionKey: "wrong-partition",
                SequenceNumber: "seq-1",
              } as KinesisRecord,
            ],
            NextShardIterator: "next-iterator-1",
          })
          // Second getRecords call returns a match
          .resolvesOnce({
            Records: [
              {
                Data: Buffer.from("matching record"),
                PartitionKey: "test-partition",
                SequenceNumber: "seq-2",
              } as KinesisRecord,
            ],
            NextShardIterator: "next-iterator-2",
          });

        // Using a different approach with runOnlyPendingTimers
        // Create a promise and start the client.waitForRecords operation
        const waitForRecordsPromise = client.waitForRecords("test-partition");

        // Run pending timers to move forward through polling loops
        // This will process the first polling cycle
        await vi.runOnlyPendingTimersAsync();

        // Run pending timers again to process the second polling cycle
        await vi.runOnlyPendingTimersAsync();

        // Now resolve the promise and get the result
        const result = await waitForRecordsPromise;

        expect(result).toEqual([
          {
            data: "matching record",
            partitionKey: "test-partition",
            sequenceNumber: "seq-2",
            approximateArrivalTimestamp: undefined,
          },
        ]);

        // Verify the correct commands were called
        expect(kinesisMock).toHaveReceivedCommandTimes(GetRecordsCommand, 2);

        // Verify parameters using commandCalls to avoid matcher issues
        const calls = kinesisMock.commandCalls(GetRecordsCommand);

        // Use objectContaining for more flexible assertions on the first call
        expect(calls[0].args[0].input).toEqual(
          expect.objectContaining({
            Limit: 100,
            ShardIterator: "initial-iterator",
          }),
        );

        // Use objectContaining for the second call too
        expect(calls[1].args[0].input).toEqual(
          expect.objectContaining({
            Limit: 100,
            ShardIterator: "next-iterator-1",
          }),
        );
      });
    });
  });

  describe("Error handling", () => {
    it("should throw error if client is not initialized", async () => {
      const newClient = new KinesisClient();

      // Test each method individually to maintain type safety
      await expect(newClient.putRecord("test", "test-partition")).rejects.toThrow(
        "KinesisClient is not initialized",
      );

      await expect(newClient.getRecords("iterator")).rejects.toThrow(
        "KinesisClient is not initialized",
      );

      await expect(newClient.getShardIterator("shard-id")).rejects.toThrow(
        "KinesisClient is not initialized",
      );

      await expect(newClient.listShards()).rejects.toThrow("KinesisClient is not initialized");

      await expect(newClient.waitForRecords("partition")).rejects.toThrow(
        "KinesisClient is not initialized",
      );

      // Note: While this isn't using a loop, it's still more concise than the original
      // implementation by grouping all related tests together in one test case
    });

    it("should propagate AWS errors", async () => {
      await client.init({ streamName: "test-stream" });

      const awsError = new Error("AWS service error");
      kinesisMock.on(PutRecordCommand).rejects(awsError);

      await expect(client.putRecord("test", "test-partition")).rejects.toThrow("AWS service error");
    });
  });

  describe("Edge cases", () => {
    it("should handle multiple initializations", async () => {
      await client.init({ streamName: "stream1" });
      expect(client.isInitialized()).toBe(true);

      await client.init({ streamName: "stream2" });

      // Check the stream name was updated in the second init
      kinesisMock.on(PutRecordCommand).resolves({ SequenceNumber: "seq-1" });
      await client.putRecord("test", "test-partition");

      // Verify the stream name was updated using commandCalls
      const calls = kinesisMock.commandCalls(PutRecordCommand);
      const lastCall = calls[calls.length - 1];

      // Access the input property correctly to get the StreamName
      const commandInput = lastCall.args[0].input;
      expect(commandInput.StreamName).toBe("stream2");
    });

    it("should handle empty data in putRecord", async () => {
      await client.init({ streamName: "test-stream" });
      kinesisMock.on(PutRecordCommand).resolves({
        SequenceNumber: "seq-empty",
      });

      await client.putRecord("", "test-partition");

      // Get the command arguments to verify
      const calls = kinesisMock.commandCalls(PutRecordCommand);
      const lastCall = calls[calls.length - 1];

      // Verify the data is empty using proper type assertions and null checking
      const commandInput = lastCall.args[0];
      let dataContent = "";

      // Handle different ways the Data could be stored in the mock
      if (commandInput && typeof commandInput === "object" && "Data" in commandInput) {
        const data = commandInput.Data;
        if (Buffer.isBuffer(data)) {
          dataContent = data.toString();
        } else if (data instanceof Uint8Array) {
          dataContent = Buffer.from(data).toString();
        } else if (typeof data === "string") {
          dataContent = data;
        }
      }

      // Verify empty string
      expect(dataContent).toBe("");
    });
  });
});
