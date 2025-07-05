/**
 * Unit tests for AWS client wrappers
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import {
  parseS3Url,
  S3ClientWrapper,
  SSMClientWrapper,
  ssmParameterCache,
  streamToString,
} from "../../src/support/aws-clients";
import { Readable } from "node:stream";

// No need to import types that aren't used

// Create mock clients
const mockSSM = mockClient(SSMClient);
const mockS3 = mockClient(S3Client);

/**
 * Helper function to create a mock S3 response with proper stream-like behavior
 * @param content Content to return in the mock stream
 * @returns Mock S3 response object
 */
function createS3Response(content: string) {
  // Create a mock stream that simulates AWS SDK stream behavior
  const mockStream = {
    on: vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      event: string,
      callback: (arg?: Buffer) => void
    ) {
      if (event === "data") {
        callback(Buffer.from(content));
      }
      if (event === "end") {
        callback();
      }
      return this;
    }),
    pipe: vi.fn().mockReturnThis(),
    transformToString: vi.fn().mockResolvedValue(content),
  };

  // Return response object with mocked stream Body
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Body: mockStream as any,
  };
}

describe("AWS Utilities", () => {
  describe("parseS3Url", () => {
    it("should parse valid S3 URL", () => {
      const result = parseS3Url("s3://my-bucket/path/to/file.json");

      expect(result).toEqual({
        bucket: "my-bucket",
        key: "path/to/file.json",
      });
    });

    it("should handle URLs with multiple slashes in path", () => {
      const result = parseS3Url("s3://my-bucket/path/with//multiple/slashes.txt");

      expect(result).toEqual({
        bucket: "my-bucket",
        key: "path/with//multiple/slashes.txt",
      });
    });

    it("should return null for invalid S3 URLs", () => {
      expect(parseS3Url("http://not-s3-url.com")).toBeNull();
      expect(parseS3Url("s3:/missing-slashes")).toBeNull();
      expect(parseS3Url("s3://bucket-only")).toBeNull();
      expect(parseS3Url("not-a-url")).toBeNull();
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
  });
});

describe("S3ClientWrapper", () => {
  let s3Wrapper: S3ClientWrapper;

  beforeEach(() => {
    // Reset mocks before each test
    mockS3.reset();

    // Create a wrapper instance with the mock client
    // Use as unknown to safely cast between types
    s3Wrapper = new S3ClientWrapper("us-west-2", mockS3 as unknown as S3Client);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should use provided region", () => {
      const testRegion = "eu-west-1";
      const wrapper = new S3ClientWrapper(testRegion);

      // We can't directly test the region inside the client, but we can check it was instantiated
      expect(wrapper.getClient()).toBeDefined();
    });

    it("should use default region when none provided", () => {
      const wrapper = new S3ClientWrapper();
      expect(wrapper.getClient()).toBeDefined();
    });

    it("should use provided client override", () => {
      // Use as unknown for safe type casting
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
      mockS3
        .on(GetObjectCommand, {
          Bucket: testBucket,
          Key: testKey,
        })
        .resolves(createS3Response(testContent));

      const result = await s3Wrapper.getObjectAsString(testBucket, testKey);

      // Should return the correct content
      expect(result).toBe(testContent);

      // Should have called the mock with correct params
      expect(mockS3.calls().length).toBeGreaterThan(0);
      expect(mockS3.call(0).args[0].input).toMatchObject({
        Bucket: testBucket,
        Key: testKey,
      });
    });

    it("should throw error for empty response body", async () => {
      const testBucket = "test-bucket";
      const testKey = "test/empty.txt";

      // Mock response with no Body
      mockS3.on(GetObjectCommand).resolves({});

      await expect(s3Wrapper.getObjectAsString(testBucket, testKey)).rejects.toThrow(
        `Empty response body for S3 object: ${testBucket}/${testKey}`
      );
    });

    it("should propagate S3 client errors", async () => {
      mockS3.on(GetObjectCommand).rejects(new Error("S3 access denied"));

      await expect(s3Wrapper.getObjectAsString("bucket", "key")).rejects.toThrow(
        "S3 access denied"
      );
    });
  });

  describe("getObjectAsJson", () => {
    it("should retrieve and parse JSON object", async () => {
      const testObject = { key: "value", nested: { data: 123 } };
      const testBucket = "test-bucket";
      const testKey = "test/file.json";

      // Setup mock to return JSON string
      mockS3.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testObject)));

      const result = await s3Wrapper.getObjectAsJson(testBucket, testKey);

      expect(result).toEqual(testObject);
    });

    it("should throw error for invalid JSON", async () => {
      const invalidJson = "{ not valid json";
      const testBucket = "test-bucket";
      const testKey = "test/invalid.json";

      mockS3.on(GetObjectCommand).resolves(createS3Response(invalidJson));

      await expect(s3Wrapper.getObjectAsJson(testBucket, testKey)).rejects.toThrow(
        expect.objectContaining({
          name: "SyntaxError", // JSON.parse will throw SyntaxError
        })
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

      expect(result).toEqual(testObject);
      expect(mockS3.call(0).args[0].input).toMatchObject({
        Bucket: "url-bucket",
        Key: "path/file.json",
      });
    });

    it("should throw error for invalid S3 URL", async () => {
      const invalidUrl = "invalid-url";

      await expect(s3Wrapper.getJsonFromUrl(invalidUrl)).rejects.toThrow(
        `Invalid S3 URL format: ${invalidUrl}`
      );
    });
  });

  describe("getContentFromUrl", () => {
    it("should parse JSON content from JSON file", async () => {
      const testObject = { key: "value" };
      const s3Url = "s3://content-bucket/config.json";

      mockS3.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testObject)));

      const result = await s3Wrapper.getContentFromUrl(s3Url);

      expect(result).toEqual(testObject);
    });

    it("should return raw string from non-JSON file", async () => {
      const textContent = "This is plain text";
      const s3Url = "s3://content-bucket/file.txt";

      mockS3.on(GetObjectCommand).resolves(createS3Response(textContent));

      const result = await s3Wrapper.getContentFromUrl(s3Url);

      expect(result).toBe(textContent);
    });

    it("should throw error for invalid JSON in .json file", async () => {
      const invalidJson = "{ broken json";
      const s3Url = "s3://content-bucket/invalid.json";

      mockS3.on(GetObjectCommand).resolves(createS3Response(invalidJson));

      await expect(s3Wrapper.getContentFromUrl(s3Url)).rejects.toThrow(
        `Error parsing JSON from S3 (${s3Url}):`
      );
    });

    it("should throw error for invalid S3 URL format", async () => {
      const invalidUrls = [
        "not-an-s3-url",
        "s3:/missing-slash/file.json",
        "s3://",
        "s3://bucket-only",
        "",
      ];

      for (const url of invalidUrls) {
        await expect(s3Wrapper.getContentFromUrl(url)).rejects.toThrow(
          `Invalid S3 URL format: ${url}`
        );
      }
    });
  });

  describe("isS3JsonReference", () => {
    it("should identify S3 JSON references", () => {
      expect(s3Wrapper.isS3JsonReference("s3://bucket/file.json")).toBe(true);
      expect(s3Wrapper.isS3JsonReference("s3://bucket/path/to/CONFIG.JSON")).toBe(true); // Case insensitive
    });

    it("should reject non-JSON S3 references", () => {
      expect(s3Wrapper.isS3JsonReference("s3://bucket/file.txt")).toBe(false);
      expect(s3Wrapper.isS3JsonReference("s3://bucket/file.jsonx")).toBe(false);
      expect(s3Wrapper.isS3JsonReference("s3://bucket/json-file")).toBe(false);
    });

    it("should reject non-S3 URLs", () => {
      expect(s3Wrapper.isS3JsonReference("http://example.com/file.json")).toBe(false);
      expect(s3Wrapper.isS3JsonReference("not-a-url")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(s3Wrapper.isS3JsonReference("")).toBe(false);
      // @ts-expect-error testing with non-string value
      expect(s3Wrapper.isS3JsonReference(null)).toBe(false);
      // @ts-expect-error testing with non-string value
      expect(s3Wrapper.isS3JsonReference(123)).toBe(false);
    });
  });
});

describe("SSMClientWrapper", () => {
  let ssmWrapper: SSMClientWrapper;

  beforeEach(() => {
    // Reset mocks and cache
    mockSSM.reset();

    // Clear parameter cache
    for (const key of Object.keys(ssmParameterCache)) {
      // Use undefined instead of delete to avoid lint errors
      ssmParameterCache[key] = undefined;
    }

    // Create wrapper with mock client
    // Use as unknown for safe type casting
    ssmWrapper = new SSMClientWrapper("us-west-2", mockSSM as unknown as SSMClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should use provided region", () => {
      const testRegion = "eu-central-1";
      const wrapper = new SSMClientWrapper(testRegion);

      expect(wrapper.getClient()).toBeDefined();
    });

    it("should use default region when none provided", () => {
      const wrapper = new SSMClientWrapper();
      expect(wrapper.getClient()).toBeDefined();
    });

    it("should use provided client override", () => {
      // Use as unknown for safe type casting
      const mockClient = mockSSM as unknown as SSMClient;
      const wrapper = new SSMClientWrapper(undefined, mockClient);

      expect(wrapper.getClient()).toBe(mockClient);
    });
  });

  describe("getParameter", () => {
    it("should retrieve parameter value", async () => {
      const paramName = "test/param";
      const paramValue = "param-value";

      // Setup mock response
      mockSSM
        .on(GetParameterCommand, {
          Name: paramName,
          WithDecryption: true,
        })
        .resolves({
          Parameter: {
            Name: paramName,
            Value: paramValue,
            Type: "String",
          },
        });

      const result = await ssmWrapper.getParameter(paramName);

      expect(result).toBe(paramValue);
      expect(mockSSM.call(0).args[0].input).toMatchObject({
        Name: paramName,
        WithDecryption: true,
      });
    });

    it("should use and update cache", async () => {
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

      // First call should use the API
      const result1 = await ssmWrapper.getParameter(paramName, true);
      expect(result1).toBe(paramValue);
      expect(mockSSM.calls()).toHaveLength(1);

      // Second call should use the cache
      const result2 = await ssmWrapper.getParameter(paramName, true);
      expect(result2).toBe(paramValue);
      expect(mockSSM.calls()).toHaveLength(1); // No additional calls

      // Verify the value is in the cache
      expect(ssmParameterCache[paramName]).toBe(paramValue);
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

      // First call
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
        `Parameter ${paramName} has no value`
      );
    });

    it("should throw meaningful error for SSM failures", async () => {
      const paramName = "test/error";
      const errorMsg = "Parameter not found";

      mockSSM.on(GetParameterCommand).rejects(new Error(errorMsg));

      await expect(ssmWrapper.getParameter(paramName)).rejects.toThrow(
        `Error fetching SSM parameter ${paramName}: Error: ${errorMsg}`
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
    it("should parse valid SSM references", () => {
      expect(ssmWrapper.parseSSMUrl("ssm://simple")).toBe("simple");
      expect(ssmWrapper.parseSSMUrl("ssm://path/with/slashes")).toBe("path/with/slashes");
      expect(ssmWrapper.parseSSMUrl("ssm:///leading/slash")).toBe("/leading/slash");
    });

    it("should return null for invalid SSM references", () => {
      expect(ssmWrapper.parseSSMUrl("not-ssm")).toBeNull();
      expect(ssmWrapper.parseSSMUrl("ssmm://wrong-prefix")).toBeNull();
      expect(ssmWrapper.parseSSMUrl("ssm:no-slashes")).toBeNull();
      // @ts-expect-error testing with non-string input
      expect(ssmWrapper.parseSSMUrl(null)).toBeNull();
      // @ts-expect-error testing with non-string input
      expect(ssmWrapper.parseSSMUrl(123)).toBeNull();
    });
  });

  describe("isSSMReference", () => {
    it("should identify SSM references", () => {
      expect(ssmWrapper.isSSMReference("ssm://param")).toBe(true);
      expect(ssmWrapper.isSSMReference("ssm://path/to/param")).toBe(true);
    });

    it("should reject non-SSM references", () => {
      expect(ssmWrapper.isSSMReference("not-ssm")).toBe(false);
      expect(ssmWrapper.isSSMReference("ssmm://wrong-prefix")).toBe(false);
      expect(ssmWrapper.isSSMReference("s3://bucket/key")).toBe(false);
    });
  });

  describe("isS3JsonReference", () => {
    it("should identify S3 JSON references", () => {
      expect(ssmWrapper.isS3JsonReference("s3://bucket/file.json")).toBe(true);
      expect(ssmWrapper.isS3JsonReference("s3://bucket/path/to/CONFIG.JSON")).toBe(true);
    });

    it("should reject non-JSON S3 references", () => {
      expect(ssmWrapper.isS3JsonReference("s3://bucket/file.txt")).toBe(false);
      expect(ssmWrapper.isS3JsonReference("s3://bucket/file.jsonx")).toBe(false);
    });

    it("should reject non-S3 URLs", () => {
      expect(ssmWrapper.isS3JsonReference("ssm://parameter")).toBe(false);
      expect(ssmWrapper.isS3JsonReference("http://example.com/file.json")).toBe(false);
    });
  });
});
