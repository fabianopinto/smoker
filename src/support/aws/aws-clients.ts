/**
 * AWS client implementations and utilities
 *
 * This file centralizes all AWS client interactions for better organization and testability.
 * It provides wrapper classes for S3 and SSM clients with utility methods for common operations.
 *
 * @module support/aws/aws-clients
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Readable } from "node:stream";

// Import interfaces
import type { IS3Client, ISSMClient, ParsedS3Url } from "../interfaces";

/**
 * Default AWS region to use when no region is specified
 */
export const DEFAULT_AWS_REGION = process.env.AWS_REGION || "us-east-1";

/**
 * Parse an S3 URL into bucket and key components
 * @param s3Url S3 URL to parse (s3://bucket/key)
 * @returns Parsed S3 URL components or null if invalid
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
 * @param streamOrData Stream, Buffer, or string data from AWS SDK response
 * @returns Promise that resolves to the content as string
 */
export async function streamToString(
  streamOrData: Readable | Buffer | string | unknown
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
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  // For unhandled types, convert to string safely
  return String(streamOrData || "");
}

/**
 * S3 client wrapper for common S3 operations
 */
export class S3ClientWrapper implements IS3Client {
  private client: S3Client;

  /**
   * Create a new S3 client wrapper
   * @param region AWS region to use (defaults to environment variable or us-east-1)
   * @param clientOverride Optional S3Client instance for testing
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
   * @returns The S3 client instance
   */
  getClient(): S3Client {
    return this.client;
  }

  /**
   * Get an object from S3 and return it as a string
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @returns Promise that resolves to the object content as string
   * @throws Error if the object cannot be retrieved
   */
  async getObjectAsString(bucket: string, key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`Empty response body for S3 object: ${bucket}/${key}`);
    }

    return await streamToString(response.Body as Readable);
  }

  /**
   * Get and parse a JSON object from S3
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @returns Promise that resolves to the parsed JSON object
   * @throws Error if the object cannot be retrieved or parsed
   */
  async getObjectAsJson<T = Record<string, unknown>>(bucket: string, key: string): Promise<T> {
    const content = await this.getObjectAsString(bucket, key);
    return JSON.parse(content);
  }

  /**
   * Check if a value is an S3 JSON reference
   * @param value Value to check
   * @returns True if the value is an S3 JSON reference (starts with s3:// and ends with .json)
   */
  isS3JsonReference(value: string): boolean {
    return (
      typeof value === "string" &&
      value.startsWith("s3://") &&
      value.toLowerCase().endsWith(".json")
    );
  }

  /**
   * Get and parse a JSON object from an S3 URL
   * @param s3Url S3 URL in the format s3://bucket/path/file.json
   * @returns Promise that resolves to the parsed JSON object
   * @throws Error if the URL is invalid, the object cannot be retrieved, or it cannot be parsed
   * @deprecated Use getContentFromUrl instead which handles both JSON and non-JSON files
   */
  async getJsonFromUrl<T = Record<string, unknown>>(s3Url: string): Promise<T> {
    const parsed = parseS3Url(s3Url);
    if (!parsed) {
      throw new Error(`Invalid S3 URL format: ${s3Url}`);
    }

    return await this.getObjectAsJson<T>(parsed.bucket, parsed.key);
  }

  /**
   * Get content from an S3 URL - handles both JSON and non-JSON files
   * @param s3Url S3 URL in the format s3://bucket/path/file[.ext]
   * @returns Promise that resolves to either a parsed JSON object or a string depending on the file extension
   * @throws Error if the URL is invalid or the object cannot be retrieved
   */
  async getContentFromUrl<T = Record<string, unknown>>(s3Url: string): Promise<T | string> {
    const parsed = parseS3Url(s3Url);
    if (!parsed) {
      throw new Error(`Invalid S3 URL format: ${s3Url}`);
    }

    // Get the content as a string first
    const content = await this.getObjectAsString(parsed.bucket, parsed.key);

    // If it's a JSON file, parse it; otherwise return as string
    if (this.isS3JsonReference(s3Url)) {
      try {
        return JSON.parse(content) as T;
      } catch (error) {
        throw new Error(`Error parsing JSON from S3 (${s3Url}): ${error}`);
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
 */
export class SSMClientWrapper implements ISSMClient {
  private client: SSMClient;

  /**
   * Create a new SSM client wrapper
   * @param region AWS region to use (defaults to environment variable or us-east-1)
   * @param clientOverride Optional SSMClient instance for testing
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
   * @returns The SSM client instance
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
   * @param name Parameter name (without ssm:// prefix)
   * @param useCache Whether to use and update the cache (default: true)
   * @returns Promise that resolves to the parameter value
   * @throws Error if the parameter cannot be retrieved
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
        throw new Error(`Parameter ${name} has no value`);
      }

      // Cache the result if using cache
      if (useCache) {
        ssmParameterCache[name] = value;
      }

      return value;
    } catch (error) {
      throw new Error(`Error fetching SSM parameter ${name}: ${error}`);
    }
  }

  /**
   * Parse an SSM parameter reference from a string
   * @param value String potentially containing SSM parameter path in format ssm://parameter/path
   * @returns Parameter name without the prefix, or null if not an SSM reference
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
   * @param value Value to check
   * @returns True if the value is an SSM parameter reference (starts with ssm://)
   */
  isSSMReference(value: string): boolean {
    return typeof value === "string" && value.startsWith("ssm://");
  }

  /**
   * Check if a value is an S3 JSON reference
   * @param value Value to check
   * @returns True if the value is an S3 JSON reference (starts with s3:// and ends with .json)
   */
  isS3JsonReference(value: string): boolean {
    return (
      typeof value === "string" &&
      value.startsWith("s3://") &&
      value.toLowerCase().endsWith(".json")
    );
  }
}
