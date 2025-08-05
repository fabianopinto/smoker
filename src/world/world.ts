/**
 * Smoke Test World Module
 *
 * This module defines the interfaces and implementations for the Smoke test world,
 * providing type definitions and contracts for client management and test helpers.
 * It extends Cucumber's World with service client management, property storage,
 * and parameter resolution functionality.
 *
 * The SmokeWorld implementation serves as the central context for test execution,
 * managing client lifecycles and providing helper methods for test steps.
 */

import { type IWorld, type IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
import type {
  CloudWatchServiceClient,
  KinesisServiceClient,
  S3ServiceClient,
  SqsServiceClient,
  SsmServiceClient,
} from "../clients/aws";
import { ClientType, type ServiceClient } from "../clients/core";
import type { RestServiceClient } from "../clients/http";
import type { KafkaServiceClient, MqttServiceClient } from "../clients/messaging";
import { type ClientConfig, ClientFactory, ClientRegistry } from "../clients/registry";
import { Configuration, type ConfigurationProvider, type ConfigValue } from "../support/config";

/**
 * SmokeWorld interface
 *
 * Extends Cucumber World with client management and test helpers. This interface
 * defines the contract for the test world, providing methods to access specific
 * client types, manage client registration, and handle client lifecycle operations.
 *
 * The SmokeWorld serves as the central context for test execution, providing:
 * - Typed access to service clients (AWS, HTTP, messaging services)
 * - Client lifecycle management (initialization, reset, destruction)
 * - Test data storage and retrieval
 * - Property management for storing and accessing test state
 * - Parameter resolution for configuration and property references
 *
 * @interface SmokeWorld
 * @extends {IWorld}
 */
export interface SmokeWorld extends IWorld {
  /**
   * Client Access Methods
   *
   * These methods provide typed access to service clients of different types.
   * Each method retrieves a client of the specified type with an optional ID.
   * If no ID is provided, the default client for that type is returned.
   *
   * The generic type parameter allows for retrieving extended client types
   * while maintaining type safety.
   *
   * @example
   * // Get the default CloudWatch client
   * const cloudWatch = world.getCloudWatch();
   *
   * // Get a specific S3 client with ID
   * const backupS3 = world.getS3("backup");
   */

  /**
   * Get a CloudWatch client with optional ID
   *
   * @param id - Optional client identifier
   * @return The CloudWatch client instance
   * @throws Error if the client does not exist
   */
  getCloudWatch<T extends CloudWatchServiceClient = CloudWatchServiceClient>(id?: string): T;

  /**
   * Get a Kafka client with optional ID
   *
   * @param id - Optional client identifier
   * @return The Kafka client instance
   * @throws Error if the client does not exist
   */
  getKafka<T extends KafkaServiceClient = KafkaServiceClient>(id?: string): T;

  /**
   * Get a Kinesis client with optional ID
   *
   * @param id - Optional client identifier
   * @return The Kinesis client instance
   * @throws Error if the client does not exist
   */
  getKinesis<T extends KinesisServiceClient = KinesisServiceClient>(id?: string): T;

  /**
   * Get an MQTT client with optional ID
   *
   * @param id - Optional client identifier
   * @return The MQTT client instance
   * @throws Error if the client does not exist
   */
  getMqtt<T extends MqttServiceClient = MqttServiceClient>(id?: string): T;

  /**
   * Get a REST client with optional ID
   *
   * @param id - Optional client identifier
   * @return The REST client instance
   * @throws Error if the client does not exist
   */
  getRest<T extends RestServiceClient = RestServiceClient>(id?: string): T;

  /**
   * Get an S3 client with optional ID
   *
   * @param id - Optional client identifier
   * @return The S3 client instance
   * @throws Error if the client does not exist
   */
  getS3<T extends S3ServiceClient = S3ServiceClient>(id?: string): T;

  /**
   * Get an SQS client with optional ID
   *
   * @param id - Optional client identifier
   * @return The SQS client instance
   * @throws Error if the client does not exist
   */
  getSqs<T extends SqsServiceClient = SqsServiceClient>(id?: string): T;

  /**
   * Get an SSM client with optional ID
   *
   * @param id - Optional client identifier
   * @return The SSM client instance
   * @throws Error if the client does not exist
   */
  getSsm<T extends SsmServiceClient = SsmServiceClient>(id?: string): T;

  /**
   * Client Registration and Management Methods
   *
   * These methods provide functionality for registering, creating, and accessing
   * service clients. They allow for managing client lifecycles and configurations
   * throughout the test execution.
   */

  /**
   * Register an existing client with a name
   *
   * Associates a client instance with a name for later retrieval. This is useful
   * when you have an existing client instance that you want to make available
   * through the world context.
   *
   * @param name - The name to register the client under
   * @param client - The client instance to register
   *
   * @example
   * // Register a custom client
   * const customClient = new MyCustomClient();
   * world.registerClient("custom", customClient);
   */
  registerClient(name: string, client: ServiceClient): void;

  /**
   * Register a client with configuration and create it
   *
   * Creates a new client of the specified type with the given configuration
   * and registers it for later access. This is a convenience method that
   * combines configuration registration, client creation, and client registration.
   *
   * @param clientType - The type of client to create
   * @param config - The configuration for the client
   * @param id - Optional client identifier
   * @return The created and registered client instance
   *
   * @example
   * // Register and create an S3 client with custom configuration
   * const s3Client = world.registerClientWithConfig(
   *   ClientType.S3,
   *   { region: "us-east-1", bucket: "test-bucket" },
   *   "test"
   * );
   */
  registerClientWithConfig(
    clientType: ClientType | string,
    config: ClientConfig,
    id?: string,
  ): ServiceClient;

  /**
   * Create a client without registering it
   *
   * Creates a new client of the specified type without registering it.
   * This is useful when you need a temporary client that doesn't need
   * to be accessed by other test steps.
   *
   * @param clientType - The type of client to create
   * @param id - Optional client identifier
   * @return The created client instance
   *
   * @example
   * // Create a temporary REST client
   * const tempClient = world.createClient(ClientType.REST);
   * await tempClient.init();
   * // Use the client for a specific operation
   * const response = await tempClient.get("/api/status");
   */
  createClient(clientType: ClientType | string, id?: string): ServiceClient;

  /**
   * Get a registered client by name
   *
   * Retrieves a previously registered client by its name. The generic type
   * parameter allows for retrieving the client with the correct type.
   *
   * @template T - The type of client to retrieve
   * @param name - The name of the client to retrieve
   * @return The client instance with the specified type
   * @throws Error if no client is registered with the given name
   *
   * @example
   * // Get a previously registered client
   * const restClient = world.getClient<RestServiceClient>("api");
   * const response = await restClient.get("/users");
   */
  getClient<T extends ServiceClient = ServiceClient>(name: string): T;

  /**
   * Check if a client exists
   *
   * Verifies whether a client is registered with the given name.
   * This is useful for conditional logic based on client availability.
   *
   * @param name - The name of the client to check
   * @return True if a client is registered with the given name, false otherwise
   *
   * @example
   * // Check if a client exists before using it
   * if (world.hasClient("api")) {
   *   const apiClient = world.getClient("api");
   *   // Use the client...
   * } else {
   *   // Create and register the client first
   *   // ...
   * }
   */
  hasClient(name: string): boolean;

  /**
   * Client Lifecycle Methods
   *
   * These methods manage the lifecycle of all registered clients, including
   * initialization, reset, and cleanup operations. They ensure proper resource
   * management throughout the test execution.
   */

  /**
   * Initialize all clients with optional configuration
   *
   * Calls the init method on all registered clients to perform any necessary
   * setup operations. This should be called before using any clients in tests.
   * Optionally accepts a configuration object to configure clients during initialization.
   *
   * @param config - Optional configuration object for client initialization
   * @return Promise that resolves when all clients are initialized
   * @throws Error if any client initialization fails
   *
   * @example
   * // Initialize all clients before starting tests
   * await world.initializeClients();
   *
   * // Initialize with custom configuration
   * await world.initializeClients({
   *   s3: { region: "us-west-1" },
   *   rest: { baseUrl: "https://api.example.com" },
   * });
   */
  initializeClients(config?: Record<string, unknown>): Promise<void>;

  /**
   * Reset all clients to initial state
   *
   * Resets all registered clients to their initial state. This is useful
   * between test scenarios to ensure a clean state without having to
   * reinitialize all clients.
   *
   * @return Promise that resolves when all clients are reset
   * @throws Error if any client reset fails
   *
   * @example
   * // Reset clients between test scenarios
   * await world.resetClients();
   */
  resetClients(): Promise<void>;

  /**
   * Destroy all clients and free resources
   *
   * Performs cleanup operations on all registered clients and releases
   * any resources they hold. This should be called at the end of test
   * execution to ensure proper cleanup.
   *
   * @return Promise that resolves when all clients are destroyed
   * @throws Error if any client destruction fails
   *
   * @example
   * // Clean up after tests are complete
   * await world.destroyClients();
   */
  destroyClients(): Promise<void>;

  /**
   * Test Data Helper Methods
   *
   * These methods provide functionality for storing and retrieving test data
   * such as API responses, content, and errors. They are useful for passing
   * data between test steps and making assertions on previous operations.
   */

  /**
   * Store response for later assertions
   *
   * Stores an API response or other data object for later retrieval and assertions.
   * This is particularly useful for multi-step tests where the response from one
   * step needs to be verified in a subsequent step.
   *
   * @param response - The response object to store
   *
   * @example
   * // Store an API response
   * const response = await restClient.get("/users");
   * world.attachResponse(response);
   */
  attachResponse(response: unknown): void;

  /**
   * Retrieve the last stored response
   *
   * Gets the most recently stored response for assertions or further processing.
   *
   * @return The last stored response
   * @throws Error if no response has been stored
   *
   * @example
   * // Retrieve and verify the last response
   * const response = world.getLastResponse();
   * expect(response.status).toBe(200);
   */
  getLastResponse(): unknown;

  /**
   * Store content for later assertions
   *
   * Stores string content (such as file contents, API response bodies, etc.)
   * for later retrieval and assertions.
   *
   * @param content - The string content to store
   *
   * @example
   * // Store file content
   * const fileContent = await s3Client.read("config.json");
   * world.attachContent(fileContent);
   */
  attachContent(content: string): void;

  /**
   * Retrieve the last stored content
   *
   * Gets the most recently stored string content for assertions or further processing.
   *
   * @return The last stored content string
   * @throws Error if no content has been stored
   *
   * @example
   * // Retrieve and verify the last content
   * const content = world.getLastContent();
   * expect(content).toContain('"status": "active"');
   */
  getLastContent(): string;

  /**
   * Store error for later assertions
   *
   * Stores an error object for later retrieval and assertions. This is useful
   * for testing error handling and negative test cases.
   *
   * @param error - The error object to store
   *
   * @example
   * // Store an error from a failed operation
   * try {
   *   await restClient.get("/invalid-endpoint");
   * } catch (error) {
   *   world.attachError(error);
   * }
   */
  attachError(error: Error | unknown): void;

  /**
   * Retrieve the last stored error
   *
   * Gets the most recently stored error for assertions or further processing.
   *
   * @return The last stored error
   * @throws Error if no error has been stored
   *
   * @example
   * // Retrieve and verify the last error
   * const error = world.getLastError();
   * expect(error).toHaveProperty("message")
   * expect(error.message).toContain("Not Found");
   */
  getLastError(): Error | unknown;

  /**
   * Property Management Methods
   *
   * These methods provide functionality for storing and retrieving properties
   * in a nested structure. They are useful for sharing state between test steps
   * and for parameterizing tests.
   */

  /**
   * Set a property value at the specified path
   *
   * Stores a value in the property tree at the specified path. The path can be
   * a string with dot notation or an array of path segments.
   *
   * @param path - The path where to store the value
   * @param value - The value to store
   *
   * @example
   * // Store a simple value
   * world.setProperty("user.id", 123);
   *
   * // Store a complex object
   * world.setProperty("api.config", { baseUrl: "https://api.example.com", timeout: 5000 });
   */
  setProperty(path: PropertyPath, value: PropertyValue): void;

  /**
   * Get a property value at the specified path
   *
   * Retrieves a value from the property tree at the specified path. If the property
   * doesn't exist, returns the default value if provided, or undefined otherwise.
   *
   * @template T - The type of the property value to retrieve
   * @param path - The path to the property
   * @param defaultValue - Optional default value to return if the property doesn't exist
   * @return The property value or the default value if not found
   *
   * @example
   * // Get a simple value
   * const userId = world.getProperty<number>("user.id");
   *
   * // Get a complex object with default value
   * const apiConfig = world.getProperty<ApiConfig>("api.config", { baseUrl: "https://default.com" });
   */
  getProperty<T = PropertyValue>(path: PropertyPath, defaultValue?: T): T;

  /**
   * Check if a property exists at the specified path
   *
   * Verifies whether a property exists in the property tree at the specified path.
   *
   * @param path - The path to check
   * @return True if the property exists, false otherwise
   *
   * @example
   * // Check if a property exists before using it
   * if (world.hasProperty("user.preferences")) {
   *   const preferences = world.getProperty("user.preferences");
   *   // Use preferences...
   * }
   */
  hasProperty(path: PropertyPath): boolean;

  /**
   * Delete a property at the specified path
   *
   * Removes a property from the property tree at the specified path.
   *
   * @param path - The path of the property to delete
   *
   * @example
   * // Delete a property that's no longer needed
   * world.deleteProperty("temporary.data");
   */
  deleteProperty(path: PropertyPath): void;

  /**
   * Resolve a parameter value
   *
   * Resolves parameter values, handling property references and other special
   * syntax. This is useful for parameterizing tests with values that may be
   * determined at runtime.
   *
   * @param param - The parameter value to resolve
   * @return Promise that resolves to the resolved parameter value
   *
   * @example
   * // Resolve a parameter that may contain property references
   * const resolvedValue = await world.resolveParam("Hello, ${user.name}!");
   */
  resolveParam(param: unknown): Promise<unknown>;

  /**
   * Check if a string contains configuration references
   *
   * @param input - The input string to check
   * @return True if the string contains configuration references, false otherwise
   */
  containsConfigReferences(input: string): boolean;

  /**
   * Check if a string contains property references
   *
   * @param input - The input string to check
   * @return True if the string contains property references, false otherwise
   */
  containsPropertyReferences(input: string): boolean;

  /**
   * Resolve configuration references in a string
   *
   * @param input - The input string that may contain configuration references
   * @return Promise resolving to the string with all configuration references replaced
   */
  resolveConfigValue(input: string): Promise<string>;

  /**
   * Resolve property references in a string
   *
   * @param input - The input string that may contain property references
   * @return The string with all property references replaced
   */
  resolvePropertyValue(input: string): string;
}

/**
 * PropertyMap interface for storing key-value pairs
 * Keys are strings and values can be simple values or nested PropertyMaps
 */
export interface PropertyMap {
  [key: string]: PropertyValue;
}

/**
 * PropertyValue type for the property map
 * Can be a simple value (string, number, boolean, null) or a nested PropertyMap
 */
export type PropertyValue = string | number | boolean | null | PropertyMap;

/**
 * Path segments for accessing nested properties
 * Can be a string (for a single level) or an array of strings (for multiple levels)
 */
export type PropertyPath = string | string[];

/**
 * Default implementation of ConfigurationProvider
 *
 * This class provides the default implementation of the ConfigurationProvider interface,
 * serving as a bridge between the SmokeWorld and the global Configuration instance.
 * It delegates configuration value retrieval to the global Configuration object.
 *
 * The provider supports asynchronous value retrieval with type safety through generics,
 * and handles default values when configuration keys are not found. This implementation
 * aligns with the factory pattern used in the Configuration class refactoring.
 *
 * @implements {ConfigurationProvider}
 */
export class DefaultConfigurationProvider implements ConfigurationProvider {
  /**
   * Get a configuration value by key path
   *
   * @param keyPath - The dot-notation path to the configuration value
   * @param defaultValue - Optional default value if the configuration value is not found
   * @return The configuration value or the default value if not found
   */
  async getValue<T extends ConfigValue>(keyPath: string, defaultValue?: T): Promise<T | undefined> {
    return await Configuration.getInstance().getValue<T>(keyPath, defaultValue);
  }
}

/**
 * Implementation of the SmokeWorld interface
 *
 * This class provides the core implementation of the SmokeWorld interface,
 * serving as the central component of the smoke testing framework. It extends
 * the Cucumber World class and implements additional functionality for managing
 * service clients, configurations, and test state.
 *
 * The implementation handles client registration and lifecycle management,
 * configuration resolution through the ConfigurationProvider, and maintains
 * test execution state including responses, content, and errors. It provides
 * typed access to specific client implementations and supports property storage
 * for sharing data between test steps.
 *
 * @extends {World}
 * @implements {SmokeWorld}
 */
export class SmokeWorldImpl extends World implements SmokeWorld {
  // Registry for all service clients
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
   *
   * @param options - Cucumber World constructor options
   * @param config - Optional initial configuration
   */
  constructor(options: IWorldOptions, config?: Record<string, unknown>) {
    super(options);

    // Initialize client registry and factory
    this.clientRegistry = new ClientRegistry();
    this.clientFactory = new ClientFactory(this.clientRegistry);

    // Initialize configuration provider
    this.configProvider = new DefaultConfigurationProvider();

    // Register initial configuration if provided
    if (config) {
      // Use getter method instead of direct property access to allow mocking in tests
      this.getClientRegistry().registerConfigs(config);
      this.createAndRegisterDefaultClients();
    }
  }

  /**
   * Create and register clients for all client types in the registry
   * This method is called during initialization if a configuration is provided
   */
  private createAndRegisterDefaultClients(): void {
    // Get all configurations from registry and create clients
    for (const [key] of this.clientRegistry.getAllConfigs().entries()) {
      // Parse client type and ID from key
      const [clientType, clientId] = key.includes(":") ? key.split(":") : [key, undefined];

      // Skip if client already exists
      if (this.hasClient(clientId ? `${clientType}:${clientId}` : clientType)) {
        continue;
      }

      // Create and register client
      this.registerClient(
        clientId ? `${clientType}:${clientId}` : clientType,
        this.clientFactory.createClient(clientType, clientId),
      );
    }
  }

  /**
   * Register a client with the world
   *
   * @param name - The client name
   * @param client - The client instance
   */
  registerClient(name: string, client: ServiceClient): void {
    this.clients.set(name, client);
  }

  /**
   * Get a client by name
   *
   * @param name - The client name
   * @return The client instance
   * @throws Error if the client does not exist
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
   *
   * @param name - The client name
   * @return True if the client exists, false otherwise
   */
  hasClient(name: string): boolean {
    return this.clients.has(name);
  }

  /**
   * Get the client registry
   *
   * @return The client registry instance
   */
  getClientRegistry(): ClientRegistry {
    return this.clientRegistry;
  }

  /**
   * Get the client factory
   *
   * @return The client factory instance
   */
  getClientFactory(): ClientFactory {
    return this.clientFactory;
  }

  /**
   * Create a new client instance
   *
   * @param clientType - The client type (enum or string)
   * @param id - Optional client identifier
   * @return The created client
   */
  createClient(clientType: ClientType | string, id?: string): ServiceClient {
    return this.clientFactory.createClient(clientType, id);
  }

  /**
   * Register a client configuration and create the client
   *
   * @param clientType - The client type (enum or string)
   * @param config - The client configuration
   * @param id - Optional client identifier
   * @return The created client
   */
  registerClientWithConfig(
    clientType: ClientType | string,
    config: ClientConfig,
    id?: string,
  ): ServiceClient {
    // Register configuration
    this.clientRegistry.registerConfig(clientType, config, id);

    // Create and register the client
    // Ensure clientId is a string by checking the type of config.id
    const configId = typeof config.id === "string" ? config.id : undefined;
    const clientId = id || configId || clientType;
    const clientKey = clientId !== clientType ? `${clientType}:${clientId}` : clientType;
    const client = this.clientFactory.createClient(clientType, clientId);
    this.registerClient(clientKey, client);

    return client;
  }

  /**
   * Get a CloudWatch client with optional ID
   *
   * @param id - Optional client identifier
   * @return The CloudWatch client instance
   * @throws Error if the client does not exist
   */
  getCloudWatch<T extends CloudWatchServiceClient = CloudWatchServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `cloudwatch:${id}` : "cloudwatch");
  }

  /**
   * Get a Kafka client with optional ID
   *
   * @param id - Optional client identifier
   * @return The Kafka client instance
   * @throws Error if the client does not exist
   */
  getKafka<T extends KafkaServiceClient = KafkaServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `kafka:${id}` : "kafka");
  }

  /**
   * Get a Kinesis client with optional ID
   *
   * @param id - Optional client identifier
   * @return The Kinesis client instance
   * @throws Error if the client does not exist
   */
  getKinesis<T extends KinesisServiceClient = KinesisServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `kinesis:${id}` : "kinesis");
  }

  /**
   * Get an MQTT client with optional ID
   *
   * @param id - Optional client identifier
   * @return The MQTT client instance
   * @throws Error if the client does not exist
   */
  getMqtt<T extends MqttServiceClient = MqttServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `mqtt:${id}` : "mqtt");
  }

  /**
   * Get a REST client with optional ID
   *
   * @param id - Optional client identifier
   * @return The REST client instance
   * @throws Error if the client does not exist
   */
  getRest<T extends RestServiceClient = RestServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `rest:${id}` : "rest");
  }

  /**
   * Get an S3 client with optional ID
   *
   * @param id - Optional client identifier
   * @return The S3 client instance
   * @throws Error if the client does not exist
   */
  getS3<T extends S3ServiceClient = S3ServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `s3:${id}` : "s3");
  }

  /**
   * Get an SQS client with optional ID
   *
   * @param id - Optional client identifier
   * @return The SQS client instance
   * @throws Error if the client does not exist
   */
  getSqs<T extends SqsServiceClient = SqsServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `sqs:${id}` : "sqs");
  }

  /**
   * Get an SSM client with optional ID
   *
   * @param id - Optional client identifier
   * @return The SSM client instance
   * @throws Error if the client does not exist
   */
  getSsm<T extends SsmServiceClient = SsmServiceClient>(id?: string): T {
    return this.getClient<T>(id ? `ssm:${id}` : "ssm");
  }

  /**
   * Initialize all clients with configuration
   *
   * @param config - Optional client-specific configuration
   * @return Promise that resolves when all clients are initialized
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
   * @return Promise that resolves when all clients are reset
   */
  async resetClients(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.reset();
    }
  }

  /**
   * Destroy all clients and free up resources
   *
   * @return Promise that resolves when all clients are destroyed
   */
  async destroyClients(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.destroy();
    }
    this.clients.clear();
  }

  /**
   * Store a response for later assertions
   *
   * @param response - The response object to store
   */
  attachResponse(response: unknown): void {
    this.lastResponse = response;
  }

  /**
   * Get the last stored response
   *
   * @return The last stored response object
   * @throws Error if no response has been attached
   */
  getLastResponse(): unknown {
    if (this.lastResponse === null) {
      throw new Error("No response has been attached");
    }
    return this.lastResponse;
  }

  /**
   * Store content for later assertions
   *
   * @param content - The content string to store
   */
  attachContent(content: string): void {
    this.lastContent = content;
  }

  /**
   * Get the last stored content
   *
   * @return The last stored content string
   * @throws Error if no content has been attached
   */
  getLastContent(): string {
    if (!this.lastContent) {
      throw new Error("No content has been attached");
    }
    return this.lastContent;
  }

  /**
   * Store an error for later assertions
   *
   * @param error - The error to store
   */
  attachError(error: Error): void {
    this.lastError = error;
  }

  /**
   * Get the last stored error
   *
   * @return The last stored error
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
   *
   * @param path - Property path as a string or array of strings
   * @return Array of path segments
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
   * @param path - Path to the property (string with dot notation or array of segments)
   * @param value - Value to set at the path
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
   * @template T - The expected type of the property value
   * @param path - The property path (string with dot notation or array of segments)
   * @param defaultValue - Optional default value to return if the property doesn't exist
   * @return The value at the path, the default value, or undefined if not found
   * @throws Error if any segment along the path doesn't exist
   */
  getProperty<T = PropertyValue>(path: PropertyPath, defaultValue?: T): T {
    const segments = this.normalizePath(path);

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    try {
      let current: PropertyValue = this.properties;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        if (current === null || current === undefined) {
          // Return default value if provided when property doesn't exist
          return defaultValue as T;
        }

        if (typeof current !== "object") {
          // Return default value if provided when trying to access property of non-object
          return defaultValue as T;
        }

        if (i === segments.length - 1) {
          // Last segment, return the value or default value if it doesn't exist
          const value = (current as Record<string, PropertyValue>)[segment];
          return (value !== undefined ? value : defaultValue) as T;
        }

        // Move to the next segment
        current = (current as Record<string, PropertyValue>)[segment];
      }

      // Should never reach here, but return default value just in case
      return defaultValue as T;
    } catch {
      // Return default value on any error
      return defaultValue as T;
    }
  }

  /**
   * Check if a property exists at the specified path
   *
   * @param path - Path to the property (string with dot notation or array of segments)
   * @return True if the property exists, false otherwise
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
   * Delete a property at the specified path
   *
   * @param path - The path of the property to delete
   * @throws Error if the property doesn't exist
   */
  deleteProperty(path: PropertyPath): void {
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
   * Check if a string contains configuration references
   *
   * @param input - The input string to check
   * @return True if the string contains configuration references, false otherwise
   */
  containsConfigReferences(input: string): boolean {
    // Use a regex that matches the pattern but doesn't validate the format
    // The actual validation will happen in resolveConfigValue
    return /config:[a-zA-Z0-9_$.]+/g.test(input);
  }

  /**
   * Check if a string contains property references
   *
   * @param input - The input string to check
   * @return True if the string contains property references, false otherwise
   */
  containsPropertyReferences(input: string): boolean {
    // Use a regex that matches the pattern but doesn't validate the format
    // The actual validation will happen in resolvePropertyValue
    return /property:[a-zA-Z0-9_$]+/g.test(input);
  }

  /**
   * Resolve configuration references in a string
   *
   * @param input - The input string that may contain configuration references
   * @return The string with all configuration references replaced with their values
   * @throws Error if a referenced configuration value is not found
   */
  async resolveConfigValue(input: string): Promise<string> {
    // Import the isConfigReference function to validate references
    // Using a more comprehensive regex to find potential config references
    let match;
    let result = input;
    const matches = [];

    // First, find all matches and validate them
    while ((match = /config:[a-zA-Z0-9_$.]+/g.exec(input)) !== null) {
      const fullMatch = match[0];

      // Validate the reference format using the exact regex pattern
      if (!/^config:([a-zA-Z0-9_$]+\.)*([a-zA-Z0-9_$]+)$/.test(fullMatch)) {
        throw new Error(
          `Invalid configuration reference format: ${fullMatch}. References must follow the pattern 'config:[segment](.[segment])*' where segment is [a-zA-Z0-9_$]+.`,
        );
      }

      const path = fullMatch.substring(7); // Remove "config:" prefix

      matches.push({
        fullMatch,
        path,
      });
    }

    // Then, process each match sequentially
    for (const { fullMatch, path } of matches) {
      // If a configuration root key is set, use it as prefix
      let fullPath = path;
      if (this.hasProperty("config.rootKey")) {
        const rootKey = this.getProperty("config.rootKey") as string;
        fullPath = `${rootKey}.${path}`;
      }

      try {
        const value = await this.configProvider.getValue(fullPath);

        if (value !== undefined) {
          result = result.replace(fullMatch, String(value));
          continue;
        }

        // Try without the root key as fallback
        if (fullPath !== path) {
          const fallbackValue = await this.configProvider.getValue(path);
          if (fallbackValue !== undefined) {
            result = result.replace(fullMatch, String(fallbackValue));
            continue;
          }
        }

        throw new Error(`Configuration value not found: ${fullPath}`);
      } catch (error) {
        throw new Error(
          `Error resolving configuration reference ${fullMatch}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return result;
  }

  /**
   * Resolve property references in a string
   *
   * @param input - The input string that may contain property references
   * @return The string with all property references replaced with their values
   * @throws Error if a referenced property value is not found
   */
  resolvePropertyValue(input: string): string {
    // Using a more comprehensive regex to find potential property references
    let match;
    let result = input;
    const matches = [];

    // First, find all matches and validate them
    while ((match = /property:[a-zA-Z0-9_$]+/g.exec(input)) !== null) {
      const fullMatch = match[0];

      // Validate the reference format using the exact regex pattern
      if (!/^property:[a-zA-Z0-9_$]+$/.test(fullMatch)) {
        throw new Error(
          `Invalid property reference format: ${fullMatch}. References must follow the pattern 'property:[key]' where key is [a-zA-Z0-9_$]+.`,
        );
      }

      const path = fullMatch.substring(9); // Remove "property:" prefix

      matches.push({
        fullMatch,
        path,
      });
    }

    // Then, process each match
    for (const { fullMatch, path } of matches) {
      if (!this.hasProperty(path)) {
        throw new Error(`Property not found: ${path}`);
      }

      result = result.replace(fullMatch, String(this.getProperty(path)));
    }

    return result;
  }

  /**
   * Resolve configuration and property references in a step parameter
   *
   * @param param - The parameter string that may contain configuration or property references
   * @return The parameter with all references resolved, or the original parameter if it contains no references
   * @throws Error if a referenced configuration or property value is not found
   */
  async resolveStepParameter(param: string): Promise<string> {
    let result = param;

    // First resolve configuration references
    if (this.containsConfigReferences(result)) {
      result = await this.resolveConfigValue(result);
    }

    // Then resolve property references
    if (this.containsPropertyReferences(result)) {
      result = this.resolvePropertyValue(result);
    }

    return result;
  }

  /**
   * Resolve a parameter value
   *
   * Resolves parameter values, handling property references and other special
   * syntax. This is useful for parameterizing tests with values that may be
   * determined at runtime.
   *
   * @param param - The parameter value to resolve
   * @return Promise that resolves to the resolved parameter value
   * @throws Error if a referenced configuration or property value is not found
   */
  async resolveParam(param: unknown): Promise<unknown> {
    // If param is null or undefined, return it as is
    if (param === null || param === undefined) {
      return param;
    }

    // If param is a string, resolve any references
    if (typeof param === "string") {
      return this.resolveStepParameter(param);
    }

    // If param is an array, resolve each element
    if (Array.isArray(param)) {
      const resolvedArray = [];
      for (const item of param) {
        resolvedArray.push(await this.resolveParam(item));
      }
      return resolvedArray;
    }

    // If param is an object, resolve each property
    if (typeof param === "object") {
      const resolvedObject: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(param as Record<string, unknown>)) {
        resolvedObject[key] = await this.resolveParam(value);
      }
      return resolvedObject;
    }

    // For other types (number, boolean, etc.), return as is
    return param;
  }
}

// Register the World constructor with Cucumber
setWorldConstructor(SmokeWorldImpl);
