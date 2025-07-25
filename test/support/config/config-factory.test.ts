/**
 * ConfigurationFactory Tests
 *
 * Tests for the ConfigurationFactory class, covering source management,
 * configuration building, and error handling across multiple source types.
 *
 * Test coverage includes:
 * - Constructor initialization with registry dependency
 * - Source management methods (add, remove, get, has)
 * - Configuration building with auto-merging of values
 * - Error handling for individual sources and entire configuration
 * - Fluent API for configuration setup
 * - Integration with the global configuration singleton
 *
 * These tests verify the configuration management system, including the Configuration class,
 * helper functions, and integration with external services.
 */

import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationFactory } from "../../../src/support/config/config-factory";
import { deepMerge } from "../../../src/support/config/config-merger";
import {
  type ConfigurationSource,
  FileConfigurationSource,
  ObjectConfigurationSource,
  S3ConfigurationSource,
} from "../../../src/support/config/config-source";
import {
  type ConfigObject,
  Configuration,
  type SmokeConfig,
} from "../../../src/support/config/configuration";

/**
 * Mock all external dependencies
 */
vi.mock("node:path");
vi.mock("../../../src/support/config/configuration");
vi.mock("../../../src/support/config/config-merger");
vi.mock("../../../src/support/config/config-source");

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Configuration objects
  BASIC_CONFIG: {
    app: { name: "test-app", version: "1.0.0" },
    database: { host: "localhost", port: 5432 },
  },
  OVERRIDE_CONFIG: {
    app: { name: "test-app-override", environment: "test" },
    server: { port: 3000 },
  },
  EMPTY_CONFIG: {},

  // File paths and URLs
  VALID_FILE: "/path/to/config.json",
  S3_URL: "s3://test-bucket/config.json",
  LOCAL_FILE_PATH: "./config.json",
  RESOLVED_PATH: "/resolved/path/to/config.json",

  // AWS configuration
  AWS_TEST_REGION: "us-west-2",
  S3_URL_WITH_REGION: "s3://test-bucket/config.json?region=us-west-2",
};

/**
 * Mock type definitions
 */
interface MockConfiguration {
  initializeGlobalInstance: ReturnType<typeof vi.fn>;
}

interface MockConfigurationSource {
  load: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock configuration source
 *
 * @param config - The configuration to mock (defaults to BASIC_CONFIG)
 * @returns A mock configuration source
 */
const createMockSource = (
  config: ConfigObject = TEST_FIXTURES.BASIC_CONFIG,
): MockConfigurationSource => ({
  load: vi.fn().mockResolvedValue(config),
});

/**
 * Tests for ConfigurationFactory
 */
describe("ConfigurationFactory", () => {
  // Test instances and mocks
  let mockConfiguration: MockConfiguration;
  let mockFileSource: MockConfigurationSource;
  let mockS3Source: MockConfigurationSource;
  let mockObjectSource: MockConfigurationSource;
  let configurationFactory: ConfigurationFactory;

  /**
   * Sets up mock configuration sources for testing
   */
  function setupMockSources(): void {
    mockFileSource = createMockSource(TEST_FIXTURES.BASIC_CONFIG);
    mockS3Source = createMockSource(TEST_FIXTURES.OVERRIDE_CONFIG);
    mockObjectSource = createMockSource(TEST_FIXTURES.EMPTY_CONFIG);

    vi.mocked(FileConfigurationSource).mockImplementation(
      () => mockFileSource as unknown as FileConfigurationSource,
    );
    vi.mocked(S3ConfigurationSource).mockImplementation(
      () => mockS3Source as unknown as S3ConfigurationSource,
    );

    // Make ObjectConfigurationSource return the actual config passed to constructor
    vi.mocked(ObjectConfigurationSource).mockImplementation(
      (config: ConfigObject) =>
        ({ load: vi.fn().mockResolvedValue(config) }) as unknown as ObjectConfigurationSource,
    );
  }

  /**
   * Sets up mock configuration for testing
   */
  function setupMockConfiguration(): void {
    mockConfiguration = {
      initializeGlobalInstance: vi.fn(),
    };

    // Create a proper mock instance that passes instanceof checks
    vi.mocked(Configuration).mockImplementation((config: SmokeConfig) => {
      const mockInstance = Object.create(Configuration.prototype);
      // Add any properties/methods that tests might need
      mockInstance.getConfig = vi.fn().mockReturnValue(config);
      mockInstance.getValue = vi.fn();
      return mockInstance;
    });

    vi.mocked(Configuration.initializeGlobalInstance).mockImplementation(
      mockConfiguration.initializeGlobalInstance,
    );
  }

  /**
   * Sets up mock utilities for testing
   */
  function setupMockUtilities(): void {
    vi.mocked(resolve).mockImplementation(() => TEST_FIXTURES.RESOLVED_PATH);
    vi.mocked(deepMerge).mockImplementation((target, source) => ({ ...target, ...source }));
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock implementations
    setupMockSources();
    setupMockConfiguration();
    setupMockUtilities();

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Create fresh factory instance
    configurationFactory = new ConfigurationFactory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Tests for constructor
   * Creates a new ConfigurationFactory instance with default configuration sources
   */
  describe("constructor", () => {
    it("should create a new factory instance with empty sources", () => {
      expect(new ConfigurationFactory()).toBeInstanceOf(ConfigurationFactory);
    });
  });

  /**
   * Tests for addSource method
   */
  describe("addSource", () => {
    it("should add a custom configuration source", () => {
      const customSource = createMockSource(TEST_FIXTURES.BASIC_CONFIG);

      const result = configurationFactory.addSource(customSource as unknown as ConfigurationSource);

      expect(result).toBe(configurationFactory); // Method chaining
    });

    it("should support method chaining with multiple sources", () => {
      const source1 = createMockSource(TEST_FIXTURES.BASIC_CONFIG);
      const source2 = createMockSource(TEST_FIXTURES.OVERRIDE_CONFIG);

      const result = configurationFactory
        .addSource(source1 as unknown as ConfigurationSource)
        .addSource(source2 as unknown as ConfigurationSource);

      expect(result).toBe(configurationFactory);
    });
  });

  /**
   * Tests for the addFile method
   * Verifies file path handling, source creation, and method chaining
   */
  describe("addFile", () => {
    it("should add a local file configuration source", () => {
      const result = configurationFactory.addFile(TEST_FIXTURES.LOCAL_FILE_PATH);

      expect(resolve).toHaveBeenCalledWith(TEST_FIXTURES.LOCAL_FILE_PATH);
      expect(FileConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.RESOLVED_PATH);
      expect(result).toBe(configurationFactory);
    });

    it("should add an S3 configuration source for S3 URLs", () => {
      const result = configurationFactory.addFile(TEST_FIXTURES.S3_URL);

      expect(S3ConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.S3_URL);
      expect(FileConfigurationSource).not.toHaveBeenCalled();
      expect(result).toBe(configurationFactory);
    });

    it("should resolve relative paths to absolute paths for local files", () => {
      configurationFactory.addFile(TEST_FIXTURES.LOCAL_FILE_PATH);

      expect(resolve).toHaveBeenCalledWith(TEST_FIXTURES.LOCAL_FILE_PATH);
      expect(FileConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.RESOLVED_PATH);
    });

    it("should support method chaining", () => {
      const result = configurationFactory
        .addFile(TEST_FIXTURES.LOCAL_FILE_PATH)
        .addFile(TEST_FIXTURES.S3_URL);

      expect(result).toBe(configurationFactory);
    });
  });

  /**
   * Tests for the addS3File method
   * Verifies S3 configuration source creation with optional region
   */
  describe("addS3File", () => {
    it("should add an S3 configuration source without region", () => {
      const result = configurationFactory.addS3File(TEST_FIXTURES.S3_URL);

      expect(S3ConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.S3_URL, undefined);
      expect(result).toBe(configurationFactory);
    });

    it("should add an S3 configuration source with specified region", () => {
      const result = configurationFactory.addS3File(
        TEST_FIXTURES.S3_URL_WITH_REGION,
        TEST_FIXTURES.AWS_TEST_REGION,
      );

      expect(S3ConfigurationSource).toHaveBeenCalledWith(
        TEST_FIXTURES.S3_URL_WITH_REGION,
        TEST_FIXTURES.AWS_TEST_REGION,
      );
      expect(result).toBe(configurationFactory);
    });

    it("should support method chaining", () => {
      const result = configurationFactory
        .addS3File(TEST_FIXTURES.S3_URL)
        .addS3File(TEST_FIXTURES.S3_URL_WITH_REGION, TEST_FIXTURES.AWS_TEST_REGION);

      expect(result).toBe(configurationFactory);
    });
  });

  /**
   * Tests for the addObject method
   * Verifies in-memory object configuration source creation
   */
  describe("addObject", () => {
    it("should add an object configuration source", () => {
      const result = configurationFactory.addObject(TEST_FIXTURES.BASIC_CONFIG);

      expect(ObjectConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.BASIC_CONFIG);
      expect(result).toBe(configurationFactory);
    });

    it("should handle empty configuration objects", () => {
      const result = configurationFactory.addObject(TEST_FIXTURES.EMPTY_CONFIG);

      expect(ObjectConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.EMPTY_CONFIG);
      expect(result).toBe(configurationFactory);
    });

    it("should support method chaining", () => {
      const result = configurationFactory
        .addObject(TEST_FIXTURES.BASIC_CONFIG)
        .addObject(TEST_FIXTURES.OVERRIDE_CONFIG);

      expect(result).toBe(configurationFactory);
    });
  });

  /**
   * Tests for the setGlobal method
   * Verifies global configuration flag management and method chaining
   */
  describe("setGlobal", () => {
    it("should set the global flag to true", () => {
      expect(configurationFactory.setGlobal(true)).toBe(configurationFactory);
    });

    it("should set the global flag to false", () => {
      expect(configurationFactory.setGlobal(false)).toBe(configurationFactory);
    });

    it("should support method chaining", () => {
      expect(configurationFactory.setGlobal(false).addObject(TEST_FIXTURES.BASIC_CONFIG)).toBe(
        configurationFactory,
      );
    });
  });

  /**
   * Tests for the build method
   * Verifies configuration loading, merging, and creation
   */
  describe("build", () => {
    it("should build configuration from single source when one source is added", async () => {
      configurationFactory.addObject(TEST_FIXTURES.BASIC_CONFIG);

      const result = await configurationFactory.build();

      expect(ObjectConfigurationSource).toHaveBeenCalledTimes(1);
      expect(ObjectConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.BASIC_CONFIG);
      expect(deepMerge).toHaveBeenCalledTimes(1);
      expect(deepMerge).toHaveBeenCalledWith({}, TEST_FIXTURES.BASIC_CONFIG);
      expect(Configuration).toHaveBeenCalledTimes(1);
      expect(Configuration).toHaveBeenCalledWith(TEST_FIXTURES.BASIC_CONFIG);
      expect(mockConfiguration.initializeGlobalInstance).toHaveBeenCalledTimes(1);
      expect(mockConfiguration.initializeGlobalInstance).toHaveBeenCalledWith(result);
      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith("Configuration built successfully");
    });

    it("should merge configurations when multiple sources are added", async () => {
      const expectedMergedConfig = {
        ...TEST_FIXTURES.BASIC_CONFIG,
        ...TEST_FIXTURES.OVERRIDE_CONFIG,
      };
      configurationFactory
        .addObject(TEST_FIXTURES.BASIC_CONFIG)
        .addObject(TEST_FIXTURES.OVERRIDE_CONFIG);

      await configurationFactory.build();

      expect(ObjectConfigurationSource).toHaveBeenCalledTimes(2);
      expect(ObjectConfigurationSource).toHaveBeenNthCalledWith(1, TEST_FIXTURES.BASIC_CONFIG);
      expect(ObjectConfigurationSource).toHaveBeenNthCalledWith(2, TEST_FIXTURES.OVERRIDE_CONFIG);

      expect(deepMerge).toHaveBeenCalledTimes(2);
      expect(deepMerge).toHaveBeenNthCalledWith(1, {}, TEST_FIXTURES.BASIC_CONFIG);
      expect(deepMerge).toHaveBeenNthCalledWith(
        2,
        TEST_FIXTURES.BASIC_CONFIG,
        TEST_FIXTURES.OVERRIDE_CONFIG,
      );

      expect(Configuration).toHaveBeenCalledTimes(1);
      expect(Configuration).toHaveBeenCalledWith(expectedMergedConfig);
    });

    it("should handle mixed source types including file, S3, and object sources", async () => {
      const fileConfig = { file: true };
      const s3Config = { s3: true };
      mockFileSource.load.mockResolvedValueOnce(fileConfig);
      mockS3Source.load.mockResolvedValueOnce(s3Config);

      configurationFactory
        .addFile(TEST_FIXTURES.VALID_FILE)
        .addS3File(TEST_FIXTURES.S3_URL)
        .addObject(TEST_FIXTURES.OVERRIDE_CONFIG);

      await configurationFactory.build();

      expect(FileConfigurationSource).toHaveBeenCalledTimes(1);
      expect(FileConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.RESOLVED_PATH);
      expect(mockFileSource.load).toHaveBeenCalledTimes(1);

      expect(S3ConfigurationSource).toHaveBeenCalledTimes(1);
      expect(S3ConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.S3_URL, undefined);
      expect(mockS3Source.load).toHaveBeenCalledTimes(1);

      expect(ObjectConfigurationSource).toHaveBeenCalledTimes(1);
      expect(ObjectConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.OVERRIDE_CONFIG);
    });

    it("should not set global configuration when setGlobal(false)", async () => {
      configurationFactory.addObject(TEST_FIXTURES.BASIC_CONFIG).setGlobal(false);

      await configurationFactory.build();

      expect(mockConfiguration.initializeGlobalInstance).not.toHaveBeenCalled();
    });

    it("should set global configuration by default", async () => {
      configurationFactory.addObject(TEST_FIXTURES.BASIC_CONFIG);

      const result = await configurationFactory.build();

      expect(mockConfiguration.initializeGlobalInstance).toHaveBeenCalledWith(result);
    });

    it("should handle source loading errors gracefully", async () => {
      const errorSource = createMockSource();
      errorSource.load.mockRejectedValue(new Error("Source loading failed"));
      configurationFactory.addSource(errorSource as unknown as ConfigurationSource);
      configurationFactory.addObject(TEST_FIXTURES.BASIC_CONFIG);

      await configurationFactory.build();

      expect(console.error).toHaveBeenCalledWith(
        "Error loading configuration from source: Object",
        expect.any(Error),
      );
      expect(ObjectConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.BASIC_CONFIG); // Other sources still loaded
      expect(deepMerge).toHaveBeenCalledWith({}, TEST_FIXTURES.BASIC_CONFIG); // Valid config was merged
    });

    it("should handle null/undefined source configurations", async () => {
      const nullSource = {
        load: vi.fn().mockResolvedValue(null),
      };
      const validSource = {
        load: vi.fn().mockResolvedValue(TEST_FIXTURES.BASIC_CONFIG),
      };

      configurationFactory.addSource(nullSource as unknown as ConfigurationSource);
      configurationFactory.addSource(validSource as unknown as ConfigurationSource);

      await configurationFactory.build();

      expect(deepMerge).toHaveBeenCalledWith({}, TEST_FIXTURES.BASIC_CONFIG); // Only valid config merged
      expect(nullSource.load).toHaveBeenCalledOnce();
      expect(validSource.load).toHaveBeenCalledOnce();
    });

    it("should handle non-object source configurations", async () => {
      const stringSource = {
        load: vi.fn().mockResolvedValue("invalid config" as unknown as ConfigObject),
      };
      const validSource = {
        load: vi.fn().mockResolvedValue(TEST_FIXTURES.BASIC_CONFIG),
      };
      configurationFactory.addSource(stringSource as unknown as ConfigurationSource);
      configurationFactory.addSource(validSource as unknown as ConfigurationSource);

      await configurationFactory.build();

      expect(deepMerge).toHaveBeenCalledWith({}, TEST_FIXTURES.BASIC_CONFIG); // Only valid config merged
      expect(stringSource.load).toHaveBeenCalledOnce();
      expect(validSource.load).toHaveBeenCalledOnce();
    });

    it("should build empty configuration when no sources added", async () => {
      await configurationFactory.build();

      expect(Configuration).toHaveBeenCalledWith({});
      expect(deepMerge).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests for integration scenarios
   * Verifies end-to-end configuration building with all methods
   */
  describe("integration scenarios", () => {
    it("should support fluent API with all methods", async () => {
      const result = await configurationFactory
        .addFile(TEST_FIXTURES.LOCAL_FILE_PATH)
        .addS3File(TEST_FIXTURES.S3_URL, TEST_FIXTURES.AWS_TEST_REGION)
        .addObject(TEST_FIXTURES.OVERRIDE_CONFIG)
        .setGlobal(false)
        .build();

      expect(FileConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.RESOLVED_PATH);
      expect(S3ConfigurationSource).toHaveBeenCalledWith(
        TEST_FIXTURES.S3_URL,
        TEST_FIXTURES.AWS_TEST_REGION,
      );
      expect(ObjectConfigurationSource).toHaveBeenCalledWith(TEST_FIXTURES.OVERRIDE_CONFIG);
      expect(mockConfiguration.initializeGlobalInstance).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(Configuration);
    });

    it("should handle complex configuration merging scenarios", async () => {
      const baseConfig = { app: { name: "base" }, database: { host: "localhost" } };
      const envConfig = { app: { name: "env" }, features: { enabled: true } };
      const overrideConfig = { database: { port: 5432 } };
      mockFileSource.load.mockResolvedValue(baseConfig);
      mockS3Source.load.mockResolvedValue(envConfig);
      mockObjectSource.load.mockResolvedValue(overrideConfig);

      await configurationFactory
        .addFile(TEST_FIXTURES.LOCAL_FILE_PATH)
        .addS3File(TEST_FIXTURES.S3_URL)
        .addObject(overrideConfig)
        .build();

      expect(deepMerge).toHaveBeenCalledTimes(3);
      expect(deepMerge).toHaveBeenNthCalledWith(1, {}, baseConfig);
      expect(deepMerge).toHaveBeenNthCalledWith(2, baseConfig, envConfig);
    });

    it("should maintain configuration immutability after build", async () => {
      configurationFactory.addObject(TEST_FIXTURES.BASIC_CONFIG);

      const config1 = await configurationFactory.build();
      const config2 = await configurationFactory.build();

      expect(config1).toBeInstanceOf(Configuration);
      expect(config2).toBeInstanceOf(Configuration);
      // Each build creates a new Configuration instance
      expect(Configuration).toHaveBeenCalledTimes(2);
    });
  });
});
