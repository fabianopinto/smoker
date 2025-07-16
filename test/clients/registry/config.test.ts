import { beforeEach, describe, expect, it } from "vitest";
import {
  type ClientConfig,
  ClientRegistry,
  ClientType,
  createClientRegistry,
} from "../../../src/clients";

describe("ClientRegistry", () => {
  let registry: ClientRegistry;

  beforeEach(() => {
    registry = new ClientRegistry();
  });

  describe("registerConfig", () => {
    it("should register a configuration correctly", () => {
      const config: ClientConfig = { host: "localhost", port: 8080 };
      registry.registerConfig(ClientType.REST, config);

      const retrievedConfig = registry.getConfig(ClientType.REST);
      expect(retrievedConfig).toEqual(config);
    });

    it("should register configuration with custom id", () => {
      const config: ClientConfig = { host: "localhost", port: 8080 };
      registry.registerConfig(ClientType.REST, config, "custom");

      const retrievedConfig = registry.getConfig(ClientType.REST, "custom");
      expect(retrievedConfig).toEqual(config);
    });

    it("should register using id from config if no explicit id", () => {
      const config: ClientConfig = { id: "from-config", host: "localhost", port: 8080 };
      registry.registerConfig(ClientType.REST, config);

      // Should be accessible using the id from config
      const retrievedConfig = registry.getConfig(ClientType.REST, "from-config");
      expect(retrievedConfig).toEqual(config);
    });

    it("should override existing configuration when registering with same key", () => {
      const config1: ClientConfig = { host: "localhost", port: 8080 };
      const config2: ClientConfig = { host: "example.com", port: 9090 };

      registry.registerConfig(ClientType.REST, config1);
      registry.registerConfig(ClientType.REST, config2);

      const retrievedConfig = registry.getConfig(ClientType.REST);
      expect(retrievedConfig).toEqual(config2);
    });
  });

  describe("getConfig", () => {
    it("should return undefined for non-existent configuration", () => {
      const config = registry.getConfig(ClientType.REST);
      expect(config).toBeUndefined();
    });

    it("should return configuration for existing type", () => {
      const testConfig: ClientConfig = { host: "localhost", port: 8080 };
      registry.registerConfig(ClientType.REST, testConfig);

      const retrievedConfig = registry.getConfig(ClientType.REST);
      expect(retrievedConfig).toEqual(testConfig);
    });

    it("should handle string type identifiers", () => {
      const testConfig: ClientConfig = { host: "localhost", port: 8080 };
      registry.registerConfig("mqtt", testConfig);

      const retrievedConfig = registry.getConfig("mqtt");
      expect(retrievedConfig).toEqual(testConfig);
    });

    it("should handle custom identifiers", () => {
      const testConfig: ClientConfig = { host: "localhost", port: 8080 };
      registry.registerConfig(ClientType.REST, testConfig, "api");

      const retrievedConfig = registry.getConfig(ClientType.REST, "api");
      expect(retrievedConfig).toEqual(testConfig);

      // Default REST should not exist
      const defaultConfig = registry.getConfig(ClientType.REST);
      expect(defaultConfig).toBeUndefined();
    });
  });

  describe("getConfigsByType", () => {
    it("should return empty array when no configs for type", () => {
      const configs = registry.getConfigsByType(ClientType.REST);
      expect(configs).toEqual([]);
    });

    it("should return all configurations of a type", () => {
      const defaultConfig: ClientConfig = { host: "localhost", port: 8080 };
      const customConfig1: ClientConfig = { host: "example.com", port: 9090 };
      const customConfig2: ClientConfig = { host: "test.com", port: 7070 };

      registry.registerConfig(ClientType.REST, defaultConfig);
      registry.registerConfig(ClientType.REST, customConfig1, "custom1");
      registry.registerConfig(ClientType.REST, customConfig2, "custom2");

      const configs = registry.getConfigsByType(ClientType.REST);

      expect(configs).toHaveLength(3);
      expect(configs).toContainEqual(defaultConfig);
      expect(configs).toContainEqual(customConfig1);
      expect(configs).toContainEqual(customConfig2);
    });
  });

  describe("hasConfig", () => {
    it("should return false for non-existent configuration", () => {
      expect(registry.hasConfig(ClientType.REST)).toBe(false);
    });

    it("should return true for existing configuration", () => {
      registry.registerConfig(ClientType.REST, { host: "localhost" });
      expect(registry.hasConfig(ClientType.REST)).toBe(true);
    });

    it("should handle custom identifiers", () => {
      registry.registerConfig(ClientType.REST, { host: "localhost" }, "api");

      expect(registry.hasConfig(ClientType.REST, "api")).toBe(true);
      expect(registry.hasConfig(ClientType.REST)).toBe(false);
    });
  });

  describe("getAllConfigs", () => {
    it("should return empty map when no configs", () => {
      const configs = registry.getAllConfigs();
      expect(configs.size).toBe(0);
    });

    it("should return copy of all registered configurations", () => {
      registry.registerConfig(ClientType.REST, { host: "localhost" });
      registry.registerConfig(ClientType.MQTT, { broker: "mqtt://localhost" });

      const configs = registry.getAllConfigs();

      expect(configs.size).toBe(2);
      expect(configs.has("rest")).toBe(true);
      expect(configs.has("mqtt")).toBe(true);
    });

    it("should return a copy that doesn't affect original", () => {
      registry.registerConfig(ClientType.REST, { host: "localhost" });

      const configs = registry.getAllConfigs();
      configs.delete("rest");

      // Original should still have the config
      expect(registry.hasConfig(ClientType.REST)).toBe(true);
    });
  });

  describe("registerConfigs", () => {
    it("should register multiple configurations from object", () => {
      const config = {
        rest: { host: "localhost", port: 8080 },
        mqtt: { broker: "mqtt://localhost", clientId: "test" },
        "s3:backup": { bucket: "backup-bucket" },
      };

      registry.registerConfigs(config);

      expect(registry.hasConfig(ClientType.REST)).toBe(true);
      expect(registry.hasConfig(ClientType.MQTT)).toBe(true);
      expect(registry.hasConfig(ClientType.S3, "backup")).toBe(true);

      const restConfig = registry.getConfig(ClientType.REST);
      expect(restConfig).toEqual({ host: "localhost", port: 8080 });
    });

    it("should handle array configurations", () => {
      const config = {
        rest: [
          { host: "localhost", port: 8080 },
          { id: "secondary", host: "example.com", port: 9090 },
        ],
      };

      registry.registerConfigs(config);

      expect(registry.hasConfig(ClientType.REST)).toBe(true);
      expect(registry.hasConfig(ClientType.REST, "secondary")).toBe(true);
    });
  });

  describe("registerConfigArray", () => {
    it("should register array of configurations with auto ID assignment", () => {
      const configs: ClientConfig[] = [
        { host: "localhost", port: 8080 },
        { host: "example.com", port: 9090 },
        { host: "test.com", port: 7070 },
      ];

      registry.registerConfigArray(ClientType.REST, configs);

      // First item should use the default key (no numeric suffix)
      expect(registry.hasConfig(ClientType.REST)).toBe(true);

      // Subsequent items should have numeric IDs
      expect(registry.hasConfig(ClientType.REST, "2")).toBe(true);
      expect(registry.hasConfig(ClientType.REST, "3")).toBe(true);
    });

    it("should respect explicit IDs in configuration", () => {
      const configs: ClientConfig[] = [
        { host: "localhost", port: 8080 },
        { id: "custom", host: "example.com", port: 9090 },
      ];

      registry.registerConfigArray(ClientType.REST, configs);

      expect(registry.hasConfig(ClientType.REST)).toBe(true);
      expect(registry.hasConfig(ClientType.REST, "custom")).toBe(true);
    });
  });
});

describe("createClientRegistry", () => {
  it("should create a registry with provided configuration", () => {
    const config = {
      rest: { host: "localhost", port: 8080 },
      mqtt: { broker: "mqtt://localhost" },
    };

    const registry = createClientRegistry(config);

    expect(registry).toBeInstanceOf(ClientRegistry);
    expect(registry.hasConfig("rest")).toBe(true);
    expect(registry.hasConfig("mqtt")).toBe(true);
  });

  it("should handle array configurations", () => {
    const config = {
      rest: [
        { host: "localhost", port: 8080 },
        { id: "secondary", host: "example.com", port: 9090 },
      ],
    };

    const registry = createClientRegistry(config);

    expect(registry).toBeInstanceOf(ClientRegistry);
    expect(registry.hasConfig("rest")).toBe(true);
    expect(registry.hasConfig("rest", "secondary")).toBe(true);
  });

  it("should create empty registry when no config provided", () => {
    const registry = createClientRegistry({});

    expect(registry).toBeInstanceOf(ClientRegistry);
    expect(registry.getAllConfigs().size).toBe(0);
  });
});
