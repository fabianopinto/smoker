/**
 * Configuration Sources Module
 *
 * This module defines the interfaces and implementations for loading configuration
 * from various sources. It provides a unified approach to configuration loading
 * through the ConfigurationSource interface and concrete implementations for
 * different storage mechanisms.
 *
 * The module supports loading configuration from:
 * - Local filesystem JSON files
 * - AWS S3 JSON objects
 * - In-memory JavaScript objects
 *
 * Each source implements error handling, parameter resolution, and consistent
 * return types to ensure reliable configuration loading regardless of source.
 */

import { S3Client } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import { BaseLogger } from "../../lib/logger";
import { S3ClientWrapper, parseS3Url } from "../aws";
import type { ConfigObject } from "./configuration";
import { ParameterResolver } from "./parameter-resolver";

// Create a logger instance for this module
const logger = new BaseLogger({ name: "smoker:config-source" });

/**
 * ConfigurationSource interface
 *
 * Defines the contract for all configuration sources in the system. This interface
 * provides a unified way to load configuration data regardless of where it's stored.
 *
 * By implementing this interface, different configuration sources can be used
 * interchangeably, allowing for flexible configuration strategies and easier testing.
 * The ConfigurationFactory uses this interface to load and merge configuration from
 * multiple heterogeneous sources.
 */
export interface ConfigurationSource {
  /**
   * Load configuration from this source
   *
   * Retrieves configuration data from the underlying source and returns it as a
   * standardized ConfigObject. Implementations should handle error conditions
   * gracefully, returning an empty object rather than throwing exceptions when
   * configuration cannot be loaded.
   *
   * @return Promise resolving to a configuration object
   */
  load(): Promise<ConfigObject>;
}

/**
 * File-based configuration source
 *
 * This class provides a configuration source implementation that loads configuration
 * data from a JSON file on the filesystem. It implements the ConfigurationSource
 * interface for consistent API access across different configuration sources.
 *
 * The source handles file reading, JSON parsing, and error handling when the file
 * is missing or contains invalid JSON. It provides graceful fallback to an empty
 * configuration object when errors occur during loading.
 *
 * @implements {ConfigurationSource}
 */
export class FileConfigurationSource implements ConfigurationSource {
  private filePath: string;

  /**
   * Create a new file configuration source
   *
   * @param filePath - The path to the JSON configuration file
   */
  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Load configuration from the file
   *
   * @return The configuration object loaded from the file
   */
  async load(): Promise<ConfigObject> {
    try {
      if (!existsSync(this.filePath)) {
        logger.warn(`Configuration file not found: ${this.filePath}`);
        return {};
      }

      const content = readFileSync(this.filePath, "utf8");
      return JSON.parse(content) as ConfigObject;
    } catch (error) {
      logger.error(
        error instanceof Error ? error : String(error),
        `Error loading configuration from ${this.filePath}`,
      );
      return {};
    }
  }
}

/**
 * S3-based configuration source
 *
 * This class provides a configuration source implementation that loads configuration
 * data from a JSON file stored in an AWS S3 bucket. It implements the ConfigurationSource
 * interface for consistent API access across different configuration sources.
 *
 * The source handles S3 URL parsing, JSON retrieval, parameter resolution, and error
 * handling. It automatically resolves any SSM parameter references or nested S3 references
 * in the loaded configuration through the ParameterResolver.
 *
 * @implements {ConfigurationSource}
 */
export class S3ConfigurationSource implements ConfigurationSource {
  private s3Url: string;
  private s3Client: S3ClientWrapper;
  private resolver: ParameterResolver;

  /**
   * Create a new S3 configuration source
   *
   * @param s3Url - S3 URL in the format s3://bucket/path/file.json
   * @param region - Optional AWS region (defaults to environment variable or us-east-1)
   * @param s3ClientInstance - Optional S3Client instance for testing
   */
  constructor(s3Url: string, region?: string, s3ClientInstance?: S3Client) {
    this.s3Url = s3Url;
    this.s3Client = new S3ClientWrapper(region, s3ClientInstance);
    this.resolver = new ParameterResolver(region, s3ClientInstance);
  }

  /**
   * Load configuration from the S3 file
   *
   * @return The configuration object loaded from the S3 file
   */
  async load(): Promise<ConfigObject> {
    try {
      const parsed = parseS3Url(this.s3Url);

      if (!parsed) {
        logger.error(`Invalid S3 URL format: ${this.s3Url}`);
        return {};
      }

      // Get JSON content from S3
      try {
        const configObject = await this.s3Client.getObjectAsJson<ConfigObject>(
          parsed.bucket,
          parsed.key,
        );

        // Resolve any parameter references in the configuration
        return await this.resolver.resolveConfig(configObject);
      } catch (error) {
        logger.error(
          error instanceof Error ? error : String(error),
          `Error loading configuration from S3 ${this.s3Url}`,
        );
        return {};
      }
    } catch (error) {
      logger.error(
        error instanceof Error ? error : String(error),
        `Error in S3ConfigurationSource.load for ${this.s3Url}`,
      );
      return {};
    }
  }
}

/**
 * Object-based configuration source
 *
 * This class provides a configuration source implementation that uses an in-memory
 * JavaScript object as its configuration data source. It implements the ConfigurationSource
 * interface for consistent API access across different configuration sources.
 *
 * The source creates a shallow copy of the provided configuration object when loaded,
 * ensuring that modifications to the returned configuration don't affect the source object.
 * This is particularly useful for providing default configurations or for testing scenarios.
 *
 * @implements {ConfigurationSource}
 */
export class ObjectConfigurationSource implements ConfigurationSource {
  private configObject: ConfigObject;

  /**
   * Create a new object configuration source
   *
   * @param configObject - The configuration object
   */
  constructor(configObject: ConfigObject) {
    this.configObject = configObject;
  }

  /**
   * Load configuration from the object
   *
   * @return The configuration object
   */
  async load(): Promise<ConfigObject> {
    return { ...this.configObject };
  }
}
