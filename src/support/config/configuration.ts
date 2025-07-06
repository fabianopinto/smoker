/**
 * Configuration manager for the application
 *
 * This file provides a centralized configuration management system with a singleton pattern.
 * It allows loading configuration from various sources and accessing values using a dot-notation path.
 * Supports merging configurations from multiple sources with proper type validation.
 *
 * @module support/config/configuration
 */
import { resolve } from "node:path";
import type { ConfigObject, ConfigValue, ConfigurationSource, SmokeConfig } from "../interfaces";
import {
  FileConfigurationSource,
  ObjectConfigurationSource,
  S3ConfigurationSource,
  SSMParameterSource,
} from "./configuration-sources";

/**
 * Configuration singleton for managing application configuration
 * This provides a centralized location for all configurable parameters
 */
export class Configuration {
  private static instance: Configuration;
  private configSources: ConfigurationSource[] = [];
  private config: SmokeConfig;
  private loaded = false;

  /**
   * Create a new configuration instance with default values
   */
  private constructor() {
    this.config = {
      defaultPhrase: "Smoking",
      phraseTemplate: "{phrase} {target}!",
    };
  }

  /**
   * Get the singleton instance of the configuration
   * @returns The configuration instance
   */
  public static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }

  /**
   * Reset the configuration to its default state
   * This is primarily used for testing
   */
  public static resetInstance(): void {
    Configuration.instance = new Configuration();
  }

  /**
   * Add a configuration source
   * @param source The configuration source to add
   */
  public addConfigurationSource(source: ConfigurationSource): void {
    this.configSources.push(source);
    this.loaded = false;
  }

  /**
   * Get the current configuration
   * @returns The current configuration
   */
  public getConfig(): SmokeConfig {
    return { ...this.config };
  }

  /**
   * Get a configuration value by key path
   * @param keyPath Dot-separated path to the configuration value (e.g. "aws.region")
   * @param defaultValue Default value to return if the key is not found
   * @returns The configuration value at the specified key path
   */
  public getValue<T extends ConfigValue>(keyPath: string, defaultValue?: T): T | undefined {
    const keys = keyPath.split(".");
    let value: ConfigValue = this.config;

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

    return value as T;
  }

  /**
   * Update the configuration with new values
   * @param partialConfig Partial configuration to merge with existing configuration
   */
  public updateConfig(partialConfig: Partial<SmokeConfig>): void {
    // Create a clean version without undefined values
    const cleanConfig: Record<string, ConfigValue> = {};

    // Add all non-undefined values from partialConfig
    Object.entries(partialConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanConfig[key] = value as ConfigValue;
      }
    });

    this.config = { ...this.config, ...cleanConfig } as SmokeConfig;
  }

  /**
   * Deep merge two objects recursively
   * - Handles arrays by replacing them completely
   * - Handles null values by removing the property
   * - Removes empty objects after merge
   *
   * @param target Target object to merge into
   * @param source Source object to merge from
   * @returns New object with merged properties
   * @private Used for internal merging and testing
   */
  private deepMerge(
    target: Record<string, ConfigValue>,
    source: Record<string, ConfigValue>
  ): Record<string, ConfigValue> {
    const result: Record<string, ConfigValue> = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        // If source value is null, remove the property
        if (sourceValue === null) {
          // Use defineProperty with enumerable: false instead of delete to avoid ESLint warning
          const propertyKey = key;
          Object.defineProperty(result, propertyKey, {
            value: undefined,
            enumerable: false,
            configurable: true,
          });
          continue;
        }

        // If both are objects (but not arrays), recursively merge them
        if (
          sourceValue !== null &&
          targetValue !== null &&
          typeof sourceValue === "object" &&
          typeof targetValue === "object" &&
          !Array.isArray(sourceValue) &&
          !Array.isArray(targetValue)
        ) {
          // Recursively merge objects
          const mergedObj = this.deepMerge(
            targetValue as Record<string, ConfigValue>,
            sourceValue as Record<string, ConfigValue>
          );

          // Only add the property if the merged object has properties
          if (Object.keys(mergedObj).length > 0) {
            result[key] = mergedObj;
          } else {
            // Use defineProperty with enumerable: false instead of delete to avoid ESLint warning
            const propertyKey = key;
            Object.defineProperty(result, propertyKey, {
              value: undefined,
              enumerable: false,
              configurable: true,
            });
          }
        } else {
          // For arrays, primitive values, or incompatible types, just replace
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Load configurations from all sources
   */
  public async loadConfigurations(): Promise<void> {
    // Don't reload if already loaded
    if (this.loaded && this.configSources.length > 0) {
      console.log("Configuration already loaded, skipping reload");
      return;
    }

    try {
      let mergedConfig: ConfigObject = {};

      // Load configurations from all sources and merge them
      for (const source of this.configSources) {
        try {
          const sourceConfig = await source.load();
          mergedConfig = { ...mergedConfig, ...sourceConfig };
        } catch (error) {
          console.error("Error loading configuration from source:", error);
        }
      }

      if (Object.keys(mergedConfig).length > 0) {
        // Validate if the required properties exist in the merged config
        const hasRequiredProperties =
          typeof mergedConfig.defaultPhrase === "string" &&
          typeof mergedConfig.phraseTemplate === "string";

        if (!hasRequiredProperties) {
          console.warn(
            "Loaded configuration is missing required properties (defaultPhrase, phraseTemplate). " +
              "These will not be updated from default values."
          );

          // Create a validated config with only valid properties
          const validConfig: Record<string, ConfigValue> = {};
          // Filter out entries with undefined values
          const filteredEntries = Object.entries(mergedConfig).filter(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ([_, value]) => value !== undefined
          );

          for (const [key, value] of filteredEntries) {
            // Only add values that match ConfigValue type (excluding undefined)
            if (value !== undefined) {
              validConfig[key] = value as ConfigValue;
            }
          }

          // Cast to SmokeConfig since we've already filtered out undefined values
          // Don't override required properties if they have incorrect types
          const preservedConfig = {
            ...this.config,
            ...validConfig,
          };

          // Ensure required properties maintain their default values if invalid types are provided
          if (typeof validConfig.defaultPhrase !== "string") {
            preservedConfig.defaultPhrase = this.config.defaultPhrase;
          }

          if (typeof validConfig.phraseTemplate !== "string") {
            preservedConfig.phraseTemplate = this.config.phraseTemplate;
          }

          this.config = preservedConfig as SmokeConfig;
        } else {
          // Ensure it has the required SmokeConfig properties
          if (
            typeof mergedConfig.defaultPhrase === "string" &&
            typeof mergedConfig.phraseTemplate === "string"
          ) {
            this.config = mergedConfig as SmokeConfig;
          } else {
            // Should never happen due to earlier check, but satisfy TypeScript
            console.error("Invalid configuration detected, using defaults");
            this.config = {
              defaultPhrase: this.config.defaultPhrase,
              phraseTemplate: this.config.phraseTemplate,
            };
          }
        }
      }

      console.log("Configuration loaded and merged successfully");
      this.loaded = true;
    } catch (error) {
      console.error("Error loading configurations:", error);
    }
  }
}

/**
 * Helper function to access the configuration
 */
export function getConfig(): SmokeConfig {
  return Configuration.getInstance().getConfig();
}

/**
 * Helper function to get a specific configuration value
 */
export function getValue<T extends ConfigValue>(keyPath: string, defaultValue?: T): T | undefined {
  return Configuration.getInstance().getValue(keyPath, defaultValue);
}

/**
 * Helper function to update the configuration
 */
export function updateConfig(partialConfig: Partial<SmokeConfig>): void {
  Configuration.getInstance().updateConfig(partialConfig);
}

/**
 * Helper function to add a configuration source from a file path or S3 URL
 * Automatically detects if the path is a local file or S3 URL
 * @param filePath File path or S3 URL (s3://bucket/path/file.json)
 */
export function addConfigurationFile(filePath: string): void {
  let source: ConfigurationSource;

  if (filePath.startsWith("s3://")) {
    source = new S3ConfigurationSource(filePath);
  } else {
    source = new FileConfigurationSource(resolve(filePath));
  }

  Configuration.getInstance().addConfigurationSource(source);
}

/**
 * Helper function to add an S3 configuration source
 * @param s3Url S3 URL in the format s3://bucket/path/file.json
 * @param region Optional AWS region (defaults to environment variable or us-east-1)
 */
export function addS3ConfigurationFile(s3Url: string, region?: string): void {
  const source = new S3ConfigurationSource(s3Url, region);
  Configuration.getInstance().addConfigurationSource(source);
}

/**
 * Helper function to add an object configuration source
 */
export function addConfigurationObject(config: ConfigObject): void {
  const source = new ObjectConfigurationSource(config);
  Configuration.getInstance().addConfigurationSource(source);
}

/**
 * Helper function to add an SSM parameter source that will resolve SSM parameter references
 * This is useful when you have a configuration object that may contain SSM references
 * @param config Configuration object with potential SSM references
 * @param region Optional AWS region (defaults to environment variable or us-east-1)
 */
export function addSSMParameterSource(config: ConfigObject, region?: string): void {
  const source = new SSMParameterSource(config, region);
  Configuration.getInstance().addConfigurationSource(source);
}

/**
 * Helper function to load all configurations
 */
export async function loadConfigurations(): Promise<void> {
  await Configuration.getInstance().loadConfigurations();
}

/**
 * Load configuration from multiple file paths or S3 URLs
 * @param filePaths Array of file paths or S3 URLs to load
 */
export async function loadConfigurationFiles(filePaths: string[]): Promise<void> {
  filePaths.forEach((path) => addConfigurationFile(path));
  await loadConfigurations();
}
