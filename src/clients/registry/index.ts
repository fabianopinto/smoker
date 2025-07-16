/**
 * Client Registry Module
 *
 * This barrel file exports all registry-related implementations
 * for centralized access to client configuration and factory functionality.
 * It provides a unified API for client registration and instantiation.
 */

export {
  ClientRegistry,
  createClientRegistry,
  createClientRegistryFromConfig,
  type ClientConfig,
} from "./config";
export { ClientFactory, createClientFactory } from "./factory";
