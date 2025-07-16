/**
 * Core Client Module
 *
 * This barrel file exports the foundational components of the client system,
 * including base interfaces, types, and implementations that all service
 * clients build upon. It provides the core abstractions that enable the
 * client architecture.
 */

export { BaseServiceClient } from "./base-client";
export type { ServiceClient } from "./interfaces";
export { ClientType, ClientTypeUtils } from "./types";
