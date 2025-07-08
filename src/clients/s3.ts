/**
 * S3 client for AWS S3 bucket operations
 */
import {
  S3Client as AwsS3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { BaseServiceClient } from "./clients";

/**
 * Interface for S3 client operations
 */
export interface S3ServiceClient {
  read(key: string): Promise<string>;
  readJson<T>(key: string): Promise<T>;
  write(key: string, content: string): Promise<void>;
  writeJson(key: string, data: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * S3 client implementation for AWS S3 bucket operations
 */
export class S3Client extends BaseServiceClient implements S3ServiceClient {
  private client: AwsS3Client | null = null;
  private bucket = "";

  /**
   * Create a new S3 client
   */
  constructor() {
    super("S3Client");
  }

  /**
   * Initialize the S3 client with configuration
   */
  protected async initializeClient(): Promise<void> {
    const region = this.getConfig<string>("region", "us-east-1");
    this.bucket = this.getConfig<string>("bucket", "");

    if (!this.bucket) {
      throw new Error("S3 bucket name is required");
    }

    this.client = new AwsS3Client({
      region,
      credentials: {
        accessKeyId: this.getConfig<string>("accessKeyId", ""),
        secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
      },
      endpoint: this.getConfig<string>("endpoint", "") || undefined,
    });
  }

  /**
   * Read an object from S3
   * @param key The object key
   * @returns The object content as a string
   */
  async read(key: string): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("error", (err) => reject(err));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });
    };

    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    return streamToString(response.Body as NodeJS.ReadableStream);
  }

  /**
   * Read a JSON object from S3
   * @param key The object key
   * @returns The parsed JSON object
   */
  async readJson<T>(key: string): Promise<T> {
    const content = await this.read(key);
    return JSON.parse(content) as T;
  }

  /**
   * Write an object to S3
   * @param key The object key
   * @param content The content to write (string)
   */
  async write(key: string, content: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: "text/plain",
    });

    await this.client.send(command);
  }

  /**
   * Write a JSON object to S3
   * @param key The object key
   * @param data The data to write as JSON
   */
  async writeJson(key: string, data: unknown): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const content = JSON.stringify(data);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: "application/json",
    });

    await this.client.send(command);
  }

  /**
   * Delete an object from S3
   * @param key The object key
   */
  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Client-specific destroy logic
   */
  protected async destroyClient(): Promise<void> {
    this.client = null;
  }
}
