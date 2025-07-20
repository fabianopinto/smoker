/**
 * Configuration Module Index
 *
 * This barrel file exports all configuration-related implementations and interfaces from the
 * configuration subsystem, providing a unified entry point for consumers. It centralizes
 * access to the configuration system components for easier imports throughout the application.
 */

export { ConfigurationFactory } from "./config-factory";
export { deepMerge } from "./config-merger";
export {
  type ConfigurationSource,
  FileConfigurationSource,
  ObjectConfigurationSource,
  S3ConfigurationSource,
} from "./config-source";
export {
  type ConfigObject,
  Configuration,
  type ConfigurationProvider,
  type ConfigValue,
  createConfiguration,
  createConfigurationFromObject,
  type SmokeConfig,
} from "./configuration";
export { ParameterResolver } from "./parameter-resolver";
