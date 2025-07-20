/**
 * Core Client Module
 *
 * This barrel file exports the foundational components of the client system,
 * including base interfaces, types, and implementations that all service
 * clients build upon. It provides the core abstractions that enable the
 * client architecture.
 *
 * These core components form the foundation of the client system and are used
 * throughout the application to ensure consistent client behavior and type safety.
 */

export { BaseServiceClient, ClientType, type ServiceClient } from "./service-client";
