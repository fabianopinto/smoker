/**
 * Client factory for creating service clients
 * Creates and configures service clients based on stored configurations
 */
import { ClientType, type ServiceClient } from "../core";
import { ClientRegistry } from "./config";

// Import all client implementations
// These are needed for the factory to create instances
import { CloudWatchClient, KinesisClient, S3Client, SqsClient, SsmClient } from "../aws";
import { RestClient } from "../http";
import { KafkaClient, MqttClient } from "../messaging";

/**
 * Factory responsible for creating service client instances
 * Uses the client registry to retrieve configurations
 */
export class ClientFactory {
  /**
   * Create a new client factory
   *
   * @param registry - The client registry containing configurations
   */
  constructor(private registry: ClientRegistry) {}

  /**
   * Create a client by type and optional ID
   * Retrieves configuration from registry and instantiates appropriate client
   *
   * @param clientType - The client type (enum or string)
   * @param id - Optional client identifier
   * @returns The created and configured service client instance
   * @throws Error if client type is unknown
   */
  createClient(clientType: ClientType | string, id?: string): ServiceClient {
    // Convert string to enum if needed
    const type = typeof clientType === "string" ? clientType : clientType;

    // Get configuration for this client (empty object as fallback)
    const config = this.registry.getConfig(type, id) || {};

    // Determine final client ID (priority: explicit id > config.id > type)
    const clientId = id || config.id || type;

    // Create client instance based on type with its configuration
    return this.createClientInstance(type, clientId, config);
  }

  /**
   * Create a client instance of the specified type with configuration
   *
   * @param type - The client type
   * @param clientId - The client identifier
   * @param config - The client configuration
   * @returns The created service client instance
   * @throws Error if client type is unknown
   */
  private createClientInstance(
    type: string | ClientType,
    clientId: string,
    config: Record<string, unknown>,
  ): ServiceClient {
    switch (type) {
      case ClientType.REST:
        return new RestClient(clientId, config);
      case ClientType.MQTT:
        return new MqttClient(clientId, config);
      case ClientType.S3:
        return new S3Client(clientId, config);
      case ClientType.CLOUDWATCH:
        return new CloudWatchClient(clientId, config);
      case ClientType.SSM:
        return new SsmClient(clientId, config);
      case ClientType.SQS:
        return new SqsClient(clientId, config);
      case ClientType.KINESIS:
        return new KinesisClient(clientId, config);
      case ClientType.KAFKA:
        return new KafkaClient(clientId, config);
      default:
        throw new Error(`Unknown client type: ${type}`);
    }
  }

  /**
   * Create and initialize a client in one operation
   *
   * @param clientType - The client type (enum or string)
   * @param id - Optional client identifier
   * @returns Promise that resolves to the initialized client
   * @throws Error if initialization fails
   */
  async createAndInitialize(clientType: ClientType | string, id?: string): Promise<ServiceClient> {
    const client = this.createClient(clientType, id);
    await client.init();
    return client;
  }
}

/**
 * Create a client factory with the given registry
 * @param registry The client registry
 * @returns A new client factory
 */
export const createClientFactory = (registry: ClientRegistry): ClientFactory => {
  return new ClientFactory(registry);
};
