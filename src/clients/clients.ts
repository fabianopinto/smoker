/**
 * Base client interfaces and abstractions
 * Defines the contract and common functionality for all service clients
 */

/**
 * Interface for all service clients
 * Defines the contract that all clients must implement
 */
export interface ServiceClient {
  /**
   * Get the name of the client
   */
  getName(): string;

  /**
   * Initialize the client with configuration
   * @param config Client-specific configuration
   */
  init(config?: Record<string, unknown>): Promise<void>;

  /**
   * Check if the client is initialized and ready to use
   */
  isInitialized(): boolean;

  /**
   * Reset the client state
   */
  reset(): Promise<void>;

  /**
   * Close/destroy the client and free up resources
   */
  destroy(): Promise<void>;
}

/**
 * Abstract base client providing common functionality for all service clients
 */
export abstract class BaseServiceClient implements ServiceClient {
  protected name: string;
  protected initialized = false;
  protected config: Record<string, unknown> = {};

  /**
   * Create a new client instance
   * @param name The client name
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Get the client name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Initialize the client with configuration
   * @param config Client-specific configuration
   */
  async init(config?: Record<string, unknown>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Call client-specific initialization
    await this.initializeClient();

    this.initialized = true;
  }

  /**
   * Client-specific initialization logic
   * Must be implemented by each client
   */
  protected abstract initializeClient(): Promise<void>;

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the client state
   */
  async reset(): Promise<void> {
    // Call client-specific reset logic
    await this.resetClient();
  }

  /**
   * Client-specific reset logic
   * Can be overridden by each client
   */
  protected async resetClient(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Close/destroy the client and free up resources
   */
  async destroy(): Promise<void> {
    // Call client-specific destroy logic
    await this.destroyClient();
    this.initialized = false;
  }

  /**
   * Client-specific destroy logic
   * Can be overridden by each client
   */
  protected async destroyClient(): Promise<void> {
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
      throw new Error("SQS client not initialized");
    }
  }
}
