/**
 * Main export file for the support directory
 * This provides a clean API to import all support functionality
 */

// Export interfaces from interfaces directory
export * from "./interfaces";

// Re-export config interfaces with more specific naming to avoid conflicts
import type {
  ConfigObject as ConfigObjectType,
  ConfigurationSource as ConfigurationSourceType,
  ConfigValue as ConfigValueType,
  IParameterResolver,
  SmokeConfig as SmokeConfigType,
} from "./interfaces";

// Export the renamed interfaces to avoid conflicts
export type {
  ConfigObjectType,
  ConfigurationSourceType,
  ConfigValueType,
  IParameterResolver,
  SmokeConfigType,
};

// Export AWS client implementations
export * from "./aws";

// Export configuration-related implementations
import {
  addConfigurationFile,
  addConfigurationObject,
  addS3ConfigurationFile,
  addSSMParameterSource,
  Configuration,
  FileConfigurationSource,
  getConfig,
  getValue,
  loadConfigurationFiles,
  loadConfigurations,
  ObjectConfigurationSource,
  ParameterResolver,
  S3ConfigurationSource,
  SSMParameterSource,
  updateConfig,
} from "./config";

// Re-export all the implementation classes and functions
export {
  addConfigurationFile,
  addConfigurationObject,
  addS3ConfigurationFile,
  addSSMParameterSource,
  Configuration,
  FileConfigurationSource,
  getConfig,
  getValue,
  loadConfigurationFiles,
  loadConfigurations,
  ObjectConfigurationSource,
  ParameterResolver,
  S3ConfigurationSource,
  SSMParameterSource,
  updateConfig,
};

// For backward compatibility, also export the ConfigObject type as is
export type ConfigObject = ConfigObjectType;

// Export utility functions
// (Future utilities can be added here)
