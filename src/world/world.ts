/**
 * World object for the Smoke scenarios
 * This class maintains state between steps
 */
import type { IWorldOptions } from "@cucumber/cucumber";
import { World, setWorldConstructor } from "@cucumber/cucumber";
import type {
  CloudWatchServiceClient,
  KafkaServiceClient,
  KinesisServiceClient,
  MqttServiceClient,
  RestServiceClient,
  S3ServiceClient,
  ServiceClient,
  SqsServiceClient,
  SsmServiceClient,
} from "../clients";
import {
  CloudWatchClient,
  KafkaClient,
  KinesisClient,
  MqttClient,
  RestClient,
  S3Client,
  SqsClient,
  SsmClient,
} from "../clients";
import { dummy } from "../lib/dummy";

/**
 * Interface extending Cucumber's World with custom methods for smoke tests
 */
export interface SmokeWorld extends World {
  // Original methods
  setTarget(target: string): void;
  getTarget(): string;
  generatePhrase(): void;
  getPhrase(): string;

  // Client registration and access methods
  registerClient(name: string, client: ServiceClient): void;
  getClient<T extends ServiceClient = ServiceClient>(name: string): T;
  hasClient(name: string): boolean;

  // Predefined client access methods
  getRest(): RestServiceClient;
  getMqtt(): MqttServiceClient;
  getS3(): S3ServiceClient;
  getCloudWatch(): CloudWatchServiceClient;
  getSsm(): SsmServiceClient;
  getSqs(): SqsServiceClient;
  getKinesis(): KinesisServiceClient;
  getKafka(): KafkaServiceClient;

  // Client initialization and cleanup
  initializeClients(config?: Record<string, Record<string, unknown>>): Promise<void>;
  destroyClients(): Promise<void>;

  // Helper methods for step definitions
  attachResponse(response: unknown): void;
  getLastResponse(): unknown;
  attachContent(content: string): void;
  getLastContent(): string;
  attachError(error: Error): void;
  getLastError(): Error;
}

/**
 * Custom World implementation for Smoke tests
 */
export class SmokeWorldImpl extends World implements SmokeWorld {
  // Properties to store state between steps
  private target = "";
  private phrase = "";

  // Registry for all clients
  private clients = new Map<string, ServiceClient>();

  // Default client instances
  private readonly restClient: RestClient;
  private readonly mqttClient: MqttClient;
  private readonly s3Client: S3Client;
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly ssmClient: SsmClient;
  private readonly sqsClient: SqsClient;
  private readonly kinesisClient: KinesisClient;
  private readonly kafkaClient: KafkaClient;

  // Storage for test execution state
  private lastResponse: unknown = null;
  private lastContent = "";
  private lastError: Error | null = null;

  /**
   * Create a new Smoke World instance
   * @param options Cucumber World constructor options
   */
  constructor(options: IWorldOptions) {
    super(options);

    // Create default client instances
    this.restClient = new RestClient();
    this.mqttClient = new MqttClient();
    this.s3Client = new S3Client();
    this.cloudWatchClient = new CloudWatchClient();
    this.ssmClient = new SsmClient();
    this.sqsClient = new SqsClient();
    this.kinesisClient = new KinesisClient();
    this.kafkaClient = new KafkaClient();

    // Register default clients
    this.registerClient("rest", this.restClient);
    this.registerClient("mqtt", this.mqttClient);
    this.registerClient("s3", this.s3Client);
    this.registerClient("cloudwatch", this.cloudWatchClient);
    this.registerClient("ssm", this.ssmClient);
    this.registerClient("sqs", this.sqsClient);
    this.registerClient("kinesis", this.kinesisClient);
    this.registerClient("kafka", this.kafkaClient);
  }

  /**
   * Sets the target
   * Converts any input to string for consistent behavior
   */
  setTarget(target: string): void {
    // Explicitly convert target to string to handle non-string inputs
    this.target = String(target);
  }

  /**
   * Gets the target
   */
  getTarget(): string {
    return this.target;
  }

  /**
   * Generates a phrase based on the stored target
   */
  generatePhrase(): void {
    this.phrase = dummy(this.target);
  }

  /**
   * Gets the generated phrase
   */
  getPhrase(): string {
    return this.phrase;
  }

  /**
   * Register a client with the world
   * @param name The client name
   * @param client The client instance
   */
  registerClient(name: string, client: ServiceClient): void {
    this.clients.set(name, client);
  }

  /**
   * Get a client by name
   * @param name The client name
   * @returns The client instance
   */
  getClient<T extends ServiceClient = ServiceClient>(name: string): T {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(`Client not found: ${name}`);
    }
    return client as T;
  }

  /**
   * Check if a client exists
   * @param name The client name
   * @returns True if the client exists, false otherwise
   */
  hasClient(name: string): boolean {
    return this.clients.has(name);
  }

  /**
   * Get the REST client
   */
  getRest(): RestServiceClient {
    return this.restClient;
  }

  /**
   * Get the MQTT client
   */
  getMqtt(): MqttServiceClient {
    return this.mqttClient;
  }

  /**
   * Get the S3 client
   */
  getS3(): S3ServiceClient {
    return this.s3Client;
  }

  /**
   * Get the CloudWatch client
   */
  getCloudWatch(): CloudWatchServiceClient {
    return this.cloudWatchClient;
  }

  /**
   * Get the SSM client
   */
  getSsm(): SsmServiceClient {
    return this.ssmClient;
  }

  /**
   * Get the SQS client
   */
  getSqs(): SqsServiceClient {
    return this.sqsClient;
  }

  /**
   * Get the Kinesis client
   */
  getKinesis(): KinesisServiceClient {
    return this.kinesisClient;
  }

  /**
   * Get the Kafka client
   */
  getKafka(): KafkaServiceClient {
    return this.kafkaClient;
  }

  /**
   * Initialize all clients with configuration
   * @param config Client-specific configuration
   */
  async initializeClients(config?: Record<string, Record<string, unknown>>): Promise<void> {
    const clientConfig = config || {};

    // Initialize each client with its specific configuration
    for (const [name, client] of this.clients.entries()) {
      const clientSpecificConfig = clientConfig[name] || {};
      await client.init(clientSpecificConfig);
    }
  }

  /**
   * Destroy all clients and free up resources
   */
  async destroyClients(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.destroy();
    }
  }

  /**
   * Attach a response object for later assertions
   * @param response The response object to store
   */
  attachResponse(response: unknown): void {
    this.lastResponse = response;
  }

  /**
   * Get the last stored response
   * @returns The last stored response
   */
  getLastResponse(): unknown {
    if (this.lastResponse === null) {
      throw new Error("No response has been attached");
    }
    return this.lastResponse;
  }

  /**
   * Attach content for later assertions
   * @param content The content string to store
   */
  attachContent(content: string): void {
    this.lastContent = content;
  }

  /**
   * Get the last stored content
   * @returns The last stored content
   */
  getLastContent(): string {
    if (!this.lastContent) {
      throw new Error("No content has been attached");
    }
    return this.lastContent;
  }

  /**
   * Attach an error for later assertions
   * @param error The error to store
   */
  attachError(error: Error): void {
    this.lastError = error;
  }

  /**
   * Get the last stored error
   * @returns The last stored error
   */
  getLastError(): Error {
    if (!this.lastError) {
      throw new Error("No error has been attached");
    }
    return this.lastError;
  }
}

// Register the World constructor with Cucumber
setWorldConstructor(SmokeWorldImpl);
