/**
 * @fileoverview AWS SSM Client Module
 *
 * This module provides interfaces and implementations for AWS Systems Manager (SSM) service clients.
 * It defines the contract for SSM Parameter Store operations such as reading, writing, and deleting
 * parameters. The implementation uses the AWS SDK to interact with SSM Parameter Store.
 *
 * The module includes functionality to interact with AWS Systems Manager Parameter Store,
 * supporting operations like retrieving parameter values, storing parameters with various types
 * and encryption options, and deleting parameters when they are no longer needed.
 */

import {
  DeleteParameterCommand,
  GetParameterCommand,
  ParameterType,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { AwsError, ValidationError } from "@fabianopinto/errors";
import { BaseServiceClient, type ServiceClient } from "../core";

/**
 * Interface for SSM service client
 *
 * Defines the contract for interacting with AWS Systems Manager Parameter Store,
 * providing methods to read, write, and delete parameters. Extends the base
 * ServiceClient interface to ensure consistent lifecycle management.
 *
 * This interface provides a comprehensive API for working with SSM parameters,
 * including support for different parameter types (String, StringList, SecureString),
 * parameter encryption/decryption, and overwrite controls. Implementations handle
 * the details of AWS SDK interactions while providing a simplified API for
 * parameter store operations.
 *
 * @extends {ServiceClient} The base service client interface
 */
export interface SsmServiceClient extends ServiceClient {
  /**
   * Read a parameter from SSM Parameter Store
   *
   * @param {string} name - The parameter name to read
   * @param {boolean} [withDecryption] - Whether to decrypt SecureString parameters
   * @returns {Promise<string>} Promise resolving to the parameter value as string
   * @throws {ValidationError} if input is invalid
   * @throws {AwsError} if parameter does not exist or cannot be read
   */
  read(name: string, withDecryption?: boolean): Promise<string>;

  /**
   * Write a parameter to SSM Parameter Store
   *
   * @param {string} name - The parameter name to write
   * @param {string} value - The parameter value to store
   * @param {string} [type] - The parameter type (String, StringList, or SecureString)
   * @param {boolean} [overwrite] - Whether to overwrite if parameter already exists
   * @throws {ValidationError} if parameters are invalid
   * @throws {AwsError} if parameter cannot be written
   */
  write(name: string, value: string, type?: string, overwrite?: boolean): Promise<void>;

  /**
   * Delete a parameter from SSM Parameter Store
   *
   * @param {string} name - The parameter name to delete
   * @throws {ValidationError} if name is invalid
   * @throws {AwsError} if parameter does not exist or cannot be deleted
   */
  delete(name: string): Promise<void>;
}

/**
 * SSM client implementation for AWS Parameter Store operations
 *
 * This class provides methods to interact with AWS Systems Manager Parameter Store,
 * including reading, writing, and deleting parameters. It implements the SsmServiceClient
 * interface and extends BaseServiceClient for consistent lifecycle management.
 *
 * The client handles AWS SDK initialization, authentication, and provides a simplified
 * API for common Parameter Store operations. It supports different parameter types
 * (String, StringList, SecureString) and includes features like parameter overwriting
 * and secure parameter handling with optional KMS encryption.
 *
 * @extends {BaseServiceClient} The base service client class
 * @implements {SsmServiceClient} The interface for SSM service client
 */
export class SsmClient extends BaseServiceClient implements SsmServiceClient {
  private client: SSMClient | null = null;

  /**
   * Create a new SSM client
   *
   * @param {string} clientId - Client identifier (defaults to "SsmClient")
   * @param {Record<string, unknown>} [config] - Optional client configuration with properties:
   *   - region: AWS region (default: "us-east-1")
   *   - accessKeyId: AWS access key ID
   *   - secretAccessKey: AWS secret access key
   *   - endpoint: Optional custom endpoint for local development
   *   - kmsKeyId: Optional KMS key ID for SecureString parameters
   */
  constructor(clientId = "SsmClient", config?: Record<string, unknown>) {
    super(clientId, config);
  }

  /**
   * Initialize the SSM client with AWS configuration
   *
   * @throws {AwsError} if client creation fails
   */
  protected async initializeClient(): Promise<void> {
    try {
      const region = this.getConfig<string>("region", "us-east-1");

      this.client = new SSMClient({
        region,
        credentials: {
          accessKeyId: this.getConfig<string>("accessKeyId", ""),
          secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
        },
        endpoint: this.getConfig<string>("endpoint", "") || undefined,
      });

      if (!this.client) {
        throw new AwsError("Failed to create SSM client instance", {
          code: "SSM_INIT_FAILED",
          context: { component: "ssm", reason: "client null" },
          isOperational: false,
        });
      }
    } catch (error) {
      throw new AwsError("Failed to initialize SSM client", {
        code: "SSM_INIT_FAILED",
        context: {
          component: "ssm",
          reason: error instanceof Error ? error.message : String(error),
        },
        isOperational: true,
        cause: error,
      });
    }
  }

  /**
   * Read a parameter from SSM Parameter Store
   *
   * @param {string} name - The parameter name to read
   * @param {boolean} [withDecryption] - Whether to decrypt SecureString parameters
   * @returns {Promise<string>} Promise resolving to the parameter value as string
   * @throws {ValidationError} if input is invalid
   * @throws {AwsError} if parameter does not exist or cannot be read
   */
  async read(name: string, withDecryption = false): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!name) {
      throw new ValidationError("SSM read operation requires a parameter name", {
        code: "SSM_PARAM_NAME_REQUIRED",
        context: { component: "ssm" },
        isOperational: false,
      });
    }

    try {
      const command = new GetParameterCommand({
        Name: name,
        WithDecryption: withDecryption,
      });

      const response = await this.client.send(command);

      if (!response.Parameter) {
        throw new AwsError(`Parameter not found: ${name}`, {
          code: "SSM_PARAMETER_NOT_FOUND",
          context: { component: "ssm", name, reason: "no parameter" },
          isOperational: false,
        });
      }

      if (response.Parameter.Value === undefined || response.Parameter.Value === null) {
        throw new AwsError(`Parameter not found: ${name}`, {
          code: "SSM_PARAMETER_NOT_FOUND",
          context: { component: "ssm", name, reason: "no value" },
          isOperational: false,
        });
      }

      return response.Parameter.Value;
    } catch (error) {
      if (error instanceof AwsError || error instanceof ValidationError) {
        throw error;
      }
      throw new AwsError(
        `Failed to read parameter ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: "SSM_READ_FAILED",
          context: {
            component: "ssm",
            name,
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Write a parameter to SSM Parameter Store
   *
   * @param {string} name - The parameter name to write
   * @param {string} value - The parameter value to store
   * @param {string} [type] - The parameter type (String, StringList, or SecureString)
   * @param {boolean} [overwrite] - Whether to overwrite if parameter already exists
   * @throws {ValidationError} if parameters are invalid
   * @throws {AwsError} if parameter cannot be written
   */
  async write(name: string, value: string, type = "String", overwrite = true): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // Validate input parameters
    if (!name) {
      throw new ValidationError("SSM write operation requires a parameter name", {
        code: "SSM_PARAM_NAME_REQUIRED",
        context: { component: "ssm" },
        isOperational: false,
      });
    }

    if (value === undefined) {
      throw new ValidationError("SSM write operation requires a parameter value", {
        code: "SSM_PARAM_VALUE_REQUIRED",
        context: { component: "ssm" },
        isOperational: false,
      });
    }

    try {
      // Convert string type to proper ParameterType enum
      let paramType: ParameterType;
      switch (type.toUpperCase()) {
        case "SECURESTRING":
          paramType = ParameterType.SECURE_STRING;
          break;
        case "STRINGLIST":
          paramType = ParameterType.STRING_LIST;
          break;
        default:
          paramType = ParameterType.STRING;
          break;
      }

      const command = new PutParameterCommand({
        Name: name,
        Value: value,
        Type: paramType,
        Overwrite: overwrite,
        // Add KMS key ID if type is SecureString
        ...(paramType === ParameterType.SECURE_STRING && {
          KeyId: this.getConfig<string>("kmsKeyId", ""),
        }),
      });

      await this.client.send(command);
    } catch (error) {
      throw new AwsError(
        `Failed to write parameter ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: "SSM_WRITE_FAILED",
          context: {
            component: "ssm",
            name,
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Delete a parameter from SSM Parameter Store
   *
   * @param {string} name - The parameter name to delete
   * @throws {ValidationError} if name is invalid
   * @throws {AwsError} if parameter does not exist or cannot be deleted
   */
  async delete(name: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!name) {
      throw new ValidationError("SSM delete operation requires a parameter name", {
        code: "SSM_PARAM_NAME_REQUIRED",
        context: { component: "ssm" },
        isOperational: false,
      });
    }

    try {
      const command = new DeleteParameterCommand({
        Name: name,
      });

      await this.client.send(command);
    } catch (error) {
      throw new AwsError(
        `Failed to delete parameter ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: "SSM_DELETE_FAILED",
          context: {
            component: "ssm",
            name,
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Client-specific cleanup logic
   * Releases AWS SSM client resources
   */
  async cleanupClient(): Promise<void> {
    // SSM client doesn't need explicit cleanup beyond nullifying the reference
    this.client = null;
  }
}
