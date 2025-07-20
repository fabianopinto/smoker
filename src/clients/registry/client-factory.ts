/**
 * Client Factory Module
 *
 * This module provides a factory for creating and initializing service clients
 * based on configurations stored in the client registry. It implements the
 * factory pattern to abstract client creation and configuration, supporting
 * multiple client types through a unified interface.
 */

import { ClientType, type ServiceClient } from "../core";
import { ClientRegistry } from "./client-registry";

// Import all client implementations
// These are needed for the factory to create instances
import { CloudWatchClient, KinesisClient, S3Client, SqsClient, SsmClient } from "../aws";
import { RestClient } from "../http";
import { KafkaClient, MqttClient } from "../messaging";

/**
 * Factory responsible for creating service client instances
 *
 * This class implements the factory pattern for creating service clients.
 * It uses the client registry to retrieve configurations and instantiates
 * the appropriate client implementation based on the client type.
 *
 * The factory supports multiple client types and handles the complexity of
 * client creation, configuration, and initialization, providing a simplified
 * interface for client consumers.
 *
 * @example
 * // Create a new client factory with the global registry
 * const factory = new ClientFactory(ClientRegistry.getInstance());
 *
 * @example
 * // Create a new client factory with a custom registry
 * const customRegistry = new ClientRegistry();
 * customRegistry.registerConfig(ClientType.REST, { baseUrl: "https://api.example.com" });
 * const factory = new ClientFactory(customRegistry);
 */
export class ClientFactory {
  /**
   * Create a new client factory
   *
   * Initializes a new client factory with the provided client registry.
   * The registry is used to retrieve configurations when creating clients.
   *
   * @param registry - The client registry containing configurations
   *
   * @example
   * // Create a new client factory with the global registry
   * const factory = new ClientFactory(ClientRegistry.getInstance());
   *
   * @example
   * // Create a new client factory with a custom registry
   * const customRegistry = new ClientRegistry();
   * customRegistry.registerConfig(ClientType.REST, { baseUrl: "https://api.example.com" });
   * const factory = new ClientFactory(customRegistry);
   */
  constructor(private registry: ClientRegistry) {}

  /**
   * Create a client by type and optional ID
   *
   * Retrieves configuration from the registry and instantiates the appropriate
   * client implementation based on the client type. If an ID is provided, it will
   * attempt to retrieve a configuration specific to that ID, falling back to the
   * default configuration for the client type if not found.
   *
   * @param clientType - The client type (enum or string)
   * @param id - Optional client identifier
   * @return The created and configured service client instance
   * @throws Error if client type is unknown or configuration is invalid
   *
   * @example
   * // Create a default REST client
   * const restClient = factory.createClient(ClientType.REST);
   *
   * // Create a specific S3 client with ID
   * const backupS3Client = factory.createClient(ClientType.S3, "backup");
   */
  createClient(clientType: ClientType | string, id?: string): ServiceClient {
    // Get configuration for this client (empty object as fallback)
    const config = this.registry.getConfig(clientType, id) || {};

    // Determine final client ID (priority: explicit id > config.id > clientType)
    const configId = typeof config.id === "string" ? config.id : undefined;
    const clientId = id || configId || clientType;

    // Create client instance based on type with its configuration
    return this.createClientInstance(clientType, clientId, config);
  }

  /**
   * Create a client instance of the specified type with configuration
   *
   * This method handles the actual instantiation of client objects based on
   * the client type. It creates the appropriate client implementation and
   * passes the configuration and client ID to the constructor.
   *
   * @param type - The client type
   * @param clientId - The client identifier
   * @param config - The client configuration
   * @return The created service client instance
   * @throws Error if client type is unknown or not supported
   * @private
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
   * Creates a client and calls its init method to perform any necessary
   * initialization. This is a convenience method for cases where the client
   * needs to be ready for use immediately after creation.
   *
   * @param clientType - The client type (enum or string)
   * @param id - Optional client identifier
   * @return Promise that resolves to the initialized client
   * @throws Error if client creation or initialization fails
   *
   * @example
   * // Create and initialize an S3 client
   * try {
   *   const s3Client = await factory.createAndInitialize(ClientType.S3);
   *   // Client is ready to use
   *   await s3Client.read("path/to/file.txt");
   * } catch (error) {
   *   console.error("Failed to initialize S3 client:", error);
   * }
   */
  async createAndInitialize(clientType: ClientType | string, id?: string): Promise<ServiceClient> {
    const client = this.createClient(clientType, id);
    await client.init();
    return client;
  }
}
