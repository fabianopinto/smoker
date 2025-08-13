/**
 * ParameterResolver Tests
 *
 * This file contains comprehensive tests for the ParameterResolver class which is responsible
 * for resolving configuration parameters from various sources including AWS SSM and S3.
 *
 * Test coverage includes:
 * - Resolution of primitive values (strings, numbers, booleans, null, undefined)
 * - Resolution of SSM parameter references
 * - Resolution of S3 JSON references
 * - Handling of arrays and nested objects
 * - Circular reference detection
 * - Error handling for various edge cases
 * - Integration with S3 and SSM clients
 * - Caching behavior
 */

import { S3Client } from "@aws-sdk/client-s3";
import { SSMClient } from "@aws-sdk/client-ssm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BaseLogger } from "../../../src/lib/logger";
import { S3ClientWrapper, SSMClientWrapper } from "../../../src/support/aws";
import type { ConfigObject, ConfigValue } from "../../../src/support/config/configuration";
import { ParameterResolver } from "../../../src/support/config/parameter-resolver";

/**
 * Mock the AWS module using factory function to avoid hoisting issues
 */
vi.mock("../../../src/support/aws", () => ({
  S3ClientWrapper: vi.fn().mockImplementation(() => ({
    client: { send: vi.fn() },
    getClient: vi.fn().mockReturnThis(),
    getObjectAsString: vi.fn(),
    getObjectAsJson: vi.fn(),
    isS3JsonReference: vi.fn(),
    getContentFromUrl: vi.fn(),
  })),
  SSMClientWrapper: vi.fn().mockImplementation(() => ({
    client: { send: vi.fn() },
    getClient: vi.fn().mockReturnThis(),
    isSSMReference: vi.fn(),
    isS3JsonReference: vi.fn(),
    parseSSMUrl: vi.fn(),
    getParameter: vi.fn(),
    clearCache: vi.fn(),
  })),
}));

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Error message generators
  CIRCULAR_REFERENCE_ERROR: (path: string) =>
    `Circular reference detected in configuration at path: ${path}`,
  MAX_DEPTH_EXCEEDED_ERROR: (maxDepth: number) => `Maximum resolution depth (${maxDepth}) exceeded`,
  INVALID_REFERENCE_ERROR: (ref: string) => `Invalid reference: ${ref}`,
  RESOLUTION_FAILED_ERROR: (msg: string) => `Resolution failed: ${msg}`,
  // Reference strings
  SSM_HOST: "ssm://db-host",
  S3_FEATURES: "s3://config-bucket/features.json",
  S3_SETTINGS: "s3://config-bucket/settings.json",
  S3_DB_CONFIG: "s3://config-bucket/db-config.json",

  // Resolved values
  RESOLVED_HOST: "prod-db.example.com",
  RESOLVED_PASSWORD: "secret123",
  RESOLVED_API_KEY: "api-key-value",
  RESOLVED_SERVER1: "10.0.0.1",
  RESOLVED_SERVER2: "10.0.0.2",
  RESOLVED_SERVER3: "10.0.0.3",
  FEATURES_CONFIG: { enabled: true, flags: { newFeature: true } },
  SETTINGS_CONFIG: { theme: "dark", notifications: true },
  DB_CONFIG: { poolSize: 10, timeout: 30 },
  REGION: "us-west-2",

  // Basic config
  BASIC_CONFIG: {
    app: { name: "test-app", version: "1.0.0" },
    database: { host: "localhost", port: 5432 },
  },

  // Config with SSM references
  WITH_SSM_REFS: {
    database: { host: "ssm://db-host", password: "ssm://db-password" },
    api: { key: "ssm://api-key" },
  },

  // Config with mixed references
  MIXED_REFS_CONFIG: {
    database: { host: "ssm://db-host", config: "s3://config-bucket/db-config.json" },
    static: { timeout: 30000, enabled: true },
  },

  // Config with nested arrays
  NESTED_ARRAY_CONFIG: {
    servers: [
      "ssm://server1-host",
      "ssm://server2-host",
      { name: "server3", host: "ssm://server3-host" },
    ],
  },
};

/**
 * Type for the mock clients to ensure type safety
 */
interface MockS3Wrapper {
  client: { send: ReturnType<typeof vi.fn> };
  getClient: ReturnType<typeof vi.fn>;
  getObjectAsString: ReturnType<typeof vi.fn>;
  getObjectAsJson: ReturnType<typeof vi.fn>;
  isS3JsonReference: ReturnType<typeof vi.fn>;
  getContentFromUrl: ReturnType<typeof vi.fn>;
}

interface MockSSMWrapper {
  client: { send: ReturnType<typeof vi.fn> };
  getClient: ReturnType<typeof vi.fn>;
  isSSMReference: ReturnType<typeof vi.fn>;
  isS3JsonReference: ReturnType<typeof vi.fn>;
  parseSSMUrl: ReturnType<typeof vi.fn>;
  getParameter: ReturnType<typeof vi.fn>;
  clearCache: ReturnType<typeof vi.fn>;
}

/**
 * Tests for the ParameterResolver class
 */
describe("ParameterResolver", () => {
  // Test fixtures
  let parameterResolver: ParameterResolver;
  let mockS3Client: MockS3Wrapper;
  let mockSSMClient: MockSSMWrapper;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Create new mock instances for each test
    mockS3Client = {
      client: { send: vi.fn() },
      getClient: vi.fn().mockReturnThis(),
      getObjectAsString: vi.fn(),
      getObjectAsJson: vi.fn(),
      isS3JsonReference: vi.fn(),
      getContentFromUrl: vi.fn(),
    };

    mockSSMClient = {
      client: { send: vi.fn() },
      getClient: vi.fn().mockReturnThis(),
      isSSMReference: vi.fn(),
      isS3JsonReference: vi.fn(),
      parseSSMUrl: vi.fn(),
      getParameter: vi.fn(),
      clearCache: vi.fn(),
    };

    // Reset and configure the mock constructors
    const MockS3ClientWrapper = vi.mocked(S3ClientWrapper);
    const MockSSMClientWrapper = vi.mocked(SSMClientWrapper);

    MockS3ClientWrapper.mockClear();
    MockSSMClientWrapper.mockClear();

    MockS3ClientWrapper.mockReturnValue(mockS3Client as unknown as S3ClientWrapper);
    MockSSMClientWrapper.mockReturnValue(mockSSMClient as unknown as SSMClientWrapper);

    // Create a new instance of the parameter resolver for each test
    parameterResolver = new ParameterResolver(
      TEST_FIXTURES.REGION,
      mockS3Client.client as unknown as S3Client,
      mockSSMClient.client as unknown as SSMClient,
    );

    // Setup default mock behaviors
    mockSSMClient.isSSMReference.mockImplementation(
      (value: string) => typeof value === "string" && value.startsWith("ssm://"),
    );

    mockSSMClient.isS3JsonReference.mockImplementation(
      (value: string) =>
        typeof value === "string" && value.startsWith("s3://") && value.endsWith(".json"),
    );

    mockSSMClient.parseSSMUrl.mockImplementation((url: string) => {
      if (!url.startsWith("ssm://")) return null;
      return url.replace("ssm://", "");
    });

    // Setup default SSM parameter responses
    mockSSMClient.getParameter.mockImplementation(async (name: string) => {
      const params: Record<string, string> = {
        "db-host": TEST_FIXTURES.RESOLVED_HOST,
        "db-password": TEST_FIXTURES.RESOLVED_PASSWORD,
        "api-key": TEST_FIXTURES.RESOLVED_API_KEY,
        "server1-host": TEST_FIXTURES.RESOLVED_SERVER1,
        "server2-host": TEST_FIXTURES.RESOLVED_SERVER2,
        "server3-host": TEST_FIXTURES.RESOLVED_SERVER3,
        "circular-param-a": "ssm://circular-param-b",
        "circular-param-b": "ssm://circular-param-a",
      };

      const paramName = name.replace("ssm://", "");
      if (!(paramName in params)) {
        throw new Error(`Parameter ${name} not found`);
      }

      return params[paramName];
    });

    // Setup default S3 responses
    mockS3Client.getContentFromUrl.mockImplementation(async (url: string) => {
      const responses: Record<string, unknown> = {
        [TEST_FIXTURES.S3_FEATURES]: TEST_FIXTURES.FEATURES_CONFIG,
        [TEST_FIXTURES.S3_SETTINGS]: TEST_FIXTURES.SETTINGS_CONFIG,
        [TEST_FIXTURES.S3_DB_CONFIG]: TEST_FIXTURES.DB_CONFIG,
        "s3://config-bucket/circular.json": { circular: true, ref: "ssm://circular-param-b" },
      };

      if (!(url in responses)) {
        throw new Error(`S3 object not found: ${url}`);
      }

      return responses[url];
    });
  });

  /**
   * Tests for constructor
   */

  describe("constructor", () => {
    it("should create instance with region and client instances", () => {
      const mockS3ClientInstance = {};
      const mockSSMClientInstance = {};
      const resolver = new ParameterResolver(
        TEST_FIXTURES.REGION,
        mockS3ClientInstance as unknown as S3Client,
        mockSSMClientInstance as unknown as SSMClient,
      );
      expect(resolver).toBeInstanceOf(ParameterResolver);
      expect(S3ClientWrapper).toHaveBeenCalledWith(TEST_FIXTURES.REGION, mockS3ClientInstance);
      expect(SSMClientWrapper).toHaveBeenCalledWith(TEST_FIXTURES.REGION, mockSSMClientInstance);
    });

    it("should create instance with default parameters", () => {
      const resolver = new ParameterResolver();
      expect(resolver).toBeInstanceOf(ParameterResolver);
      expect(S3ClientWrapper).toHaveBeenCalledWith(undefined, undefined);
      expect(SSMClientWrapper).toHaveBeenCalledWith(undefined, undefined);
    });

    it("should create instance with region only", () => {
      const resolver = new ParameterResolver(TEST_FIXTURES.REGION);
      expect(resolver).toBeInstanceOf(ParameterResolver);
      expect(S3ClientWrapper).toHaveBeenCalledWith(TEST_FIXTURES.REGION, undefined);
      expect(SSMClientWrapper).toHaveBeenCalledWith(TEST_FIXTURES.REGION, undefined);
    });
  });

  /**
   * Tests for resolveValue method
   */

  describe("resolveValue", () => {
    /**
     * Tests for primitive value resolution
     */

    describe("primitive values", () => {
      it("should return string values as-is when not references", async () => {
        mockSSMClient.isSSMReference.mockReturnValue(false);
        mockSSMClient.isS3JsonReference.mockReturnValue(false);

        const result = await parameterResolver.resolveValue("regular-string");

        expect(result).toBe("regular-string");
        expect(mockSSMClient.isSSMReference).toHaveBeenCalledWith("regular-string");
        expect(mockSSMClient.isS3JsonReference).toHaveBeenCalledWith("regular-string");
      });

      it("should return number values as-is", async () => {
        const result = await parameterResolver.resolveValue(42);

        expect(result).toBe(42);
      });

      it("should return boolean values as-is", async () => {
        const result = await parameterResolver.resolveValue(true);

        expect(result).toBe(true);
      });

      it("should return null values as-is", async () => {
        const result = await parameterResolver.resolveValue(null);

        expect(result).toBeNull();
      });
    });

    /**
     * Tests for SSM parameter resolution
     */

    describe("SSM parameter resolution", () => {
      it("should resolve SSM parameter references", async () => {
        mockSSMClient.isSSMReference
          .mockReturnValueOnce(true) // For TEST_FIXTURES.SSM_HOST
          .mockReturnValueOnce(false); // For resolved value TEST_FIXTURES.RESOLVED_HOST
        mockSSMClient.isS3JsonReference.mockReturnValueOnce(false); // For resolved value TEST_FIXTURES.RESOLVED_HOST
        mockSSMClient.parseSSMUrl.mockReturnValue("db-host");
        mockSSMClient.getParameter.mockResolvedValue(TEST_FIXTURES.RESOLVED_HOST);

        const result = await parameterResolver.resolveValue(TEST_FIXTURES.SSM_HOST);

        expect(result).toBe(TEST_FIXTURES.RESOLVED_HOST);
        expect(mockSSMClient.isSSMReference).toHaveBeenCalledWith(TEST_FIXTURES.SSM_HOST);
        expect(mockSSMClient.parseSSMUrl).toHaveBeenCalledWith(TEST_FIXTURES.SSM_HOST);
        expect(mockSSMClient.getParameter).toHaveBeenCalledWith("db-host");
      });

      it("should handle SSM parameter resolution errors", async () => {
        mockSSMClient.isSSMReference.mockReturnValue(true);
        mockSSMClient.parseSSMUrl.mockReturnValue("non-existent-param");
        const ssmError = new Error("Parameter not found");
        mockSSMClient.getParameter.mockRejectedValue(ssmError);

        await expect(parameterResolver.resolveValue("ssm://non-existent")).rejects.toThrow(
          /Parameter not found/,
        );
      });

      it("should handle null parameter name from parseSSMUrl", async () => {
        mockSSMClient.isSSMReference
          .mockReturnValueOnce(true) // For TEST_FIXTURES.SSM_HOST
          .mockReturnValueOnce(false); // For fallback check on original value
        mockSSMClient.isS3JsonReference.mockReturnValueOnce(false); // For fallback S3 check on original value
        mockSSMClient.parseSSMUrl.mockReturnValue(null);

        const result = await parameterResolver.resolveValue(TEST_FIXTURES.SSM_HOST);

        expect(result).toBe(TEST_FIXTURES.SSM_HOST);
        expect(mockSSMClient.parseSSMUrl).toHaveBeenCalledWith(TEST_FIXTURES.SSM_HOST);
        expect(mockSSMClient.getParameter).not.toHaveBeenCalled();
      });

      it("should recursively resolve nested SSM references", async () => {
        // Flow: resolveValue("ssm://param-a") -> getParameter("param-a") -> "ssm://param-b" -> resolveValue("ssm://param-b") -> getParameter("param-b") -> "prod-db.example.com"
        mockSSMClient.isSSMReference
          .mockReturnValueOnce(true) // Initial: "ssm://param-a" is SSM reference
          .mockReturnValueOnce(true) // After getParameter: "ssm://param-b" is SSM reference (triggers recursive call)
          .mockReturnValueOnce(true) // Recursive call: "ssm://param-b" is SSM reference
          .mockReturnValueOnce(false); // After second getParameter: "prod-db.example.com" is not SSM reference

        mockSSMClient.isS3JsonReference
          .mockReturnValueOnce(false) // After getParameter: "ssm://param-b" is not S3 reference
          .mockReturnValueOnce(false); // After second getParameter: "prod-db.example.com" is not S3 reference

        mockSSMClient.parseSSMUrl
          .mockReturnValueOnce("param-a") // Parse initial "ssm://param-a"
          .mockReturnValueOnce("param-b"); // Parse recursive "ssm://param-b"

        mockSSMClient.getParameter
          .mockResolvedValueOnce("ssm://param-b") // param-a resolves to "ssm://param-b"
          .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_HOST); // param-b resolves to final value

        const result = await parameterResolver.resolveValue("ssm://param-a");

        expect(result).toBe(TEST_FIXTURES.RESOLVED_HOST);
        expect(mockSSMClient.getParameter).toHaveBeenCalledTimes(2);
        expect(mockSSMClient.getParameter).toHaveBeenNthCalledWith(1, "param-a");
        expect(mockSSMClient.getParameter).toHaveBeenNthCalledWith(2, "param-b");
      });
    });

    /**
     * Tests for S3 JSON reference resolution
     * Verifies that S3 JSON references are resolved correctly
     */
    describe("S3 JSON reference resolution", () => {
      it("should resolve S3 JSON references", async () => {
        mockSSMClient.isSSMReference.mockReturnValue(false);
        mockSSMClient.isS3JsonReference.mockReturnValue(true);
        mockS3Client.getContentFromUrl.mockResolvedValue(TEST_FIXTURES.FEATURES_CONFIG);

        const result = await parameterResolver.resolveValue(TEST_FIXTURES.S3_FEATURES);

        expect(result).toEqual(TEST_FIXTURES.FEATURES_CONFIG);
        expect(mockSSMClient.isS3JsonReference).toHaveBeenCalledWith(TEST_FIXTURES.S3_FEATURES);
        expect(mockS3Client.getContentFromUrl).toHaveBeenCalledWith(TEST_FIXTURES.S3_FEATURES);
      });

      it("should handle S3 JSON resolution errors", async () => {
        const s3Error = new Error("S3 access denied");
        mockSSMClient.isSSMReference.mockReturnValue(false);
        mockSSMClient.isS3JsonReference.mockReturnValue(true);
        mockS3Client.getContentFromUrl.mockRejectedValue(s3Error);

        const loggerErrorSpy = vi.spyOn(BaseLogger.prototype, "error").mockImplementation(() => {
          // Suppress logger output in tests
        });

        const result = await parameterResolver.resolveValue(TEST_FIXTURES.S3_FEATURES);

        expect(result).toBe(TEST_FIXTURES.S3_FEATURES); // Returns original reference on error
        // ParameterResolver logs as logger.error(message, error)
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          `Error resolving S3 JSON reference ${TEST_FIXTURES.S3_FEATURES}:`,
          s3Error,
        );

        loggerErrorSpy.mockRestore();
      });

      it("should recursively resolve S3 JSON content with nested references", async () => {
        mockSSMClient.isSSMReference
          .mockReturnValueOnce(false) // For S3 reference check
          .mockReturnValueOnce(true); // For nested SSM reference
        mockSSMClient.isS3JsonReference
          .mockReturnValueOnce(true) // For S3 reference
          .mockReturnValueOnce(false); // For nested SSM reference
        mockS3Client.getContentFromUrl.mockResolvedValue({ host: "ssm://db-host", port: 5432 });
        mockSSMClient.parseSSMUrl.mockReturnValue("db-host");
        mockSSMClient.getParameter.mockResolvedValue(TEST_FIXTURES.RESOLVED_HOST);

        const result = await parameterResolver.resolveValue(TEST_FIXTURES.S3_DB_CONFIG);

        expect(result).toEqual({ host: TEST_FIXTURES.RESOLVED_HOST, port: 5432 });
      });
    });

    /**
     * Tests for array resolution
     * Verifies that array items are resolved recursively
     */
    describe("array resolution", () => {
      it("should resolve array items recursively", async () => {
        mockSSMClient.isSSMReference
          .mockReturnValueOnce(true) // For first item
          .mockReturnValueOnce(false); // For second item
        mockSSMClient.isS3JsonReference.mockReturnValue(false);
        mockSSMClient.parseSSMUrl.mockReturnValue("server1-host");
        mockSSMClient.getParameter.mockResolvedValue("server1.example.com");

        const result = await parameterResolver.resolveValue([
          "ssm://server1-host",
          "regular-string",
          42,
        ]);

        expect(result).toEqual(["server1.example.com", "regular-string", 42]);
      });

      it("should handle empty arrays", async () => {
        const result = await parameterResolver.resolveValue([]);

        expect(result).toEqual([]);
      });

      it("should resolve nested arrays", async () => {
        mockSSMClient.isSSMReference.mockReturnValueOnce(true).mockReturnValueOnce(false);
        mockSSMClient.isS3JsonReference.mockReturnValue(false);
        mockSSMClient.parseSSMUrl.mockReturnValue("param1");
        mockSSMClient.getParameter.mockResolvedValue("resolved-value");

        const result = await parameterResolver.resolveValue([["ssm://param1"], ["regular-value"]]);

        expect(result).toEqual([["resolved-value"], ["regular-value"]]);
      });
    });

    /**
     * Tests for object resolution
     * Verifies that object properties are resolved recursively
     */
    describe("object resolution", () => {
      it("should resolve object properties recursively", async () => {
        // TEST_FIXTURES.WITH_SSM_REFS has 3 SSM references: database.host, database.password, api.key
        mockSSMClient.isSSMReference
          .mockReturnValueOnce(true) // database.host: "ssm://db-host" is SSM reference
          .mockReturnValueOnce(false) // resolved host value is not SSM reference
          .mockReturnValueOnce(true) // database.password: "ssm://db-password" is SSM reference
          .mockReturnValueOnce(false) // resolved password value is not SSM reference
          .mockReturnValueOnce(true) // api.key: "ssm://api-key" is SSM reference
          .mockReturnValueOnce(false); // resolved api key value is not SSM reference

        mockSSMClient.isS3JsonReference
          .mockReturnValueOnce(false) // resolved host value is not S3 reference
          .mockReturnValueOnce(false) // resolved password value is not S3 reference
          .mockReturnValueOnce(false); // resolved api key value is not S3 reference

        mockSSMClient.parseSSMUrl
          .mockReturnValueOnce("db-host")
          .mockReturnValueOnce("db-password")
          .mockReturnValueOnce("api-key");

        mockSSMClient.getParameter
          .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_HOST)
          .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_PASSWORD)
          .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_API_KEY);

        const result = await parameterResolver.resolveValue(TEST_FIXTURES.WITH_SSM_REFS);

        expect(result).toEqual({
          database: {
            host: TEST_FIXTURES.RESOLVED_HOST,
            password: TEST_FIXTURES.RESOLVED_PASSWORD,
          },
          api: { key: TEST_FIXTURES.RESOLVED_API_KEY },
        });
      });

      it("should handle empty objects", async () => {
        const result = await parameterResolver.resolveValue({});

        expect(result).toEqual({});
      });

      it("should preserve object structure with mixed value types", async () => {
        const mixedObject = {
          stringRef: "ssm://param",
          regularString: "value",
          number: 42,
          boolean: true,
          nullValue: null,
          nested: { prop: "ssm://nested-param" },
        };
        // Mock setup for mixed object: stringRef (SSM), regularString (literal), nested.prop (SSM)
        mockSSMClient.isSSMReference
          .mockReturnValueOnce(true) // stringRef: "ssm://param" is SSM reference
          .mockReturnValueOnce(false) // resolved "resolved-param" is not SSM reference
          .mockReturnValueOnce(false) // regularString: "value" is not SSM reference
          .mockReturnValueOnce(true) // nested.prop: "ssm://nested-param" is SSM reference
          .mockReturnValueOnce(false); // resolved "resolved-nested" is not SSM reference

        mockSSMClient.isS3JsonReference
          .mockReturnValueOnce(false) // resolved "resolved-param" is not S3 reference
          .mockReturnValueOnce(false) // regularString: "value" is not S3 reference
          .mockReturnValueOnce(false); // resolved "resolved-nested" is not S3 reference

        mockSSMClient.parseSSMUrl
          .mockReturnValueOnce("param") // Parse "ssm://param"
          .mockReturnValueOnce("nested-param"); // Parse "ssm://nested-param"

        mockSSMClient.getParameter
          .mockResolvedValueOnce("resolved-param") // param resolves to "resolved-param"
          .mockResolvedValueOnce("resolved-nested"); // nested-param resolves to "resolved-nested"

        const result = await parameterResolver.resolveValue(mixedObject);

        expect(result).toEqual({
          stringRef: "resolved-param",
          regularString: "value",
          number: 42,
          boolean: true,
          nullValue: null,
          nested: { prop: "resolved-nested" },
        });
      });
    });

    /**
     * Tests for circular reference detection
     * Verifies that circular references are detected and handled gracefully
     */
    describe("circular reference detection", () => {
      it("should detect circular SSM references", async () => {
        // Create a scenario where the same reference appears twice in the processing stack
        // We'll simulate: ssm://param-a -> ssm://param-b -> ssm://param-a (circular)

        let callCount = 0;
        mockSSMClient.isSSMReference.mockImplementation((value: string) => {
          return value.startsWith("ssm://");
        });

        mockSSMClient.isS3JsonReference.mockReturnValue(false);

        mockSSMClient.parseSSMUrl.mockImplementation((url: string) => {
          if (url === "ssm://param-a") return "param-a";
          if (url === "ssm://param-b") return "param-b";
          return null;
        });

        mockSSMClient.getParameter.mockImplementation(async (paramName: string) => {
          callCount++;
          if (paramName === "param-a" && callCount === 1) {
            return "ssm://param-b"; // First call: param-a -> ssm://param-b
          }
          if (paramName === "param-b" && callCount === 2) {
            return "ssm://param-a"; // Second call: param-b -> ssm://param-a (creates circular reference)
          }
          return "resolved-value";
        });

        await expect(parameterResolver.resolveValue("ssm://param-a")).rejects.toThrow(
          "Circular reference detected",
        );
      });

      it("should detect circular S3 references", async () => {
        mockSSMClient.isSSMReference.mockReturnValue(false);
        mockSSMClient.isS3JsonReference.mockReturnValue(true);
        mockS3Client.getContentFromUrl.mockResolvedValue("s3://config-bucket/circular.json");

        await expect(
          parameterResolver.resolveValue("s3://config-bucket/circular.json"),
        ).rejects.toThrow(/Circular reference detected/);
      });

      it("should rethrow circular reference errors from S3 resolution", async () => {
        const circularError = new Error("Circular reference detected: test");
        mockSSMClient.isSSMReference.mockReturnValue(false);
        mockSSMClient.isS3JsonReference.mockReturnValue(true);
        mockS3Client.getContentFromUrl.mockRejectedValue(circularError);

        await expect(parameterResolver.resolveValue(TEST_FIXTURES.S3_FEATURES)).rejects.toThrow(
          "Circular reference detected: test",
        );
      });
    });

    /**
     * Tests for maximum depth limiting
     * Verifies that maximum depth is enforced to prevent infinite recursion
     */
    describe("maximum depth limiting", () => {
      it("should throw error when maximum depth is exceeded", async () => {
        // Create deeply nested object structure
        const deepObject: ConfigObject = {};
        let current = deepObject;
        for (let i = 0; i < 12; i++) {
          current.nested = { value: "ssm://param" };
          current = current.nested as ConfigObject;
        }

        // Mock to return false for resolved values to avoid circular reference detection
        mockSSMClient.isSSMReference.mockImplementation((value: string) => {
          // Only the original "ssm://param" should be detected as SSM reference
          return value === "ssm://param";
        });
        mockSSMClient.isS3JsonReference.mockReturnValue(false);
        mockSSMClient.parseSSMUrl.mockReturnValue("param");
        mockSSMClient.getParameter.mockResolvedValue("resolved-value");

        await expect(parameterResolver.resolveValue(deepObject)).rejects.toThrow(
          "Maximum parameter resolution depth (10) exceeded. Possible circular reference detected.",
        );
      });

      it("should handle maximum depth with nested arrays", async () => {
        // Create deep nested arrays
        let deepArray: ConfigValue = "ssm://param";
        for (let i = 0; i < 12; i++) {
          deepArray = [deepArray];
        }

        mockSSMClient.isSSMReference.mockReturnValue(true);
        mockSSMClient.isS3JsonReference.mockReturnValue(false);
        mockSSMClient.parseSSMUrl.mockReturnValue("param");
        mockSSMClient.getParameter.mockResolvedValue("resolved-value");

        await expect(parameterResolver.resolveValue(deepArray)).rejects.toThrow(
          "Maximum parameter resolution depth (10) exceeded",
        );
      });
    });
  });

  /**
   * Tests for resolveConfig method
   */
  describe("resolveConfig", () => {
    it("should resolve configuration object", async () => {
      mockSSMClient.isSSMReference
        .mockReturnValueOnce(true) // database.host: "ssm://db-host"
        .mockReturnValueOnce(false) // resolved host value check
        .mockReturnValueOnce(true) // database.password: "ssm://db-password"
        .mockReturnValueOnce(false) // resolved password value check
        .mockReturnValueOnce(true) // api.key: "ssm://api-key"
        .mockReturnValueOnce(false); // resolved api key value check

      mockSSMClient.isS3JsonReference
        .mockReturnValueOnce(false) // resolved host S3 check
        .mockReturnValueOnce(false) // resolved password S3 check
        .mockReturnValueOnce(false); // resolved api key S3 check

      mockSSMClient.parseSSMUrl
        .mockReturnValueOnce("db-host")
        .mockReturnValueOnce("db-password")
        .mockReturnValueOnce("api-key");

      mockSSMClient.getParameter
        .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_HOST)
        .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_PASSWORD)
        .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_API_KEY);

      const result = await parameterResolver.resolveConfig(TEST_FIXTURES.WITH_SSM_REFS);

      expect(result).toEqual({
        database: { host: TEST_FIXTURES.RESOLVED_HOST, password: TEST_FIXTURES.RESOLVED_PASSWORD },
        api: { key: TEST_FIXTURES.RESOLVED_API_KEY },
      });
    });

    it("should handle empty configuration object", async () => {
      const result = await parameterResolver.resolveConfig({});

      expect(result).toEqual({});
    });

    it("should handle basic configuration objects", async () => {
      // No references to resolve in this test
      mockSSMClient.isSSMReference.mockReturnValue(false);
      mockSSMClient.isS3JsonReference.mockReturnValue(false);

      const result = await parameterResolver.resolveConfig(TEST_FIXTURES.BASIC_CONFIG);

      expect(result).toEqual(TEST_FIXTURES.BASIC_CONFIG);
      expect(mockSSMClient.getParameter).not.toHaveBeenCalled();
      expect(mockS3Client.getContentFromUrl).not.toHaveBeenCalled();
    });

    it("should return ConfigObject type", async () => {
      mockSSMClient.isSSMReference.mockReturnValue(false);
      mockSSMClient.isS3JsonReference.mockReturnValue(false);

      const result = await parameterResolver.resolveConfig(TEST_FIXTURES.BASIC_CONFIG);

      expect(result).toEqual(TEST_FIXTURES.BASIC_CONFIG);
      expect(typeof result).toBe("object");
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(false);
    });
  });

  /**
   * Tests for integration scenarios
   */
  describe("integration scenarios", () => {
    it("should resolve mixed SSM and S3 references", async () => {
      mockSSMClient.isSSMReference
        .mockReturnValueOnce(true) // For database.host
        .mockReturnValueOnce(false) // For database.config (S3 check)
        .mockReturnValueOnce(false) // For static.timeout (not a reference)
        .mockReturnValueOnce(false); // For static.enabled (not a reference)

      mockSSMClient.isS3JsonReference
        .mockReturnValueOnce(false) // For database.host (not S3)
        .mockReturnValueOnce(true); // For database.config (is S3)
      mockSSMClient.parseSSMUrl.mockReturnValueOnce("db-host");

      mockSSMClient.getParameter.mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_HOST);

      mockS3Client.getContentFromUrl.mockResolvedValueOnce(TEST_FIXTURES.DB_CONFIG);

      const result = await parameterResolver.resolveConfig(TEST_FIXTURES.MIXED_REFS_CONFIG);

      expect(result).toEqual({
        database: { host: TEST_FIXTURES.RESOLVED_HOST, config: TEST_FIXTURES.DB_CONFIG },
        static: { timeout: 30000, enabled: true },
      });
    });

    it("should resolve array items in configuration", async () => {
      mockSSMClient.isSSMReference
        .mockReturnValueOnce(true) // servers[0]: "ssm://server1-host"
        .mockReturnValueOnce(true) // servers[1]: "ssm://server2-host"
        .mockReturnValueOnce(false) // servers[2]: object
        .mockReturnValueOnce(true); // servers[2].host: "ssm://server3-host"

      mockSSMClient.isS3JsonReference.mockReturnValue(false);

      mockSSMClient.parseSSMUrl
        .mockReturnValueOnce("server1-host")
        .mockReturnValueOnce("server2-host")
        .mockReturnValueOnce("server3-host");

      mockSSMClient.getParameter
        .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_SERVER1)
        .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_SERVER2)
        .mockResolvedValueOnce(TEST_FIXTURES.RESOLVED_SERVER3);

      const result = await parameterResolver.resolveConfig(TEST_FIXTURES.NESTED_ARRAY_CONFIG);

      expect(result).toEqual({
        servers: [
          TEST_FIXTURES.RESOLVED_SERVER1,
          TEST_FIXTURES.RESOLVED_SERVER2,
          { name: "server3", host: TEST_FIXTURES.RESOLVED_SERVER3 },
        ],
      });
    });

    it("should maintain immutability of original configuration", async () => {
      const originalConfig = { ...TEST_FIXTURES.BASIC_CONFIG };
      mockSSMClient.isSSMReference.mockReturnValue(false);
      mockSSMClient.isS3JsonReference.mockReturnValue(false);

      const result = await parameterResolver.resolveConfig(originalConfig);

      // Modify the result
      (result as Record<string, unknown>).newProperty = "modified";

      expect(originalConfig).toEqual(TEST_FIXTURES.BASIC_CONFIG);
      expect(originalConfig).not.toHaveProperty("newProperty");
    });

    it("should handle resolution depth properly with complex nesting", async () => {
      // Create a moderately deep but valid structure
      const complexConfig = {
        level1: { level2: { level3: { level4: { level5: { value: "ssm://deep-param" } } } } },
      };

      // Mock to return false for resolved values to avoid circular reference detection
      mockSSMClient.isSSMReference.mockImplementation((value: string) => {
        // Only the original "ssm://deep-param" should be detected as SSM reference
        return value === "ssm://deep-param";
      });
      mockSSMClient.isS3JsonReference.mockReturnValue(false);
      mockSSMClient.parseSSMUrl.mockReturnValue("deep-param");
      mockSSMClient.getParameter.mockResolvedValue("deep-resolved-value");

      const result = await parameterResolver.resolveConfig(complexConfig);

      expect(result).toEqual({
        level1: { level2: { level3: { level4: { level5: { value: "deep-resolved-value" } } } } },
      });
    });
  });
});
