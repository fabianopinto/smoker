/**
 * AWS Client Module
 *
 * This module centralizes all AWS client interactions for better organization and testability.
 * It provides wrapper classes and interfaces for AWS services like S3 and SSM with utility
 * methods for common operations.
 *
 * Key features:
 * - Type-safe interfaces for AWS service clients
 * - Wrapper implementations that simplify AWS SDK usage
 * - Utility functions for working with AWS resources (URLs, streams, etc.)
 * - Parameter caching for improved performance
 * - Consistent error handling across AWS services
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Readable } from "node:stream";
import { ERR_S3_INVALID_URL, ERR_S3_READ, ERR_SSM_PARAMETER, SmokerError } from "../../errors";

/**
 * Parsed S3 URL components
 *
 * Represents the result of parsing an S3 URL in the format s3://bucket/key.
 * Contains the extracted bucket name and object key for use in S3 operations.
 *
 * @property bucket - The S3 bucket name extracted from the URL
 * @property key - The object key (path) within the bucket extracted from the URL
 */
export interface ParsedS3Url {
  bucket: string;
  key: string;
}

/**
 * Interface for S3 client operations
 *
 * Defines the contract for interacting with AWS Simple Storage Service (S3),
 * providing methods to retrieve objects as strings or parsed JSON, and utilities
 * for working with S3 URLs and references.
 *
 * This interface abstracts the underlying AWS SDK implementation details,
 * providing a simplified API for common S3 operations while maintaining
 * flexibility for different implementation strategies.
 *
 * @see {S3ClientWrapper} The standard implementation of this interface
 */
export interface IS3Client {
  /**
   * Get the underlying S3 client
   *
   * @return The S3 client instance
   */
  getClient(): S3Client;

  /**
   * Get an object from S3 and return it as a string
   *
   * @param bucket - S3 bucket name
   * @param key - S3 object key
   * @return Promise that resolves to the object content as string
   * @throws {SmokerError} if the object cannot be retrieved
   */
  getObjectAsString(bucket: string, key: string): Promise<string>;

  /**
   * Get and parse a JSON object from S3
   *
   * @param bucket - S3 bucket name
   * @param key - S3 object key
   * @return Promise that resolves to the parsed JSON object
   * @throws {SmokerError} if the object cannot be retrieved or parsed
   */
  getObjectAsJson<T = Record<string, unknown>>(bucket: string, key: string): Promise<T>;

  /**
   * Check if a value is an S3 JSON reference
   *
   * @param value - Value to check
   * @return True if the value is an S3 JSON reference (starts with s3:// and ends with .json)
   */
  isS3JsonReference(value: string): boolean;

  /**
   * Get content from an S3 URL - handles both JSON and non-JSON files
   *
   * @param s3Url - S3 URL in the format s3://bucket/path/file[.ext]
   * @return Promise that resolves to either a parsed JSON object or a string depending on the file extension
   * @throws {SmokerError} if the URL is invalid or the object cannot be retrieved
   */
  getContentFromUrl<T = Record<string, unknown>>(s3Url: string): Promise<T | string>;
}

/**
 * Interface for SSM parameter store client operations
 *
 * Defines the contract for interacting with AWS Systems Manager Parameter Store,
 * providing methods to retrieve parameters, manage parameter caching, and utilities
 * for working with parameter references in configuration strings.
 *
 * This interface abstracts the underlying AWS SDK implementation details,
 * providing a simplified API for common Parameter Store operations while supporting
 * features like parameter caching, reference parsing, and automatic decryption.
 *
 * @see {SSMClientWrapper} The standard implementation of this interface
 */
export interface ISSMClient {
  /**
   * Get the underlying SSM client
   *
   * @return The SSM client instance
   */
  getClient(): SSMClient;

  /**
   * Clear the parameter cache
   */
  clearCache(): void;

  /**
   * Get a parameter from SSM Parameter Store
   *
   * @param name - Parameter name (without ssm:// prefix)
   * @param useCache - Whether to use and update the cache (default: true)
   * @return Promise that resolves to the parameter value
   * @throws {SmokerError} if the parameter cannot be retrieved
   */
  getParameter(name: string, useCache?: boolean): Promise<string>;

  /**
   * Parse an SSM parameter reference from a string
   *
   * @param value - String potentially containing SSM parameter path in format ssm://parameter/path
   * @return Parameter name without the prefix, or null if not an SSM reference
   */
  parseSSMUrl(value: string): string | null;

  /**
   * Check if a value is an SSM parameter reference
   *
   * @param value - Value to check
   * @return True if the value is an SSM parameter reference (starts with ssm://)
   */
  isSSMReference(value: string): boolean;

  /**
   * Check if a value is an S3 JSON reference
   *
   * @param value - Value to check
   * @return True if the value is an S3 JSON reference (starts with s3:// and ends with .json)
   */
  isS3JsonReference(value: string): boolean;
}

/**
 * Default AWS region to use when no region is specified
 *
 * This constant provides a fallback AWS region when none is explicitly provided.
 * It first checks for an AWS_REGION environment variable, and if not found,
 * defaults to "us-east-1" (N. Virginia region).
 */
export const DEFAULT_AWS_REGION = process.env.AWS_REGION || "us-east-1";

/**
 * Parse an S3 URL into bucket and key components
 *
 * Extracts the bucket name and object key from an S3 URL in the format s3://bucket/key.
 * This utility function is used for working with S3 references in configuration and
 * for resolving S3 paths to actual object locations.
 *
 * @param s3Url - S3 URL to parse (s3://bucket/key) or undefined
 * @return Parsed S3 URL components or null if the URL is invalid or undefined
 *
 * @example
 * // Parse an S3 URL
 * const parsed = parseS3Url("s3://my-bucket/path/to/file.json");
 * if (parsed) {
 *   console.log(`Bucket: ${parsed.bucket}, Key: ${parsed.key}`);
 * }
 */
export function parseS3Url(s3Url: string | undefined): ParsedS3Url | null {
  if (!s3Url) return null;

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
 * Convert a stream or buffer response to a string
 *
 * Utility function that handles various response types from AWS SDK calls and
 * converts them to a string representation. This is particularly useful when
 * working with S3 object content or other AWS responses that might return
 * different data types depending on the context.
 *
 * The function handles several input types:
 * - String values (returned as-is)
 * - Buffer objects (converted using UTF-8 encoding)
 * - Readable streams (consumed and concatenated)
 * - Objects with toString() methods
 *
 * @param streamOrData - Stream, Buffer, string, or other data from AWS SDK response
 * @return Promise that resolves to the content as string
 * @throws {SmokerError} if the data cannot be converted to a string
 *
 * @example
 * // Convert an S3 object response to string
 * const response = await s3Client.send(new GetObjectCommand({ Bucket, Key }));
 * const content = await streamToString(response.Body);
 */
export async function streamToString(
  streamOrData: Readable | Buffer | string | unknown,
): Promise<string> {
  // If already a string, return it directly
  if (typeof streamOrData === "string") {
    return streamOrData;
  }

  // If it's a Buffer, convert to string
  if (Buffer.isBuffer(streamOrData)) {
    return streamOrData.toString("utf8");
  }

  // If it has a toString method (some AWS SDK responses), use it
  interface WithToString {
    toString(encoding?: string): string;
  }

  // Check if the object has a custom toString method
  if (
    streamOrData &&
    typeof (streamOrData as WithToString).toString === "function" &&
    (streamOrData as WithToString).toString !== Object.prototype.toString
  ) {
    return (streamOrData as WithToString).toString("utf8");
  }

  // Handle readable stream
  if (streamOrData && typeof (streamOrData as Readable).on === "function") {
    return new Promise<string>((resolve, reject) => {
      const stream = streamOrData as Readable;
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (error) => reject(error));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  // For unhandled types, convert to string safely
  return String(streamOrData || "");
}

/**
 * S3 client wrapper implementation
 *
 * This class provides a wrapper around the AWS SDK S3 client, offering simplified
 * methods for common S3 operations like retrieving objects as strings or JSON.
 * It implements the IS3Client interface for consistent API access.
 *
 * The wrapper handles AWS SDK initialization, authentication, and provides utility
 * methods for working with S3 URLs and content types. It includes features for
 * parsing S3 URLs, determining content types based on file extensions, and
 * automatically handling JSON parsing for appropriate files.
 *
 * @implements {IS3Client}
 */
export class S3ClientWrapper implements IS3Client {
  private client: S3Client;

  /**
   * Create a new S3 client wrapper
   *
   * @param region - AWS region to use (defaults to environment variable or us-east-1)
   * @param clientOverride - Optional S3Client instance for testing
   */
  constructor(region?: string, clientOverride?: S3Client) {
    this.client =
      clientOverride ||
      new S3Client({
        region: region || DEFAULT_AWS_REGION,
      });
  }

  /**
   * Get the underlying S3 client
   *
   * @return The S3 client instance
   */
  getClient(): S3Client {
    return this.client;
  }

  /**
   * Get an object from S3 and return it as a string
   *
   * @param bucket - S3 bucket name
   * @param key - S3 object key
   * @return Promise that resolves to the object content as string
   * @throws {SmokerError} if the object cannot be retrieved
   */
  async getObjectAsString(bucket: string, key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);
      if (!response.Body) {
        throw new SmokerError("Failed to read S3 object", {
          code: ERR_S3_READ,
          domain: "aws",
          details: { component: "s3", bucket, key, reason: "Empty response body" },
          retryable: true,
        });
      }

      return await streamToString(response.Body as Readable);
    } catch (error) {
      // Wrap AWS SDK errors into a structured SmokerError
      throw new SmokerError("Failed to read S3 object", {
        code: ERR_S3_READ,
        domain: "aws",
        details: {
          component: "s3",
          bucket,
          key,
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Get and parse a JSON object from S3
   *
   * @param bucket - S3 bucket name
   * @param key - S3 object key
   * @return Promise that resolves to the parsed JSON object
   * @throws {SmokerError} if the object cannot be retrieved or parsed
   */
  async getObjectAsJson<T = Record<string, unknown>>(bucket: string, key: string): Promise<T> {
    const content = await this.getObjectAsString(bucket, key);
    return JSON.parse(content);
  }

  /**
   * Check if a value is an S3 JSON reference
   *
   * @param value - Value to check
   * @return True if the value is an S3 JSON reference (starts with s3:// and ends with .json)
   */
  isS3JsonReference(value: string): boolean {
    return (
      typeof value === "string" &&
      value.startsWith("s3://") &&
      value.toLowerCase().endsWith(".json")
    );
  }

  /**
   * Get content from an S3 URL - handles both JSON and non-JSON files
   *
   * @param s3Url - S3 URL in the format s3://bucket/path/file[.ext]
   * @return Promise that resolves to either a parsed JSON object or a string depending on the file extension
   * @throws {SmokerError} if the URL is invalid or the object cannot be retrieved
   */
  async getContentFromUrl<T = Record<string, unknown>>(s3Url: string): Promise<T | string> {
    const parsed = parseS3Url(s3Url);
    if (!parsed) {
      throw new SmokerError(`Invalid S3 URL format: ${s3Url}`, {
        code: ERR_S3_INVALID_URL,
        domain: "aws",
        details: { component: "s3", url: s3Url },
        retryable: false,
      });
    }

    // Get the content as a string first
    const content = await this.getObjectAsString(parsed.bucket, parsed.key);

    // If it's a JSON file, parse it; otherwise return as string
    if (this.isS3JsonReference(s3Url)) {
      try {
        return JSON.parse(content) as T;
      } catch (error) {
        throw new SmokerError("Failed to parse JSON from S3", {
          code: ERR_S3_READ,
          domain: "aws",
          details: {
            component: "s3",
            url: s3Url,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: false,
          cause: error,
        });
      }
    }

    // Return as string for non-JSON files
    return content as unknown as T;
  }
}

/**
 * Cache for SSM parameters to avoid repeated API calls
 */
export const ssmParameterCache: Record<
  string,
  string | number | boolean | object | null | undefined
> = {};

/**
 * SSM client wrapper for common Parameter Store operations
 *
 * This class provides a wrapper around the AWS SDK SSM client, offering simplified
 * methods for accessing AWS Systems Manager Parameter Store. It implements the
 * ISSMClient interface for consistent API access.
 *
 * The wrapper handles AWS SDK initialization, authentication, and provides utility
 * methods for working with parameter references. It includes features for parameter
 * caching to improve performance, parsing SSM parameter references from strings,
 * and automatic decryption of secure parameters.
 *
 * @implements {ISSMClient}
 */
export class SSMClientWrapper implements ISSMClient {
  private client: SSMClient;

  /**
   * Create a new SSM client wrapper
   *
   * @param region - AWS region to use (defaults to environment variable or us-east-1)
   * @param clientOverride - Optional SSMClient instance for testing
   */
  constructor(region?: string, clientOverride?: SSMClient) {
    this.client =
      clientOverride ||
      new SSMClient({
        region: region || DEFAULT_AWS_REGION,
      });
  }

  /**
   * Get the underlying SSM client
   *
   * @return The SSM client instance
   */
  getClient(): SSMClient {
    return this.client;
  }

  /**
   * Clear the parameter cache
   */
  clearCache(): void {
    // Empty the cache by replacing it with a new object
    for (const key of Object.keys(ssmParameterCache)) {
      ssmParameterCache[key] = undefined;
    }
  }

  /**
   * Get a parameter from SSM Parameter Store
   *
   * @param name - Parameter name (without ssm:// prefix)
   * @param useCache - Whether to use and update the cache (default: true)
   * @return Promise that resolves to the parameter value
   * @throws {SmokerError} if the parameter cannot be retrieved
   */
  async getParameter(name: string, useCache = true): Promise<string> {
    // Check cache first if using cache
    if (useCache && ssmParameterCache[name] !== undefined) {
      // We know this is a string because we only store strings in the cache for parameters
      return ssmParameterCache[name] as string;
    }

    try {
      const command = new GetParameterCommand({
        Name: name,
        WithDecryption: true, // Auto-decrypt SecureString parameters
      });

      const response = await this.client.send(command);

      const value = response.Parameter?.Value;
      if (value === undefined) {
        throw new SmokerError("SSM parameter has no value", {
          code: ERR_SSM_PARAMETER,
          domain: "aws",
          details: { component: "ssm", name, reason: "no value" },
          retryable: false,
        });
      }

      // Cache the result if using cache
      if (useCache) {
        ssmParameterCache[name] = value;
      }

      return value;
    } catch (error) {
      throw new SmokerError("Failed to fetch SSM parameter", {
        code: ERR_SSM_PARAMETER,
        domain: "aws",
        details: {
          component: "ssm",
          name,
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Parse an SSM parameter reference from a string
   *
   * @param value - String potentially containing SSM parameter path in format ssm://parameter/path
   * @return Parameter name without the prefix, or null if not an SSM reference
   */
  parseSSMUrl(value: string): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const ssmUrlRegex = /^ssm:\/\/(.+)$/;
    const match = value.match(ssmUrlRegex);

    if (!match) {
      return null;
    }

    return match[1];
  }

  /**
   * Check if a value is an SSM parameter reference
   *
   * @param value - Value to check
   * @return True if the value is an SSM parameter reference (starts with ssm://)
   */
  isSSMReference(value: string): boolean {
    return typeof value === "string" && value.startsWith("ssm://");
  }

  /**
   * Check if a value is an S3 JSON reference
   *
   * @param value - Value to check
   * @return True if the value is an S3 JSON reference (starts with s3:// and ends with .json)
   */
  isS3JsonReference(value: string): boolean {
    return (
      typeof value === "string" &&
      value.startsWith("s3://") &&
      value.toLowerCase().endsWith(".json")
    );
  }
}
