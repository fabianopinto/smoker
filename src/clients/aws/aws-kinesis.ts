/**
 * Kinesis Client Module
 *
 * This module provides interfaces and implementations for AWS Kinesis service clients.
 * It defines the contract for Kinesis operations such as reading and writing records
 * to Kinesis streams. The implementation uses the AWS SDK to interact with Kinesis.
 *
 * The module includes functionality to interact with Amazon Kinesis streams,
 * supporting operations like reading records from streams, writing records to streams,
 * and managing stream shards.
 */

import {
  KinesisClient as AwsKinesisClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListShardsCommand,
  PutRecordCommand,
} from "@aws-sdk/client-kinesis";
import { ERR_VALIDATION, SmokerError } from "../../errors";
import { BaseServiceClient, type ServiceClient } from "../core";

/**
 * Interface for Kinesis records
 *
 * Represents a record retrieved from a Kinesis stream. Contains the data payload,
 * partition key, sequence number, and optional timestamp information.
 *
 * @property data - The record data as a string
 * @property partitionKey - The partition key used to determine the shard
 * @property sequenceNumber - The unique identifier for the record within the stream
 * @property approximateArrivalTimestamp - Optional timestamp when the record was inserted
 */
export interface KinesisRecord {
  data: string;
  partitionKey: string;
  sequenceNumber: string;
  approximateArrivalTimestamp?: Date;
}

/**
 * Interface for Kinesis service client
 *
 * Defines the contract for interacting with AWS Kinesis data streams, providing
 * methods to write records to streams, read records from streams, manage shard
 * iterators, and list available shards. Extends the base ServiceClient interface
 * to ensure consistent lifecycle management.
 *
 * This interface provides a comprehensive API for working with Kinesis streams,
 * including support for partition key-based routing, shard management, and utilities
 * for waiting for specific records to appear in the stream. Implementations handle
 * the details of AWS SDK interactions while providing a simplified and consistent API.
 *
 * @extends {ServiceClient}
 * @see {ServiceClient} The base service client interface
 */
export interface KinesisServiceClient extends ServiceClient {
  /**
   * Put a record into the Kinesis stream
   *
   * Writes a single record to the Kinesis stream with the specified data and
   * partition key. The partition key determines which shard the record is routed to.
   *
   * @param data - The data to write as string or Buffer
   * @param partitionKey - The partition key to determine the shard
   * @return Promise resolving to the sequence number of the record
   * @throws {SmokerError} if writing fails or the stream doesn't exist
   *
   * @example
   * // Write a JSON record to the stream
   * const data = JSON.stringify({ id: 123, event: "user_login" });
   * const sequenceNumber = await kinesisClient.putRecord(data, "user-123");
   * console.log(`Record written with sequence number: ${sequenceNumber}`);
   */
  putRecord(data: string | Buffer, partitionKey: string): Promise<string>;

  /**
   * Get records from the Kinesis stream
   *
   * Retrieves records from the Kinesis stream using the provided shard iterator.
   * The shard iterator points to a specific position in the shard from which to
   * start reading records.
   *
   * @param shardIterator - The shard iterator pointing to the position in the shard
   * @param limit - Maximum number of records to retrieve (default: 10)
   * @return Promise resolving to an array of Kinesis records
   * @throws {SmokerError} if reading fails or the shard iterator is invalid
   *
   * @example
   * // Get up to 20 records from a shard
   * const shardIterator = await kinesisClient.getShardIterator("my-stream", "shard-000001", "LATEST");
   * const records = await kinesisClient.getRecords(shardIterator, 20);
   *
   * // Process each record
   * records.forEach(record => {
   *   const data = JSON.parse(record.data);
   *   console.log(`Received record: ${JSON.stringify(data)}`);
   * });
   */
  getRecords(shardIterator: string, limit?: number): Promise<KinesisRecord[]>;

  /**
   * Get a shard iterator for the Kinesis stream
   *
   * @param shardId - The shard ID
   * @param iteratorType - The iterator type (default: LATEST)
   * @param sequence - Optional sequence number
   * @return Shard iterator
   * @throws {SmokerError} if iterator cannot be obtained
   */
  getShardIterator(shardId: string, iteratorType?: string, sequence?: string): Promise<string>;

  /**
   * List shards in the Kinesis stream
   *
   * @return Array of shard IDs
   * @throws {SmokerError} if listing fails
   */
  listShards(): Promise<string[]>;

  /**
   * Wait for records with a specific partition key
   *
   * @param partitionKey - The partition key to wait for
   * @param timeoutMs - Timeout in milliseconds (default: 30000)
   * @return Array of records that match the partition key
   * @throws {SmokerError} if waiting fails
   */
  waitForRecords(partitionKey: string, timeoutMs?: number): Promise<KinesisRecord[]>;
}

/**
 * Kinesis client implementation for AWS Kinesis stream operations
 *
 * This class provides methods to interact with AWS Kinesis data streams,
 * including reading and writing records, managing shards, and waiting for
 * specific records to appear. It implements the KinesisServiceClient interface
 * and extends BaseServiceClient for consistent lifecycle management.
 *
 * The client handles AWS SDK initialization, authentication, and provides a
 * simplified API for common Kinesis operations. It includes features like
 * formatting AWS SDK responses into application-friendly structures, and
 * waiting for records with configurable timeouts and retry mechanisms.
 *
 * @implements {KinesisServiceClient}
 * @extends {BaseServiceClient}
 */
export class KinesisClient extends BaseServiceClient implements KinesisServiceClient {
  private client: AwsKinesisClient | null = null;
  private streamName = "";

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
   */
  constructor(clientId = "KinesisClient", config?: Record<string, unknown>) {
    super(clientId, config);
  }

  /**
   * Initialize the client with AWS configuration
   *
   * @throws {SmokerError} if streamName is not provided or client creation fails
   */
  protected async initializeClient(): Promise<void> {
    try {
      const region = this.getConfig<string>("region", "us-east-1");
      this.streamName = this.getConfig<string>("streamName", "");

      if (!this.streamName) {
        throw new SmokerError("Kinesis client requires a stream name", {
          code: ERR_VALIDATION,
          domain: "aws",
          details: { component: "kinesis" },
          retryable: false,
        });
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
      throw new SmokerError(
        `Failed to initialize Kinesis client: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "kinesis",
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Put a record into the Kinesis stream
   *
   * @param data - The data to write as string or Buffer
   * @param partitionKey - The partition key
   * @return Sequence number of the record
   * @throws {SmokerError} if writing fails or client is not initialized
   */
  async putRecord(data: string | Buffer, partitionKey: string): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!data) {
      throw new SmokerError("Kinesis putRecord requires data content", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: { component: "kinesis", streamName: this.streamName },
        retryable: false,
      });
    }

    if (!partitionKey) {
      throw new SmokerError("Kinesis putRecord requires a partition key", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: { component: "kinesis", streamName: this.streamName },
        retryable: false,
      });
    }

    try {
      const command = new PutRecordCommand({
        StreamName: this.streamName,
        Data: data instanceof Buffer ? data : Buffer.from(data),
        PartitionKey: partitionKey,
      });

      const response = await this.client.send(command);

      return response.SequenceNumber || `sequence-${Date.now()}`;
    } catch (error) {
      throw new SmokerError(
        `Failed to put record into stream ${this.streamName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "kinesis",
            streamName: this.streamName,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Get records from the Kinesis stream
   *
   * @param shardIterator - The shard iterator
   * @param limit - Maximum number of records to retrieve (default: 10)
   * @return Array of records
   * @throws {SmokerError} if retrieval fails or client is not initialized
   */
  async getRecords(shardIterator: string, limit = 10): Promise<KinesisRecord[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!shardIterator) {
      throw new SmokerError("Kinesis getRecords requires a shard iterator", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: { component: "kinesis", streamName: this.streamName },
        retryable: false,
      });
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
      throw new SmokerError(
        `Failed to get records from stream ${this.streamName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "kinesis",
            streamName: this.streamName,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Get a shard iterator for the Kinesis stream
   *
   * @param shardId - The shard ID
   * @param iteratorType - The iterator type (default: LATEST)
   * @param sequence - Optional sequence number
   * @return Shard iterator
   * @throws {SmokerError} if iterator cannot be obtained or client is not initialized
   */
  async getShardIterator(
    shardId: string,
    iteratorType = "LATEST",
    sequence?: string,
  ): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!shardId) {
      throw new SmokerError("Kinesis getShardIterator requires a shard ID", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: { component: "kinesis", streamName: this.streamName },
        retryable: false,
      });
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

      const command = new GetShardIteratorCommand(
        sequence &&
        (iteratorType === "AFTER_SEQUENCE_NUMBER" || iteratorType === "AT_SEQUENCE_NUMBER")
          ? { ...baseInput, StartingSequenceNumber: sequence }
          : baseInput,
      );

      const response = await this.client.send(command);

      if (!response.ShardIterator) {
        throw new SmokerError("Failed to get Kinesis shard iterator", {
          code: ERR_VALIDATION,
          domain: "aws",
          details: { component: "kinesis", streamName: this.streamName, shardId },
          retryable: true,
        });
      }

      return response.ShardIterator;
    } catch (error) {
      throw new SmokerError(
        `Failed to get shard iterator for stream ${this.streamName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "kinesis",
            streamName: this.streamName,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * List shards in the Kinesis stream
   *
   * @return Array of shard IDs
   * @throws {SmokerError} if listing fails or client is not initialized
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
      throw new SmokerError(
        `Failed to list shards for stream ${this.streamName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "kinesis",
            streamName: this.streamName,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Format AWS Kinesis records into the application's record format
   *
   * @param awsRecords - Raw records from AWS Kinesis
   * @return Formatted records
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
   * @return Matching records or empty array if timeout reached
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
    while (getCurrentTime() < endTime) {
      const command = new GetRecordsCommand({
        ShardIterator: currentShardIterator,
        Limit: 100,
      });

      const response = await this.client.send(command);

      // Update the shard iterator for the next iteration
      currentShardIterator = response.NextShardIterator || currentShardIterator;

      if (response.Records && response.Records.length > 0) {
        // Format and filter the records
        const records = this.formatRecords(response.Records);
        const matchingRecords = records.filter((r) => r.partitionKey === partitionKey);

        if (matchingRecords.length > 0) {
          return matchingRecords;
        }
      }

      // Wait before polling again
      await delay(pollInterval);
    }

    // Timeout reached, return empty array
    return [];
  }

  async waitForRecords(partitionKey: string, timeoutMs = 30000): Promise<KinesisRecord[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!partitionKey) {
      throw new SmokerError("Kinesis waitForRecords requires a partition key", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: { component: "kinesis", streamName: this.streamName },
        retryable: false,
      });
    }

    try {
      const startTime = getCurrentTime();
      const endTime = startTime + timeoutMs;

      // Get the iterator for the first shard
      const shards = await this.listShards();
      if (shards.length === 0) {
        return [];
      }

      const shardIterator = await this.getShardIterator(shards[0], "LATEST");
      return await this.pollForRecords(shardIterator, partitionKey, endTime);
    } catch (error) {
      throw new SmokerError(
        `Error waiting for records in stream ${this.streamName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "kinesis",
            streamName: this.streamName,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
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

/**
 * Utility functions for Kinesis operations
 *
 * This section contains helper functions used by the Kinesis client implementation
 * for common operations like timing, delays, and asynchronous operations.
 * These functions are separated from the main client class for better organization
 * and potential reuse across other modules.
 */

/**
 * Get the current timestamp in milliseconds
 *
 * @return Current time in milliseconds since epoch
 */
function getCurrentTime(): number {
  return Date.now();
}

/**
 * Create a delay for the specified duration
 *
 * Creates a promise that resolves after the specified time,
 * useful for implementing polling mechanisms and rate limiting.
 *
 * @param ms - Milliseconds to delay
 * @return Promise that resolves after the specified delay
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
