/**
 * Core client interfaces for the smoke testing framework
 *
 * This module provides the base ServiceClient interface that all client implementations
 * must extend. It defines the core methods required for client lifecycle management.
 */

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
   * @returns Promise that resolves when the client is initialized
   */
  init(): Promise<void>;

  /**
   * Reset the client to its initial state
   * This should clear any stored state but keep the client initialized
   *
   * @returns Promise that resolves when the client is reset
   */
  reset(): Promise<void>;

  /**
   * Destroy the client and free up any resources
   * The client should not be used after calling this method
   *
   * @returns Promise that resolves when the client is destroyed
   */
  destroy(): Promise<void>;

  /**
   * Check if the client is initialized
   *
   * @returns True if the client is initialized, false otherwise
   */
  isInitialized(): boolean;

  /**
   * Get the name of the client
   *
   * @returns The client name
   */
  getName(): string;

  /**
   * Clean up any resources before destroying the client
   * This method is called by destroy() and should be overridden by implementations
   *
   * @returns Promise that resolves when cleanup is complete
   */
  cleanupClient(): Promise<void>;
}
