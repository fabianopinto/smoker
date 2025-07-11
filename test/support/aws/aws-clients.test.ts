/**
 * Unit tests for AWS client wrappers
 * Tests the functionality of S3ClientWrapper and related utilities
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseS3Url,
  S3ClientWrapper,
  SSMClientWrapper,
  ssmParameterCache,
  streamToString,
} from "../../../src/support";
import { createS3Response } from "../aws-test-utils";

// Create mock clients
const mockSSM = mockClient(SSMClient);
const mockS3 = mockClient(S3Client);

describe("AWS Utilities", () => {
  describe("parseS3Url", () => {
    // Use it.each for parameterized tests with valid URLs
    it.each([
      {
        url: "s3://my-bucket/path/to/file.json",
        expected: { bucket: "my-bucket", key: "path/to/file.json" },
      },
      {
        url: "s3://my-bucket/path/with//multiple/slashes.txt",
        expected: { bucket: "my-bucket", key: "path/with//multiple/slashes.txt" },
      },
      {
        url: "s3://bucket-with-dash/file.pdf",
        expected: { bucket: "bucket-with-dash", key: "file.pdf" },
      },
    ])("should parse valid S3 URL: $url", ({ url, expected }) => {
      const result = parseS3Url(url);
      expect(result).toEqual(expected);
    });

    // Use it.each for parameterized tests with invalid URLs
    it.each([
      "http://not-s3-url.com",
      "s3:/missing-slashes",
      "s3://bucket-only",
      "not-a-url",
      "", // Empty string edge case
    ])("should return null for invalid S3 URL: %s", (invalidUrl) => {
      expect(parseS3Url(invalidUrl)).toBeNull();
    });

    // Edge case: undefined input
    it("should handle undefined input gracefully", () => {
      expect(parseS3Url(undefined as unknown as string)).toBeNull();
    });
  });

  describe("streamToString", () => {
    it("should convert stream to string", async () => {
      // Create a simple readable stream for testing
      const testContent = "test stream content";
      const stream = new Readable({
        read() {
          this.push(Buffer.from(testContent));
          this.push(null); // Signals end of stream
        },
      });

      const result = await streamToString(stream);
      expect(result).toBe(testContent);
    });

    it("should handle empty streams", async () => {
      const stream = new Readable({
        read() {
          this.push(null); // Empty stream
        },
      });

      const result = await streamToString(stream);
      expect(result).toBe("");
    });

    it("should reject on stream error", async () => {
      const errorMessage = "Stream error";
      const stream = new Readable({
        read() {
          this.emit("error", new Error(errorMessage));
        },
      });

      await expect(streamToString(stream)).rejects.toThrow(errorMessage);
    });

    // Additional edge cases
    it("should handle large data streams", async () => {
      // Create a stream with large content (100KB)
      const largeContent = "X".repeat(100 * 1024);
      const stream = new Readable({
        read() {
          this.push(Buffer.from(largeContent));
          this.push(null);
        },
      });

      const result = await streamToString(stream);
      expect(result.length).toBe(largeContent.length);
      expect(result).toBe(largeContent);
    });
  });
});

describe("S3ClientWrapper", () => {
  let s3Wrapper: S3ClientWrapper;

  beforeEach(() => {
    // Reset mocks before each test
    mockS3.reset();

    // Create a wrapper instance with the mock client
    s3Wrapper = new S3ClientWrapper("us-west-2", mockS3 as unknown as S3Client);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should use provided region", () => {
      const testRegion = "eu-west-1";
      const wrapper = new S3ClientWrapper(testRegion);

      // Implementation detail: we can't easily test the region directly,
      // but we can verify that a new client was created
      expect(wrapper.getClient()).toBeDefined();
    });

    it("should use default region when not specified", () => {
      const wrapper = new S3ClientWrapper();
      expect(wrapper.getClient()).toBeDefined();
    });

    it("should use provided client when specified", () => {
      const mockClient = mockS3 as unknown as S3Client;
      const wrapper = new S3ClientWrapper(undefined, mockClient);

      expect(wrapper.getClient()).toBe(mockClient);
    });
  });

  describe("getObjectAsString", () => {
    it("should retrieve object as string", async () => {
      const testContent = "test file content";
      const testBucket = "test-bucket";
      const testKey = "test/file.txt";

      // Setup mock response
      mockS3.on(GetObjectCommand).resolves(createS3Response(testContent));

      const result = await s3Wrapper.getObjectAsString(testBucket, testKey);

      // Verify result
      expect(result).toBe(testContent);

      // Verify correct command was sent using aws-sdk-client-mock-vitest matcher
      expect(mockS3).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: testBucket,
        Key: testKey,
      });
    });

    it("should throw error for empty response body", async () => {
      const testBucket = "test-bucket";
      const testKey = "test/file.txt";

      // Mock empty response
      mockS3.on(GetObjectCommand).resolves({
        // No Body property
      });

      await expect(s3Wrapper.getObjectAsString(testBucket, testKey)).rejects.toThrow(
        `Empty response body for S3 object: ${testBucket}/${testKey}`,
      );
    });

    it("should propagate S3 client errors", async () => {
      // Mock S3 access denied error
      mockS3.on(GetObjectCommand).rejects(new Error("S3 access denied"));

      await expect(s3Wrapper.getObjectAsString("bucket", "key")).rejects.toThrow(
        "S3 access denied",
      );
    });
  });

  describe("getObjectAsJson", () => {
    it("should retrieve and parse JSON object", async () => {
      const testObject = { key: "value", nested: { data: 123 } };
      const testBucket = "test-bucket";
      const testKey = "test/file.json";

      // Setup mock response with stringified JSON
      mockS3.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testObject)));

      const result = await s3Wrapper.getObjectAsJson(testBucket, testKey);

      // Verify result
      expect(result).toEqual(testObject);

      // Verify correct command was sent
      expect(mockS3).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: testBucket,
        Key: testKey,
      });
    });

    it("should throw error for invalid JSON", async () => {
      const testBucket = "test-bucket";
      const testKey = "test/file.json";
      const invalidJson = "{ this is not valid JSON }";

      // Setup mock response with invalid JSON
      mockS3.on(GetObjectCommand).resolves(createS3Response(invalidJson));

      await expect(s3Wrapper.getObjectAsJson(testBucket, testKey)).rejects.toThrow(
        expect.objectContaining({
          name: "SyntaxError", // JSON.parse will throw SyntaxError
        }),
      );
    });
  });

  describe("getJsonFromUrl", () => {
    it("should retrieve and parse JSON from S3 URL", async () => {
      const testObject = { data: "from-url" };
      const s3Url = "s3://url-bucket/path/file.json";

      // Setup mock for the URL
      mockS3.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testObject)));

      const result = await s3Wrapper.getJsonFromUrl(s3Url);

      // Verify result
      expect(result).toEqual(testObject);

      // Verify correct command was sent
      expect(mockS3).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: "url-bucket",
        Key: "path/file.json",
      });
    });

    it("should throw error for invalid S3 URL", async () => {
      const invalidUrl = "invalid-url";

      await expect(s3Wrapper.getJsonFromUrl(invalidUrl)).rejects.toThrow(
        `Invalid S3 URL format: ${invalidUrl}`,
      );
    });
  });

  describe("getContentFromUrl", () => {
    it("should parse JSON content from JSON file", async () => {
      const testObject = { key: "value" };
      const s3Url = "s3://content-bucket/config.json";

      // Setup mock response with JSON content
      mockS3.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testObject)));

      const result = await s3Wrapper.getContentFromUrl(s3Url);

      // Verify result is parsed JSON
      expect(result).toEqual(testObject);

      // Verify correct command was sent
      expect(mockS3).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: "content-bucket",
        Key: "config.json",
      });
    });

    it("should return plain string for non-JSON files", async () => {
      const testContent = "Plain text content";
      const s3Url = "s3://content-bucket/file.txt";

      // Setup mock response with text content
      mockS3.on(GetObjectCommand).resolves(createS3Response(testContent));

      const result = await s3Wrapper.getContentFromUrl(s3Url);

      // Verify result is plain string
      expect(result).toBe(testContent);
    });

    it("should throw error for invalid JSON in JSON file", async () => {
      const invalidJson = "{ not valid json }";
      const s3Url = "s3://content-bucket/file.json";

      mockS3.on(GetObjectCommand).resolves(createS3Response(invalidJson));

      await expect(s3Wrapper.getContentFromUrl(s3Url)).rejects.toThrow(
        `Error parsing JSON from S3 (${s3Url}):`,
      );
    });

    it("should throw error for invalid S3 URL format", async () => {
      // Use it.each for multiple test cases
      const invalidUrls = [
        "not-an-s3-url",
        "s3:/missing-slash/file.json",
        "s3://",
        "s3://bucket-only",
        "",
      ];

      for (const url of invalidUrls) {
        await expect(s3Wrapper.getContentFromUrl(url)).rejects.toThrow(
          `Invalid S3 URL format: ${url}`,
        );
      }
    });
  });

  describe("isS3JsonReference", () => {
    // Use it.each for testing valid S3 JSON references
    it.each([
      "s3://bucket/file.json",
      "s3://bucket/path/to/CONFIG.JSON", // Test case insensitivity
      "s3://bucket/path/to/config.Json", // Mixed case
    ])("should identify valid S3 JSON reference: %s", (validRef) => {
      expect(s3Wrapper.isS3JsonReference(validRef)).toBe(true);
    });

    // Use it.each for testing invalid S3 JSON references
    it.each([
      "s3://bucket/file.txt", // Not JSON
      "s3://bucket/file.jsonx", // Wrong extension
      "ssm://parameter", // Wrong protocol
      "http://example.com/file.json", // Wrong protocol
      "", // Empty string
    ])("should reject invalid S3 JSON reference: %s", (invalidRef) => {
      expect(s3Wrapper.isS3JsonReference(invalidRef)).toBe(false);
    });

    // Test non-string inputs with proper type handling
    it("should handle non-string inputs gracefully", () => {
      // Use type assertion to test with null/undefined while keeping TypeScript happy
      expect(s3Wrapper.isS3JsonReference(null as unknown as string)).toBe(false);
      expect(s3Wrapper.isS3JsonReference(undefined as unknown as string)).toBe(false);
      expect(s3Wrapper.isS3JsonReference(123 as unknown as string)).toBe(false);
    });
  });
});

describe("SSMClientWrapper", () => {
  let ssmWrapper: SSMClientWrapper;

  beforeEach(() => {
    // Reset mocks before each test
    mockSSM.reset();

    // Clear SSM parameter cache
    Object.keys(ssmParameterCache).forEach((key) => {
      ssmParameterCache[key] = undefined;
    });

    // Create a wrapper instance with the mock client
    ssmWrapper = new SSMClientWrapper("us-west-2", mockSSM as unknown as SSMClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should use provided region", () => {
      const testRegion = "eu-west-1";
      const wrapper = new SSMClientWrapper(testRegion);
      expect(wrapper.getClient()).toBeDefined();
    });

    it("should use provided client when specified", () => {
      const mockClient = mockSSM as unknown as SSMClient;
      const wrapper = new SSMClientWrapper(undefined, mockClient);
      expect(wrapper.getClient()).toBe(mockClient);
    });
  });

  describe("getParameter", () => {
    it("should retrieve parameter value", async () => {
      const paramName = "test/parameter";
      const paramValue = "parameter-value";

      // Setup mock response
      mockSSM.on(GetParameterCommand).resolves({
        Parameter: {
          Name: paramName,
          Value: paramValue,
          Type: "String",
        },
      });

      const result = await ssmWrapper.getParameter(paramName);

      // Verify result
      expect(result).toBe(paramValue);

      // Verify command was sent with correct parameters
      expect(mockSSM).toHaveReceivedCommandWith(GetParameterCommand, {
        Name: paramName,
        WithDecryption: true,
      });
    });

    it("should cache parameter values", async () => {
      const paramName = "test/cached";
      const paramValue = "cached-value";

      // Setup mock response
      mockSSM.on(GetParameterCommand).resolves({
        Parameter: {
          Name: paramName,
          Value: paramValue,
          Type: "String",
        },
      });

      // First call should make an API request
      const result1 = await ssmWrapper.getParameter(paramName);
      expect(result1).toBe(paramValue);
      expect(mockSSM.calls()).toHaveLength(1);

      // Second call should use the cache
      const result2 = await ssmWrapper.getParameter(paramName);
      expect(result2).toBe(paramValue);

      // No additional API calls should be made
      expect(mockSSM.calls()).toHaveLength(1);
    });

    it("should bypass cache when requested", async () => {
      const paramName = "test/bypass";
      const paramValue = "bypass-value";

      // Setup mock response
      mockSSM.on(GetParameterCommand).resolves({
        Parameter: {
          Name: paramName,
          Value: paramValue,
          Type: "String",
        },
      });

      // First call with cache enabled
      await ssmWrapper.getParameter(paramName, true);
      expect(mockSSM.calls()).toHaveLength(1);

      // Second call with useCache=false should bypass cache
      await ssmWrapper.getParameter(paramName, false);
      expect(mockSSM.calls()).toHaveLength(2);
    });

    it("should throw error if parameter has no value", async () => {
      const paramName = "test/empty";

      // Mock response with no value
      mockSSM.on(GetParameterCommand).resolves({
        Parameter: {
          Name: paramName,
          Type: "String",
          // No Value property
        },
      });

      await expect(ssmWrapper.getParameter(paramName)).rejects.toThrow(
        `Parameter ${paramName} has no value`,
      );
    });

    it("should throw meaningful error for SSM failures", async () => {
      const paramName = "test/error";
      const errorMsg = "Parameter not found";

      mockSSM.on(GetParameterCommand).rejects(new Error(errorMsg));

      await expect(ssmWrapper.getParameter(paramName)).rejects.toThrow(
        `Error fetching SSM parameter ${paramName}: Error: ${errorMsg}`,
      );
    });
  });

  describe("clearCache", () => {
    it("should clear the parameter cache", async () => {
      // Setup cache with test data
      ssmParameterCache["test/param1"] = "value1";
      ssmParameterCache["test/param2"] = "value2";

      // Clear the cache
      ssmWrapper.clearCache();

      // Verify all cache entries are undefined
      expect(ssmParameterCache["test/param1"]).toBeUndefined();
      expect(ssmParameterCache["test/param2"]).toBeUndefined();
    });
  });

  describe("parseSSMUrl", () => {
    // Use it.each for valid SSM references
    it.each([
      { input: "ssm://simple", expected: "simple" },
      { input: "ssm://path/with/slashes", expected: "path/with/slashes" },
      { input: "ssm:///leading/slash", expected: "/leading/slash" },
    ])("should parse valid SSM reference: $input", ({ input, expected }) => {
      expect(ssmWrapper.parseSSMUrl(input)).toBe(expected);
    });

    // Use it.each for invalid SSM references
    it.each(["not-ssm", "ssmm://wrong-prefix", "ssm:no-slashes"])(
      "should return null for invalid SSM reference: %s",
      (invalidRef) => {
        expect(ssmWrapper.parseSSMUrl(invalidRef)).toBeNull();
      },
    );

    // Test non-string inputs with proper type handling
    it("should handle non-string inputs gracefully", () => {
      // Use type assertion to test with null/undefined while keeping TypeScript happy
      expect(ssmWrapper.parseSSMUrl(null as unknown as string)).toBeNull();
      expect(ssmWrapper.parseSSMUrl(undefined as unknown as string)).toBeNull();
      expect(ssmWrapper.parseSSMUrl(123 as unknown as string)).toBeNull();
    });
  });

  describe("isSSMReference", () => {
    // Use it.each for valid SSM references
    it.each(["ssm://param", "ssm://path/to/param", "ssm:///leading/slash"])(
      "should identify SSM reference: %s",
      (validRef) => {
        expect(ssmWrapper.isSSMReference(validRef)).toBe(true);
      },
    );

    // Use it.each for invalid SSM references
    it.each([
      "not-ssm",
      "ssmm://wrong-prefix",
      "s3://bucket/key",
      "", // Empty string
    ])("should reject non-SSM reference: %s", (invalidRef) => {
      expect(ssmWrapper.isSSMReference(invalidRef)).toBe(false);
    });

    // Test non-string inputs with proper type handling
    it("should handle non-string inputs gracefully", () => {
      // Use type assertion to test with null/undefined while keeping TypeScript happy
      expect(ssmWrapper.isSSMReference(null as unknown as string)).toBe(false);
      expect(ssmWrapper.isSSMReference(undefined as unknown as string)).toBe(false);
      expect(ssmWrapper.isSSMReference(123 as unknown as string)).toBe(false);
    });
  });
});
