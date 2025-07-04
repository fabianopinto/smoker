/**
 * Configuration for the cucumber tests
 * This provides a centralized location for all configurable parameters
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";

/**
 * ConfigValue represents any type of configuration value that can be stored
 * This allows for flexibility in configuration data types
 */
export type ConfigValue = string | number | boolean | ConfigObject | ConfigValue[] | null;

/**
 * ConfigObject represents a nested configuration object with string keys
 * This allows for complex configuration hierarchies
 */
export interface ConfigObject {
  [key: string]: ConfigValue;
}

/**
 * SmokeConfig defines the required structure for configuration
 * while still allowing for flexible extension with additional properties
 */
export interface SmokeConfig {
  // Core BDD settings that are required
  defaultPhrase: string;
  phraseTemplate: string;

  // Additional configuration properties can be added dynamically
  [key: string]: ConfigValue;
}

/**
 * ConfigurationSource represents a source of configuration data
 */
export interface ConfigurationSource {
  /**
   * Load configuration from this source
   * @returns A configuration object
   */
  load(): Promise<ConfigObject>;
}

/**
 * FileConfigurationSource loads configuration from a local JSON file
 */
export class FileConfigurationSource implements ConfigurationSource {
  private filePath: string;

  /**
   * Create a new file configuration source
   * @param filePath The path to the JSON configuration file
   */
  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Load configuration from the file
   * @returns The configuration object loaded from the file
   */
  async load(): Promise<ConfigObject> {
    try {
      if (!existsSync(this.filePath)) {
        console.warn(`Configuration file not found: ${this.filePath}`);
        return {};
      }

      const content = readFileSync(this.filePath, "utf8");
      return JSON.parse(content) as ConfigObject;
    } catch (error) {
      console.error(`Error loading configuration from ${this.filePath}:`, error);
      return {};
    }
  }
}

/**
 * Parse S3 URL into bucket and key components
 * @param s3Url S3 URL in the format s3://bucket/path/file.json
 */
function parseS3Url(s3Url: string): { bucket: string; key: string } | null {
  const s3UrlRegex = /^s3:\/\/([^/]+)\/(.+)$/;
  const match = s3Url.match(s3UrlRegex);

  if (!match) {
    return null;
  }

  return {
    bucket: match[1],
    key: match[2],
  };
}

/**
 * Convert a stream to a string
 * @param stream Readable stream
 */
async function streamToString(stream: Readable): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

/**
 * S3ConfigurationSource loads configuration from an S3 JSON file
 */
export class S3ConfigurationSource implements ConfigurationSource {
  private s3Url: string;
  private s3Client: S3Client;

  /**
   * Create a new S3 configuration source
   * @param s3Url S3 URL in the format s3://bucket/path/file.json
   * @param region Optional AWS region (defaults to environment variable or us-east-1)
   */
  constructor(s3Url: string, region?: string) {
    this.s3Url = s3Url;
    this.s3Client = new S3Client({
      region: region || process.env.AWS_REGION || "us-east-1",
    });
  }

  /**
   * Load configuration from the S3 file
   * @returns The configuration object loaded from the S3 file
   */
  async load(): Promise<ConfigObject> {
    try {
      const parsedUrl = parseS3Url(this.s3Url);

      if (!parsedUrl) {
        console.error(`Invalid S3 URL format: ${this.s3Url}`);
        return {};
      }

      const { bucket, key } = parsedUrl;
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        console.error(`Empty response body for S3 object: ${this.s3Url}`);
        return {};
      }

      // Convert the readable stream to a string
      const content = await streamToString(response.Body as Readable);
      return JSON.parse(content) as ConfigObject;
    } catch (error) {
      console.error(`Error loading configuration from S3 ${this.s3Url}:`, error);
      return {};
    }
  }
}

/**
 * ObjectConfigurationSource loads configuration from a JavaScript object
 */
export class ObjectConfigurationSource implements ConfigurationSource {
  private configObject: ConfigObject;

  /**
   * Create a new object configuration source
   * @param configObject The configuration object
   */
  constructor(configObject: ConfigObject) {
    this.configObject = configObject;
  }

  /**
   * Load configuration from the object
   * @returns The configuration object
   */
  async load(): Promise<ConfigObject> {
    return this.configObject;
  }
}

export class Configuration {
  private static instance: Configuration;
  private config: SmokeConfig;
  private configSources: ConfigurationSource[] = [];

  private constructor() {
    // Default configuration
    this.config = {
      defaultPhrase: "Smoking",
      phraseTemplate: "{phrase} {target}!",
    };
  }

  /**
   * Gets the singleton instance of the Configuration
   */
  public static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }

  /**
   * Gets the current configuration
   */
  public getConfig(): SmokeConfig {
    return this.config;
  }

  /**
   * Gets a specific configuration value by key path
   * Supports nested keys with dot notation (e.g., "database.url")
   * @param keyPath The key path to look up
   * @param defaultValue Optional default value if key doesn't exist
   */
  public getValue<T extends ConfigValue>(keyPath: string, defaultValue?: T): T | undefined {
    const keys = keyPath.split(".");
    let current: ConfigObject | ConfigValue = this.config;

    for (const key of keys) {
      if (
        current === undefined ||
        current === null ||
        typeof current !== "object" ||
        Array.isArray(current)
      ) {
        return defaultValue;
      }
      current = (current as ConfigObject)[key];
    }

    return current !== undefined ? (current as T) : defaultValue;
  }

  /**
   * Updates the configuration
   */
  public updateConfig(partialConfig: Partial<SmokeConfig>): void {
    // Filter out any undefined values to maintain type consistency
    const validPartialConfig: Partial<SmokeConfig> = {};

    // Only copy over defined values
    Object.entries(partialConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        (validPartialConfig as Record<string, ConfigValue>)[key] = value as ConfigValue;
      }
    });

    // Update the configuration with a type assertion to ensure TypeScript knows there are no undefined values
    this.config = {
      ...this.config,
      ...(validPartialConfig as SmokeConfig),
    };
  }

  /**
   * Add a configuration source
   * @param source The configuration source to add
   */
  public addConfigurationSource(source: ConfigurationSource): void {
    this.configSources.push(source);
  }

  /**
   * Deep merges source object into target object
   * If a property in source is null, it will be removed from the output
   */
  private deepMerge(target: ConfigObject, source: ConfigObject): ConfigObject {
    // Create new output object
    const output = { ...target };
    // Keep track of keys to remove
    const keysToRemove: string[] = [];

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        // If the value is null, mark this property for removal
        if (source[key] === null) {
          keysToRemove.push(key);
        } else if (
          source[key] &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key]) &&
          target[key] &&
          typeof target[key] === "object" &&
          !Array.isArray(target[key])
        ) {
          // Deep merge nested objects
          const mergedValue = this.deepMerge(
            target[key] as ConfigObject,
            source[key] as ConfigObject
          );

          // If the merged object is empty, mark it for removal
          if (Object.keys(mergedValue).length === 0) {
            keysToRemove.push(key);
          } else {
            output[key] = mergedValue;
          }
        } else {
          // For non-object values, simply replace the value
          output[key] = source[key];
        }
      }
    }

    // Remove all marked keys by creating a new filtered object
    const result = Object.entries(output)
      .filter(([key]) => !keysToRemove.includes(key))
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as ConfigObject);

    return result;
  }

  /**
   * Load and merge configurations from all added sources
   */
  public async loadConfigurations(): Promise<void> {
    try {
      // Load and merge configurations from all sources
      for (const source of this.configSources) {
        try {
          const sourceConfig = await source.load();

          // Ensure the source config has the required properties for SmokeConfig
          // Ensure we have a clean merged config that follows the type constraints
          // Use a properly typed safe merge to ensure we don't include undefined values
          const mergedConfig = this.deepMerge(this.config, sourceConfig) as Record<
            string,
            ConfigValue
          >;

          // Validate the merged config has required properties
          if (
            typeof mergedConfig.defaultPhrase !== "string" ||
            typeof mergedConfig.phraseTemplate !== "string"
          ) {
            console.warn("Configuration is missing required properties, using defaults");
            // Keep the existing configuration for the required properties
            // Create a properly typed SmokeConfig object with the required fields
            const validConfig: SmokeConfig = {
              defaultPhrase: this.config.defaultPhrase,
              phraseTemplate: this.config.phraseTemplate,
            };

            // Add all other properties from the merged config that aren't undefined
            // Create a new fully-typed object with filtered properties
            // First, filter out entries that should be excluded
            const filteredEntries = Object.entries(mergedConfig).filter(
              ([k, v]) =>
                k !== "defaultPhrase" && k !== "phraseTemplate" && v !== undefined && v !== null
            );

            // Then add each filtered property to the valid config
            for (const [key, value] of filteredEntries) {
              // Only add values that match ConfigValue type (excluding undefined)
              if (value !== undefined) {
                validConfig[key] = value as ConfigValue;
              }
            }

            this.config = validConfig;
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
        } catch (error) {
          console.error("Error loading configuration from source:", error);
        }
      }

      console.log("Configuration loaded and merged successfully");
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
