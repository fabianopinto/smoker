/**
 * Configuration Factory Module
 *
 * This module provides a factory pattern implementation for building configuration objects
 * from multiple sources. It centralizes configuration management and supports loading from
 * files, S3, and in-memory objects with automatic merging of values.
 *
 * Key features:
 * - Fluent API for configuration setup
 * - Support for local files, S3 objects, and in-memory objects
 * - Automatic source detection and loading
 * - Deep merging of configuration values
 * - Error handling for individual sources
 * - Integration with the global configuration singleton
 *
 * Configuration objects created by this factory are immutable after creation,
 * ensuring consistency throughout the application lifecycle.
 */

import { resolve } from "node:path";
import { deepMerge } from "./config-merger";
import {
  type ConfigurationSource,
  FileConfigurationSource,
  ObjectConfigurationSource,
  S3ConfigurationSource,
} from "./config-source";
import {
  type ConfigObject,
  Configuration,
  type ConfigValue,
  type SmokeConfig,
} from "./configuration";

/**
 * Factory for building Configuration objects
 *
 * This class implements the factory pattern for creating configuration objects from
 * multiple sources. It provides a fluent API for adding configuration sources and
 * building immutable Configuration instances.
 *
 * Key features:
 * - Method chaining for intuitive configuration setup
 * - Support for multiple configuration sources in a single configuration
 * - Automatic merging of configuration values with deep object merging
 * - Graceful error handling for individual source failures
 * - Optional integration with the global configuration singleton
 *
 * The factory supports various configuration sources including local files, S3 objects,
 * and in-memory objects. By default, the built configuration is set as the global configuration
 * unless explicitly disabled with setGlobal(false).
 *
 * @example
 * // Create a configuration from multiple sources
 * const config = await new ConfigurationFactory()
 *   .addFile("./config/defaults.json")            // Local file
 *   .addS3File("s3://my-bucket/config.json")      // S3 object
 *   .addObject({ overrides: { timeout: 5000 } })  // In-memory object
 *   .build();
 *
 * // Access a configuration value
 * const apiKey = await config.getValue("api.key");
 */
export class ConfigurationFactory {
  private configSources: ConfigurationSource[] = [];
  private setAsGlobal = true;

  /**
   * Add a configuration source
   *
   * Adds a custom configuration source to the factory. The source will be loaded
   * and merged with other sources when build() is called.
   *
   * @param source - The configuration source to add
   * @return This factory instance for method chaining
   *
   * @example
   * // Add a custom configuration source
   * factory.addSource(new MyCustomConfigSource());
   */
  public addSource(source: ConfigurationSource): ConfigurationFactory {
    this.configSources.push(source);
    return this;
  }

  /**
   * Add a configuration source from a file path or S3 URL
   *
   * Automatically detects if the path is a local file or S3 URL and creates
   * the appropriate configuration source. For local files, the path is resolved
   * to an absolute path. For S3 URLs, an S3ConfigurationSource is created.
   *
   * @param filePath - File path or S3 URL (s3://bucket/path/file.json)
   * @return This factory instance for method chaining
   *
   * @example
   * // Add a local configuration file
   * factory.addFile("./config/settings.json");
   *
   * @example
   * // Add an S3 configuration file
   * factory.addFile("s3://my-bucket/config/settings.json");
   */
  public addFile(filePath: string): ConfigurationFactory {
    let source: ConfigurationSource;

    if (filePath.startsWith("s3://")) {
      source = new S3ConfigurationSource(filePath);
    } else {
      source = new FileConfigurationSource(resolve(filePath));
    }

    return this.addSource(source);
  }

  /**
   * Add an S3 configuration source
   *
   * Creates and adds an S3ConfigurationSource for loading configuration from an S3 object.
   * This method provides explicit control over the AWS region to use for S3 access.
   *
   * @param s3Url - S3 URL in the format s3://bucket/path/file.json
   * @param region - Optional AWS region (defaults to environment variable or us-east-1)
   * @return This factory instance for method chaining
   *
   * @example
   * // Add an S3 configuration file with specific region
   * factory.addS3File("s3://my-bucket/config/settings.json", "eu-west-1");
   */
  public addS3File(s3Url: string, region?: string): ConfigurationFactory {
    const source = new S3ConfigurationSource(s3Url, region);
    return this.addSource(source);
  }

  /**
   * Add an object configuration source
   *
   * Creates and adds an ObjectConfigurationSource for loading configuration from
   * an in-memory object. This is useful for providing default values, overrides,
   * or dynamically generated configuration.
   *
   * @param config - Configuration object to add
   * @return This factory instance for method chaining
   *
   * @example
   * // Add default configuration values
   * factory.addObject({
   *   logging: { level: "info" },
   *   timeouts: { default: 3000 }
   * });
   */
  public addObject(config: ConfigObject): ConfigurationFactory {
    const source = new ObjectConfigurationSource(config);
    return this.addSource(source);
  }

  /**
   * Control whether the built configuration should be set as global
   *
   * By default, the configuration built by this factory is set as the global
   * configuration accessible via Configuration.getInstance(). This method allows
   * controlling that behavior when multiple configurations are needed.
   *
   * This is particularly useful in scenarios where you need multiple configuration
   * instances for different components or when testing with isolated configurations.
   *
   * @param setAsGlobal - Whether to set as global configuration (default: true)
   * @return This factory instance for method chaining
   *
   * @example
   * // Build a configuration without setting it as global
   * const localConfig = await new ConfigurationFactory()
   *   .addFile("./config/local-config.json")
   *   .setGlobal(false)
   *   .build();
   *
   * // The global configuration remains unchanged
   * const globalConfig = Configuration.getInstance();
   */
  public setGlobal(setAsGlobal: boolean): ConfigurationFactory {
    this.setAsGlobal = setAsGlobal;
    return this;
  }

  /**
   * Build the configuration by loading and merging all sources
   *
   * Loads configuration from all added sources, merges them in order of addition,
   * and creates an immutable Configuration object. By default, the built configuration
   * is set as the global configuration unless disabled with setGlobal(false).
   *
   * The build process handles errors from individual sources gracefully, logging errors
   * but continuing with the remaining sources. This ensures that a partial configuration
   * is still available even if some sources fail to load.
   *
   * @return Promise resolving to a new immutable Configuration object
   *
   * @example
   * // Build a complete configuration
   * const config = await new ConfigurationFactory()
   *   .addFile("./defaults.json")
   *   .addFile("./environment.json")
   *   .addObject({ overrides: { debug: true } })
   *   .build();
   *
   * // Access a configuration value
   * const timeout = await config.getValue("api.timeout");
   */
  public async build(): Promise<Configuration> {
    let mergedConfig: Record<string, ConfigValue> = {};

    // Load from all sources
    for (const source of this.configSources) {
      try {
        const sourceConfig = await source.load();
        if (sourceConfig && typeof sourceConfig === "object") {
          // Deep merge the configuration
          mergedConfig = deepMerge(mergedConfig, sourceConfig as Record<string, ConfigValue>);
        }
      } catch (error) {
        console.error(`Error loading configuration from source: ${source.constructor.name}`, error);
      }
    }

    console.log("Configuration built successfully");
    const config = new Configuration(mergedConfig as SmokeConfig);

    // Set as global configuration by default unless explicitly disabled
    if (this.setAsGlobal) {
      Configuration.initializeGlobalInstance(config);
    }

    return config;
  }
}
