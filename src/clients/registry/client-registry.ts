/**
 * Client Registry Module
 *
 * This module provides a registry for client configurations, allowing
 * client instances to be created with consistent settings. It implements
 * a singleton pattern for global configuration access and supports
 * storing and retrieving configurations by client type and optional ID.
 *
 * The registry uses immutable configuration objects to prevent runtime
 * modifications and provides type-safe access to client settings.
 */

import { ClientType } from "../core";

/**
 * Deep readonly utility type
 *
 * Makes all properties and nested properties of T readonly, ensuring that
 * objects cannot be mutated at any level of nesting. This provides stronger
 * immutability guarantees than TypeScript's built-in Readonly utility type.
 *
 * The type recursively applies readonly modifiers to arrays, objects, and their
 * nested properties while preserving function types as-is. This creates truly
 * immutable data structures that prevent accidental mutations throughout the
 * application, enhancing type safety and reducing runtime errors.
 *
 * @template T - The type to make deeply readonly
 * @return A type where all properties and nested properties are readonly
 */
type DeepReadonly<T> = T extends (infer R)[]
  ? readonly DeepReadonly<R>[]
  : T extends (...args: unknown[]) => unknown
    ? T
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

/**
 * Client configuration type
 *
 * Represents the configuration object for a service client. This flexible type
 * allows for different configuration properties depending on the client type.
 * Each client implementation can define its own expected configuration structure.
 *
 * @example
 * // AWS S3 client configuration
 * const s3Config: ClientConfig = {
 *   region: "us-east-1",
 *   bucket: "my-data-bucket",
 *   endpoint: "https://s3.amazonaws.com"
 * };
 */
export type ClientConfig = Record<string, unknown>;

/**
 * Readonly client configuration type
 *
 * A deeply immutable version of ClientConfig that ensures configuration values
 * cannot be mutated at runtime. This type is used for returning configurations
 * to prevent accidental modifications after retrieval.
 *
 * @see {ClientConfig} The base configuration type
 * @see {DeepReadonly} The utility type used to create immutable objects
 */
export type ReadonlyClientConfig = DeepReadonly<ClientConfig>;

/**
 * Client registry implementation
 *
 * Manages client configurations by type and ID. This class provides functionality for
 * storing, retrieving, and managing client configurations. It ensures that returned
 * configurations are immutable to prevent unexpected modifications.
 *
 * This class implements the singleton pattern, providing a global instance accessible
 * via the static getInstance() method. It can also be instantiated directly for
 * scenarios requiring multiple isolated registries.
 *
 * @see {ClientRegistry.getInstance} Method to access the global registry instance
 * @see {ClientRegistry.resetInstance} Method to reset the global registry instance
 */
export class ClientRegistry {
  /**
   * Singleton instance of the client registry
   *
   * @private
   */
  private static instance: ClientRegistry | null = null;

  /**
   * Get the global singleton instance of the client registry
   *
   * If the instance doesn't exist yet, it will be created automatically.
   * This provides a true singleton pattern for accessing the global registry.
   *
   * @return The global singleton instance of the client registry
   *
   * @example
   * // Get the global registry and register a configuration
   * const registry = ClientRegistry.getInstance();
   * registry.registerConfig(ClientType.REST, { baseUrl: "https://api.example.com" });
   */
  public static getInstance(): ClientRegistry {
    if (ClientRegistry.instance === null) {
      ClientRegistry.instance = new ClientRegistry();
    }
    return ClientRegistry.instance;
  }

  /**
   * Reset the global singleton instance
   *
   * Clears the current singleton instance, allowing a new one to be created
   * on the next call to getInstance(). This is primarily useful for testing
   * or when completely resetting the application state.
   *
   * @param newInstance - Optional new instance to set as the singleton
   *
   * @example
   * // Reset the global registry to a clean state
   * ClientRegistry.resetInstance();
   *
   * // Reset and provide a pre-configured instance
   * const newRegistry = new ClientRegistry();
   * newRegistry.registerConfig(ClientType.S3, { region: "us-east-1" });
   * ClientRegistry.resetInstance(newRegistry);
   */
  public static resetInstance(newInstance?: ClientRegistry): void {
    if (newInstance) {
      ClientRegistry.instance = newInstance;
    } else {
      ClientRegistry.instance = null;
    }
  }

  /**
   * Map of client configurations
   * Key format: "type:id" or just "type" if no ID
   */
  private readonly configs: Map<string, ClientConfig> = new Map<string, ClientConfig>();

  /**
   * Register a client configuration
   *
   * Stores a configuration for a specific client type and optional ID.
   * The configuration is deep-copied to ensure immutability of the stored data.
   *
   * @param clientType - The type of client (REST, MQTT, etc.)
   * @param config - Configuration object for the client
   * @param id - Optional client identifier
   *
   * @example
   * // Register a configuration for an S3 client
   * registry.registerConfig(ClientType.S3, {
   *   region: "us-east-1",
   *   bucket: "my-data-bucket"
   * });
   *
   * // Register a configuration for a specific S3 client instance
   * registry.registerConfig(ClientType.S3, {
   *   region: "eu-west-1",
   *   bucket: "europe-data-bucket"
   * }, "europe");
   */
  registerConfig(clientType: ClientType | string, config: ClientConfig, id?: string): void {
    const key = this.getConfigKey(clientType, id);
    // Create a deep copy to ensure immutability of the stored configuration
    this.configs.set(key, JSON.parse(JSON.stringify(config)));
  }

  /**
   * Register multiple client configurations at once
   *
   * Processes a configuration object with client types as keys. The key format
   * can be either just the client type or "type:id" to specify a client ID.
   * Non-object values in the configs object are skipped.
   *
   * @param configs - Object mapping client types to their configurations
   *
   * @example
   * // Register multiple client configurations at once
   * registry.registerConfigs({
   *   "rest": { baseUrl: "https://api.example.com" },
   *   "s3": { region: "us-east-1", bucket: "default-bucket" },
   *   "s3:backup": { region: "us-west-1", bucket: "backup-bucket" }
   * });
   */
  registerConfigs(configs: Record<string, unknown>): void {
    if (!configs || typeof configs !== "object") {
      return;
    }

    // Process each key in the configs object
    Object.entries(configs).forEach(([key, value]) => {
      // Skip non-object values
      if (!value || typeof value !== "object") {
        return;
      }

      // Check if the key contains a client ID (format: "type:id")
      const [clientType, id] = key.split(":");

      // Register the configuration
      this.registerConfig(clientType, value as ClientConfig, id);
    });
  }

  /**
   * Get a client configuration by type and optional ID
   *
   * Retrieves a configuration for a specific client type and optional ID.
   * If a configuration with the specific ID is not found, it will fall back
   * to the default configuration for that client type. Returns a deep readonly
   * copy of the configuration to prevent mutations.
   *
   * @param clientType - The type of client
   * @param id - Optional client identifier
   * @return The readonly client configuration or undefined if not found
   *
   * @example
   * // Get the default S3 client configuration
   * const s3Config = registry.getConfig(ClientType.S3);
   *
   * // Get a specific S3 client configuration
   * const europeS3Config = registry.getConfig(ClientType.S3, "europe");
   */
  getConfig(clientType: ClientType | string, id?: string): ReadonlyClientConfig | undefined {
    const key = this.getConfigKey(clientType, id);

    // Try to get config with the specific ID first
    const config = this.configs.get(key);
    if (config) {
      // Return a deep copy as readonly to prevent mutations
      return Object.freeze(JSON.parse(JSON.stringify(config))) as ReadonlyClientConfig;
    }

    // If ID was provided but not found, fall back to default config for the type
    if (id) {
      const defaultKey = this.getConfigKey(clientType);
      const defaultConfig = this.configs.get(defaultKey);
      if (defaultConfig) {
        // Return a deep copy as readonly to prevent mutations
        return Object.freeze(JSON.parse(JSON.stringify(defaultConfig))) as ReadonlyClientConfig;
      }
    }

    // No configuration found
    return undefined;
  }

  /**
   * Check if a configuration exists for a client
   *
   * Verifies whether a configuration exists for the specified client type
   * and optional ID. This method can be used to check availability before
   * attempting to retrieve a configuration.
   *
   * @param clientType - The type of client
   * @param id - Optional client identifier
   * @return True if a configuration exists, false otherwise
   *
   * @example
   * // Check if a specific client configuration exists
   * if (registry.hasConfig(ClientType.REST, "api-v2")) {
   *   const config = registry.getConfig(ClientType.REST, "api-v2");
   *   // Use the configuration...
   * }
   */
  hasConfig(clientType: ClientType | string, id?: string): boolean {
    const key = this.getConfigKey(clientType, id);
    return this.configs.has(key);
  }

  /**
   * Get all registered configurations
   *
   * Retrieves all configurations currently stored in the registry as a readonly map.
   * The map keys are in the format "type:id" or just "type" if no ID was specified.
   * All configuration objects are returned as deeply readonly to prevent mutations.
   *
   * @return A readonly map of all configurations
   *
   * @example
   * // Get all registered configurations
   * const allConfigs = registry.getAllConfigs();
   *
   * // Iterate through all configurations
   * allConfigs.forEach((config, key) => {
   *   console.log(`Configuration for ${key}:`, config);
   * });
   */
  getAllConfigs(): ReadonlyMap<string, ReadonlyClientConfig> {
    const readonlyConfigs = new Map<string, ReadonlyClientConfig>();

    this.configs.forEach((config, key) => {
      readonlyConfigs.set(
        key,
        Object.freeze(JSON.parse(JSON.stringify(config))) as ReadonlyClientConfig,
      );
    });

    return readonlyConfigs;
  }

  /**
   * Clear all registered configurations
   *
   * Removes all configurations from the registry. This is useful for resetting
   * the registry to a clean state, typically during testing or when reinitializing
   * the application with a new set of configurations.
   *
   * @example
   * // Reset the registry to a clean state
   * registry.clearConfigs();
   *
   * // Then register new configurations
   * registry.registerConfig(ClientType.REST, { baseUrl: "https://new-api.example.com" });
   */
  clearConfigs(): void {
    this.configs.clear();
  }

  /**
   * Generate a configuration key from client type and optional ID
   *
   * Creates a string key for storing and retrieving configurations in the internal map.
   * The key format is "type:id" when an ID is provided, or just "type" otherwise.
   * This method ensures consistent key generation across all registry operations.
   *
   * @param clientType - The type of client
   * @param id - Optional client identifier
   * @return The configuration key in the format "type:id" or "type"
   * @private
   */
  private getConfigKey(clientType: ClientType | string, id?: string): string {
    // Ensure we have a string representation regardless of input type
    const type = String(clientType);
    return id ? `${type}:${id}` : type;
  }
}
