/**
 * Client configuration module
 * Defines the structure, storage, and management of client configurations
 */
import { ClientType } from "../core";

/**
 * Base client configuration interface
 * All client-specific configurations extend from this interface
 *
 * @property id - Optional unique identifier for the client instance
 * @property enabled - Optional flag to enable/disable the client
 */
export interface ClientConfig extends Record<string, unknown> {
  /** Unique client identifier (defaults to client type if not provided) */
  id?: string;

  /** Whether the client is enabled (defaults to true) */
  enabled?: boolean;
}

/**
 * Registry for managing client configurations
 * Provides methods for registering, retrieving, and querying client configurations
 */
export class ClientRegistry {
  /**
   * Map of client configurations keyed by 'type:id' or just 'type' for default instances
   * Example keys: 'rest', 'mqtt:1', 's3:backup'
   */
  private configs = new Map<string, ClientConfig>();

  /**
   * Register a client configuration
   *
   * @param clientType - The client type (enum or string)
   * @param config - The client-specific configuration object
   * @param id - Optional client identifier (defaults to value in config.id or clientType)
   */
  registerConfig(clientType: ClientType | string, config: ClientConfig, id?: string): void {
    // Normalize type to string
    const typeStr = typeof clientType === "string" ? clientType : clientType;

    // Determine client ID (priority: explicit id param > config.id > type)
    const clientId = id || config.id || typeStr;

    // Create the configuration key
    const key = this.createConfigKey(typeStr, clientId);

    // Store the configuration
    this.configs.set(key, config);
  }

  /**
   * Create a configuration key from type and id
   *
   * @param type - The client type string
   * @param id - The client identifier
   * @returns The configuration key
   */
  private createConfigKey(type: string, id: string): string {
    return id !== type ? `${type}:${id}` : type;
  }

  /**
   * Get a client configuration by type and optional ID
   *
   * @param clientType - The client type (enum or string)
   * @param id - Optional client identifier (defaults to clientType)
   * @returns The client configuration if found, undefined otherwise
   */
  getConfig(clientType: ClientType | string, id?: string): ClientConfig | undefined {
    // Normalize type to string
    const typeStr = typeof clientType === "string" ? clientType : clientType;

    // Determine client ID (priority: explicit id param > type)
    const clientId = id || typeStr;

    // Create the key and retrieve configuration
    const key = this.createConfigKey(typeStr, clientId);
    return this.configs.get(key);
  }

  /**
   * Get all configurations for a specific client type
   * Returns both the default configuration and any named configurations
   *
   * @param clientType - The client type (enum or string)
   * @returns Array of configurations for the client type
   */
  getConfigsByType(clientType: ClientType | string): ClientConfig[] {
    // Normalize type to string
    const typeStr = typeof clientType === "string" ? clientType : clientType;
    const result: ClientConfig[] = [];

    // Add the default client if it exists
    const defaultConfig = this.configs.get(typeStr);
    if (defaultConfig) {
      result.push(defaultConfig);
    }

    // Generate the prefix for specific IDs
    const prefix = `${typeStr}:`;

    // Add any clients with specific IDs
    for (const [key, config] of this.configs.entries()) {
      if (key !== typeStr && key.startsWith(prefix)) {
        result.push(config);
      }
    }

    return result;
  }

  /**
   * Check if a configuration exists for a client type and optional ID
   *
   * @param clientType - The client type (enum or string)
   * @param id - Optional client identifier (defaults to clientType)
   * @returns True if the configuration exists, false otherwise
   */
  hasConfig(clientType: ClientType | string, id?: string): boolean {
    // Normalize type to string
    const typeStr = typeof clientType === "string" ? clientType : clientType;

    // Determine client ID (priority: explicit id param > type)
    const clientId = id || typeStr;

    // Create the key and check if configuration exists
    const key = this.createConfigKey(typeStr, clientId);
    return this.configs.has(key);
  }

  /**
   * Get all registered configurations as a Map
   * Creates a new Map instance to avoid external modification
   *
   * @returns A copy of the internal configuration map
   */
  getAllConfigs(): Map<string, ClientConfig> {
    return new Map(this.configs);
  }

  /**
   * Bulk register configurations from a configuration object
   * Supports both single configurations and arrays of configurations
   *
   * @param config - Object containing client configurations
   */
  registerConfigs(config: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(config)) {
      // Parse client type and ID from the key
      const [clientType, clientId] = key.includes(":") ? key.split(":") : [key, undefined];

      // Handle array of configurations
      if (Array.isArray(value)) {
        this.registerConfigArray(clientType, value as ClientConfig[]);
      }
      // Handle single configuration object
      else if (typeof value === "object" && value !== null) {
        this.registerConfig(clientType, value as ClientConfig, clientId);
      }
    }
  }

  /**
   * Register an array of configurations for a single client type
   * Automatically assigns IDs to configurations based on position if not specified
   *
   * @param clientType - The client type (enum or string)
   * @param configs - Array of client configurations
   */
  registerConfigArray(clientType: ClientType | string, configs: ClientConfig[]): void {
    // Process each configuration with automatic ID assignment
    configs.forEach((config, index) => {
      // Only assign numeric ID if not first item and no ID specified
      const id = config.id || (index > 0 ? `${index + 1}` : undefined);
      this.registerConfig(clientType, config, id as string);
    });
  }
}

/**
 * Create a client registry from a configuration object
 * @param config Client configurations
 * @returns A new client registry
 */
export function createClientRegistryFromConfig(config: Record<string, unknown>): ClientRegistry {
  const registry = new ClientRegistry();

  // Process client configurations from config
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "object" && value !== null) {
      // Check if this is a client configuration array
      if (Array.isArray(value)) {
        // Handle array of client configurations (multiple clients of same type)
        for (const clientConfig of value) {
          if (typeof clientConfig === "object" && clientConfig !== null) {
            const config = clientConfig as Record<string, unknown>;
            const id = (config.id as string) || undefined;
            registry.registerConfig(key, config as ClientConfig, id);
          }
        }
      } else {
        // Handle single client configuration
        registry.registerConfig(key, value as ClientConfig);
      }
    }
  }

  return registry;
}

// Export the client factory functionality with a shorter alias
export const createClientRegistry = createClientRegistryFromConfig;
