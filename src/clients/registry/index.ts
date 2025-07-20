/**
 * Client Registry Module
 *
 * This barrel file exports all registry-related implementations and interfaces
 * for centralized access to client configuration and factory functionality.
 * It provides a unified API for client registration and instantiation.
 */

export { ClientFactory } from "./client-factory";
export { type ClientConfig, ClientRegistry, type ReadonlyClientConfig } from "./client-registry";
