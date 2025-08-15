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

import {
  World as CucumberWorld,
  type IWorld,
  type IWorldOptions,
  setWorldConstructor,
} from "@cucumber/cucumber";
import { ClientType, type ServiceClient } from "../clients/core";
import { type ClientConfig, ClientFactory, ClientRegistry } from "../clients/registry";
import { ERR_CONFIG_MISSING, ERR_CONFIG_PARSE, ERR_VALIDATION, SmokerError } from "../errors";
import { type ConfigurationProvider, DefaultConfigurationProvider } from "../support/config";
import { createWorldProperties, WorldProperties } from "./world-properties";

/**
 * SmokeWorld interface
 *
 * Extends Cucumber World with client management and test helpers. This interface
 * defines the contract for the test world, providing methods to access specific
 * client types, manage client registration, and handle client lifecycle operations.
 *
 * The SmokeWorld serves as the central context for test execution, providing:
 * - Access to service clients (AWS, HTTP, messaging services) via `getClient`
 * - Client lifecycle management (initialization, reset, destruction)
 * - Test data storage and retrieval
 * - Property management for storing and accessing test state
 * - Parameter resolution for configuration and property references
 *
 * @template T - The type parameter for the world, used to extend the Cucumber World
 * @extends {IWorld<T>}
 */
export interface SmokeWorld<T = unknown> extends IWorld<T> {
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
   * @throws {SmokerError} if no client is registered with the given name
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
   * @throws {SmokerError} if any client initialization fails
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
   * @throws {SmokerError} if any client reset fails
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
   * @throws {SmokerError} if any client destruction fails
   *
   * @example
   * // Clean up after tests are complete
   * await world.destroyClients();
   */
  destroyClients(): Promise<void>;

  /**
   * Property Management Methods
   *
   * These methods provide functionality for storing and retrieving properties
   * in a flat structure. They are useful for sharing state between test steps
   * and for parameterizing tests.
   */

  /**
   * Set a property value with the specified key
   *
   * Stores a value in the property map with the specified key. The key is a string
   * that uniquely identifies the property. The value can be a primitive, array, or plain object.
   *
   * @param key - The key to store the value under
   * @param value - The value to store (primitive, array, or plain object)
   *
   * @example
   * // Store a simple value
   * world.setProperty("userId", 123);
   *
   * // Store a complex object
   * world.setProperty("apiConfig", {
   *   baseUrl: "https://api.example.com",
   *   timeout: 5000
   * });
   */
  setProperty(key: string, value: unknown): void;

  /**
   * Get a property value by key
   *
   * Retrieves a value from the property map with the specified key. If the property
   * doesn't exist, returns the default value if provided, or undefined otherwise.
   *
   * @template T - The expected type of the property value
   * @param key - The key of the property to retrieve
   * @param defaultValue - Optional default value to return if the property doesn't exist
   * @return The property value, the default value if not found, or undefined
   *
   * @example
   * // Get a simple value
   * const userId = world.getProperty<number>("userId");
   *
   * // Get a complex object with default value
   * const apiConfig = world.getProperty<ApiConfig>("apiConfig", {
   *   baseUrl: "https://default.com"
   * });
   */
  getProperty<T = unknown>(key: string, defaultValue?: T): T | undefined;

  /**
   * Check if a property exists with the specified key
   *
   * Verifies whether a property exists in the property map with the specified key.
   *
   * @param key - The key to check
   * @return True if the property exists, false otherwise
   *
   * @example
   * // Check if a property exists before using it
   * if (world.hasProperty("userPreferences")) {
   *   const preferences = world.getProperty("userPreferences");
   *   // Use preferences...
   * }
   */
  hasProperty(key: string): boolean;

  /**
   * Delete a property with the specified key
   *
   * Removes a property from the property map with the specified key.
   *
   * @param key - The key of the property to delete
   *
   * @example
   * // Delete a property that's no longer needed
   * world.deleteProperty("temporaryData");
   */
  deleteProperty(key: string): void;

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

  /**
   * Check if a string is a property reference
   *
   * @param input - The input string to check
   * @return True if the string is a property reference, false otherwise
   */
  isPropertyReference(input: string): boolean;

  /**
   * Get the WorldProperties instance
   *
   * @return The WorldProperties instance used by this world
   */
  getWorldProperties(): WorldProperties;
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
 * @template T - The type parameter for the world, used to extend the Cucumber World
 * @extends {CucumberWorld<T>}
 * @implements {SmokeWorld<T>}
 */
export class SmokeWorldImpl<T = unknown> extends CucumberWorld<T> implements SmokeWorld<T> {
  // Registry for all service clients
  private clients = new Map<string, ServiceClient>();

  // Client configuration and factory
  private clientRegistry: ClientRegistry;
  private clientFactory: ClientFactory;

  // WorldProperties instance for property management
  private worldProperties: WorldProperties;

  // Configuration provider for resolving config values
  private configProvider: ConfigurationProvider;

  /**
   * Create a new SmokeWorld instance
   *
   * @param options - Cucumber World constructor options
   * @param config - Optional initial configuration
   * @param injectedRegistry - Optional client registry for dependency injection
   * @param injectedFactory - Optional client factory for dependency injection
   * @param injectedConfigProvider - Optional configuration provider for dependency injection
   */
  constructor(
    options: IWorldOptions,
    config?: Record<string, unknown>,
    injectedRegistry?: ClientRegistry,
    injectedFactory?: ClientFactory,
    injectedConfigProvider?: ConfigurationProvider,
  ) {
    super(options);

    // Initialize client registry and factory with injected or new instances
    this.clientRegistry = injectedRegistry || new ClientRegistry();
    this.clientFactory =
      injectedFactory ||
      (injectedRegistry
        ? new ClientFactory(injectedRegistry)
        : new ClientFactory(this.clientRegistry));

    // Initialize configuration provider
    this.configProvider = injectedConfigProvider || new DefaultConfigurationProvider();

    // Initialize WorldProperties instance
    this.worldProperties = createWorldProperties();

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
   * @throws {SmokerError} if the client does not exist
   */
  getClient<T extends ServiceClient = ServiceClient>(name: string): T {
    const client = this.clients.get(name);
    if (!client) {
      throw new SmokerError("Client not found", {
        code: ERR_VALIDATION,
        domain: "world",
        details: { component: "world", clientName: name },
        retryable: false,
      });
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
   * Set a property value with the specified key
   *
   * Stores a value in the property map with the specified key. The value can be
   * a primitive, array, or plain object.
   *
   * @param key - The key to store the value under
   * @param value - The value to store (primitive, array, or plain object)
   * @throws {SmokerError} if the key is empty or contains invalid characters
   */
  setProperty(key: string, value: unknown): void {
    // Delegate to WorldProperties instance
    this.worldProperties.set(key, value);
  }

  /**
   * Get a property value by key
   *
   * @template T - The expected type of the property value
   * @param key - The key of the property to retrieve
   * @param defaultValue - The default value to return if the property doesn't exist
   * @throws {SmokerError} if the key is empty or contains invalid characters
   * @return The property value, or the default value if the property doesn't exist
   */
  getProperty<T = unknown>(key: string, defaultValue?: T): T | undefined {
    // Delegate to WorldProperties instance
    return this.worldProperties.get(key, defaultValue);
  }

  /**
   * Check if a property exists with the specified key
   *
   * @param key - The key of the property to check
   * @throws {SmokerError} if the key is empty or contains invalid characters
   * @return True if the property exists, false otherwise
   */
  hasProperty(key: string): boolean {
    // Delegate to WorldProperties instance
    return this.worldProperties.has(key);
  }

  /**
   * Delete a property with the specified key
   *
   * @param key - The key of the property to delete
   * @throws {SmokerError} if the key is empty or contains invalid characters
   * @throws {SmokerError} if the property doesn't exist
   */
  deleteProperty(key: string): void {
    // Check if property exists before attempting deletion
    if (!this.hasProperty(key)) {
      throw new SmokerError(`Property not found: ${key}`, {
        code: ERR_VALIDATION,
        domain: "world",
        details: { component: "world", key },
        retryable: false,
      });
    }

    // Delegate to WorldProperties instance
    this.worldProperties.delete(key);
  }

  /**
   * Resolve a configuration reference
   *
   * @param input - The input string that may be a configuration reference
   * @return The configuration value if input is a configuration reference, or the original string if not
   * @throws {SmokerError} if input is a configuration reference but the configuration value is not found
   */
  async resolveConfigValue(input: string): Promise<string> {
    // Define the pattern to find configuration references
    const configPattern = /config:([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)/g;

    // If the input is exactly a config reference, resolve it directly
    if (input.startsWith("config:") && !input.includes(" ")) {
      const exactPattern = /^config:([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)$/;
      const match = exactPattern.exec(input);

      if (!match) {
        throw new SmokerError("Invalid configuration reference format", {
          code: ERR_VALIDATION,
          domain: "world",
          details: {
            component: "world",
            input,
            pattern: "config:[segment](.[segment])*, where segment matches [a-zA-Z0-9_$]+",
          },
          retryable: false,
        });
      }

      const configPath = match[1];
      return this.getConfigValue(configPath);
    }

    // For strings with embedded config references, process each match
    const matches = input.match(configPattern);
    if (matches && matches.length > 0) {
      let result = input;

      // Process each config reference sequentially
      for (const match of matches) {
        const pathMatch = /config:([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)/.exec(match);
        if (pathMatch) {
          const configPath = pathMatch[1];
          // Get the configuration value and replace the reference
          const value = await this.getConfigValue(configPath);
          // Replace the config reference with its value
          result = result.replace(match, value);
        }
      }

      return result;
    }

    // If no config references found, return the original input
    return input;
  }

  /**
   * Helper method to get a configuration value
   *
   * @param configPath - Path to the configuration value
   * @returns The configuration value as a string
   * @throws {SmokerError} if the configuration value is not found
   */
  private async getConfigValue(configPath: string): Promise<string> {
    try {
      const value = await this.configProvider.getValue(configPath);

      if (value !== undefined) {
        return String(value);
      }

      throw new SmokerError("Configuration value not found", {
        code: ERR_CONFIG_MISSING,
        domain: "config",
        details: { component: "configuration", path: configPath },
        retryable: false,
      });
    } catch (error: unknown) {
      if (SmokerError.isSmokerError(error)) {
        // Re-throw structured errors directly (including ERR_CONFIG_MISSING)
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SmokerError("Failed to resolve configuration reference", {
        code: ERR_CONFIG_PARSE,
        domain: "config",
        details: { component: "configuration", reason: errorMessage },
        retryable: false,
        cause: error,
      });
    }
  }

  /**
   * Check if a string is a property reference
   *
   * @param input - The input string to check
   * @return True if the string is a property reference, false otherwise
   */
  isPropertyReference(input: string): boolean {
    return this.worldProperties.isPropertyReference(input);
  }

  /**
   * Get the WorldProperties instance
   *
   * @return The WorldProperties instance used by this world
   */
  getWorldProperties(): WorldProperties {
    return this.worldProperties;
  }

  /**
   * Resolve property references in a string
   *
   * @param input - The input string that may be a property reference
   * @return The property value if input is a property reference, or the original string if not
   * @throws {SmokerError} if input is a property reference but the property is not found
   */
  resolvePropertyValue(input: string): string {
    // Delegate to WorldProperties instance
    return this.worldProperties.resolvePropertyValue(input);
  }

  /**
   * Resolve configuration and property references in a step parameter
   *
   * @param param - The parameter string that may contain configuration or property references
   * @return The parameter with all references resolved, or the original parameter if it contains no references
   * @throws {SmokerError} if a referenced configuration or property value is not found
   */
  async resolveStepParameter(param: string): Promise<string> {
    let result = param;

    // First resolve configuration references
    if (/config:[a-zA-Z0-9_$.]+/g.test(result)) {
      result = await this.resolveConfigValue(result);
    }

    // Then resolve property references using WorldProperties.isPropertyReference
    if (this.isPropertyReference(result)) {
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
   * @throws {SmokerError} if a referenced configuration or property value is not found
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
