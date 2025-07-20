/**
 * Parameter Resolution Module
 *
 * This module provides functionality for resolving external parameter references in
 * configuration objects. It supports resolving references to AWS SSM parameters and
 * S3 JSON objects, with recursive resolution capabilities.
 *
 * Key features:
 * - SSM parameter resolution (ssm:// references)
 * - S3 JSON object resolution (s3://*.json references)
 * - Recursive resolution of nested references
 * - Circular reference detection
 * - Maximum depth limiting to prevent infinite recursion
 */

import { S3Client } from "@aws-sdk/client-s3";
import { SSMClient } from "@aws-sdk/client-ssm";
import { S3ClientWrapper, SSMClientWrapper } from "../aws";
import type { ConfigObject, ConfigValue } from "./configuration";

/**
 * Parameter Resolver class
 *
 * Handles the resolution of external parameter references in configuration objects.
 * This class provides functionality to resolve SSM parameter references and S3 JSON
 * references, with support for recursive resolution and circular reference detection.
 *
 * The resolver maintains a processing stack and depth counter to detect circular
 * references and prevent infinite recursion. It works with both primitive values
 * and complex nested objects, resolving references at any level of nesting.
 */
export class ParameterResolver {
  private s3Client: S3ClientWrapper;
  private ssmClient: SSMClientWrapper;
  private processingStack: string[] = [];
  private resolutionDepth = 0;
  private readonly MAX_DEPTH = 10; // Maximum recursion depth for nested references

  /**
   * Create a new parameter resolver
   *
   * Initializes a new parameter resolver with AWS clients for S3 and SSM access.
   * The resolver can use custom client instances for testing purposes or create
   * new instances with the specified region.
   *
   * @param region - AWS region to use (defaults to environment variable or us-east-1)
   * @param s3ClientInstance - Optional S3Client instance for testing
   * @param ssmClientInstance - Optional SSMClient instance for testing
   */
  constructor(region?: string, s3ClientInstance?: S3Client, ssmClientInstance?: SSMClient) {
    this.s3Client = new S3ClientWrapper(region, s3ClientInstance);
    this.ssmClient = new SSMClientWrapper(region, ssmClientInstance);
  }

  /**
   * Resolve all parameter references in a configuration value
   *
   * Recursively resolves any parameter references in the provided configuration value.
   * This method handles different types of values:
   * - String values: Checks for and resolves SSM and S3 JSON references
   * - Array values: Recursively resolves each item in the array
   * - Object values: Recursively resolves each property in the object
   * - Primitive values: Returns as-is
   *
   * The method includes circular reference detection and depth limiting to
   * prevent infinite recursion when resolving nested references.
   *
   * @param value - Configuration value to resolve
   * @return Promise resolving to the resolved configuration value
   * @throws Error if circular references are detected or maximum depth is exceeded
   */
  async resolveValue(value: ConfigValue): Promise<ConfigValue> {
    if (this.resolutionDepth >= this.MAX_DEPTH) {
      throw new Error(
        `Maximum parameter resolution depth (${this.MAX_DEPTH}) exceeded. Possible circular reference detected.`,
      );
    }

    this.resolutionDepth++;
    try {
      if (typeof value === "string") {
        // Check for SSM parameter reference
        if (this.ssmClient.isSSMReference(value)) {
          const paramName = this.ssmClient.parseSSMUrl(value);
          if (paramName) {
            // Check for circular references
            if (this.processingStack.includes(value)) {
              throw new Error(
                `Circular reference detected: ${this.processingStack.join(" -> ")} -> ${value}`,
              );
            }

            this.processingStack.push(value);
            try {
              // Get the parameter value
              const paramValue = await this.ssmClient.getParameter(paramName);

              // If the parameter value is a string that looks like another reference,
              // recursively resolve it
              if (
                typeof paramValue === "string" &&
                (this.ssmClient.isSSMReference(paramValue) ||
                  this.ssmClient.isS3JsonReference(paramValue))
              ) {
                return await this.resolveValue(paramValue);
              }

              return paramValue;
            } finally {
              this.processingStack.pop();
            }
          }
        }

        // Check for S3 JSON file reference
        if (this.ssmClient.isS3JsonReference(value)) {
          // Check for circular references
          if (this.processingStack.includes(value)) {
            throw new Error(
              `Circular reference detected: ${this.processingStack.join(" -> ")} -> ${value}`,
            );
          }

          this.processingStack.push(value);
          try {
            // Get and parse the JSON file from S3
            const jsonContent = await this.s3Client.getContentFromUrl<ConfigValue>(value);

            // Recursively resolve references in the JSON content
            return await this.resolveValue(jsonContent);
          } catch (error) {
            // Rethrow circular reference errors instead of catching them
            if (error instanceof Error && error.message.includes("Circular reference")) {
              throw error;
            }

            console.error(`Error resolving S3 JSON reference ${value}:`, error);
            // Return the original reference on non-circular reference errors
            return value;
          } finally {
            this.processingStack.pop();
          }
        }

        // Not a special reference, return as-is
        return value;
      } else if (Array.isArray(value)) {
        // Resolve array items recursively
        const resolvedArray: ConfigValue[] = [];
        for (const item of value) {
          resolvedArray.push(await this.resolveValue(item));
        }
        return resolvedArray;
      } else if (value !== null && typeof value === "object") {
        // Resolve object properties recursively
        const resolvedObject: ConfigObject = {};
        for (const [key, val] of Object.entries(value)) {
          resolvedObject[key] = await this.resolveValue(val);
        }
        return resolvedObject;
      }

      // Primitive values (number, boolean, null) are returned as-is
      return value;
    } finally {
      this.resolutionDepth--;
    }
  }

  /**
   * Resolve all parameter references in a configuration object
   *
   * Convenience method that resolves all parameter references in a configuration object.
   * This method calls resolveValue internally but ensures that the result is cast back
   * to a ConfigObject type for easier use with configuration objects.
   *
   * @param config - Configuration object to resolve
   * @return Promise resolving to the resolved configuration object
   * @throws Error if circular references are detected or maximum depth is exceeded
   */
  async resolveConfig(config: ConfigObject): Promise<ConfigObject> {
    return (await this.resolveValue(config)) as ConfigObject;
  }
}
