/**
 * Configuration interfaces
 * Defines contracts for configuration management
 */

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
 * Interface for parameter resolution
 */
export interface IParameterResolver {
  /**
   * Resolve all parameter references in a configuration value
   * Supports SSM parameters (ssm://) and S3 JSON files (s3://*.json)
   * @param value Configuration value to resolve
   * @returns Resolved configuration value
   */
  resolveValue(value: ConfigValue): Promise<ConfigValue>;

  /**
   * Resolve all parameter references in a configuration object
   * @param config Configuration object to resolve
   * @returns Resolved configuration object
   */
  resolveConfig(config: ConfigObject): Promise<ConfigObject>;
}
