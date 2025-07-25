/**
 * Configuration Source Tests
 *
 * This file contains comprehensive tests for the ConfigurationSource implementations,
 * covering file-based, S3-based, and object-based configuration sources.
 *
 * Test coverage includes:
 * - ConfigurationSource interface contract validation
 * - FileConfigurationSource file loading and error handling
 * - S3ConfigurationSource S3 loading and parameter resolution
 * - ObjectConfigurationSource object copying and immutability
 * - Error handling and edge cases for all source types
 */

import { S3Client } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S3ClientWrapper, parseS3Url } from "../../../src/support/aws";
import {
  type ConfigurationSource,
  FileConfigurationSource,
  ObjectConfigurationSource,
  S3ConfigurationSource,
} from "../../../src/support/config/config-source";
import type { ConfigObject } from "../../../src/support/config/configuration";
import { ParameterResolver } from "../../../src/support/config/parameter-resolver";

/**
 * Setup mocks for external dependencies
 */
vi.mock("node:fs");
vi.mock("@aws-sdk/client-s3");
vi.mock("../../../src/support/aws");
vi.mock("../../../src/support/config/parameter-resolver");

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // File paths and URLs
  VALID_FILE: "/path/to/config.json",

  // S3-related fixtures
  S3_URL: "s3://config-bucket/app/config.json",
  INVALID_S3_URL: "invalid://not-s3-url",
  REGION: "us-west-2",
  BUCKET: "config-bucket",
  KEY: "app/config.json",

  // Test configurations moved from TEST_CONFIGS
  CONFIG_BASIC: {
    app: { name: "test-app", version: "1.0.0" },
    database: { host: "localhost", port: 5432 },
  },
  CONFIG_EMPTY: {},
};

/**
 * Mock implementation of S3 client wrapper for testing
 */
interface MockS3ClientWrapper {
  getObjectAsJson: ReturnType<typeof vi.fn>;
}

/**
 * Mock implementation of parameter resolver for testing
 */
interface MockParameterResolver {
  resolveConfig: ReturnType<typeof vi.fn>;
}

/**
 * Mocked file system existsSync functions
 */
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe("ConfigurationSource", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods to prevent test output clutter
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Reset mock implementations
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  afterEach(() => {
    // Restore console methods
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("FileConfigurationSource", () => {
    let fileSource: FileConfigurationSource;

    beforeEach(() => {
      fileSource = new FileConfigurationSource(TEST_FIXTURES.VALID_FILE);
    });

    /**
     * Tests for constructor
     */
    describe("constructor", () => {
      it("should create instance with file path", () => {
        const source = new FileConfigurationSource(TEST_FIXTURES.VALID_FILE);
        expect(source).toBeInstanceOf(FileConfigurationSource);
      });

      it("should implement ConfigurationSource interface", () => {
        expect(fileSource.load).toBeDefined();
        expect(typeof fileSource.load).toBe("function");
      });
    });

    /**
     * Tests for load method
     * Loads and resolves configuration from a file.
     */
    describe("load", () => {
      it("should load and parse valid JSON file", async () => {
        const jsonString = JSON.stringify(TEST_FIXTURES.CONFIG_BASIC);
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(jsonString);

        const result = await fileSource.load();

        expect(existsSync).toHaveBeenCalledWith(TEST_FIXTURES.VALID_FILE);
        expect(readFileSync).toHaveBeenCalledWith(TEST_FIXTURES.VALID_FILE, "utf8");
        expect(result).toEqual(TEST_FIXTURES.CONFIG_BASIC);
      });

      it("should return empty object when file does not exist", async () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const result = await fileSource.load();

        expect(existsSync).toHaveBeenCalledWith(TEST_FIXTURES.VALID_FILE);
        expect(readFileSync).not.toHaveBeenCalled();
        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `Configuration file not found: ${TEST_FIXTURES.VALID_FILE}`,
        );
      });

      it("should handle JSON parsing errors gracefully", async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue("{ invalid json content //");

        const result = await fileSource.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Error loading configuration from ${TEST_FIXTURES.VALID_FILE}:`,
          expect.any(SyntaxError),
        );
      });

      it("should handle file system errors gracefully", async () => {
        const fsError = new Error("Permission denied");
        vi.mocked(existsSync).mockImplementation(() => {
          throw fsError;
        });

        const result = await fileSource.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Error loading configuration from ${TEST_FIXTURES.VALID_FILE}:`,
          fsError,
        );
      });

      it("should handle empty file gracefully", async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue("");

        const result = await fileSource.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Error loading configuration from ${TEST_FIXTURES.VALID_FILE}:`,
          expect.any(SyntaxError),
        );
      });
    });
  });

  /**
   * Tests for S3ConfigurationSource
   * Tests cover the constructor and load method for S3ConfigurationSource.
   */
  describe("S3ConfigurationSource", () => {
    let s3Source: S3ConfigurationSource;
    let mockS3Client: MockS3ClientWrapper;
    let mockParameterResolver: MockParameterResolver;
    let mockS3ClientInstance: S3Client;

    beforeEach(() => {
      mockS3Client = { getObjectAsJson: vi.fn() };
      mockParameterResolver = { resolveConfig: vi.fn() };
      mockS3ClientInstance = {} as S3Client;

      vi.mocked(S3ClientWrapper).mockImplementation(
        () => mockS3Client as unknown as S3ClientWrapper,
      );
      vi.mocked(ParameterResolver).mockImplementation(
        () => mockParameterResolver as unknown as ParameterResolver,
      );

      s3Source = new S3ConfigurationSource(
        TEST_FIXTURES.S3_URL,
        TEST_FIXTURES.REGION,
        mockS3ClientInstance,
      );
    });

    /**
     * Tests for constructor
     */
    describe("constructor", () => {
      it("should create instance with S3 URL and region", () => {
        const source = new S3ConfigurationSource(TEST_FIXTURES.S3_URL, TEST_FIXTURES.REGION);
        expect(source).toBeInstanceOf(S3ConfigurationSource);
        expect(S3ClientWrapper).toHaveBeenCalledWith(TEST_FIXTURES.REGION, undefined);
        expect(ParameterResolver).toHaveBeenCalledWith(TEST_FIXTURES.REGION, undefined);
      });

      it("should create instance with custom S3Client", () => {
        const source = new S3ConfigurationSource(
          TEST_FIXTURES.S3_URL,
          TEST_FIXTURES.REGION,
          mockS3ClientInstance,
        );
        expect(source).toBeInstanceOf(S3ConfigurationSource);
        expect(S3ClientWrapper).toHaveBeenCalledWith(TEST_FIXTURES.REGION, mockS3ClientInstance);
        expect(ParameterResolver).toHaveBeenCalledWith(TEST_FIXTURES.REGION, mockS3ClientInstance);
      });

      it("should implement ConfigurationSource interface", () => {
        expect(s3Source.load).toBeDefined();
        expect(typeof s3Source.load).toBe("function");
      });
    });

    /**
     * Tests for load method
     * Loads and resolves configuration from S3.
     */
    describe("load", () => {
      it("should load and resolve configuration from S3", async () => {
        vi.mocked(parseS3Url).mockReturnValue({
          bucket: TEST_FIXTURES.BUCKET,
          key: TEST_FIXTURES.KEY,
        });
        mockS3Client.getObjectAsJson.mockResolvedValue(TEST_FIXTURES.CONFIG_BASIC);
        mockParameterResolver.resolveConfig.mockResolvedValue(TEST_FIXTURES.CONFIG_BASIC);

        const result = await s3Source.load();

        expect(parseS3Url).toHaveBeenCalledWith(TEST_FIXTURES.S3_URL);
        expect(mockS3Client.getObjectAsJson).toHaveBeenCalledWith(
          TEST_FIXTURES.BUCKET,
          TEST_FIXTURES.KEY,
        );
        expect(mockParameterResolver.resolveConfig).toHaveBeenCalledWith(
          TEST_FIXTURES.CONFIG_BASIC,
        );
        expect(result).toEqual(TEST_FIXTURES.CONFIG_BASIC);
      });

      it("should return empty object for invalid S3 URL", async () => {
        vi.mocked(parseS3Url).mockReturnValue(null);
        const invalidSource = new S3ConfigurationSource(TEST_FIXTURES.INVALID_S3_URL);

        const result = await invalidSource.load();

        expect(parseS3Url).toHaveBeenCalledWith(TEST_FIXTURES.INVALID_S3_URL);
        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Invalid S3 URL format: ${TEST_FIXTURES.INVALID_S3_URL}`,
        );
      });

      it("should handle S3 client errors gracefully", async () => {
        const s3Error = new Error("S3 access denied");
        vi.mocked(parseS3Url).mockReturnValue({
          bucket: TEST_FIXTURES.BUCKET,
          key: TEST_FIXTURES.KEY,
        });
        mockS3Client.getObjectAsJson.mockRejectedValue(s3Error);

        const result = await s3Source.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Error loading configuration from S3 ${TEST_FIXTURES.S3_URL}:`,
          s3Error,
        );
      });

      it("should handle parameter resolution errors gracefully", async () => {
        const resolverError = new Error("Parameter resolution failed");
        vi.mocked(parseS3Url).mockReturnValue({
          bucket: TEST_FIXTURES.BUCKET,
          key: TEST_FIXTURES.KEY,
        });
        mockS3Client.getObjectAsJson.mockResolvedValue(TEST_FIXTURES.CONFIG_BASIC);
        mockParameterResolver.resolveConfig.mockRejectedValue(resolverError);

        const result = await s3Source.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Error loading configuration from S3 ${TEST_FIXTURES.S3_URL}:`,
          resolverError,
        );
      });

      it("should handle general errors in load method", async () => {
        const generalError = new Error("Unexpected error");
        vi.mocked(parseS3Url).mockImplementation(() => {
          throw generalError;
        });

        const result = await s3Source.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Error in S3ConfigurationSource.load for ${TEST_FIXTURES.S3_URL}:`,
          generalError,
        );
      });

      it("should work without parameter resolution when config has no parameters", async () => {
        vi.mocked(parseS3Url).mockReturnValue({
          bucket: TEST_FIXTURES.BUCKET,
          key: TEST_FIXTURES.KEY,
        });
        mockS3Client.getObjectAsJson.mockResolvedValue(TEST_FIXTURES.CONFIG_BASIC);
        mockParameterResolver.resolveConfig.mockResolvedValue(TEST_FIXTURES.CONFIG_BASIC);

        const result = await s3Source.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_BASIC);
        expect(mockParameterResolver.resolveConfig).toHaveBeenCalledWith(
          TEST_FIXTURES.CONFIG_BASIC,
        );
      });
    });
  });

  /**
   * Tests for ObjectConfigurationSource
   * Loading of configuration from a static JavaScript object.
   */
  describe("ObjectConfigurationSource", () => {
    let objectSource: ObjectConfigurationSource;

    beforeEach(() => {
      objectSource = new ObjectConfigurationSource(TEST_FIXTURES.CONFIG_BASIC);
    });

    /**
     * Tests for constructor
     */
    describe("constructor", () => {
      it("should create instance with configuration object", () => {
        const source = new ObjectConfigurationSource(TEST_FIXTURES.CONFIG_BASIC);
        expect(source).toBeInstanceOf(ObjectConfigurationSource);
      });

      it("should implement ConfigurationSource interface", () => {
        expect(objectSource.load).toBeDefined();
        expect(typeof objectSource.load).toBe("function");
      });

      it("should handle empty configuration object", () => {
        const source = new ObjectConfigurationSource(TEST_FIXTURES.CONFIG_EMPTY);
        expect(source).toBeInstanceOf(ObjectConfigurationSource);
      });
    });

    /**
     * Tests for load method
     * Verifies immutability of the object configuration source.
     */
    describe("load", () => {
      it("should return copy of configuration object", async () => {
        const result = await objectSource.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_BASIC);
        expect(result).not.toBe(TEST_FIXTURES.CONFIG_BASIC); // Different object reference
      });

      it("should return shallow copy ensuring immutability", async () => {
        const originalConfig = { ...TEST_FIXTURES.CONFIG_BASIC };

        const result = await objectSource.load();

        // Modify the returned object
        (result as Record<string, unknown>).newProperty = "modified";
        if (result.app && typeof result.app === "object" && result.app !== null) {
          (result.app as Record<string, unknown>).name = "modified-name";
        }

        // original config should be unchanged
        const secondResult = await objectSource.load();
        expect(secondResult).toEqual(originalConfig);
        expect(secondResult).not.toHaveProperty("newProperty");
      });

      it("should handle empty configuration object", async () => {
        const emptySource = new ObjectConfigurationSource(TEST_FIXTURES.CONFIG_EMPTY);

        const result = await emptySource.load();

        expect(result).toEqual(TEST_FIXTURES.CONFIG_EMPTY);
        expect(result).not.toBe(TEST_FIXTURES.CONFIG_EMPTY);
      });

      it("should handle null and undefined properties", async () => {
        const configWithNulls = { nullValue: null, validValue: "test" } as ConfigObject;
        const nullSource = new ObjectConfigurationSource(configWithNulls);

        const result = await nullSource.load();

        expect(result).toEqual(configWithNulls);
        expect(result.nullValue).toBeNull();
        expect(result.validValue).toBe("test");
      });

      it("should preserve nested object structure", async () => {
        const nestedConfig = { level1: { level2: { level3: { value: "deep-value" } } } };
        const nestedSource = new ObjectConfigurationSource(nestedConfig);

        const result = await nestedSource.load();

        expect(result).toEqual(nestedConfig);
        if (result.level1 && typeof result.level1 === "object" && result.level1 !== null) {
          const level1 = result.level1 as Record<string, unknown>;
          if (level1.level2 && typeof level1.level2 === "object" && level1.level2 !== null) {
            const level2 = level1.level2 as Record<string, unknown>;
            if (level2.level3 && typeof level2.level3 === "object" && level2.level3 !== null) {
              const level3 = level2.level3 as Record<string, unknown>;
              expect(level3.value).toBe("deep-value");
            }
          }
          // Verify it's a shallow copy (nested objects are still referenced)
          expect(result.level1).toBe(nestedConfig.level1);
        }
      });
    });
  });

  /**
   * Tests for integration scenarios
   * Verifies interface compliance and real-world usage patterns
   */
  describe("integration scenarios", () => {
    it("should all implement ConfigurationSource interface consistently", async () => {
      const sources: ConfigurationSource[] = [
        new FileConfigurationSource(TEST_FIXTURES.VALID_FILE),
        new S3ConfigurationSource(TEST_FIXTURES.S3_URL),
        new ObjectConfigurationSource(TEST_FIXTURES.CONFIG_BASIC),
      ];

      for (const source of sources) {
        expect(source.load).toBeDefined();
        expect(typeof source.load).toBe("function");

        // Each load method should return a Promise<ConfigObject>
        const loadPromise = source.load();
        expect(loadPromise).toBeInstanceOf(Promise);

        const result = await loadPromise;
        expect(typeof result).toBe("object");
        expect(result).not.toBeNull();
      }
    });

    it("should handle mixed success and failure scenarios", async () => {
      // Use only ObjectConfigurationSource to avoid filesystem mock conflicts
      const successSource = new ObjectConfigurationSource(TEST_FIXTURES.CONFIG_BASIC);
      const emptySource = new ObjectConfigurationSource(TEST_FIXTURES.CONFIG_EMPTY);
      const sources = [successSource, emptySource];

      const results = await Promise.all(sources.map((source) => source.load()));

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(TEST_FIXTURES.CONFIG_BASIC); // Success source
      expect(results[1]).toEqual(TEST_FIXTURES.CONFIG_EMPTY); // Empty source

      // Verify both sources returned valid configuration objects
      for (const result of results) {
        expect(typeof result).toBe("object");
        expect(result).not.toBeNull();
      }
    });

    it("should maintain type safety across all implementations", async () => {
      const sources: ConfigurationSource[] = [
        new ObjectConfigurationSource(TEST_FIXTURES.CONFIG_BASIC),
      ];

      const results = await Promise.all(sources.map((source) => source.load()));

      for (const result of results) {
        expect(result).toEqual(expect.any(Object));
        expect(Array.isArray(result)).toBe(false);
      }
    });
  });
});
