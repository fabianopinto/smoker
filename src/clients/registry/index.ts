/**
 * Registry exports
 * Provides centralized access to client configuration and factory functionality
 */

export {
  ClientRegistry,
  createClientRegistry,
  createClientRegistryFromConfig,
  type ClientConfig,
} from "./config";
export { ClientFactory, createClientFactory } from "./factory";
