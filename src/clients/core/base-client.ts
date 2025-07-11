/**
 * Base service client implementation
 * Provides common functionality and state management for all service clients
 *
 * This abstract class implements the ServiceClient interface and handles
 * common aspects like configuration management, initialization tracking,
 * and lifecycle state management. Specific client implementations should extend
 * this class and provide their client-specific functionality.
 */
import type { ServiceClient } from "./interfaces";

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
   * @returns The client name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Initialize the client with provided configuration
   *
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  init(): Promise<void> {
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
   * @returns Promise that resolves when client-specific initialization is complete
   * @throws Error if client-specific initialization fails
   */
  protected abstract initializeClient(): Promise<void>;

  /**
   * Check if the client is initialized
   *
   * @returns True if the client has been successfully initialized, false otherwise
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the client to its initial state
   * Destroys the current client instance and reinitializes it
   *
   * @returns Promise that resolves when reset is complete
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
   * @returns Promise that resolves when client-specific cleanup is complete
   * @throws Error if cleanup fails
   */
  async cleanupClient(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Get a configuration value
   * @param key The configuration key
   * @param defaultValue Default value if key is not found
   * @returns Configuration value
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
   * @param client The client to check
   */
  protected assertNotNull<T>(client: T | null): asserts client is NonNullable<T> {
    if (!client) {
      throw new Error("Client not initialized");
    }
  }
}
