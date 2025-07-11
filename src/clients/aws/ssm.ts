/**
 * SSM client for AWS Parameter Store operations
 *
 * Provides functionality to interact with the AWS Systems Manager Parameter Store.
 * Supports reading, writing, and deleting parameters with various types and encryption options.
 */
import {
  DeleteParameterCommand,
  GetParameterCommand,
  ParameterType,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { BaseServiceClient, type ServiceClient } from "../core";

/**
 * Interface for SSM client operations
 *
 * Defines the contract for SSM clients with methods for Parameter Store operations
 */
export interface SsmServiceClient extends ServiceClient {
  /**
   * Read a parameter from SSM Parameter Store
   *
   * @param name - The parameter name to read
   * @param withDecryption - Whether to decrypt SecureString parameters
   * @returns Promise resolving to the parameter value as string
   * @throws Error if parameter does not exist or cannot be read
   */
  read(name: string, withDecryption?: boolean): Promise<string>;

  /**
   * Write a parameter to SSM Parameter Store
   *
   * @param name - The parameter name to write
   * @param value - The parameter value to store
   * @param type - The parameter type (String, StringList, or SecureString)
   * @param overwrite - Whether to overwrite if parameter already exists
   * @throws Error if parameter cannot be written
   */
  write(name: string, value: string, type?: string, overwrite?: boolean): Promise<void>;

  /**
   * Delete a parameter from SSM Parameter Store
   *
   * @param name - The parameter name to delete
   * @throws Error if parameter does not exist or cannot be deleted
   */
  delete(name: string): Promise<void>;
}

/**
 * SSM client implementation for AWS Parameter Store operations
 *
 * Implements the SsmServiceClient interface for interacting with AWS Systems Manager
 * Parameter Store. Provides methods for reading, writing, and deleting parameters.
 */
export class SsmClient extends BaseServiceClient implements SsmServiceClient {
  private client: SSMClient | null = null;

  /**
   * Create a new SSM client
   *
   * @param clientId - Client identifier (defaults to "SsmClient")
   * @param config - Optional client configuration with properties:
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
   * @throws Error if client creation fails
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
        throw new Error("Failed to create SSM client instance");
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize SSM client: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Read a parameter from SSM Parameter Store
   *
   * @param name - The parameter name to read
   * @param withDecryption - Whether to decrypt SecureString parameters
   * @returns Promise resolving to the parameter value as string
   * @throws Error if parameter does not exist or cannot be read
   */
  async read(name: string, withDecryption = false): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!name) {
      throw new Error("SSM read operation requires a parameter name");
    }

    try {
      const command = new GetParameterCommand({
        Name: name,
        WithDecryption: withDecryption,
      });

      const response = await this.client.send(command);

      if (!response.Parameter || !response.Parameter.Value) {
        throw new Error(`Parameter not found: ${name}`);
      }

      return response.Parameter.Value;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Parameter not found")) {
        // Rethrow our own error for better context
        throw error;
      }
      throw new Error(
        `Failed to read parameter ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Write a parameter to SSM Parameter Store
   *
   * @param name - The parameter name to write
   * @param value - The parameter value to store
   * @param type - The parameter type (String, StringList, or SecureString)
   * @param overwrite - Whether to overwrite if parameter already exists
   * @throws Error if parameter cannot be written or parameters are invalid
   */
  async write(name: string, value: string, type = "String", overwrite = true): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // Validate input parameters
    if (!name) {
      throw new Error("SSM write operation requires a parameter name");
    }

    if (value === undefined) {
      throw new Error("SSM write operation requires a parameter value");
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
      throw new Error(
        `Failed to write parameter ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a parameter from SSM Parameter Store
   *
   * @param name - The parameter name to delete
   * @throws Error if parameter does not exist, cannot be deleted, or name is invalid
   */
  async delete(name: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!name) {
      throw new Error("SSM delete operation requires a parameter name");
    }

    try {
      const command = new DeleteParameterCommand({
        Name: name,
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(
        `Failed to delete parameter ${name}: ${error instanceof Error ? error.message : String(error)}`,
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
