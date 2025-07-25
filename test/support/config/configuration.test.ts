/**
 * Tests for the Configuration Module
 *
 * These tests verify the configuration management system including the Configuration class,
 * helper functions, and integration with external services.
 *
 * Test coverage includes:
 * - Configuration singleton pattern and global instance management
 * - Configuration value retrieval with dot-notation paths
 * - SSM parameter reference resolution
 * - S3 reference resolution and JSON parsing
 * - Key path validation and error handling
 * - Helper functions for configuration creation
 * - Type safety and immutability guarantees
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S3ClientWrapper, SSMClientWrapper } from "../../../src/support/aws/aws-clients";
import { ConfigurationFactory } from "../../../src/support/config/config-factory";
import {
  type ConfigObject,
  Configuration,
  createConfiguration,
  createConfigurationFromObject,
  type SmokeConfig,
} from "../../../src/support/config/configuration";

/**
 * Mock AWS clients and factory
 */
vi.mock("../../../src/support/aws/aws-clients");
vi.mock("../../../src/support/config/config-factory");

/**
 * Test fixtures for Configuration module tests
 */
const TEST_FIXTURES = {
  // Configuration objects
  BASIC_CONFIG: {
    app: { name: "test-app", version: "1.0.0", timeout: 5000, enabled: true },
    database: {
      host: "localhost",
      port: 5432,
      credentials: { username: "admin", password: "ssm://db/password" },
    },
    features: { logging: true, analytics: false, config: "s3://bucket/config.json" },
    arrays: { servers: ["server1", "server2", "server3"] },
    nullValue: null,
  },
  EMPTY_CONFIG: {},

  // External service responses
  SSM_RESOLVED: "resolved-ssm-value",
  S3_JSON_CONTENT: { key: "value" },
  S3_TEXT_CONTENT: "text content from s3",

  // Error cases
  NON_EXISTENT_MISSING_KEY_VALUE: "non-existent-key",
  DEFAULT_FALLBACK: "default-fallback-value",
};

/**
 * Mock instances with proper typing
 */
let mockSSMClient: MockSSMClient;
let mockS3Client: MockS3Client;
let mockConfigFactory: MockConfigFactory;

/**
 * Mock SSM client interface
 */
interface MockSSMClient {
  getParameter: ReturnType<typeof vi.fn>;
}

/**
 * Mock S3 client interface
 */
interface MockS3Client {
  getContentFromUrl: ReturnType<typeof vi.fn>;
}

/**
 * Mock config factory interface
 */
interface MockConfigFactory {
  addFile: ReturnType<typeof vi.fn>;
  addObject: ReturnType<typeof vi.fn>;
  build: ReturnType<typeof vi.fn>;
}

/**
 * Creates a test configuration instance
 *
 * @param config - Configuration object to use for testing
 * @returns New Configuration instance
 */
function createTestConfiguration(config: SmokeConfig = TEST_FIXTURES.BASIC_CONFIG): Configuration {
  return new Configuration(config);
}

/**
 * Sets up SSM client mock
 *
 * @param value - Value to use for SSM mock
 */
function setupSSMMock(value: string = TEST_FIXTURES.SSM_RESOLVED): void {
  mockSSMClient.getParameter.mockResolvedValue(value);
}

/**
 * Sets up S3 client mock
 * @param content - Content to use for S3 mock
 */
function setupS3Mock(content: unknown = TEST_FIXTURES.S3_JSON_CONTENT): void {
  mockS3Client.getContentFromUrl.mockResolvedValue(content);
}

/**
 * Configuration tests
 */
describe("Configuration", () => {
  beforeEach(() => {
    // Reset configuration singleton
    Configuration.resetInstance();

    // Create fresh mocks
    mockSSMClient = { getParameter: vi.fn() };
    mockS3Client = { getContentFromUrl: vi.fn() };
    mockConfigFactory = {
      addFile: vi.fn().mockReturnThis(),
      addObject: vi.fn().mockReturnThis(),
      build: vi.fn(),
    };

    // Setup mock implementations
    vi.mocked(SSMClientWrapper).mockImplementation(
      () => mockSSMClient as unknown as SSMClientWrapper,
    );
    vi.mocked(S3ClientWrapper).mockImplementation(() => mockS3Client as unknown as S3ClientWrapper);
    vi.mocked(ConfigurationFactory).mockImplementation(
      () => mockConfigFactory as unknown as ConfigurationFactory,
    );

    // Mock console methods
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    Configuration.resetInstance();
  });

  /**
   * Configuration class tests
   */
  describe("Configuration", () => {
    /**
     * Tests for constructor
     */
    describe("constructor", () => {
      it("should create configuration instance with provided config", () => {
        const config = createTestConfiguration();

        expect(config).toBeInstanceOf(Configuration);
        expect(config.getConfig()).toEqual(TEST_FIXTURES.BASIC_CONFIG);
      });

      it("should create configuration with empty config", () => {
        const config = new Configuration(TEST_FIXTURES.EMPTY_CONFIG);

        expect(config.getConfig()).toEqual(TEST_FIXTURES.EMPTY_CONFIG);
      });
    });

    /**
     * Singleton pattern tests
     */
    describe("singleton pattern", () => {
      /**
       * getInstance tests
       */
      describe("getInstance", () => {
        it("should throw error when no global instance exists", () => {
          expect(() => Configuration.getInstance()).toThrow(
            "Global configuration is not initialized",
          );
        });

        it("should return global instance when initialized", () => {
          const config = createTestConfiguration();
          Configuration.initializeGlobalInstance(config);

          const instance = Configuration.getInstance();

          expect(instance).toBe(config);
        });
      });

      /**
       * Reset instance tests
       */
      describe("resetInstance", () => {
        it("should clear global instance when called without arguments", () => {
          Configuration.initializeGlobalInstance(createTestConfiguration());

          Configuration.resetInstance();

          expect(() => Configuration.getInstance()).toThrow(
            "Global configuration is not initialized",
          );
        });

        it("should set new global instance when provided", () => {
          const oldConfig = createTestConfiguration();
          const newConfig = createTestConfiguration({ test: "new" });
          Configuration.initializeGlobalInstance(oldConfig);

          Configuration.resetInstance(newConfig);

          const instance = Configuration.getInstance();
          expect(instance).toBe(newConfig);
          expect(instance.getConfig()).toEqual({ test: "new" });
        });
      });

      /**
       * Initialize global instance tests
       */
      describe("initializeGlobalInstance", () => {
        it("should set global instance", () => {
          const config = createTestConfiguration();

          Configuration.initializeGlobalInstance(config);

          const instance = Configuration.getInstance();
          expect(instance).toBe(config);
        });

        it("should overwrite existing global instance with warning", () => {
          const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
          const oldConfig = createTestConfiguration();
          const newConfig = createTestConfiguration({ test: "new" });
          Configuration.initializeGlobalInstance(oldConfig);

          Configuration.initializeGlobalInstance(newConfig);

          const instance = Configuration.getInstance();
          expect(instance).toBe(newConfig);
          expect(consoleSpy).toHaveBeenCalledWith(
            "Global configuration is already initialized, overwriting",
          );
        });
      });
    });

    /**
     * Get config tests
     */
    describe("getConfig", () => {
      it("should return copy of configuration", () => {
        const result = createTestConfiguration().getConfig();

        expect(result).toEqual(TEST_FIXTURES.BASIC_CONFIG);
        expect(result).not.toBe(TEST_FIXTURES.BASIC_CONFIG); // Should be a copy
      });
    });

    /**
     * Get value tests
     */
    describe("getValue", () => {
      /**
       * Tests for basic value retrieval
       */
      describe("basic value retrieval", () => {
        it("should retrieve simple string value", async () => {
          expect(await createTestConfiguration().getValue("app.name")).toBe("test-app");
        });

        it("should retrieve number value", async () => {
          expect(await createTestConfiguration().getValue("app.timeout")).toBe(5000);
        });

        it("should retrieve boolean value", async () => {
          expect(await createTestConfiguration().getValue("app.enabled")).toBe(true);
        });

        it("should retrieve nested object", async () => {
          expect(await createTestConfiguration().getValue("database.credentials")).toEqual({
            username: "admin",
            password: "ssm://db/password",
          });
        });

        it("should retrieve array value", async () => {
          expect(await createTestConfiguration().getValue("arrays.servers")).toEqual([
            "server1",
            "server2",
            "server3",
          ]);
        });

        it("should retrieve null value", async () => {
          expect(await createTestConfiguration().getValue("nullValue")).toBeNull();
        });
      });

      /**
       * Default values tests
       */
      describe("default values", () => {
        it("should return default value for non-existent key", async () => {
          expect(
            await createTestConfiguration().getValue(
              TEST_FIXTURES.NON_EXISTENT_MISSING_KEY_VALUE,
              TEST_FIXTURES.DEFAULT_FALLBACK,
            ),
          ).toBe(TEST_FIXTURES.DEFAULT_FALLBACK);
        });

        it("should return undefined for non-existent key without default", async () => {
          expect(
            await createTestConfiguration().getValue(TEST_FIXTURES.NON_EXISTENT_MISSING_KEY_VALUE),
          ).toBeUndefined();
        });

        it("should return actual value even when default is provided", async () => {
          expect(await createTestConfiguration().getValue("app.name", "default")).toBe("test-app");
        });
      });

      /**
       * Key path validation tests
       */
      describe("key path validation", () => {
        it("should handle valid key paths", async () => {
          const config = createTestConfiguration();

          await expect(config.getValue("app.name")).resolves.toBe("test-app");
          await expect(config.getValue("app_name")).resolves.toBeUndefined();
          await expect(config.getValue("app$name")).resolves.toBeUndefined();
          await expect(config.getValue("app123")).resolves.toBeUndefined();
        });

        it("should return undefined and log error for invalid key paths", async () => {
          const config = createTestConfiguration();
          const consoleSpy = vi.spyOn(console, "error");

          await expect(config.getValue("app-name")).resolves.toBeUndefined();
          expect(consoleSpy).toHaveBeenCalledWith(
            "Invalid key path format: app-name. Must match [a-zA-Z0-9_$.]+",
          );

          await expect(config.getValue("app.name-invalid")).resolves.toBeUndefined();
          expect(consoleSpy).toHaveBeenCalledWith(
            "Invalid key path format: app.name-invalid. Must match [a-zA-Z0-9_$.]+",
          );

          await expect(config.getValue("app..name")).resolves.toBeUndefined();
          expect(consoleSpy).toHaveBeenCalledWith(
            "Invalid key path format: app..name. Must match [a-zA-Z0-9_$.]+",
          );

          await expect(config.getValue("")).resolves.toBeUndefined();
          expect(consoleSpy).toHaveBeenCalledWith(
            "Invalid key path format: . Must match [a-zA-Z0-9_$.]+",
          );
        });

        it("should return default value for invalid key paths when provided", async () => {
          const defaultValue = "fallback-value";

          const result = await createTestConfiguration().getValue("invalid-key", defaultValue);

          expect(result).toBe(defaultValue);
          expect(console.error).toHaveBeenCalledWith(
            "Invalid key path format: invalid-key. Must match [a-zA-Z0-9_$.]+",
          );
        });
      });

      /**
       * SSM reference resolution tests
       */
      describe("SSM reference resolution", () => {
        it("should resolve SSM parameter reference", async () => {
          setupSSMMock(TEST_FIXTURES.SSM_RESOLVED);

          expect(await createTestConfiguration().getValue("database.credentials.password")).toBe(
            TEST_FIXTURES.SSM_RESOLVED,
          );
          expect(mockSSMClient.getParameter).toHaveBeenCalledWith("db/password");
        });

        it("should return default value when SSM resolution fails", async () => {
          const defaultValue = "fallback-password";
          mockSSMClient.getParameter.mockRejectedValue(new Error("SSM Error"));

          expect(
            await createTestConfiguration().getValue("database.credentials.password", defaultValue),
          ).toBe(defaultValue);
          expect(console.error).toHaveBeenCalledWith(
            "Error resolving SSM parameter reference ssm://db/password:",
            expect.any(Error),
          );
        });

        it("should handle SSM reference without default value on error", async () => {
          mockSSMClient.getParameter.mockRejectedValue(new Error("SSM Error"));

          expect(
            await createTestConfiguration().getValue("database.credentials.password"),
          ).toBeUndefined();
        });
      });

      /**
       * S3 reference resolution tests
       */
      describe("S3 reference resolution", () => {
        it("should resolve S3 JSON reference", async () => {
          setupS3Mock(TEST_FIXTURES.S3_JSON_CONTENT);

          expect(await createTestConfiguration().getValue("features.config")).toEqual(
            TEST_FIXTURES.S3_JSON_CONTENT,
          );
          expect(mockS3Client.getContentFromUrl).toHaveBeenCalledWith("s3://bucket/config.json");
        });

        it("should resolve S3 text reference", async () => {
          setupS3Mock(TEST_FIXTURES.S3_TEXT_CONTENT);

          expect(
            await createTestConfiguration({
              features: { textFile: "s3://bucket/readme.txt" },
            }).getValue("features.textFile"),
          ).toBe(TEST_FIXTURES.S3_TEXT_CONTENT);
        });

        it("should return default value when S3 resolution fails", async () => {
          const defaultValue = { fallback: "config" };
          mockS3Client.getContentFromUrl.mockRejectedValue(new Error("S3 Error"));

          expect(await createTestConfiguration().getValue("features.config", defaultValue)).toEqual(
            defaultValue,
          );
          expect(console.error).toHaveBeenCalledWith(
            "Error resolving S3 reference s3://bucket/config.json:",
            expect.any(Error),
          );
        });

        it("should handle S3 reference without default value on error", async () => {
          mockS3Client.getContentFromUrl.mockRejectedValue(new Error("S3 Error"));

          expect(await createTestConfiguration().getValue("features.config")).toBeUndefined();
        });
      });

      /**
       * Edge cases tests
       */
      describe("edge cases", () => {
        it("should handle deeply nested paths", async () => {
          expect(
            await createTestConfiguration({
              level1: { level2: { level3: { level4: { value: "deep-value" } } } },
            }).getValue("level1.level2.level3.level4.value"),
          ).toBe("deep-value");
        });

        it("should handle path that leads to non-object", async () => {
          expect(await createTestConfiguration().getValue("app.name.invalid")).toBeUndefined();
        });
      });
    });
  });

  /**
   * Tests for helper functions
   */
  describe("Helper Functions", () => {
    /**
     * createConfiguration tests
     */
    describe("createConfiguration", () => {
      it("should create configuration from file paths", async () => {
        const filePaths = ["config1.json", "config2.json"];
        const expectedConfig = createTestConfiguration();
        mockConfigFactory.build.mockResolvedValue(expectedConfig);

        const result = await createConfiguration(filePaths);

        expect(ConfigurationFactory).toHaveBeenCalled();
        expect(mockConfigFactory.addFile).toHaveBeenCalledWith("config1.json");
        expect(mockConfigFactory.addFile).toHaveBeenCalledWith("config2.json");
        expect(mockConfigFactory.build).toHaveBeenCalled();
        expect(result).toBe(expectedConfig);
      });

      it("should set configuration as global by default", async () => {
        const filePaths = ["config.json"];
        const expectedConfig = createTestConfiguration();
        mockConfigFactory.build.mockResolvedValue(expectedConfig);

        await createConfiguration(filePaths);

        const globalInstance = Configuration.getInstance();
        expect(globalInstance).toBe(expectedConfig);
      });

      it("should not set as global when setAsGlobal is false", async () => {
        const filePaths = ["config.json"];
        const expectedConfig = createTestConfiguration();
        mockConfigFactory.build.mockResolvedValue(expectedConfig);

        await createConfiguration(filePaths, false);

        expect(() => Configuration.getInstance()).toThrow(
          "Global configuration is not initialized",
        );
      });

      it("should handle empty file paths array", async () => {
        const expectedConfig = createTestConfiguration();
        mockConfigFactory.build.mockResolvedValue(expectedConfig);

        const result = await createConfiguration([]);

        expect(mockConfigFactory.addFile).not.toHaveBeenCalled();
        expect(mockConfigFactory.build).toHaveBeenCalled();
        expect(result).toBe(expectedConfig);
      });
    });

    /**
     * Create configuration from object tests
     */
    describe("createConfigurationFromObject", () => {
      it("should create configuration from config object", async () => {
        const configObject: ConfigObject = { test: "value" };
        const expectedConfig = createTestConfiguration();
        mockConfigFactory.build.mockResolvedValue(expectedConfig);

        const result = await createConfigurationFromObject(configObject);

        expect(ConfigurationFactory).toHaveBeenCalled();
        expect(mockConfigFactory.addObject).toHaveBeenCalledWith(configObject);
        expect(mockConfigFactory.build).toHaveBeenCalled();
        expect(result).toBe(expectedConfig);
      });

      it("should set configuration as global by default", async () => {
        const configObject: ConfigObject = { test: "value" };
        const expectedConfig = createTestConfiguration();
        mockConfigFactory.build.mockResolvedValue(expectedConfig);

        await createConfigurationFromObject(configObject);

        const globalInstance = Configuration.getInstance();
        expect(globalInstance).toBe(expectedConfig);
      });

      it("should not set as global when setAsGlobal is false", async () => {
        const configObject: ConfigObject = { test: "value" };
        const expectedConfig = createTestConfiguration();
        mockConfigFactory.build.mockResolvedValue(expectedConfig);

        await createConfigurationFromObject(configObject, false);

        expect(() => Configuration.getInstance()).toThrow(
          "Global configuration is not initialized",
        );
      });

      it("should handle empty config object", async () => {
        const configObject: ConfigObject = {};
        const expectedConfig = createTestConfiguration();
        mockConfigFactory.build.mockResolvedValue(expectedConfig);

        const result = await createConfigurationFromObject(configObject);

        expect(mockConfigFactory.addObject).toHaveBeenCalledWith({});
        expect(result).toBe(expectedConfig);
      });
    });
  });

  /**
   * Integration Tests
   */
  describe("Integration Scenarios", () => {
    it("should handle mixed reference types in configuration", async () => {
      const mixedConfig = {
        database: {
          password: "ssm://db/password",
          config: "s3://bucket/db-config.json",
          host: "localhost",
        },
      };
      const config = createTestConfiguration(mixedConfig);
      setupSSMMock("resolved-password");
      setupS3Mock({ maxConnections: 100 });

      const password = await config.getValue("database.password");
      const dbConfig = await config.getValue("database.config");
      const host = await config.getValue("database.host");

      expect(password).toBe("resolved-password");
      expect(dbConfig).toEqual({ maxConnections: 100 });
      expect(host).toBe("localhost");
    });

    it("should maintain configuration immutability", async () => {
      const originalConfig = { ...TEST_FIXTURES.BASIC_CONFIG };
      const config = createTestConfiguration(TEST_FIXTURES.BASIC_CONFIG);

      const retrievedConfig = config.getConfig();
      retrievedConfig.app = { name: "modified" };

      expect(config.getConfig()).toEqual(originalConfig);
      expect(config.getConfig().app).toEqual(TEST_FIXTURES.BASIC_CONFIG.app);
    });

    it("should work with real-world configuration patterns", async () => {
      const realWorldConfig = {
        environment: "production",
        services: {
          api: { baseUrl: "https://api.example.com", timeout: 30000, retries: 3 },
          database: { connectionString: "ssm://prod/db/connection", poolSize: 10 },
        },
        features: {
          enableLogging: true,
          enableMetrics: false,
          config: "s3://config-bucket/feature-flags.json",
        },
      };
      const config = createTestConfiguration(realWorldConfig);
      setupSSMMock("postgresql://user:pass@host:5432/db");
      setupS3Mock({ experimentalFeature: true, betaFeature: false });

      const environment = await config.getValue("environment");
      const apiTimeout = await config.getValue("services.api.timeout");
      const dbConnection = await config.getValue("services.database.connectionString");
      const featureConfig = await config.getValue("features.config");

      expect(environment).toBe("production");
      expect(apiTimeout).toBe(30000);
      expect(dbConnection).toBe("postgresql://user:pass@host:5432/db");
      expect(featureConfig).toEqual({ experimentalFeature: true, betaFeature: false });
    });
  });
});
