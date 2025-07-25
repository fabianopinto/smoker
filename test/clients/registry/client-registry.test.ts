/**
 * Tests for the ClientRegistry class
 *
 * These tests verify the functionality of the ClientRegistry which manages
 * client configurations by type and ID.
 *
 * Test Coverage:
 * - Singleton pattern (getInstance, resetInstance)
 * - Configuration registration (registerConfig, registerConfigs)
 * - Configuration retrieval (getConfig, getAllConfigs)
 * - Configuration checking (hasConfig)
 * - Registry management (clearConfigs)
 * - Key generation (getConfigKey - tested indirectly)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientType } from "../../../src/clients/core";
import { type ClientConfig, ClientRegistry } from "../../../src/clients/registry/client-registry";

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client configurations
  CONFIG_REST: { baseUrl: "https://api.example.com", timeout: 5000, retries: 3 } as ClientConfig,
  CONFIG_S3: { region: "us-west-2", bucket: "test-bucket" } as ClientConfig,

  // Client identifiers
  ID_API: "api1",
  ID_BACKUP: "backup",
  ID_CUSTOM_CLIENT: "custom-client",
  ID_NON_EXISTENT: "non-existent",

  // Test values
  URL_NEW_API: "https://new-api.example.com",
  URL_MUTATED_API: "https://mutated.example.com",
};

/**
 * Tests for the ClientRegistry class
 */
describe("ClientRegistry", () => {
  // Test instance
  let registry: ClientRegistry;

  beforeEach(() => {
    // Reset the singleton instance before each test
    ClientRegistry.resetInstance();
    registry = ClientRegistry.getInstance();
    // Reset the singleton instance before each test to ensure isolation
    ClientRegistry.resetInstance();
    // Create a fresh registry for each test
    registry = new ClientRegistry();
  });

  afterEach(() => {
    // Clean up after each test
    ClientRegistry.resetInstance();
  });

  /**
   * Tests for the singleton pattern implementation
   * Verifies that getInstance returns the same instance and resetInstance works correctly
   */
  describe("getInstance", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = ClientRegistry.getInstance();
      const instance2 = ClientRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetInstance is called", () => {
      const instance1 = ClientRegistry.getInstance();
      ClientRegistry.resetInstance();
      const instance2 = ClientRegistry.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it("should use the provided instance when resetInstance is called with an instance", () => {
      const customRegistry = new ClientRegistry();
      customRegistry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      ClientRegistry.resetInstance(customRegistry);
      const instance = ClientRegistry.getInstance();

      expect(instance).toBe(customRegistry);
      expect(instance.hasConfig(ClientType.REST)).toBe(true);
    });
  });

  /**
   * Tests for the registerConfig method
   * Verifies that configurations can be registered for different client types and IDs
   */
  describe("registerConfig", () => {
    it("should register a configuration for a client type", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      expect(registry.hasConfig(ClientType.REST)).toBe(true);
    });

    it("should register a configuration for a client type with an ID", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST, TEST_FIXTURES.ID_API);

      expect(registry.hasConfig(ClientType.REST, TEST_FIXTURES.ID_API)).toBe(true);
    });

    it("should override an existing configuration for the same client type", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      const newConfig = { baseUrl: TEST_FIXTURES.URL_NEW_API };
      registry.registerConfig(ClientType.REST, newConfig);

      const config = registry.getConfig(ClientType.REST);
      expect(config).toEqual(expect.objectContaining(newConfig));
    });

    it("should accept string client types", () => {
      registry.registerConfig(TEST_FIXTURES.ID_CUSTOM_CLIENT, TEST_FIXTURES.CONFIG_REST);

      expect(registry.hasConfig(TEST_FIXTURES.ID_CUSTOM_CLIENT)).toBe(true);
    });
  });

  /**
   * Tests for the registerConfigs method
   * Verifies that multiple configurations can be registered at once
   */
  describe("registerConfigs", () => {
    it("should register multiple configurations from an object", () => {
      const configs = {
        [ClientType.REST]: TEST_FIXTURES.CONFIG_REST,
        [ClientType.S3]: TEST_FIXTURES.CONFIG_S3,
      };

      registry.registerConfigs(configs);

      expect(registry.hasConfig(ClientType.REST)).toBe(true);
      expect(registry.hasConfig(ClientType.S3)).toBe(true);
    });

    it("should register multiple configurations with IDs from an object", () => {
      const configs = {
        [`${ClientType.REST}:${TEST_FIXTURES.ID_API}`]: TEST_FIXTURES.CONFIG_REST,
        [`${ClientType.REST}:${TEST_FIXTURES.ID_BACKUP}`]: { baseUrl: TEST_FIXTURES.URL_NEW_API },
      };

      registry.registerConfigs(configs);

      expect(registry.hasConfig(ClientType.REST, TEST_FIXTURES.ID_API)).toBe(true);
      expect(registry.hasConfig(ClientType.REST, TEST_FIXTURES.ID_BACKUP)).toBe(true);
    });

    it("should override existing configurations with the same type and ID", () => {
      const initialConfigs = {
        [ClientType.REST]: TEST_FIXTURES.CONFIG_REST,
      };

      const updatedConfigs = {
        [ClientType.REST]: { baseUrl: TEST_FIXTURES.URL_NEW_API },
      };

      registry.registerConfigs(initialConfigs);
      registry.registerConfigs(updatedConfigs);

      const config = registry.getConfig(ClientType.REST);
      expect(config).toEqual(expect.objectContaining(updatedConfigs[ClientType.REST]));
    });

    it("should ignore non-object configurations", () => {
      const configs = {
        [ClientType.REST]: TEST_FIXTURES.CONFIG_REST,
        invalidConfig: "not an object",
      };

      registry.registerConfigs(configs as Record<string, unknown>);

      expect(registry.hasConfig(ClientType.REST)).toBe(true);
      expect(registry.hasConfig("invalidConfig")).toBe(false);
    });

    it("should handle null or non-object configs parameter", () => {
      const spy = vi.spyOn(registry, "registerConfig");

      // Test with null
      registry.registerConfigs(null as unknown as Record<string, unknown>);

      expect(spy).not.toHaveBeenCalled();

      // Test with non-object
      registry.registerConfigs("not an object" as unknown as Record<string, unknown>);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests for the getConfig method
   * Verifies that configurations can be retrieved and are properly immutable
   */
  describe("getConfig", () => {
    it("should return the configuration for a client type", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      const config = registry.getConfig(ClientType.REST);

      expect(config).toEqual(expect.objectContaining(TEST_FIXTURES.CONFIG_REST));
    });

    it("should return the configuration for a client type with an ID", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST, TEST_FIXTURES.ID_API);

      const config = registry.getConfig(ClientType.REST, TEST_FIXTURES.ID_API);

      expect(config).toBeDefined();
      expect(config).toEqual(expect.objectContaining(TEST_FIXTURES.CONFIG_REST));
    });

    it("should return the default configuration when ID is not found", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      const config = registry.getConfig(ClientType.REST, TEST_FIXTURES.ID_NON_EXISTENT);

      expect(config).toBeDefined();
      expect(config).toEqual(expect.objectContaining(TEST_FIXTURES.CONFIG_REST));
    });

    it("should return undefined for non-existent client type", () => {
      const config = registry.getConfig(ClientType.REST);

      expect(config).toBeUndefined();
    });

    it("should return a frozen configuration object", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      const config = registry.getConfig(ClientType.REST) as Record<string, unknown>;

      expect(Object.isFrozen(config)).toBe(true);
      expect(() => {
        config.baseUrl = TEST_FIXTURES.URL_MUTATED_API;
      }).toThrow();
    });

    it("should work with string client types", () => {
      registry.registerConfig(TEST_FIXTURES.ID_CUSTOM_CLIENT, TEST_FIXTURES.CONFIG_REST);

      const config = registry.getConfig(TEST_FIXTURES.ID_CUSTOM_CLIENT);

      expect(config).toBeDefined();
      expect(config).toEqual(expect.objectContaining(TEST_FIXTURES.CONFIG_REST));
    });
  });

  /**
   * Tests for the hasConfig method
   * Verifies that configuration existence can be checked correctly
   */
  describe("hasConfig", () => {
    it("should return true if a configuration exists for the client type", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      expect(registry.hasConfig(ClientType.REST)).toBe(true);
    });

    it("should return true if a configuration exists for the client type with an ID", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST, TEST_FIXTURES.ID_API);

      expect(registry.hasConfig(ClientType.REST, TEST_FIXTURES.ID_API)).toBe(true);
    });

    it("should return false if no configuration exists for the client type", () => {
      expect(registry.hasConfig(ClientType.REST)).toBe(false);
    });

    it("should return false if no configuration exists for the client type with the specified ID", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      expect(registry.hasConfig(ClientType.REST, TEST_FIXTURES.ID_NON_EXISTENT)).toBe(false);
    });

    it("should accept string client types", () => {
      registry.registerConfig(TEST_FIXTURES.ID_CUSTOM_CLIENT, TEST_FIXTURES.CONFIG_REST);

      expect(registry.hasConfig(TEST_FIXTURES.ID_CUSTOM_CLIENT)).toBe(true);
    });
  });

  /**
   * Tests for the getAllConfigs method
   * Verifies that all configurations can be retrieved as a readonly map
   */
  describe("getAllConfigs", () => {
    it("should return all registered configurations", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);
      registry.registerConfig(ClientType.S3, TEST_FIXTURES.CONFIG_S3);

      const configs = registry.getAllConfigs();

      expect(configs.size).toBe(2);
      expect(configs.get(ClientType.REST)).toEqual(
        expect.objectContaining(TEST_FIXTURES.CONFIG_REST),
      );
      expect(configs.get(ClientType.S3)).toEqual(expect.objectContaining(TEST_FIXTURES.CONFIG_S3));
    });

    it("should return an empty map if no configurations are registered", () => {
      const configs = registry.getAllConfigs();

      expect(configs.size).toBe(0);
    });

    it("should return a readonly map with deeply readonly configurations", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      const configs = registry.getAllConfigs();
      const config = configs.get(ClientType.REST);

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        config.baseUrl = TEST_FIXTURES.VALUES.MUTATED_BASE_URL;
      }).toThrow();
    });
  });

  /**
   * Tests for the clearConfigs method
   * Verifies that all configurations can be removed from the registry
   */
  describe("clearConfigs", () => {
    it("should remove all registered configurations", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);
      registry.registerConfig(ClientType.S3, TEST_FIXTURES.CONFIG_S3);
      expect(registry.hasConfig(ClientType.REST)).toBe(true);
      expect(registry.hasConfig(ClientType.S3)).toBe(true);

      registry.clearConfigs();

      expect(registry.hasConfig(ClientType.REST)).toBe(false);
      expect(registry.hasConfig(ClientType.S3)).toBe(false);
      expect(registry.getAllConfigs().size).toBe(0);
    });
  });

  /**
   * Tests for the private getConfigKey method
   * Tests this private method indirectly through public methods
   */
  describe("getConfigKey", () => {
    // This is a private method, so we'll test it indirectly through public methods
    it("should generate keys in the format 'type' when no ID is provided", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST);

      expect(registry.hasConfig(ClientType.REST)).toBe(true);
      expect(registry.getAllConfigs().has(ClientType.REST)).toBe(true);
    });

    it("should generate keys in the format 'type:id' when an ID is provided", () => {
      registry.registerConfig(ClientType.REST, TEST_FIXTURES.CONFIG_REST, TEST_FIXTURES.ID_API);

      const configs = registry.getAllConfigs();

      expect(registry.hasConfig(ClientType.REST, TEST_FIXTURES.ID_API)).toBe(true);
      expect(configs.has(`${ClientType.REST}:${TEST_FIXTURES.ID_API}`)).toBe(true);
    });
  });
});
