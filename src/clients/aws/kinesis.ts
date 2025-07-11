/**
 * Kinesis client for AWS Kinesis stream operations
 *
 * Provides functionality to interact with Amazon Kinesis streams.
 * Supports reading and writing records to streams.
 */
import {
  KinesisClient as AwsKinesisClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListShardsCommand,
  PutRecordCommand,
} from "@aws-sdk/client-kinesis";
import { BaseServiceClient } from "../core/base-client";
import type { ServiceClient } from "../core/interfaces";

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
 * Interface for Kinesis client operations
 */
export interface KinesisServiceClient extends ServiceClient {
  /**
   * Put a record into the Kinesis stream
   *
   * @param data - The data to write as string or Buffer
   * @param partitionKey - The partition key
   * @returns Sequence number of the record
   * @throws Error if writing fails
   */
  putRecord(data: string | Buffer, partitionKey: string): Promise<string>;

  /**
   * Get records from the Kinesis stream
   *
   * @param shardIterator - The shard iterator
   * @param limit - Maximum number of records to retrieve (default: 10)
   * @returns Array of records
   * @throws Error if retrieval fails
   */
  getRecords(shardIterator: string, limit?: number): Promise<KinesisRecord[]>;

  /**
   * Get a shard iterator for the Kinesis stream
   *
   * @param shardId - The shard ID
   * @param iteratorType - The iterator type (default: LATEST)
   * @param sequence - Optional sequence number
   * @returns Shard iterator
   * @throws Error if iterator cannot be obtained
   */
  getShardIterator(shardId: string, iteratorType?: string, sequence?: string): Promise<string>;

  /**
   * List shards in the Kinesis stream
   *
   * @returns Array of shard IDs
   * @throws Error if listing fails
   */
  listShards(): Promise<string[]>;

  /**
   * Wait for records with a specific partition key
   *
   * @param partitionKey - The partition key to wait for
   * @param timeoutMs - Timeout in milliseconds (default: 30000)
   * @returns Array of records that match the partition key
   * @throws Error if waiting fails
   */
  waitForRecords(partitionKey: string, timeoutMs?: number): Promise<KinesisRecord[]>;
}

/**
 * Kinesis client implementation for AWS Kinesis stream operations
 */

/**
 * Time provider interface for better testability
 */
export interface TimeProvider {
  /**
   * Get the current timestamp in milliseconds
   */
  now(): number;

  /**
   * Create a delay for the specified duration
   * @param ms - Milliseconds to delay
   */
  delay(ms: number): Promise<void>;
}

/**
 * Default implementation of TimeProvider using standard Date and setTimeout
 */
export class DefaultTimeProvider implements TimeProvider {
  now(): number {
    return Date.now();
  }

  async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class KinesisClient extends BaseServiceClient implements KinesisServiceClient {
  private client: AwsKinesisClient | null = null;
  private streamName = "";
  private timeProvider: TimeProvider;

  /**
   * Create a new Kinesis client
   *
   * @param clientId - Client identifier (defaults to "KinesisClient")
   * @param config - Optional client configuration with properties:
   *   - streamName: (required) Name of the Kinesis stream
   *   - region: AWS region (default: "us-east-1")
   *   - accessKeyId: AWS access key ID
   *   - secretAccessKey: AWS secret access key
   *   - endpoint: Optional custom endpoint for local development
   * @param timeProvider - Optional time provider for testing
   */
  constructor(
    clientId = "KinesisClient",
    config?: Record<string, unknown>,
    timeProvider?: TimeProvider,
  ) {
    super(clientId, config);
    this.timeProvider = timeProvider || new DefaultTimeProvider();
  }

  /**
   * Initialize the client with AWS configuration
   *
   * @throws Error if streamName is not provided or client creation fails
   */
  protected async initializeClient(): Promise<void> {
    try {
      const region = this.getConfig<string>("region", "us-east-1");
      this.streamName = this.getConfig<string>("streamName", "");

      if (!this.streamName) {
        throw new Error("Kinesis client requires a stream name");
      }

      this.client = new AwsKinesisClient({
        region,
        credentials: {
          accessKeyId: this.getConfig<string>("accessKeyId", ""),
          secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
        },
        endpoint: this.getConfig<string>("endpoint", "") || undefined,
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize Kinesis client: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Put a record into the Kinesis stream
   *
   * @param data - The data to write as string or Buffer
   * @param partitionKey - The partition key
   * @returns Sequence number of the record
   * @throws Error if writing fails or client is not initialized
   */
  async putRecord(data: string | Buffer, partitionKey: string): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!data) {
      throw new Error("Kinesis putRecord requires data content");
    }

    if (!partitionKey) {
      throw new Error("Kinesis putRecord requires a partition key");
    }

    try {
      const input = {
        StreamName: this.streamName,
        Data: data instanceof Buffer ? data : Buffer.from(data),
        PartitionKey: partitionKey,
      };

      const command = new PutRecordCommand(input);
      const response = await this.client.send(command);

      return response.SequenceNumber || `sequence-${Date.now()}`;
    } catch (error) {
      throw new Error(
        `Failed to put record into stream ${this.streamName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get records from the Kinesis stream
   *
   * @param shardIterator - The shard iterator
   * @param limit - Maximum number of records to retrieve (default: 10)
   * @returns Array of records
   * @throws Error if retrieval fails or client is not initialized
   */
  async getRecords(shardIterator: string, limit = 10): Promise<KinesisRecord[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!shardIterator) {
      throw new Error("Kinesis getRecords requires a shard iterator");
    }

    try {
      const command = new GetRecordsCommand({
        ShardIterator: shardIterator,
        Limit: limit,
      });

      const response = await this.client.send(command);

      if (!response.Records || response.Records.length === 0) {
        return [];
      }

      // Format the records using the shared method
      return this.formatRecords(response.Records);
    } catch (error) {
      throw new Error(
        `Failed to get records from stream ${this.streamName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a shard iterator for the Kinesis stream
   *
   * @param shardId - The shard ID
   * @param iteratorType - The iterator type (default: LATEST)
   * @param sequence - Optional sequence number
   * @returns Shard iterator
   * @throws Error if iterator cannot be obtained or client is not initialized
   */
  async getShardIterator(
    shardId: string,
    iteratorType = "LATEST",
    sequence?: string,
  ): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!shardId) {
      throw new Error("Kinesis getShardIterator requires a shard ID");
    }

    try {
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
    } catch (error) {
      throw new Error(
        `Failed to get shard iterator for stream ${this.streamName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List shards in the Kinesis stream
   *
   * @returns Array of shard IDs
   * @throws Error if listing fails or client is not initialized
   */
  async listShards(): Promise<string[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    try {
      const command = new ListShardsCommand({
        StreamName: this.streamName,
      });

      const response = await this.client.send(command);

      if (!response.Shards || response.Shards.length === 0) {
        return [];
      }

      return response.Shards.map((shard) => shard.ShardId || "");
    } catch (error) {
      throw new Error(
        `Failed to list shards for stream ${this.streamName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Wait for records with a specific partition key
   *
   * @param partitionKey - The partition key to wait for
   * @param timeoutMs - Timeout in milliseconds (default: 30000)
   * @returns Array of records that match the partition key
   * @throws Error if waiting fails or client is not initialized
   */
  /**
   * Format AWS Kinesis records into the application's record format
   *
   * @param awsRecords - Raw records from AWS Kinesis
   * @returns Formatted records
   */
  private formatRecords(
    awsRecords: {
      Data?: Uint8Array;
      PartitionKey?: string;
      SequenceNumber?: string;
      ApproximateArrivalTimestamp?: Date;
    }[],
  ): KinesisRecord[] {
    return awsRecords.map((record) => ({
      data: record.Data ? Buffer.from(record.Data).toString("utf-8") : "",
      partitionKey: record.PartitionKey || "",
      sequenceNumber: record.SequenceNumber || "",
      approximateArrivalTimestamp: record.ApproximateArrivalTimestamp,
    }));
  }

  /**
   * Poll for records with a specific partition key
   *
   * @param shardIterator - Iterator for the shard to poll
   * @param partitionKey - Partition key to filter records by
   * @param endTime - Timestamp when polling should stop (milliseconds)
   * @param pollInterval - Time between polling attempts (milliseconds)
   * @returns Matching records or empty array if timeout reached
   */
  private async pollForRecords(
    shardIterator: string,
    partitionKey: string,
    endTime: number,
    pollInterval = 2000,
  ): Promise<KinesisRecord[]> {
    this.assertNotNull(this.client);
    let currentShardIterator = shardIterator;

    // Poll for records until timeout
    while (this.timeProvider.now() < endTime) {
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
        const records = this.formatRecords(getRecordsResponse.Records);
        const matchingRecords = records.filter((r) => r.partitionKey === partitionKey);

        if (matchingRecords.length > 0) {
          return matchingRecords;
        }
      }

      // Wait before polling again
      await this.timeProvider.delay(pollInterval);
    }

    // Timeout reached, return empty array
    return [];
  }

  async waitForRecords(partitionKey: string, timeoutMs = 30000): Promise<KinesisRecord[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!partitionKey) {
      throw new Error("Kinesis waitForRecords requires a partition key");
    }

    try {
      const startTime = this.timeProvider.now();
      const endTime = startTime + timeoutMs;

      // Get the iterator for the first shard
      const shards = await this.listShards();
      if (shards.length === 0) {
        return [];
      }

      const shardIterator = await this.getShardIterator(shards[0], "LATEST");
      return await this.pollForRecords(shardIterator, partitionKey, endTime);
    } catch (error) {
      throw new Error(
        `Error waiting for records in stream ${this.streamName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Client-specific cleanup logic
   * Releases AWS Kinesis client resources
   */
  async cleanupClient(): Promise<void> {
    // Kinesis client doesn't need explicit cleanup beyond nullifying the reference
    this.client = null;
  }
}
