/**
 * Test utilities for SmokeWorld tests
 *
 * This file contains common mock implementations and helper functions
 * that are used across multiple test files.
 */
import { vi } from "vitest";
import type { ClientType } from "../../src/clients";
import { Configuration } from "../../src/support";
import type { PropertyMap, PropertyPath, PropertyValue } from "../../src/world";

/**
 * Mock implementation of a service client for testing
 */
export interface MockClient {
  id?: string;
  init: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  isInitialized: ReturnType<typeof vi.fn>;
  getName: ReturnType<typeof vi.fn>;
  cleanupClient: ReturnType<typeof vi.fn>;
}

/**
 * Mock implementation of a client registry for testing
 */
export interface MockRegistry {
  registerConfig: ReturnType<typeof vi.fn>;
  getConfig: ReturnType<typeof vi.fn>;
  hasConfig: ReturnType<typeof vi.fn>;
  getAllConfigs: ReturnType<typeof vi.fn>;
  getConfigsByType: ReturnType<typeof vi.fn>;
  registerConfigs: ReturnType<typeof vi.fn>;
  registerConfigArray: ReturnType<typeof vi.fn>;
}

/**
 * Mock implementation of a client factory for testing
 */
export interface MockFactory {
  createClient: ReturnType<typeof vi.fn>;
  createAndInitialize?: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock service client for testing
 *
 * @param id Optional client identifier
 * @param options Configuration options for the mock client
 * @returns A mock service client
 */
export function createMockClient(
  id?: string,
  options: {
    initFails?: boolean;
    resetFails?: boolean;
    destroyFails?: boolean;
    isInitialized?: boolean;
  } = {},
): MockClient {
  return {
    id,
    init: vi.fn().mockImplementation(() => {
      if (options.initFails) {
        return Promise.reject(new Error(`Failed to initialize client ${id}`));
      }
      return Promise.resolve(undefined);
    }),
    reset: vi.fn().mockImplementation(() => {
      if (options.resetFails) {
        return Promise.reject(new Error(`Failed to reset client ${id}`));
      }
      return Promise.resolve(undefined);
    }),
    destroy: vi.fn().mockImplementation(() => {
      if (options.destroyFails) {
        return Promise.reject(new Error(`Failed to destroy client ${id}`));
      }
      return Promise.resolve(undefined);
    }),
    isInitialized: vi.fn().mockReturnValue(options.isInitialized ?? false),
    getName: vi.fn().mockReturnValue(id),
    cleanupClient: vi.fn().mockResolvedValue(undefined),
  } as unknown as MockClient;
}

/**
 * Create a mock client registry for testing
 *
 * @param configEntries Optional initial configuration entries
 * @returns A mock client registry
 */
export function createMockRegistry(configEntries: [string, unknown][] = []): MockRegistry {
  return {
    registerConfig: vi.fn(),
    getConfig: vi.fn().mockReturnValue({}),
    hasConfig: vi.fn().mockReturnValue(false),
    getAllConfigs: vi.fn().mockReturnValue(new Map(configEntries)),
    getConfigsByType: vi.fn(),
    registerConfigs: vi.fn(),
    registerConfigArray: vi.fn(),
  };
}

/**
 * Create a mock client factory for testing
 *
 * @param clientMap Map of client types/ids to mock clients
 * @returns A mock client factory
 */
export function createMockFactory(clientMap: Record<string, MockClient>): MockFactory {
  return {
    createClient: vi.fn().mockImplementation((type: ClientType | string, id?: string) => {
      const key = id ? `${type}:${id}` : type;
      return clientMap[key] || null;
    }),
    createAndInitialize: vi
      .fn()
      .mockImplementation(async (type: ClientType | string, id?: string) => {
        const client = clientMap[id ? `${type}:${id}` : type];
        if (client) await client.init();
        return client;
      }),
  };
}

/**
 * Mock implementation of the parameter resolution methods from SmokeWorldImpl
 * This allows us to test these methods without triggering Cucumber's initialization
 */
export class MockParameterResolver {
  private properties: PropertyMap = {};

  // Property management methods
  setProperty(path: PropertyPath, value: PropertyValue): void {
    const segments = typeof path === "string" ? path.split(".") : path;

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    let current = this.properties;

    // Navigate to the parent of the property to set
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];

      // Create nested objects if they don't exist
      if (!current[segment] || typeof current[segment] !== "object" || current[segment] === null) {
        current[segment] = {};
      }

      current = current[segment] as PropertyMap;
    }

    // Set the property value
    current[segments[segments.length - 1]] = value;
  }

  getProperty(path: PropertyPath): PropertyValue {
    const segments = typeof path === "string" ? path.split(".") : path;

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    let current: PropertyValue = this.properties;

    // Navigate to the property
    for (const segment of segments) {
      // Check if current is an object and has the property
      if (current === null || typeof current !== "object" || !(segment in current)) {
        throw new Error(`Property not found at path: ${segments.join(".")}`);
      }

      // Move to the next level
      current = (current as PropertyMap)[segment];
    }

    return current;
  }

  hasProperty(path: PropertyPath): boolean {
    const segments = typeof path === "string" ? path.split(".") : path;

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    try {
      this.getProperty(path);
      return true;
    } catch {
      return false;
    }
  }

  // Parameter resolution methods
  containsConfigReferences(input: string): boolean {
    if (typeof input !== "string") {
      return false;
    }
    return /config:([a-zA-Z0-9._-]+)/g.test(input);
  }

  containsPropertyReferences(input: string): boolean {
    if (typeof input !== "string") {
      return false;
    }
    return /prop:([a-zA-Z0-9._-]+)/g.test(input);
  }

  resolveConfigValues(input: string): string {
    if (typeof input !== "string") {
      return String(input);
    }

    // Special case for adjacent config references like config:firstconfig:second
    // First, handle the case where config references are directly adjacent
    const adjacentPattern = /config:([a-zA-Z0-9]+)config:([a-zA-Z0-9._-]+)/g;
    const result = input.replace(adjacentPattern, (match, path1, path2) => {
      const config = Configuration.getInstance();
      const value1 = config.getValue(path1);
      const value2 = config.getValue(path2);

      if (value1 === undefined) {
        throw new Error(`Configuration value not found: ${path1}`);
      }
      if (value2 === undefined) {
        throw new Error(`Configuration value not found: ${path2}`);
      }

      return String(value1) + String(value2);
    });

    // Then process any remaining standard config references
    return result.replace(/config:([a-zA-Z0-9._-]+)/g, (match, path) => {
      // If a configuration root key is set, use it as prefix
      let fullPath = path;
      if (this.hasProperty("config.rootKey")) {
        const rootKey = this.getProperty("config.rootKey") as string;
        fullPath = `${rootKey}.${path}`;
      }

      const config = Configuration.getInstance();
      const value = config.getValue(fullPath);

      if (value === undefined) {
        // Try without the root key as fallback
        if (fullPath !== path) {
          const fallbackValue = config.getValue(path);
          if (fallbackValue !== undefined) {
            return String(fallbackValue);
          }
        }
        throw new Error(`Configuration value not found: ${path}`);
      }

      return String(value);
    });
  }

  resolvePropertyValues(input: string): string {
    if (typeof input !== "string") {
      return String(input);
    }

    // Use a regex to find all property references
    return input.replace(/prop:([a-zA-Z0-9._-]+)/g, (match, path) => {
      try {
        const value = this.getProperty(path);
        return String(value);
      } catch {
        throw new Error(`Property not found: ${path}`);
      }
    });
  }

  resolveStepParameter(param: string): string {
    if (typeof param !== "string") {
      return String(param);
    }

    // First resolve config values, then property values
    let result = param;

    if (this.containsConfigReferences(result)) {
      result = this.resolveConfigValues(result);
    }

    if (this.containsPropertyReferences(result)) {
      result = this.resolvePropertyValues(result);
    }

    return result;
  }
}

/**
 * Create a mock Configuration instance for testing
 *
 * @param valueMap Map of configuration paths to values
 * @returns A mock Configuration instance
 */
export function createMockConfiguration(valueMap: Record<string, unknown> = {}): Configuration {
  const mockGetValue = vi.fn().mockImplementation((path: string) => valueMap[path]);

  return {
    getValue: mockGetValue,
    addConfigurationSource: vi.fn(),
    loadConfiguration: vi.fn(),
    isLoaded: vi.fn().mockReturnValue(true),
    getConfigSources: vi.fn().mockReturnValue([]),
    configSources: [],
    config: {},
    loaded: true,
  } as unknown as Configuration;
}

/**
 * Create a minimal mock for a property handler
 */
export class PropertyHandler {
  private properties: PropertyMap = {};

  setProperty(path: PropertyPath, value: PropertyValue): void {
    const segments = typeof path === "string" ? path.split(".") : path;

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    let current = this.properties;

    // Navigate to the parent of the property to set
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];

      // Create nested objects if they don't exist
      if (!current[segment] || typeof current[segment] !== "object" || current[segment] === null) {
        current[segment] = {};
      }

      current = current[segment] as PropertyMap;
    }

    // Set the property value
    current[segments[segments.length - 1]] = value;
  }

  getProperty(path: PropertyPath): PropertyValue {
    const segments = typeof path === "string" ? path.split(".") : path;

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    let current: PropertyValue = this.properties;

    // Navigate to the property
    for (const segment of segments) {
      // Check if current is an object and has the property
      if (current === null || typeof current !== "object" || !(segment in current)) {
        throw new Error(`Property not found at path: ${segments.join(".")}`);
      }

      // Move to the next level
      current = (current as PropertyMap)[segment];
    }

    return current;
  }

  hasProperty(path: PropertyPath): boolean {
    const segments = typeof path === "string" ? path.split(".") : path;

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    try {
      this.getProperty(path);
      return true;
    } catch {
      return false;
    }
  }

  removeProperty(path: PropertyPath): void {
    const segments = typeof path === "string" ? path.split(".") : path;

    if (segments.length === 0) {
      throw new Error("Property path cannot be empty");
    }

    let current = this.properties;

    // Navigate to the parent of the property to remove
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];

      // Check if the path exists
      if (!current[segment] || typeof current[segment] !== "object" || current[segment] === null) {
        throw new Error(`Property not found at path: ${segments.join(".")}`);
      }

      // Move to the next level
      current = current[segment] as PropertyMap;
    }

    const lastSegment = segments[segments.length - 1];

    // Check if the property exists before removing
    if (!(lastSegment in current)) {
      throw new Error(`Property not found at path: ${segments.join(".")}`);
    }

    // Remove the property using Reflect.deleteProperty instead of delete operator
    Reflect.deleteProperty(current, lastSegment);
  }

  getPropertyMap(): PropertyMap {
    // Return a deep copy to prevent direct modification
    return JSON.parse(JSON.stringify(this.properties));
  }
}
