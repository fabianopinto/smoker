/**
 * Parameter resolution system
 * Handles resolving different types of parameter references (SSM, S3 JSON, etc.)
 */
import { S3Client } from "@aws-sdk/client-s3";
import { SSMClient } from "@aws-sdk/client-ssm";
import { S3ClientWrapper, SSMClientWrapper } from "./aws-clients";
import type { ConfigObject, ConfigValue } from "./config";

/**
 * Class to handle resolution of configuration parameters from various sources
 */
export class ParameterResolver {
  private s3Client: S3ClientWrapper;
  private ssmClient: SSMClientWrapper;
  private processingStack: string[] = [];
  private resolutionDepth = 0;
  private readonly MAX_DEPTH = 10; // Maximum recursion depth for nested references

  /**
   * Create a new parameter resolver
   * @param region AWS region to use (defaults to environment variable or us-east-1)
   * @param s3ClientInstance Optional S3Client instance for testing
   * @param ssmClientInstance Optional SSMClient instance for testing
   */
  constructor(region?: string, s3ClientInstance?: S3Client, ssmClientInstance?: SSMClient) {
    this.s3Client = new S3ClientWrapper(region, s3ClientInstance);
    this.ssmClient = new SSMClientWrapper(region, ssmClientInstance);
  }

  /**
   * Resolve all parameter references in a configuration value
   * Supports SSM parameters (ssm://) and S3 JSON files (s3://*.json)
   * @param value Configuration value to resolve
   * @returns Resolved configuration value
   */
  async resolveValue(value: ConfigValue): Promise<ConfigValue> {
    if (this.resolutionDepth >= this.MAX_DEPTH) {
      throw new Error(
        `Maximum parameter resolution depth (${this.MAX_DEPTH}) exceeded. Possible circular reference detected.`
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
                `Circular reference detected: ${this.processingStack.join(" -> ")} -> ${value}`
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
              `Circular reference detected: ${this.processingStack.join(" -> ")} -> ${value}`
            );
          }

          this.processingStack.push(value);
          try {
            // Get and parse the JSON file from S3
            const jsonContent = await this.s3Client.getJsonFromUrl<ConfigValue>(value);

            // Recursively resolve references in the JSON content
            return await this.resolveValue(jsonContent);
          } catch (error) {
            console.error(`Error resolving S3 JSON reference ${value}:`, error);
            // Return the original reference on error
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
   * @param config Configuration object to resolve
   * @returns Resolved configuration object
   */
  async resolveConfig(config: ConfigObject): Promise<ConfigObject> {
    return (await this.resolveValue(config)) as ConfigObject;
  }
}
