/**
 * Core Service Client Module
 *
 * This module provides the foundation for all service clients in the smoke testing framework.
 * It defines the base ServiceClient interface that all client implementations must extend,
 * as well as the ClientType enumeration for type-safe client identification.
 *
 * Specific client implementations should extend the BaseServiceClient class and
 * provide their client-specific functionality while inheriting the common behavior
 * for configuration management, initialization tracking, and lifecycle state management.
 */

/**
 * Client type enumeration
 * Defines all available service client types in the system
 * This enum is used for type-safe client identification and instantiation
 */
export enum ClientType {
  /** REST client for HTTP API interactions */
  REST = "rest",
  /** MQTT client for message broker interactions */
  MQTT = "mqtt",
  /** AWS S3 client for object storage operations */
  S3 = "s3",
  /** AWS CloudWatch client for logging and metrics */
  CLOUDWATCH = "cloudwatch",
  /** AWS SSM client for parameter store operations */
  SSM = "ssm",
  /** AWS SQS client for queue operations */
  SQS = "sqs",
  /** AWS Kinesis client for data streaming */
  KINESIS = "kinesis",
  /** Kafka client for event streaming */
  KAFKA = "kafka",
}

/**
 * Base service client interface
 *
 * Defines the contract for all service clients with initialization, reset,
 * destruction, and status methods.
 */
export interface ServiceClient {
  /**
   * Initialize the client
   * This should be called before using any client operations
   *
   * @return Promise that resolves when the client is initialized
   */
  init(): Promise<void>;

  /**
   * Reset the client to its initial state
   * This should clear any stored state but keep the client initialized
   *
   * @return Promise that resolves when the client is reset
   */
  reset(): Promise<void>;

  /**
   * Destroy the client and free up any resources
   * The client should not be used after calling this method
   *
   * @return Promise that resolves when the client is destroyed
   */
  destroy(): Promise<void>;

  /**
   * Check if the client is initialized
   *
   * @return True if the client is initialized, false otherwise
   */
  isInitialized(): boolean;

  /**
   * Get the name of the client
   *
   * @return The client name
   */
  getName(): string;

  /**
   * Clean up any resources before destroying the client
   * This method is called by destroy() and should be overridden by implementations
   *
   * @return Promise that resolves when cleanup is complete
   */
  cleanupClient(): Promise<void>;
}

/**
 * Base service client abstract class
 *
 * This abstract class provides a common implementation of the ServiceClient interface
 * that all specific client implementations can extend. It handles the core lifecycle
 * operations including initialization tracking, configuration management, and resource
 * cleanup.
 *
 * The class implements a consistent pattern for client initialization, ensuring that
 * clients are properly initialized before use and cleaned up after destruction. It also
 * provides utility methods for configuration access and state validation that derived
 * classes can leverage.
 *
 * Specific client implementations should extend this class and implement the abstract
 * initializeClient() method to provide their service-specific initialization logic.
 *
 * @implements {ServiceClient}
 */
export abstract class BaseServiceClient implements ServiceClient {
  /** Client name identifier */
  protected name: string;

  /** Initialization state flag */
  protected initialized = false;

  /** Client-specific configuration */
  protected config: Record<string, unknown> = {};

  /**
   * Create a new client instance
   *
   * @param name - The client name identifier
   * @param config - Client-specific configuration object
   */
  constructor(name: string, config: Record<string, unknown> = {}) {
    this.name = name;
    this.config = config;
  }

  /**
   * Get the client name identifier
   *
   * @return The client name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Initialize the client with provided configuration
   *
   * @return Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  init(): Promise<void> {
    // Skip initialization if the client is already initialized
    if (this.isInitialized()) {
      return Promise.resolve();
    }

    // Set the client as not initialized at the beginning
    this.initialized = false;

    // Use promise chaining to ensure initialization state is properly managed
    return this.initializeClient().then(() => {
      // Only set initialized to true if initializeClient resolves successfully
      this.initialized = true;
    });
    // If initializeClient rejects, the promise chain will propagate that rejection
    // without executing the then() block, leaving initialized as false
  }

  /**
   * Initialize client-specific functionality
   * This abstract method must be implemented by each client subclass
   *
   * @return Promise that resolves when client-specific initialization is complete
   * @throws Error if client-specific initialization fails
   */
  protected abstract initializeClient(): Promise<void>;

  /**
   * Check if the client is initialized
   *
   * @return True if the client has been successfully initialized, false otherwise
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the client to its initial state
   * Destroys the current client instance and reinitializes it
   *
   * @return Promise that resolves when reset is complete
   * @throws Error if reset fails with the underlying error message
   */
  async reset(): Promise<void> {
    // If not initialized, nothing to reset
    if (!this.initialized) {
      return;
    }

    try {
      // Clean up existing resources
      await this.destroy();

      // Re-initialize the client
      await this.init();
    } catch (error) {
      // Propagate error with context
      throw new Error(
        `Failed to reset client: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close/destroy the client and free up resources
   */
  async destroy(): Promise<void> {
    // If not initialized, nothing to destroy
    if (!this.initialized) {
      return;
    }

    try {
      // Call client-specific cleanup
      await this.cleanupClient();

      // Mark as not initialized
      this.initialized = false;
    } catch (error) {
      // Propagate error with context
      throw new Error(
        `Failed to destroy client: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Clean up client-specific resources
   * This method can be overridden by client subclasses if cleanup is required
   *
   * @return Promise that resolves when client-specific cleanup is complete
   * @throws Error if cleanup fails
   */
  async cleanupClient(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Get a configuration value
   *
   * @param key - The configuration key
   * @param defaultValue - Default value if key is not found
   * @return Configuration value
   */
  protected getConfig<T>(key: string, defaultValue: T): T {
    return key in this.config ? (this.config[key] as T) : defaultValue;
  }

  /**
   * Ensure the client is initialized
   */
  protected ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error(`${this.name} is not initialized. Call init() first.`);
    }
  }

  /**
   * Assert that the client is initialized
   *
   * @param client - The client to check
   */
  protected assertNotNull<T>(client: T | null): asserts client is NonNullable<T> {
    if (client === null || client === undefined) {
      throw new Error("Client not initialized");
    }
  }
}
