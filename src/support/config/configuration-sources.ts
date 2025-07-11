/**
 * Configuration sources for the application
 *
 * This file defines different sources from which configuration can be loaded.
 * It implements the ConfigurationSource interface with various concrete implementations
 * for loading from files, S3, objects, and SSM parameters.
 *
 * @module support/config/configuration-sources
 */
import { S3Client } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import { ParameterResolver } from ".";
import { S3ClientWrapper, parseS3Url } from "../aws";
import type { ConfigObject, ConfigurationSource } from "../interfaces";

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
 * S3ConfigurationSource loads configuration from an S3 JSON file
 */
export class S3ConfigurationSource implements ConfigurationSource {
  private s3Url: string;
  private s3Client: S3ClientWrapper;
  private resolver: ParameterResolver;

  /**
   * Create a new S3 configuration source
   * @param s3Url S3 URL in the format s3://bucket/path/file.json
   * @param region Optional AWS region (defaults to environment variable or us-east-1)
   * @param s3ClientInstance Optional S3Client instance for testing
   */
  constructor(s3Url: string, region?: string, s3ClientInstance?: S3Client) {
    this.s3Url = s3Url;
    this.s3Client = new S3ClientWrapper(region, s3ClientInstance);
    this.resolver = new ParameterResolver(region, s3ClientInstance);
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

      // Get JSON content from S3
      try {
        const configObject = await this.s3Client.getObjectAsJson<ConfigObject>(bucket, key);

        // Resolve any parameter references in the configuration
        return await this.resolver.resolveConfig(configObject);
      } catch (error) {
        console.error(`Error loading configuration from S3 ${this.s3Url}:`, error);
        return {};
      }
    } catch (error) {
      console.error(`Error in S3ConfigurationSource.load for ${this.s3Url}:`, error);
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
    return { ...this.configObject };
  }
}

/**
 * SSMParameterSource loads configuration by resolving SSM parameters references
 * in an existing configuration object
 */
export class SSMParameterSource implements ConfigurationSource {
  private resolver: ParameterResolver;
  private configObject: ConfigObject;

  /**
   * Create a new SSM parameter source
   * @param configObject Configuration object with potential SSM references
   * @param region Optional AWS region (defaults to environment variable or us-east-1)
   */
  constructor(configObject: ConfigObject, region?: string) {
    this.resolver = new ParameterResolver(region);
    this.configObject = configObject;
  }

  /**
   * Load configuration by resolving SSM parameters in the object
   * @returns The configuration object with resolved SSM parameters
   */
  async load(): Promise<ConfigObject> {
    try {
      return await this.resolver.resolveConfig(this.configObject);
    } catch (error) {
      console.error("Error resolving SSM parameters in configuration:", error);
      return this.configObject;
    }
  }
}
