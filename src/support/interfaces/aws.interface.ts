/**
 * AWS service interfaces
 * Defines contracts for AWS service interactions
 */

/**
 * Interface for parsed S3 URL components
 */
export interface ParsedS3Url {
  bucket: string;
  key: string;
}

import { S3Client } from "@aws-sdk/client-s3";
import { SSMClient } from "@aws-sdk/client-ssm";

/**
 * Interface for S3 client operations
 */
export interface IS3Client {
  /**
   * Get the underlying S3 client
   * @returns The S3 client instance
   */
  getClient(): S3Client;

  /**
   * Get an object from S3 and return it as a string
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @returns Promise that resolves to the object content as string
   * @throws Error if the object cannot be retrieved
   */
  getObjectAsString(bucket: string, key: string): Promise<string>;

  /**
   * Get and parse a JSON object from S3
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @returns Promise that resolves to the parsed JSON object
   * @throws Error if the object cannot be retrieved or parsed
   */
  getObjectAsJson<T = Record<string, unknown>>(bucket: string, key: string): Promise<T>;

  /**
   * Check if a value is an S3 JSON reference
   * @param value Value to check
   * @returns True if the value is an S3 JSON reference (starts with s3:// and ends with .json)
   */
  isS3JsonReference(value: string): boolean;

  /**
   * Get and parse a JSON object from an S3 URL
   * @param s3Url S3 URL in the format s3://bucket/path/file.json
   * @returns Promise that resolves to the parsed JSON object
   * @throws Error if the URL is invalid, the object cannot be retrieved, or it cannot be parsed
   * @deprecated Use getContentFromUrl instead which handles both JSON and non-JSON files
   */
  getJsonFromUrl<T = Record<string, unknown>>(s3Url: string): Promise<T>;

  /**
   * Get content from an S3 URL - handles both JSON and non-JSON files
   * @param s3Url S3 URL in the format s3://bucket/path/file[.ext]
   * @returns Promise that resolves to either a parsed JSON object or a string depending on the file extension
   * @throws Error if the URL is invalid or the object cannot be retrieved
   */
  getContentFromUrl<T = Record<string, unknown>>(s3Url: string): Promise<T | string>;
}

/**
 * Interface for SSM parameter store client operations
 */
export interface ISSMClient {
  /**
   * Get the underlying SSM client
   * @returns The SSM client instance
   */
  getClient(): SSMClient;

  /**
   * Clear the parameter cache
   */
  clearCache(): void;

  /**
   * Get a parameter from SSM Parameter Store
   * @param name Parameter name (without ssm:// prefix)
   * @param useCache Whether to use and update the cache (default: true)
   * @returns Promise that resolves to the parameter value
   * @throws Error if the parameter cannot be retrieved
   */
  getParameter(name: string, useCache?: boolean): Promise<string>;

  /**
   * Parse an SSM parameter reference from a string
   * @param value String potentially containing SSM parameter path in format ssm://parameter/path
   * @returns Parameter name without the prefix, or null if not an SSM reference
   */
  parseSSMUrl(value: string): string | null;

  /**
   * Check if a value is an SSM parameter reference
   * @param value Value to check
   * @returns True if the value is an SSM parameter reference (starts with ssm://)
   */
  isSSMReference(value: string): boolean;

  /**
   * Check if a value is an S3 JSON reference
   * @param value Value to check
   * @returns True if the value is an S3 JSON reference (starts with s3:// and ends with .json)
   */
  isS3JsonReference(value: string): boolean;
}
