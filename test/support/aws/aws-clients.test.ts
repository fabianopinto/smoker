/**
 * Tests for AWS Clients Module
 *
 * This test suite verifies the functionality of AWS service wrapper classes and utility functions
 * for S3 and SSM Parameter Store integration. It ensures proper handling of AWS service operations,
 * error conditions, and edge cases.
 *
 * Test Coverage:
 * - Utility functions (parseS3Url, streamToString)
 * - S3ClientWrapper methods and error handling
 * - SSMClientWrapper methods with parameter caching
 * - Interface contracts and type safety
 * - Error handling and edge cases
 */

import { GetObjectCommand, type GetObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "node:stream";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERR_S3_READ, ERR_SSM_PARAMETER, SmokerError } from "../../../src/errors";
import {
  DEFAULT_AWS_REGION,
  type IS3Client,
  type ISSMClient,
  parseS3Url,
  S3ClientWrapper,
  SSMClientWrapper,
  ssmParameterCache,
  streamToString,
} from "../../../src/support/aws/aws-clients";

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // S3 related test data
  S3_BUCKET_NAME: "test-bucket",
  S3_JSON_KEY: "test/path/config.json",
  S3_TEXT_KEY: "test/path/readme.txt",
  S3_CONTENT: "test file content",
  S3_JSON_CONTENT: { message: "test json content", value: 42 },

  // SSM related test data
  SSM_PARAM_NAME: "/test/parameter",
  SSM_PARAM_VALUE: "test-parameter-value",

  // URLs for testing
  URL_VALID_S3_JSON: "s3://test-bucket/test/path/config.json",
  URL_VALID_S3_TEXT: "s3://test-bucket/test/path/readme.txt",
  URL_INVALID_S3: "invalid-s3-url",

  // AWS configuration
  AWS_TEST_REGION: "us-west-2",
};

/**
 * Test Instance Variables
 */
let s3ClientWrapper: S3ClientWrapper;
let ssmClientWrapper: SSMClientWrapper;

/**
 * Create AWS SDK client mocks
 */
const s3ClientMock = mockClient(S3Client);
const ssmClientMock = mockClient(SSMClient);

/**
 * Test suite for AWS Clients Module
 */
describe("AWS Clients Module", () => {
  beforeEach(() => {
    // Reset all AWS SDK client mocks before each test
    s3ClientMock.reset();
    ssmClientMock.reset();

    // Clear SSM parameter cache to ensure test isolation
    Object.keys(ssmParameterCache).forEach((key) => {
      ssmParameterCache[key] = undefined;
    });

    // Create fresh wrapper instances for each test
    s3ClientWrapper = new S3ClientWrapper(TEST_FIXTURES.AWS_TEST_REGION);
    ssmClientWrapper = new SSMClientWrapper(TEST_FIXTURES.AWS_TEST_REGION);
  });

  afterEach(() => {
    // Clean up mocks after each test to prevent interference
    s3ClientMock.reset();
    ssmClientMock.reset();

    // Clear any timers or intervals that might have been set
    vi.clearAllTimers();

    // Clear any mocks that were created during the test
    vi.clearAllMocks();

    // Clear any mock implementations
    vi.restoreAllMocks();
  });

  afterAll(() => {
    // Clean up any resources after all tests are done
    vi.resetAllMocks();
  });

  /**
   * Creates a mock readable stream for testing stream conversion
   *
   * @param content - The string content to put in the stream
   * @returns A readable stream containing the content
   */
  function createMockStream(content: string): Readable {
    const stream = new Readable();
    stream.push(content);
    stream.push(null); // Signal end of stream
    return stream;
  }

  /**
   * Creates a mock AWS S3 response object
   *
   * @param body - The response body content
   * @returns Mock S3 response object
   */
  function createMockS3Response(
    body: Readable | Buffer | string | undefined,
  ): GetObjectCommandOutput {
    // Use type assertion for the Body property since we know it's valid in our test context
    return { Body: body as unknown as GetObjectCommandOutput["Body"], $metadata: {} };
  }

  /**
   * Tests for Constants
   */
  describe("Constants", () => {
    it("should export DEFAULT_AWS_REGION with correct fallback", () => {
      expect(DEFAULT_AWS_REGION).toBeDefined();
      expect(typeof DEFAULT_AWS_REGION).toBe("string");
      // Should be either from env var or default
      expect(DEFAULT_AWS_REGION).toMatch(/^[a-z0-9-]+$/);
    });
  });

  /**
   * Utility Functions Tests
   */
  describe("parseS3Url", () => {
    it("should parse valid S3 URLs correctly", () => {
      expect(parseS3Url(TEST_FIXTURES.URL_VALID_S3_JSON)).toEqual({
        bucket: TEST_FIXTURES.S3_BUCKET_NAME,
        key: TEST_FIXTURES.S3_JSON_KEY,
      });
    });

    it("should return null for invalid S3 URLs", () => {
      expect(parseS3Url(TEST_FIXTURES.URL_INVALID_S3)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(parseS3Url(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseS3Url("")).toBeNull();
    });

    it("should handle complex S3 URLs with nested paths", () => {
      expect(parseS3Url("s3://my-bucket/deep/nested/path/to/file.json")).toEqual({
        bucket: "my-bucket",
        key: "deep/nested/path/to/file.json",
      });
    });
  });

  /**
   * Stream to String Tests
   */
  describe("streamToString", () => {
    it("should return string input as-is", async () => {
      expect(await streamToString(TEST_FIXTURES.S3_CONTENT)).toBe(TEST_FIXTURES.S3_CONTENT);
    });

    it("should convert Readable stream to string", async () => {
      expect(await streamToString(createMockStream(TEST_FIXTURES.S3_CONTENT))).toBe(
        TEST_FIXTURES.S3_CONTENT,
      );
    });

    it("should handle empty stream", async () => {
      expect(await streamToString(createMockStream(""))).toBe("");
    });

    it("should handle objects with custom toString method", async () => {
      const objectWithToString = {
        toString: vi.fn().mockReturnValue(TEST_FIXTURES.S3_CONTENT),
      };

      expect(await streamToString(objectWithToString)).toBe(TEST_FIXTURES.S3_CONTENT);
      expect(objectWithToString.toString).toHaveBeenCalledWith("utf8");
    });

    it("should handle unknown types by converting to string", async () => {
      expect(await streamToString({ value: 42 })).toBe("[object Object]");
      // TODO: Add more specific tests for unknown types
    });

    it("should handle null/undefined input", async () => {
      expect(await streamToString(null)).toBe("");
      expect(await streamToString(undefined)).toBe("");
    });

    it("should handle stream errors", async () => {
      const errorStream = new Readable();
      const testError = new Error("Stream error");

      const promise = streamToString(errorStream);
      errorStream.emit("error", testError);

      await expect(promise).rejects.toThrow("Stream error");
    });
  });

  /**
   * S3ClientWrapper Tests
   */
  describe("S3ClientWrapper", () => {
    /**
     * Constructor Tests
     */
    describe("constructor", () => {
      it("should create instance with default region", () => {
        expect(new S3ClientWrapper()).toBeInstanceOf(S3ClientWrapper);
      });

      it("should create instance with specified region", () => {
        expect(new S3ClientWrapper(TEST_FIXTURES.AWS_TEST_REGION)).toBeInstanceOf(S3ClientWrapper);
      });

      it("should use provided client override", () => {
        const customClient = new S3Client({ region: TEST_FIXTURES.AWS_TEST_REGION });
        expect(new S3ClientWrapper(undefined, customClient).getClient()).toBe(customClient);
      });
    });

    /**
     * Client Tests
     */
    describe("getClient", () => {
      it("should return the underlying S3 client", () => {
        expect(s3ClientWrapper.getClient()).toBeInstanceOf(S3Client);
      });
    });

    /**
     * Object As String Tests
     */
    describe("getObjectAsString", () => {
      it("should retrieve object content as string", async () => {
        const mockResponse = createMockS3Response(TEST_FIXTURES.S3_CONTENT);
        s3ClientMock.on(GetObjectCommand).resolves(mockResponse);

        const result = await s3ClientWrapper.getObjectAsString(
          TEST_FIXTURES.S3_BUCKET_NAME,
          TEST_FIXTURES.S3_TEXT_KEY,
        );

        expect(result).toBe(TEST_FIXTURES.S3_CONTENT);
        expect(s3ClientMock).toHaveReceivedCommandWith(GetObjectCommand, {
          Bucket: TEST_FIXTURES.S3_BUCKET_NAME,
          Key: TEST_FIXTURES.S3_TEXT_KEY,
        });
      });

      it("should throw error when response body is empty", async () => {
        const mockResponse = createMockS3Response(undefined);
        s3ClientMock.on(GetObjectCommand).resolves(mockResponse);

        await expect(
          s3ClientWrapper.getObjectAsString(
            TEST_FIXTURES.S3_BUCKET_NAME,
            TEST_FIXTURES.S3_TEXT_KEY,
          ),
        ).rejects.toSatisfy(
          (err) =>
            SmokerError.isSmokerError(err) &&
            err.code === ERR_S3_READ &&
            err.domain === "aws" &&
            err.details?.component === "s3" &&
            err.details?.bucket === TEST_FIXTURES.S3_BUCKET_NAME &&
            err.details?.key === TEST_FIXTURES.S3_TEXT_KEY,
        );
      });

      it("should propagate AWS SDK errors", async () => {
        const awsError = new Error("AWS S3 Error");
        s3ClientMock.on(GetObjectCommand).rejects(awsError);

        await expect(
          s3ClientWrapper.getObjectAsString(
            TEST_FIXTURES.S3_BUCKET_NAME,
            TEST_FIXTURES.S3_TEXT_KEY,
          ),
        ).rejects.toSatisfy(
          (err) =>
            SmokerError.isSmokerError(err) &&
            err.code === ERR_S3_READ &&
            err.domain === "aws" &&
            err.details?.component === "s3",
        );
      });
    });

    /**
     * Object As JSON Tests
     */
    describe("getObjectAsJson", () => {
      it("should retrieve and parse S3 object as JSON", async () => {
        const jsonContent = JSON.stringify(TEST_FIXTURES.S3_JSON_CONTENT);
        const mockResponse = createMockS3Response(Buffer.from(jsonContent));
        s3ClientMock.on(GetObjectCommand).resolves(mockResponse);

        const result = await s3ClientWrapper.getObjectAsJson(
          TEST_FIXTURES.S3_BUCKET_NAME,
          TEST_FIXTURES.S3_JSON_KEY,
        );

        expect(result).toEqual(TEST_FIXTURES.S3_JSON_CONTENT);
      });

      it("should throw error for invalid JSON", async () => {
        const invalidJson = "{ invalid json }";
        const mockResponse = createMockS3Response(Buffer.from(invalidJson));
        s3ClientMock.on(GetObjectCommand).resolves(mockResponse);

        await expect(
          s3ClientWrapper.getObjectAsJson(TEST_FIXTURES.S3_BUCKET_NAME, TEST_FIXTURES.S3_JSON_KEY),
        ).rejects.toThrow();
      });
    });

    /**
     * Is S3 JSON Reference Tests
     */
    describe("isS3JsonReference", () => {
      it("should return true for valid S3 JSON references", () => {
        expect(s3ClientWrapper.isS3JsonReference(TEST_FIXTURES.URL_VALID_S3_JSON)).toBe(true);
        expect(s3ClientWrapper.isS3JsonReference("s3://bucket/file.JSON")).toBe(true);
      });

      it("should return false for non-JSON S3 references", () => {
        expect(s3ClientWrapper.isS3JsonReference(TEST_FIXTURES.URL_VALID_S3_TEXT)).toBe(false);
        expect(s3ClientWrapper.isS3JsonReference("s3://bucket/file.txt")).toBe(false);
      });

      it("should return false for non-S3 URLs", () => {
        expect(s3ClientWrapper.isS3JsonReference("http://example.com/file.json")).toBe(false);
        expect(s3ClientWrapper.isS3JsonReference("file.json")).toBe(false);
      });

      it("should return false for non-string inputs", () => {
        expect(s3ClientWrapper.isS3JsonReference(null as unknown as string)).toBe(false);
        expect(s3ClientWrapper.isS3JsonReference(undefined as unknown as string)).toBe(false);
        expect(s3ClientWrapper.isS3JsonReference(123 as unknown as string)).toBe(false);
      });
    });

    /**
     * Get Content From URL Tests
     */
    describe("getContentFromUrl", () => {
      it("should parse and return JSON content for JSON URLs", async () => {
        const jsonContent = JSON.stringify(TEST_FIXTURES.S3_JSON_CONTENT);
        const mockResponse = createMockS3Response(Buffer.from(jsonContent));
        s3ClientMock.on(GetObjectCommand).resolves(mockResponse);

        const result = await s3ClientWrapper.getContentFromUrl(TEST_FIXTURES.URL_VALID_S3_JSON);

        expect(result).toEqual(TEST_FIXTURES.S3_JSON_CONTENT);
      });

      it("should return string content for non-JSON URLs", async () => {
        const mockResponse = createMockS3Response(Buffer.from(TEST_FIXTURES.S3_CONTENT));
        s3ClientMock.on(GetObjectCommand).resolves(mockResponse);

        const result = await s3ClientWrapper.getContentFromUrl(TEST_FIXTURES.URL_VALID_S3_TEXT);

        expect(result).toBe(TEST_FIXTURES.S3_CONTENT);
      });

      it("should throw error for invalid S3 URLs", async () => {
        await expect(
          s3ClientWrapper.getContentFromUrl(TEST_FIXTURES.URL_INVALID_S3),
        ).rejects.toThrow(`Invalid S3 URL format: ${TEST_FIXTURES.URL_INVALID_S3}`);
      });

      it("should throw error for invalid JSON in JSON files", async () => {
        const invalidJson = "{ invalid json }";
        const mockResponse = createMockS3Response(Buffer.from(invalidJson));
        s3ClientMock.on(GetObjectCommand).resolves(mockResponse);

        await expect(
          s3ClientWrapper.getContentFromUrl(TEST_FIXTURES.URL_VALID_S3_JSON),
        ).rejects.toSatisfy(
          (err) =>
            SmokerError.isSmokerError(err) &&
            err.code === ERR_S3_READ &&
            err.domain === "aws" &&
            err.details?.component === "s3",
        );
      });

      it("should parse JSON when extension is uppercase .JSON", async () => {
        const jsonContent = JSON.stringify(TEST_FIXTURES.S3_JSON_CONTENT);
        const mockResponse = createMockS3Response(Buffer.from(jsonContent));
        s3ClientMock.on(GetObjectCommand).resolves(mockResponse);

        const result = await s3ClientWrapper.getContentFromUrl(
          "s3://test-bucket/test/path/config.JSON",
        );

        expect(result).toEqual(TEST_FIXTURES.S3_JSON_CONTENT);
      });
    });
  });

  /**
   * SSMClientWrapper Tests
   */
  describe("SSMClientWrapper", () => {
    /**
     * Constructor Tests
     */
    describe("constructor", () => {
      it("should create instance with default region", () => {
        expect(new SSMClientWrapper()).toBeInstanceOf(SSMClientWrapper);
      });

      it("should create instance with custom region", () => {
        expect(new SSMClientWrapper(TEST_FIXTURES.AWS_TEST_REGION)).toBeInstanceOf(
          SSMClientWrapper,
        );
      });

      it("should use provided client override", () => {
        const customClient = new SSMClient({ region: "us-west-1" });

        const wrapper = new SSMClientWrapper(undefined, customClient);
        expect(wrapper.getClient()).toBe(customClient);
      });
    });

    /**
     * Client Tests
     */
    describe("getClient", () => {
      it("should return the underlying SSM client", () => {
        expect(ssmClientWrapper.getClient()).toBeInstanceOf(SSMClient);
      });
    });

    /**
     * Clear Cache Tests
     */
    describe("clearCache", () => {
      it("should clear all cached parameters", () => {
        ssmParameterCache["test-param"] = "test-value";
        ssmParameterCache["another-param"] = "another-value";

        ssmClientWrapper.clearCache();

        expect(ssmParameterCache["test-param"]).toBeUndefined();
        expect(ssmParameterCache["another-param"]).toBeUndefined();
      });
    });

    /**
     * Get Parameter Tests
     */
    describe("getParameter", () => {
      it("should retrieve parameter from SSM and cache it", async () => {
        ssmClientMock
          .on(GetParameterCommand)
          .resolves({ Parameter: { Value: TEST_FIXTURES.SSM_PARAM_VALUE } });

        const value1 = await ssmClientWrapper.getParameter(TEST_FIXTURES.SSM_PARAM_NAME);
        expect(value1).toBe(TEST_FIXTURES.SSM_PARAM_VALUE);
        expect(ssmClientMock).toHaveReceivedCommandTimes(GetParameterCommand, 1);

        const value2 = await ssmClientWrapper.getParameter(TEST_FIXTURES.SSM_PARAM_NAME);
        expect(value2).toBe(TEST_FIXTURES.SSM_PARAM_VALUE);
        expect(ssmClientMock).toHaveReceivedCommandTimes(GetParameterCommand, 1);

        const value3 = await ssmClientWrapper.getParameter(TEST_FIXTURES.SSM_PARAM_NAME, false);
        expect(value3).toBe(TEST_FIXTURES.SSM_PARAM_VALUE);
        expect(ssmClientMock).toHaveReceivedCommandTimes(GetParameterCommand, 2);
      });

      it("should throw structured error when Parameter has no value", async () => {
        ssmClientMock.on(GetParameterCommand).resolves({ $metadata: {} });

        await expect(ssmClientWrapper.getParameter(TEST_FIXTURES.SSM_PARAM_NAME)).rejects.toSatisfy(
          (err) =>
            SmokerError.isSmokerError(err) &&
            err.code === ERR_SSM_PARAMETER &&
            err.domain === "aws" &&
            err.details?.component === "ssm",
        );
      });

      it("should wrap AWS Error objects with structured SmokerError", async () => {
        ssmClientMock.on(GetParameterCommand).rejects(new Error("AccessDenied"));

        await expect(ssmClientWrapper.getParameter(TEST_FIXTURES.SSM_PARAM_NAME)).rejects.toSatisfy(
          (err) =>
            SmokerError.isSmokerError(err) &&
            err.code === ERR_SSM_PARAMETER &&
            err.domain === "aws" &&
            err.details?.component === "ssm",
        );
      });

      it("should wrap non-Error values with structured SmokerError", async () => {
        ssmClientMock.on(GetParameterCommand).rejects("String SSM error");

        await expect(ssmClientWrapper.getParameter(TEST_FIXTURES.SSM_PARAM_NAME)).rejects.toSatisfy(
          (err) =>
            SmokerError.isSmokerError(err) &&
            err.code === ERR_SSM_PARAMETER &&
            err.domain === "aws" &&
            err.details?.component === "ssm",
        );
      });
    });

    describe("parseSSMUrl & isSSMReference", () => {
      it("should parse valid ssm:// URLs and detect references", () => {
        const url = "ssm://path/to/param";
        expect(ssmClientWrapper.isSSMReference(url)).toBe(true);
        expect(ssmClientWrapper.parseSSMUrl(url)).toBe("path/to/param");
      });

      it("should return null for invalid SSM URLs and false for non-SSM values", () => {
        expect(ssmClientWrapper.isSSMReference("/path/to/param")).toBe(false);
        expect(ssmClientWrapper.parseSSMUrl("/path/to/param")).toBeNull();
      });
    });
  });

  /**
   * Interface Contract Tests
   */
  describe("Interface Contracts", () => {
    it("should implement IS3Client interface correctly", () => {
      const client: IS3Client = s3ClientWrapper;

      expect(typeof client.getClient).toBe("function");
      expect(typeof client.getObjectAsString).toBe("function");
      expect(typeof client.getObjectAsJson).toBe("function");
      expect(typeof client.isS3JsonReference).toBe("function");
      expect(typeof client.getContentFromUrl).toBe("function");
    });

    it("should implement ISSMClient interface correctly", () => {
      const client: ISSMClient = ssmClientWrapper;

      expect(typeof client.getClient).toBe("function");
      expect(typeof client.clearCache).toBe("function");
      expect(typeof client.getParameter).toBe("function");
      expect(typeof client.parseSSMUrl).toBe("function");
      expect(typeof client.isSSMReference).toBe("function");
      expect(typeof client.isS3JsonReference).toBe("function");
    });
  });

  /**
   * Integration Tests
   */
  describe("Integration", () => {
    it.each([
      "s3://my-config-bucket/environments/prod/config.json",
      "s3://data-lake/2023/12/25/events.json",
      "s3://backup-storage/database-dumps/latest.sql",
    ])("should work with real-world S3 URL pattern '%s'", async (url) => {
      const parsed = parseS3Url(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.bucket).toBeTruthy();
      expect(parsed?.key).toBeTruthy();
    });

    it.each([
      "ssm:///prod/database/password",
      "ssm://app-config/feature-flags",
      "ssm:///shared/api-keys/external-service",
    ])("should work with real-world SSM parameter pattern '%s'", (param) => {
      expect(ssmClientWrapper.isSSMReference(param)).toBe(true);
      expect(ssmClientWrapper.parseSSMUrl(param)).toBeTruthy();
    });
  });
});
