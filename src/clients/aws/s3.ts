/**
 * S3 client for AWS S3 bucket operations
 *
 * Provides functionality to interact with Amazon S3 storage service,
 * including reading, writing, and deleting objects from S3 buckets.
 */
import {
  S3Client as AwsS3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { BaseServiceClient } from "../core/base-client";
import type { ServiceClient } from "../core/interfaces";

/**
 * Interface for S3 client operations
 *
 * Defines the contract for S3 clients with methods for basic object operations
 * such as reading, writing, and deleting objects in S3 buckets.
 */
export interface S3ServiceClient extends ServiceClient {
  /**
   * Read an object from S3
   *
   * @param key - The object key (path within the bucket)
   * @returns Promise resolving to the object content as a string
   * @throws Error if object does not exist or cannot be read
   */
  read(key: string): Promise<string>;

  /**
   * Read a JSON object from S3 and parse it
   *
   * @template T - The expected type of the parsed JSON
   * @param key - The object key (path within the bucket)
   * @returns Promise resolving to the parsed JSON object
   * @throws Error if object does not exist, cannot be read, or is invalid JSON
   */
  readJson<T>(key: string): Promise<T>;

  /**
   * Write a string object to S3
   *
   * @param key - The object key (path within the bucket)
   * @param content - The string content to write
   * @throws Error if writing fails
   */
  write(key: string, content: string): Promise<void>;

  /**
   * Convert data to JSON and write to S3
   *
   * @param key - The object key (path within the bucket)
   * @param data - The data object to serialize as JSON
   * @throws Error if serialization or writing fails
   */
  writeJson(key: string, data: unknown): Promise<void>;

  /**
   * Delete an object from S3
   *
   * @param key - The object key (path within the bucket)
   * @throws Error if deletion fails
   */
  delete(key: string): Promise<void>;
}

/**
 * S3 client implementation for AWS S3 bucket operations
 *
 * Implements the S3ServiceClient interface for interacting with Amazon S3.
 * Provides methods for reading, writing, and deleting objects in S3 buckets.
 */
export class S3Client extends BaseServiceClient implements S3ServiceClient {
  private client: AwsS3Client | null = null;
  private bucket = "";

  /**
   * Create a new S3 client
   *
   * @param clientId - Client identifier (defaults to "S3Client")
   * @param config - Optional client configuration with properties:
   *   - bucket: (required) The S3 bucket name to use
   *   - region: AWS region (default: "us-east-1")
   *   - accessKeyId: AWS access key ID
   *   - secretAccessKey: AWS secret access key
   *   - endpoint: Optional custom endpoint for local development
   */
  constructor(clientId = "S3Client", config?: Record<string, unknown>) {
    super(clientId, config);
  }

  /**
   * Initialize the S3 client with AWS configuration
   *
   * @throws Error if bucket name is not provided or client creation fails
   */
  protected async initializeClient(): Promise<void> {
    // Get configuration with defaults
    const region = this.getConfig<string>("region", "us-east-1");
    this.bucket = this.getConfig<string>("bucket", "");

    if (!this.bucket) {
      throw new Error("S3 client requires a 'bucket' name to be provided in configuration");
    }

    // Create AWS S3 client
    const awsClient = new AwsS3Client({
      region,
      credentials: {
        accessKeyId: this.getConfig<string>("accessKeyId", ""),
        secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
      },
      endpoint: this.getConfig<string>("endpoint", "") || undefined,
    });

    // Assign to this.client after creation to ensure undefined is properly detected
    this.client = awsClient;

    // Critical null check - must throw error if client is null
    if (!this.client) {
      throw new Error(`Failed to create S3 client for bucket ${this.bucket}`);
    }
  }

  /**
   * Read an object from S3
   *
   * @param key - The object key (path within the bucket)
   * @returns Promise resolving to the object content as a string
   * @throws Error if object does not exist or cannot be read
   */
  async read(key: string): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!key) {
      throw new Error("S3 read operation requires a key");
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error(`Object ${key} in bucket ${this.bucket} has no content`);
      }

      // Convert the readable stream to a string
      return await this.streamToString(response.Body as NodeJS.ReadableStream);
    } catch (error) {
      throw new Error(
        `Failed to read object ${key} from bucket ${this.bucket}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Convert a readable stream to string
   *
   * @param stream - The readable stream to convert
   * @returns Promise resolving to the stream content as string
   */
  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  /**
   * Read a JSON object from S3 and parse it
   *
   * @template T - The expected type of the parsed JSON
   * @param key - The object key (path within the bucket)
   * @returns Promise resolving to the parsed JSON object
   * @throws Error if object does not exist, cannot be read, or is invalid JSON
   */
  async readJson<T>(key: string): Promise<T> {
    try {
      const content = await this.read(key);
      return JSON.parse(content) as T;
    } catch (error) {
      // If it's already our custom error from read(), just propagate it
      if (error instanceof Error && error.message.startsWith(`Failed to read object`)) {
        throw error;
      }
      // Otherwise wrap JSON parsing errors with more context
      throw new Error(
        `Failed to parse JSON from ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Write a string object to S3
   *
   * @param key - The object key (path within the bucket)
   * @param content - The string content to write
   * @throws Error if writing fails or parameters are invalid
   */
  async write(key: string, content: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!key) {
      throw new Error("S3 write operation requires a key");
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: "text/plain",
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(
        `Failed to write object ${key} to bucket ${this.bucket}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Convert data to JSON and write to S3
   *
   * @param key - The object key (path within the bucket)
   * @param data - The data object to serialize as JSON
   * @throws Error if serialization or writing fails
   */
  async writeJson(key: string, data: unknown): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!key) {
      throw new Error("S3 writeJson operation requires a key");
    }

    try {
      // Convert data to JSON string
      const content = JSON.stringify(data);

      // Write the JSON data
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: "application/json",
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(
        `Failed to write JSON object ${key} to bucket ${this.bucket}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete an object from S3
   *
   * @param key - The object key (path within the bucket)
   * @throws Error if deletion fails or key is invalid
   */
  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!key) {
      throw new Error("S3 delete operation requires a key");
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(
        `Failed to delete object ${key} from bucket ${this.bucket}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Client-specific cleanup logic
   * Releases AWS S3 client resources
   */
  async cleanupClient(): Promise<void> {
    // S3 client doesn't need explicit cleanup beyond nullifying the reference
    this.client = null;
  }
}
