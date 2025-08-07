/**
 * World exports
 *
 * This module exports the SmokeWorld interface and related components for use in BDD step definitions.
 * The SmokeWorld interface provides typed access to service clients, test data
 * storage and retrieval, and property management for storing and accessing test
 * state.
 *
 * Also exports the WorldProperties implementation for property management functionality.
 */

export { DefaultConfigurationProvider, type SmokeWorld, SmokeWorldImpl } from "./world";
export { createWorldProperties, WorldProperties } from "./world-properties";
