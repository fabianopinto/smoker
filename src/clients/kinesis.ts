/**
 * Kinesis client for AWS Kinesis stream operations
 */
import {
  KinesisClient as AwsKinesisClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListShardsCommand,
  PutRecordCommand,
} from "@aws-sdk/client-kinesis";
import { BaseServiceClient } from "./clients";

/**
 * Interface for Kinesis client operations
 */
export interface KinesisServiceClient {
  putRecord(data: string | Buffer, partitionKey: string): Promise<string>;
  getRecords(shardIterator: string, limit?: number): Promise<KinesisRecord[]>;
  getShardIterator(shardId: string, iteratorType?: string, sequence?: string): Promise<string>;
  listShards(): Promise<string[]>;
  waitForRecords(partitionKey: string, timeoutMs?: number): Promise<KinesisRecord[]>;
}

/**
 * Interface for Kinesis records
 */
export interface KinesisRecord {
  data: string;
  partitionKey: string;
  sequenceNumber: string;
  approximateArrivalTimestamp?: Date;
}

/**
 * Kinesis client implementation for AWS Kinesis stream operations
 */
export class KinesisClient extends BaseServiceClient implements KinesisServiceClient {
  private client: AwsKinesisClient | null = null;
  private streamName = "";

  /**
   * Create a new Kinesis client
   */
  constructor() {
    super("KinesisClient");
  }

  /**
   * Initialize the client
   */
  protected async initializeClient(): Promise<void> {
    const region = this.getConfig<string>("region", "us-east-1");
    this.streamName = this.getConfig<string>("streamName", "");

    if (!this.streamName) {
      throw new Error("Kinesis stream name is required");
    }

    this.client = new AwsKinesisClient({
      region,
      credentials: {
        accessKeyId: this.getConfig<string>("accessKeyId", ""),
        secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
      },
      endpoint: this.getConfig<string>("endpoint", "") || undefined,
    });
  }

  /**
   * Put a record into the Kinesis stream
   * @param data The data to write as string or Buffer
   * @param partitionKey The partition key
   * @returns Sequence number of the record
   */
  async putRecord(data: string | Buffer, partitionKey: string): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const input = {
      StreamName: this.streamName,
      Data: data instanceof Buffer ? data : Buffer.from(data),
      PartitionKey: partitionKey,
    };

    const command = new PutRecordCommand(input);
    const response = await this.client.send(command);

    return response.SequenceNumber || `sequence-${Date.now()}`;
  }

  /**
   * Get records from the Kinesis stream
   * @param shardIterator The shard iterator
   * @param limit Maximum number of records to retrieve (default: 10)
   * @returns Array of records
   */
  async getRecords(shardIterator: string, limit = 10): Promise<KinesisRecord[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new GetRecordsCommand({
      ShardIterator: shardIterator,
      Limit: limit,
    });

    const response = await this.client.send(command);

    if (!response.Records || response.Records.length === 0) {
      return [];
    }

    return response.Records.map((record) => ({
      data: record.Data ? Buffer.from(record.Data).toString("utf-8") : "",
      partitionKey: record.PartitionKey || "",
      sequenceNumber: record.SequenceNumber || "",
      approximateArrivalTimestamp: record.ApproximateArrivalTimestamp,
    }));
  }

  /**
   * Get a shard iterator for the Kinesis stream
   * @param shardId The shard ID
   * @param iteratorType The iterator type (default: LATEST)
   * @param sequence Optional sequence number
   * @returns Shard iterator
   */
  async getShardIterator(
    shardId: string,
    iteratorType = "LATEST",
    sequence?: string,
  ): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // Create the input object with the required properties
    const baseInput = {
      StreamName: this.streamName,
      ShardId: shardId,
      ShardIteratorType: iteratorType as
        | "AT_SEQUENCE_NUMBER"
        | "AFTER_SEQUENCE_NUMBER"
        | "TRIM_HORIZON"
        | "LATEST"
        | "AT_TIMESTAMP",
    };

    // Add optional StartingSequenceNumber if needed
    const input =
      sequence &&
      (iteratorType === "AFTER_SEQUENCE_NUMBER" || iteratorType === "AT_SEQUENCE_NUMBER")
        ? { ...baseInput, StartingSequenceNumber: sequence }
        : baseInput;

    const command = new GetShardIteratorCommand(input);
    const response = await this.client.send(command);

    if (!response.ShardIterator) {
      throw new Error(`Failed to get shard iterator for shard ${shardId}`);
    }

    return response.ShardIterator;
  }

  /**
   * List shards in the Kinesis stream
   * @returns Array of shard IDs
   */
  async listShards(): Promise<string[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new ListShardsCommand({
      StreamName: this.streamName,
    });

    const response = await this.client.send(command);

    if (!response.Shards || response.Shards.length === 0) {
      return [];
    }

    return response.Shards.map((shard) => shard.ShardId || "");
  }

  /**
   * Wait for records with a specific partition key
   * @param partitionKey The partition key to wait for
   * @param timeoutMs Timeout in milliseconds (default: 30000)
   * @returns Array of records that match the partition key
   */
  async waitForRecords(partitionKey: string, timeoutMs = 30000): Promise<KinesisRecord[]> {
    this.ensureInitialized();

    const startTime = Date.now();
    const endTime = startTime + timeoutMs;

    // Get the iterator for the first shard
    const shards = await this.listShards();
    if (shards.length === 0) {
      return [];
    }

    const shardIterator = await this.getShardIterator(shards[0], "LATEST");
    let currentShardIterator = shardIterator;

    // Poll for records until timeout
    while (Date.now() < endTime) {
      this.assertNotNull(this.client);

      const getRecordsResponse = await this.client.send(
        new GetRecordsCommand({
          ShardIterator: currentShardIterator,
          Limit: 100,
        }),
      );

      // Update the shard iterator for the next iteration
      currentShardIterator = getRecordsResponse.NextShardIterator || currentShardIterator;

      if (getRecordsResponse.Records && getRecordsResponse.Records.length > 0) {
        // Format and filter the records
        const records = getRecordsResponse.Records.map((record) => ({
          data: record.Data ? Buffer.from(record.Data).toString("utf-8") : "",
          partitionKey: record.PartitionKey || "",
          sequenceNumber: record.SequenceNumber || "",
          approximateArrivalTimestamp: record.ApproximateArrivalTimestamp,
        }));

        const matchingRecords = records.filter((r) => r.partitionKey === partitionKey);
        if (matchingRecords.length > 0) {
          return matchingRecords;
        }
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return [];
  }
}
