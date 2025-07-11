/**
 * World object for the Smoke scenarios
 * This class maintains state between steps
 */
import { type IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
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
import { ClientType } from "../clients/core";
import { type ClientConfig, ClientFactory, ClientRegistry } from "../clients/registry";
import { dummy } from "../lib/dummy";

/**
 * SmokeWorld interface and implementation
 *
 * This module provides the SmokeWorld interface that extends Cucumber's World,
 * adding client management and helper methods for smoke tests.
 */

/**
 * SmokeWorld interface
 * Extends Cucumber World with client management and test helpers
 *
 * This interface defines the contract for the test world, providing methods
 * to access specific client types, manage client registration, and handle
 * client lifecycle operations.
 */
export interface SmokeWorld extends World {
  /**
   * Client Access Methods
   * Each method retrieves a client of the specified type with optional ID
   */
  getRest<T extends RestServiceClient = RestServiceClient>(id?: string): T;
  getMqtt<T extends MqttServiceClient = MqttServiceClient>(id?: string): T;
  getS3<T extends S3ServiceClient = S3ServiceClient>(id?: string): T;
  getCloudWatch<T extends CloudWatchServiceClient = CloudWatchServiceClient>(id?: string): T;
  getSsm<T extends SsmServiceClient = SsmServiceClient>(id?: string): T;
  getSqs<T extends SqsServiceClient = SqsServiceClient>(id?: string): T;
  getKinesis<T extends KinesisServiceClient = KinesisServiceClient>(id?: string): T;
  getKafka<T extends KafkaServiceClient = KafkaServiceClient>(id?: string): T;

  /**
   * Client Registration and Access
   */
  // Register an existing client with a name
  registerClient(name: string, client: ServiceClient): void;

  // Register a client with configuration and create it
  registerClientWithConfig(
    clientType: ClientType | string,
    config: ClientConfig,
    id?: string,
  ): ServiceClient;

  // Register multiple client configurations of the same type
  registerClientConfigs(clientType: ClientType | string, configs: ClientConfig[]): ServiceClient[];

  // Create a client without registering it
  createClient(clientType: ClientType | string, id?: string): ServiceClient;

  // Get a registered client by name
  getClient<T extends ServiceClient = ServiceClient>(name: string): T;

  // Check if a client exists
  hasClient(name: string): boolean;

  /**
   * Client Lifecycle Management
   */
  // Initialize all clients with optional configuration
  initializeClients(config?: Record<string, unknown>): Promise<void>;

  // Reset all clients to initial state
  resetClients(): Promise<void>;

  // Destroy all clients and free resources
  destroyClients(): Promise<void>;

  /**
   * Helper Methods for storing and retrieving test data
   */
  // Store response for later assertions
  attachResponse(response: unknown): void;

  // Retrieve the last stored response
  getLastResponse(): unknown;

  // Store content for later assertions
  attachContent(content: string): void;

  // Retrieve the last stored content
  getLastContent(): string;

  // Store error for later assertions
  attachError(error: Error): void;

  // Retrieve the last stored error
  getLastError(): Error;

  /**
   * Optional methods for target and phrase functionality
   */
  // Set the target string
  setTarget(target: string): void;

  // Get the current target
  getTarget(): string;

  // Generate a phrase based on the target
  generatePhrase(): void;

  // Get the generated phrase
  getPhrase(): string;
}

/**
 * Default SmokeWorld implementation
 *
 * This class extends Cucumber's World and implements the SmokeWorld interface,
 * providing client management and access functionality for smoke tests.
 * It manages client configuration, registration, creation, and lifecycle operations.
 */
export class SmokeWorldImpl extends World implements SmokeWorld {
  // Properties to store state between steps
  private target = "";
  private phrase = "";

  // Registry for all clients
  private clients = new Map<string, ServiceClient>();

  // Client configuration and factory
  private clientRegistry: ClientRegistry;
  private clientFactory: ClientFactory;

  // Storage for test execution state
  private lastResponse: unknown = null;
  private lastContent = "";
  private lastError: Error | null = null;

  /**
   * Create a new SmokeWorld instance
   * @param options Cucumber World constructor options
   * @param config Optional initial configuration
   */
  constructor(options: IWorldOptions, config?: Record<string, unknown>) {
    super(options);

    // Initialize client registry and factory
    this.clientRegistry = new ClientRegistry();
    this.clientFactory = new ClientFactory(this.clientRegistry);

    // Register initial configuration if provided
    if (config) {
      // Use getter method instead of direct property access to allow mocking in tests
      this.getClientRegistry().registerConfigs(config);
      this.createAndRegisterDefaultClients();
    }
  }

  /**
   * Create and register clients for all client types in the registry
   */
  private createAndRegisterDefaultClients(): void {
    // Get all configurations from registry and create clients
    const configs = this.clientRegistry.getAllConfigs();

    for (const [key] of configs.entries()) {
      // Parse client type and ID from key
      const [clientType, clientId] = key.includes(":") ? key.split(":") : [key, undefined];

      // Skip if client already exists
      const clientKey = clientId ? `${clientType}:${clientId}` : clientType;
      if (this.hasClient(clientKey)) {
        continue;
      }

      // Create and register client
      const client = this.clientFactory.createClient(clientType, clientId);
      this.registerClient(clientKey, client);
    }
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
   * Get the client registry
   */
  getClientRegistry(): ClientRegistry {
    return this.clientRegistry;
  }

  /**
   * Get the client factory
   */
  getClientFactory(): ClientFactory {
    return this.clientFactory;
  }

  /**
   * Create a new client instance
   * @param clientType The client type (enum or string)
   * @param id Optional client identifier
   * @returns The created client
   */
  createClient(clientType: ClientType | string, id?: string): ServiceClient {
    return this.clientFactory.createClient(clientType, id);
  }

  /**
   * Register a client configuration and create the client
   * @param clientType The client type (enum or string)
   * @param config The client configuration
   * @param id Optional client identifier
   * @returns The created client
   */
  registerClientWithConfig(
    clientType: ClientType | string,
    config: ClientConfig,
    id?: string,
  ): ServiceClient {
    // Register configuration
    this.clientRegistry.registerConfig(clientType, config, id);

    // Create and register the client
    const clientId = id || config.id || clientType;
    const clientKey = clientId !== clientType ? `${clientType}:${clientId}` : clientType;
    const client = this.clientFactory.createClient(clientType, clientId);
    this.registerClient(clientKey, client);

    return client;
  }

  /**
   * Get a REST client with optional ID
   *
   * @param id - Optional client identifier
   * @returns The REST client instance
   * @throws Error if the client does not exist
   */
  getRest<T extends RestServiceClient = RestServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `rest:${id}` : "rest");
  }

  /**
   * Get an MQTT client with optional ID
   *
   * @param id - Optional client identifier
   * @returns The MQTT client instance
   * @throws Error if the client does not exist
   */
  getMqtt<T extends MqttServiceClient = MqttServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `mqtt:${id}` : "mqtt");
  }

  /**
   * Get an S3 client with optional ID
   *
   * @param id - Optional client identifier
   * @returns The S3 client instance
   * @throws Error if the client does not exist
   */
  getS3<T extends S3ServiceClient = S3ServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `s3:${id}` : "s3");
  }

  /**
   * Get a CloudWatch client with optional ID
   *
   * @param id - Optional client identifier
   * @returns The CloudWatch client instance
   * @throws Error if the client does not exist
   */
  getCloudWatch<T extends CloudWatchServiceClient = CloudWatchServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `cloudwatch:${id}` : "cloudwatch");
  }

  /**
   * Get an SSM client with optional ID
   *
   * @param id - Optional client identifier
   * @returns The SSM client instance
   * @throws Error if the client does not exist
   */
  getSsm<T extends SsmServiceClient = SsmServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `ssm:${id}` : "ssm");
  }

  /**
   * Get an SQS client with optional ID
   *
   * @param id - Optional client identifier
   * @returns The SQS client instance
   * @throws Error if the client does not exist
   */
  getSqs<T extends SqsServiceClient = SqsServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `sqs:${id}` : "sqs");
  }

  /**
   * Get a Kinesis client with optional ID
   *
   * @param id - Optional client identifier
   * @returns The Kinesis client instance
   * @throws Error if the client does not exist
   */
  getKinesis<T extends KinesisServiceClient = KinesisServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `kinesis:${id}` : "kinesis");
  }

  /**
   * Get a Kafka client with optional ID
   *
   * @param id - Optional client identifier
   * @returns The Kafka client instance
   * @throws Error if the client does not exist
   */
  getKafka<T extends KafkaServiceClient = KafkaServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `kafka:${id}` : "kafka");
  }

  /**
   * Register multiple client configurations for a single client type
   * Each configuration becomes a separate client with auto-assigned IDs
   * @param clientType The client type (enum or string)
   * @param configs Array of client configurations
   * @returns Array of created clients
   */
  registerClientConfigs(clientType: ClientType | string, configs: ClientConfig[]): ServiceClient[] {
    const createdClients: ServiceClient[] = [];

    // Register the configuration array
    this.clientRegistry.registerConfigArray(clientType, configs);

    // Create clients for each configuration
    configs.forEach((config, index) => {
      // Use index+1 for ID if not specified and not first item
      const id = config.id || (index > 0 ? `${index + 1}` : undefined);
      const client = this.createClient(clientType, id as string);
      createdClients.push(client);
    });

    return createdClients;
  }

  /**
   * Initialize all clients with configuration
   * @param config Client-specific configuration
   */
  async initializeClients(config?: Record<string, unknown>): Promise<void> {
    if (config) {
      // Register configurations and create clients
      this.clientRegistry.registerConfigs(config);
      this.createAndRegisterDefaultClients();
    }

    // Initialize each client
    for (const client of this.clients.values()) {
      await client.init();
    }
  }

  /**
   * Reset all clients to their initial state
   *
   * @returns Promise that resolves when all clients are reset
   */
  async resetClients(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.reset();
    }
  }

  /**
   * Destroy all clients and free up resources
   *
   * @returns Promise that resolves when all clients are destroyed
   */
  async destroyClients(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.destroy();
    }

    // Clear the client map after destroying all clients
    this.clients.clear();
  }

  /**
   * Attach a response object for later assertions
   * Stores the response for access in subsequent steps
   *
   * @param response - The response object to store for later access
   */
  attachResponse(response: unknown): void {
    this.lastResponse = response;
  }

  /**
   * Get the last stored response
   *
   * @returns The last stored response object
   * @throws Error if no response has been attached
   */
  getLastResponse(): unknown {
    if (this.lastResponse === null) {
      throw new Error("No response has been attached");
    }
    return this.lastResponse;
  }

  /**
   * Attach content for later assertions
   * Stores a content string for access in subsequent steps
   *
   * @param content - The content string to store for later access
   */
  attachContent(content: string): void {
    this.lastContent = content;
  }

  /**
   * Get the last stored content
   *
   * @returns The last stored content string
   * @throws Error if no content has been attached
   */
  getLastContent(): string {
    if (!this.lastContent) {
      throw new Error("No content has been attached");
    }
    return this.lastContent;
  }

  /**
   * Attach an error for later assertions
   * Stores an error object for access in subsequent steps
   *
   * @param error - The error object to store for later access
   */
  attachError(error: Error): void {
    this.lastError = error;
  }

  /**
   * Get the last stored error
   *
   * @returns The last stored error object
   * @throws Error if no error has been attached
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
