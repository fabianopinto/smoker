/**
 * Configuration Module
 *
 * This module provides a comprehensive configuration management system based on a factory pattern.
 * It defines the core interfaces, types, and classes for working with application configuration.
 *
 * Key features:
 * - Type-safe configuration access with dot-notation paths
 * - Automatic resolution of SSM parameters and S3 references
 * - Immutable configuration objects after creation
 * - Global configuration instance for application-wide access
 * - Support for hierarchical configuration with nested objects
 *
 * The module implements a factory pattern for configuration creation and provides
 * helper functions for common configuration operations.
 */

import { ERR_CONFIG_MISSING, SmokerError } from "../../errors";
import { BaseLogger } from "../../lib/logger";
import { S3ClientWrapper, SSMClientWrapper } from "../aws";
import { ConfigurationFactory } from "./config-factory";

// Create a logger instance for this module
const logger = new BaseLogger({ name: "smoker:configuration" });

/**
 * Configuration provider interface for accessing configuration values
 *
 * Defines the contract for accessing configuration values by key path. This interface
 * abstracts the details of configuration storage and resolution, allowing for
 * different implementations and easier testing through mocking.
 *
 * The interface supports asynchronous value retrieval to accommodate automatic
 * resolution of external references like SSM parameters and S3 objects.
 */
export interface ConfigurationProvider {
  getValue<T extends ConfigValue>(keyPath: string, defaultValue?: T): Promise<T | undefined>;
}

/**
 * ConfigValue type
 *
 * Represents any type of value that can be stored in the configuration system.
 * This union type allows for flexibility in configuration data types while
 * maintaining type safety throughout the application.
 *
 * Supported types include:
 * - Primitive values (string, number, boolean)
 * - Nested objects (ConfigObject)
 * - Arrays of any ConfigValue
 * - null (to explicitly indicate absence of a value)
 */
export type ConfigValue = string | number | boolean | ConfigObject | ConfigValue[] | null;

/**
 * ConfigObject interface
 *
 * Represents a nested configuration object with string keys and ConfigValue values.
 * This interface enables complex configuration hierarchies with arbitrary nesting depth,
 * allowing for organized and structured configuration data.
 *
 * The interface uses an index signature to support dynamic property access while
 * maintaining type safety for the values stored in the configuration object.
 */
export interface ConfigObject {
  [key: string]: ConfigValue;
}

/**
 * SmokeConfig type
 *
 * Defines the structure for the application's configuration object. This type
 * represents the root configuration object that contains all application settings.
 *
 * The type is defined as a Record with string keys and ConfigValue values, allowing
 * for flexible extension with additional properties while maintaining type safety.
 * This approach enables dynamic access to configuration properties without requiring
 * explicit interface updates for each new property.
 */
export type SmokeConfig = Record<string, ConfigValue>;

/**
 * Configuration class for managing application configuration
 *
 * This class provides a centralized location for all configurable parameters and
 * implements the ConfigurationProvider interface. It manages access to configuration
 * values with support for automatic resolution of external references.
 *
 * Features include dot-notation path access to nested values, automatic resolution
 * of SSM parameters and S3 references, and type-safe access to configuration values.
 *
 * The configuration is immutable after creation and can only be built
 * using the ConfigurationFactory.
 *
 * @implements {ConfigurationProvider}
 */
export class Configuration {
  /**
   * Singleton instance of the configuration
   *
   * @private
   */
  private static instance: Configuration | null = null;

  /**
   * Get the global configuration instance
   *
   * If the instance doesn't exist yet, it will throw an error as the configuration
   * must be explicitly initialized before use with initializeGlobalInstance.
   *
   * @return The global configuration instance
   * @throws {SmokerError} if the configuration has not been initialized
   *
   * @example
   * // Get the global configuration and access a value
   * const config = Configuration.getInstance();
   * const value = await config.getValue("api.timeout");
   */
  public static getInstance(): Configuration {
    if (Configuration.instance === null) {
      throw new SmokerError("Global configuration is not initialized", {
        code: ERR_CONFIG_MISSING,
        domain: "config",
        details: { component: "configuration", source: "Configuration.getInstance" },
        retryable: false,
      });
    }
    return Configuration.instance;
  }

  /**
   * Reset the global configuration instance
   *
   * Sets the global configuration instance to the provided configuration or clears it.
   * This is useful for testing scenarios or when reinitializing the application.
   *
   * @param newInstance - Optional new configuration instance to set as global
   *
   * @example
   * // Reset the global configuration
   * Configuration.resetInstance();
   *
   * @example
   * // Set a new configuration as the global instance
   * const newConfig = await new ConfigurationFactory()
   *   .addFile("new-config.json")
   *   .build();
   * Configuration.resetInstance(newConfig);
   */
  public static resetInstance(newInstance?: Configuration): void {
    Configuration.instance = newInstance || null;
  }

  /**
   * Initialize the global configuration instance
   *
   * Sets the global configuration instance to the provided configuration.
   * If a global configuration already exists, it will be overwritten with a warning.
   * This method is part of the factory pattern implementation for configuration management.
   *
   * @param config - The configuration instance to set as global
   *
   * @example
   * // Create a configuration and set it as global
   * const config = await new ConfigurationFactory()
   *   .addFile("config.json")
   *   .build(false); // Don't set as global automatically
   * Configuration.initializeGlobalInstance(config);
   */
  public static initializeGlobalInstance(config: Configuration): void {
    if (Configuration.instance !== null) {
      logger.warn("Global configuration is already initialized, overwriting");
    }
    Configuration.instance = config;
  }

  private readonly config: SmokeConfig;

  /**
   * Create a new configuration instance with the provided config object
   *
   * @param config - The configuration object
   */
  constructor(config: SmokeConfig) {
    this.config = { ...config };
  }

  /**
   * Get the current configuration
   *
   * @return A copy of the current configuration
   */
  public getConfig(): SmokeConfig {
    return { ...this.config };
  }

  /**
   * Get a configuration value by key path and resolve any SSM or S3 references
   *
   * This function supports automatic resolution of references to external resources:
   * - SSM parameters: Values starting with "ssm://" will be resolved from AWS SSM Parameter Store
   * - S3 objects: Values starting with "s3://" will be retrieved from AWS S3
   *   - JSON files (ending with .json) will be automatically parsed and set in the configuration
   *   - Other file types will be returned as strings in the configuration value
   *
   * @template T - The type of the configuration value to retrieve
   * @param keyPath - Dot-separated path to the configuration value (e.g. "aws.region")
   * @param defaultValue - Default value to return if the key is not found or resolution fails
   * @return Promise resolving to the configuration value at the specified key path
   *
   * @example
   * // Retrieve a regular configuration value
   * const region = await config.getValue("aws.region");
   *
   * @example
   * // Retrieve and resolve an SSM parameter reference
   * // Configuration contains: { "apiKey": "ssm://my/secret/api-key" }
   * const apiKey = await config.getValue("apiKey"); // Returns the actual SSM parameter value
   *
   * @example
   * // Retrieve and parse a JSON file from S3
   * // Configuration contains: { "settings": "s3://my-bucket/config/settings.json" }
   * const settings = await config.getValue("settings"); // Returns the parsed JSON object
   */
  public async getValue<T extends ConfigValue>(
    keyPath: string,
    defaultValue?: T,
  ): Promise<T | undefined> {
    // Validate keyPath format
    if (!this.isValidKeyPath(keyPath)) {
      logger.error(`Invalid key path format: ${keyPath}. Must match [a-zA-Z0-9_$.]+`);
      return defaultValue;
    }

    const keys = keyPath.split(".");
    let value: ConfigValue = this.config;

    // Navigate through the configuration object using the key path
    for (const key of keys) {
      if (
        value === null ||
        typeof value !== "object" ||
        !Object.prototype.hasOwnProperty.call(value, key)
      ) {
        return defaultValue;
      }
      value = (value as ConfigObject)[key];
    }

    // If the value is a string, check for SSM or S3 references
    if (typeof value === "string") {
      // Handle SSM references (ssm://path/to/parameter)
      if (value.startsWith("ssm://")) {
        return await this.resolveSSMReference(value, defaultValue);
      }

      // Handle S3 references (s3://bucket/path/to/file)
      if (value.startsWith("s3://")) {
        return await this.resolveS3Reference(value, defaultValue);
      }
    }

    return value as T;
  }

  /**
   * Validate that a key path matches the required format [a-zA-Z0-9_$]+
   *
   * @param keyPath - The key path to validate
   * @return True if the key path is valid, false otherwise
   * @private
   */
  private isValidKeyPath(keyPath: string): boolean {
    // Each segment of the key path must match the pattern
    const keySegments = keyPath.split(".");
    return keySegments.every((segment) => /^[a-zA-Z0-9_$]+$/.test(segment));
  }

  /**
   * Resolve an SSM parameter reference
   *
   * @param reference - The SSM reference string (e.g., "ssm://path/to/parameter")
   * @param defaultValue - Default value to return if resolution fails
   * @return The resolved parameter value or the default value
   * @private
   */
  private async resolveSSMReference<T extends ConfigValue>(
    reference: string,
    defaultValue?: T,
  ): Promise<T | undefined> {
    try {
      const parameterName = reference.substring(6); // Remove "ssm://" prefix
      const ssmClient = new SSMClientWrapper();
      return (await ssmClient.getParameter(parameterName)) as unknown as T;
    } catch (error) {
      logger.error(
        error instanceof Error ? error : String(error),
        `Error resolving SSM parameter reference ${reference}`,
      );
      return defaultValue;
    }
  }

  /**
   * Resolve an S3 reference
   *
   * @param reference - The S3 reference string (e.g., "s3://bucket/path/to/file.json")
   * @param defaultValue - Default value to return if resolution fails
   * @return The resolved S3 content (parsed if JSON, string otherwise) or the default value
   * @private
   */
  private async resolveS3Reference<T extends ConfigValue>(
    reference: string,
    defaultValue?: T,
  ): Promise<T | undefined> {
    try {
      const s3Client = new S3ClientWrapper();
      const content = await s3Client.getContentFromUrl(reference);

      // If it's a JSON file, return the parsed content
      if (reference.toLowerCase().endsWith(".json")) {
        return content as unknown as T;
      }

      // For non-JSON files, ensure we're returning a string
      return String(content) as unknown as T;
    } catch (error) {
      logger.error(
        error instanceof Error ? error : String(error),
        `Error resolving S3 reference ${reference}`,
      );
      return defaultValue;
    }
  }
}

/**
 * Create a configuration from multiple file paths or S3 URLs
 *
 * Helper function that creates a ConfigurationFactory, adds file paths,
 * and builds a Configuration object. Part of the factory pattern implementation.
 *
 * @param filePaths - Array of file paths or S3 URLs to load
 * @param setAsGlobal - Whether to set the configuration as global (default: true)
 * @return Promise resolving to a new Configuration object
 */
export async function createConfiguration(
  filePaths: string[],
  setAsGlobal = true,
): Promise<Configuration> {
  const factory = new ConfigurationFactory();

  filePaths.forEach((path) => factory.addFile(path));

  const config = await factory.build();

  // Automatically set as global configuration unless explicitly disabled
  if (setAsGlobal) {
    Configuration.initializeGlobalInstance(config);
  }

  return config;
}

/**
 * Create a configuration from an object
 *
 * Helper function that creates a ConfigurationFactory, adds a configuration object,
 * and builds a Configuration object. Part of the factory pattern implementation.
 *
 * @param configObject - Configuration object to use as the source
 * @param setAsGlobal - Whether to set the configuration as global (default: true)
 * @return Promise resolving to a new Configuration object
 */
export async function createConfigurationFromObject(
  configObject: ConfigObject,
  setAsGlobal = true,
): Promise<Configuration> {
  const factory = new ConfigurationFactory();

  factory.addObject(configObject);

  const config = await factory.build();

  // Automatically set as global configuration unless explicitly disabled
  if (setAsGlobal) {
    Configuration.initializeGlobalInstance(config);
  }

  return config;
}
