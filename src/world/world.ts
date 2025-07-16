/**
 * World object for the Smoke scenarios
 * This class maintains state between steps
 */
import { type IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
import {
  type ClientConfig,
  ClientFactory,
  ClientRegistry,
  ClientType,
  type CloudWatchServiceClient,
  type KafkaServiceClient,
  type KinesisServiceClient,
  type MqttServiceClient,
  type RestServiceClient,
  type S3ServiceClient,
  type ServiceClient,
  type SqsServiceClient,
  type SsmServiceClient,
} from "../clients";

/**
 * SmokeWorld interface and implementation
 *
 * This module provides the SmokeWorld interface that extends Cucumber's World,
 * adding client management and he§lper methods for smoke tests.
 */

/**
 * PropertyValue type for the property map
 * Can be a simple value (string, number, boolean, null) or a nested PropertyMap
 */
export type PropertyValue = string | number | boolean | null | PropertyMap;

/**
 * PropertyMap interface for storing key-value pairs
 * Keys are strings and values can be simple values or nested PropertyMaps
 */
export interface PropertyMap {
  [key: string]: PropertyValue;
}

/**
 * Path segments for accessing nested properties
 * Can be a string (for a single level) or an array of strings (for multiple levels)
 */
export type PropertyPath = string | string[];

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
   * Property Management Methods
   * Methods for storing and retrieving properties in a nested structure
   */
  // Set a property value at the specified path
  setProperty(path: PropertyPath, value: PropertyValue): void;

  // Get a property value from the specified path
  getProperty(path: PropertyPath): PropertyValue;

  // Check if a property exists at the specified path
  hasProperty(path: PropertyPath): boolean;

  // Remove a property at the specified path
  removeProperty(path: PropertyPath): void;

  // Get the entire property map
  getPropertyMap(): PropertyMap;

  /**
   * Step Parameter Resolution Methods
   * Methods for resolving references in step parameters
   */
  // Resolve configuration and property references in a step parameter
  resolveStepParameter(param: string): string;

  // Check if a string contains configuration references
  containsConfigReferences(input: string): boolean;

  // Check if a string contains property references
  containsPropertyReferences(input: string): boolean;

  // Resolve configuration references in a string
  resolveConfigValues(input: string): string;

  // Resolve property references in a string
  resolvePropertyValues(input: string): string;
}

/**
 * Default SmokeWorld implementation
 *
 * This class extends Cucumber's World and implements the SmokeWorld interface,
 * providing client management and access functionality for smoke tests.
 * It manages client configuration, registration, creation, and lifecycle operations.
 */
import { Configuration, type ConfigValue } from "../support";

// Define an interface for Configuration provider to make testing easier
export interface ConfigurationProvider {
  getValue<T extends ConfigValue>(keyPath: string, defaultValue?: T): T | undefined;
}

// Default implementation that uses the singleton Configuration
export class DefaultConfigurationProvider implements ConfigurationProvider {
  getValue<T extends ConfigValue>(keyPath: string, defaultValue?: T): T | undefined {
    const config = Configuration.getInstance();
    return config.getValue<T>(keyPath, defaultValue);
  }
}

export class SmokeWorldImpl extends World implements SmokeWorld {
  // Properties to store state between steps

  // Registry for all clients
  private clients = new Map<string, ServiceClient>();

  // Client configuration and factory
  private clientRegistry: ClientRegistry;
  private clientFactory: ClientFactory;

  // Storage for test execution state
  private lastResponse: unknown = null;
  private lastContent = "";
  private lastError: Error | null = null;

  // Property map for storing key-value pairs
  private properties: PropertyMap = {};

  // Configuration provider for resolving config values
  private configProvider: ConfigurationProvider;

  /**
   * Create a new SmokeWorld instance
   * @param options Cucumber World constructor options
   * @param config Optional initial configuration
   * @param configProvider Optional configuration provider (for testing)
   */
  constructor(
    options: IWorldOptions,
    config?: Record<string, unknown>,
    configProvider?: ConfigurationProvider,
  ) {
    super(options);

    // Initialize client registry and factory
    this.clientRegistry = new ClientRegistry();
    this.clientFactory = new ClientFactory(this.clientRegistry);

    // Initialize configuration provider (use default if not provided)
    this.configProvider = configProvider || new DefaultConfigurationProvider();

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

  /**
   * Normalize a property path to an array of path segments
   * @param path Property path as a string or array of strings
   * @returns Array of path segments
   */
  private normalizePath(path: PropertyPath): string[] {
    if (typeof path === "string") {
      // Split the string path by dots, but only if not empty
      return path ? path.split(".") : [];
    }
    return path;
  }

  /**
   * Set a property value at the specified path
   * Creates nested objects as needed
   *
   * @param path Path to the property (string with dot notation or array of segments)
   * @param value Value to set at the path
   */
  setProperty(path: PropertyPath, value: PropertyValue): void {
    const segments = this.normalizePath(path);

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    let current: PropertyMap = this.properties;

    // Navigate to the parent of the property to set
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];

      // Create nested object if it doesn't exist or isn't an object
      if (!current[segment] || typeof current[segment] !== "object" || current[segment] === null) {
        current[segment] = {};
      }

      // Move to the next level
      current = current[segment] as PropertyMap;
    }

    // Set the value at the final path segment
    current[segments[segments.length - 1]] = value;
  }

  /**
   * Get a property value from the specified path
   *
   * @param path Path to the property (string with dot notation or array of segments)
   * @returns The value at the path or undefined if not found
   * @throws Error if any segment along the path doesn't exist
   */
  getProperty(path: PropertyPath): PropertyValue {
    const segments = this.normalizePath(path);

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    let current: PropertyValue = this.properties;

    // Navigate through the path segments
    for (const segment of segments) {
      // Check if current is an object and has the property
      if (current === null || typeof current !== "object" || !(segment in current)) {
        throw new Error(`Property not found at path: ${segments.join(".")}`);
      }

      // Move to the next level
      current = (current as PropertyMap)[segment];
    }

    return current;
  }

  /**
   * Check if a property exists at the specified path
   *
   * @param path Path to the property (string with dot notation or array of segments)
   * @returns True if the property exists, false otherwise
   */
  hasProperty(path: PropertyPath): boolean {
    const segments = this.normalizePath(path);

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    try {
      this.getProperty(path);
      return true;
    } catch {
      // If property doesn't exist, getProperty will throw an error
      return false;
    }
  }

  /**
   * Remove a property at the specified path
   *
   * @param path Path to the property (string with dot notation or array of segments)
   * @throws Error if the property doesn't exist
   */
  removeProperty(path: PropertyPath): void {
    const segments = this.normalizePath(path);

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    let current: PropertyMap = this.properties;

    // Navigate to the parent of the property to remove
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];

      // Check if the path exists
      if (!current[segment] || typeof current[segment] !== "object" || current[segment] === null) {
        throw new Error(`Property not found at path: ${segments.slice(0, i + 1).join(".")}`);
      }

      // Move to the next level
      current = current[segment] as PropertyMap;
    }

    const lastSegment = segments[segments.length - 1];

    // Check if the property exists before removing
    if (!(lastSegment in current)) {
      throw new Error(`Property not found at path: ${segments.join(".")}`);
    }

    // Remove the property using Reflect.deleteProperty instead of delete operator
    Reflect.deleteProperty(current, lastSegment);
  }

  /**
   * Get the entire property map
   *
   * @returns The current property map
   */
  getPropertyMap(): PropertyMap {
    // Return a deep copy to prevent direct modification
    return JSON.parse(JSON.stringify(this.properties));
  }

  /**
   * Check if a string contains configuration references
   *
   * @param input The input string to check for configuration references
   * @returns True if the string contains at least one configuration reference, false otherwise
   */
  containsConfigReferences(input: string): boolean {
    return /config:([a-zA-Z0-9._-]+)/g.test(input);
  }

  /**
   * Check if a string contains property references
   *
   * @param input The input string to check for property references
   * @returns True if the string contains at least one property reference, false otherwise
   */
  containsPropertyReferences(input: string): boolean {
    return /prop:([a-zA-Z0-9._-]+)/g.test(input);
  }

  /**
   * Resolve configuration references in a string
   *
   * @param input The input string that may contain configuration references
   * @returns The string with all configuration references replaced with their values
   * @throws Error if a referenced configuration value is not found
   */
  resolveConfigValues(input: string): string {
    return input.replace(/config:([a-zA-Z0-9._-]+)/g, (match, path) => {
      // If a configuration root key is set, use it as prefix
      let fullPath = path;
      if (this.hasProperty("config.rootKey")) {
        const rootKey = this.getProperty("config.rootKey") as string;
        fullPath = `${rootKey}.${path}`;
      }

      // Use the injected configuration provider instead of direct static access
      const value = this.configProvider.getValue(fullPath);

      if (value === undefined) {
        // Try without the root key as fallback
        if (fullPath !== path) {
          const fallbackValue = this.configProvider.getValue(path);
          if (fallbackValue !== undefined) {
            return String(fallbackValue);
          }
        }
        throw new Error(`Configuration value not found: ${fullPath}`);
      }

      return String(value);
    });
  }

  /**
   * Resolve property references in a string
   *
   * @param input The input string that may contain property references
   * @returns The string with all property references replaced with their values
   * @throws Error if a referenced property value is not found
   */
  resolvePropertyValues(input: string): string {
    return input.replace(/prop:([a-zA-Z0-9._-]+)/g, (match, path) => {
      if (!this.hasProperty(path)) {
        throw new Error(`Property not found: ${path}`);
      }

      const value = this.getProperty(path);
      return String(value);
    });
  }

  /**
   * Resolve configuration and property references in a step parameter
   *
   * @param param The parameter string that may contain configuration or property references
   * @returns The parameter with all references resolved, or the original parameter if it contains no references
   * @throws Error if a referenced configuration or property value is not found
   */
  resolveStepParameter(param: string): string {
    let result = param;

    // First resolve configuration references
    if (this.containsConfigReferences(result)) {
      result = this.resolveConfigValues(result);
    }

    // Then resolve property references
    if (this.containsPropertyReferences(result)) {
      result = this.resolvePropertyValues(result);
    }

    return result;
  }
}

// Register the World constructor with Cucumber
setWorldConstructor(SmokeWorldImpl);
