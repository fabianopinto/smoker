/**
 * SSM client for AWS Parameter Store operations
 */
import {
  DeleteParameterCommand,
  GetParameterCommand,
  ParameterType,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { BaseServiceClient } from "./clients";

/**
 * Interface for SSM client operations
 */
export interface SsmServiceClient {
  read(name: string, withDecryption?: boolean): Promise<string>;
  write(name: string, value: string, type?: string, overwrite?: boolean): Promise<void>;
  delete(name: string): Promise<void>;
}

/**
 * SSM client implementation for AWS Parameter Store operations
 */
export class SsmClient extends BaseServiceClient implements SsmServiceClient {
  private client: SSMClient | null = null;

  /**
   * Create a new SSM client
   */
  constructor() {
    super("SsmClient");
  }

  /**
   * Initialize the SSM client with configuration
   */
  protected async initializeClient(): Promise<void> {
    const region = this.getConfig<string>("region", "us-east-1");

    this.client = new SSMClient({
      region,
      credentials: {
        accessKeyId: this.getConfig<string>("accessKeyId", ""),
        secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
      },
      endpoint: this.getConfig<string>("endpoint", "") || undefined,
    });
  }

  /**
   * Read a parameter from SSM Parameter Store
   * @param name The parameter name
   * @param withDecryption Whether to decrypt the parameter (for SecureString)
   * @returns The parameter value
   */
  async read(name: string, withDecryption = false): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: withDecryption,
    });

    const response = await this.client.send(command);

    if (!response.Parameter || !response.Parameter.Value) {
      throw new Error(`Parameter not found: ${name}`);
    }

    return response.Parameter.Value;
  }

  /**
   * Write a parameter to the parameter store
   * @param name The parameter name
   * @param value The parameter value
   * @param type The parameter type (String, StringList, or SecureString)
   * @param overwrite Whether to overwrite an existing parameter
   */
  async write(name: string, value: string, type = "String", overwrite = true): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

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
  }

  /**
   * Delete a parameter from SSM Parameter Store
   * @param name The parameter name
   */
  async delete(name: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new DeleteParameterCommand({
      Name: name,
    });

    await this.client.send(command);
  }

  /**
   * Client-specific destroy logic
   */
  protected async destroyClient(): Promise<void> {
    this.client = null;
  }
}
