import {
  S3Client as AwsS3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { StreamingBlobPayloadOutputTypes } from "@smithy/types";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S3Client } from "../../src/clients/s3";

// Helper function to create a mock stream that implements necessary interface properties
function createMockStream(content?: string): StreamingBlobPayloadOutputTypes {
  // Create a minimal implementation that satisfies the requirements of the client code
  const mockStream = {
    on: (event: string, callback: (chunk?: Buffer) => void) => {
      if (event === "data" && content) {
        callback(Buffer.from(content));
      }
      if (event === "end") {
        callback();
      }
      return mockStream;
    },
    pipe: () => mockStream,
    // Add additional required properties with dummy values
    transformToByteArray: async () => new Uint8Array(0),
    transformToString: async () => content || "",
    transformToWebStream: () => new ReadableStream(),
  };

  // Use a type assertion to satisfy TypeScript without implementing all interface members
  return mockStream as unknown as StreamingBlobPayloadOutputTypes;
}

// Create error stream that emits an error
function createErrorStream(errorMessage: string): StreamingBlobPayloadOutputTypes {
  // Create a minimal implementation for error streams
  const mockStream = {
    on: (event: string, callback: (err: Error) => void) => {
      if (event === "error") {
        callback(new Error(errorMessage));
      }
      return mockStream;
    },
    pipe: () => mockStream,
    // Add additional required properties with dummy values
    transformToByteArray: async () => {
      throw new Error(errorMessage);
    },
    transformToString: async () => {
      throw new Error(errorMessage);
    },
    transformToWebStream: () => new ReadableStream(),
  };

  // Use a type assertion to satisfy TypeScript without implementing all interface members
  return mockStream as unknown as StreamingBlobPayloadOutputTypes;
}

// Create the mock client
const s3Mock = mockClient(AwsS3Client);

describe("S3Client", () => {
  let client: S3Client;

  beforeEach(() => {
    // Reset all mocks before each test
    s3Mock.reset();

    client = new S3Client();
  });

  afterEach(async () => {
    await client.destroy();
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("S3Client");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should be initialized after init is called", async () => {
      await client.init({ bucket: "test-bucket" });
      expect(client.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      await client.init({ bucket: "test-bucket" });
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should throw an error if bucket is not provided", async () => {
      await expect(client.init()).rejects.toThrow("S3 bucket name is required");
    });

    it("should use default region when none provided", async () => {
      await client.init({ bucket: "test-bucket" });

      // Verify the client was properly initialized
      expect(client.isInitialized()).toBe(true);
    });

    it("should use provided configuration", async () => {
      const config = {
        region: "eu-west-1",
        bucket: "my-test-bucket",
        accessKeyId: "test-key-id",
        secretAccessKey: "test-secret",
        endpoint: "http://localhost:4566",
      };

      await client.init(config);

      // Verify the client was properly initialized
      expect(client.isInitialized()).toBe(true);
    });
  });

  describe("S3 operations", () => {
    beforeEach(async () => {
      await client.init({ bucket: "test-bucket" });
    });

    describe("read", () => {
      it("should call S3 getObject with correct parameters", async () => {
        const key = "test-key.txt";
        const content = "test content";

        // Mock successful getObject response using our helper
        s3Mock.on(GetObjectCommand).resolves({
          Body: createMockStream(content),
        });

        const result = await client.read(key);

        expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
          Bucket: "test-bucket",
          Key: key,
        });
        expect(result).toBe(content);
      });

      it("should handle error when Body is missing", async () => {
        s3Mock.on(GetObjectCommand).resolves({
          // Body is missing
        });

        await expect(client.read("test-key.txt")).rejects.toThrow("Object not found");
      });

      it("should handle stream errors", async () => {
        // Use our error stream helper
        s3Mock.on(GetObjectCommand).resolves({
          Body: createErrorStream("Stream error"),
        });

        await expect(client.read("test-key.txt")).rejects.toThrow("Stream error");
      });

      it("should handle various error scenarios", async () => {
        // Test AWS API errors
        s3Mock.on(GetObjectCommand).rejects(new Error("Access denied"));
        await expect(client.read("test-key.txt")).rejects.toThrow("Access denied");

        // Reset the mock to test missing body
        s3Mock.reset();
        s3Mock.on(GetObjectCommand).resolves({
          // Body is missing
        });
        await expect(client.read("test-key.txt")).rejects.toThrow("Object not found");
      });

      it("should throw if client is not initialized", async () => {
        const newClient = new S3Client();
        await expect(newClient.read("test-key.txt")).rejects.toThrow("not initialized");
      });
    });

    describe("readJson", () => {
      it("should parse JSON content correctly", async () => {
        const key = "test.json";
        const jsonData = { name: "test", value: 42 };
        const jsonString = JSON.stringify(jsonData);

        // Mock the read method
        vi.spyOn(client, "read").mockResolvedValueOnce(jsonString);

        const result = await client.readJson<typeof jsonData>(key);

        expect(client.read).toHaveBeenCalledWith(key);
        expect(result).toEqual(jsonData);
      });

      it("should throw on invalid JSON", async () => {
        const key = "test.json";
        const invalidJson = "{invalid:json}";

        // Mock the read method
        vi.spyOn(client, "read").mockResolvedValueOnce(invalidJson);

        await expect(client.readJson(key)).rejects.toThrow(SyntaxError);
      });

      it("should handle both valid and invalid JSON operations", async () => {
        // Test valid JSON
        const key = "test.json";
        const jsonData = { name: "test", value: 42 };
        const jsonString = JSON.stringify(jsonData);

        // Mock the read method for valid JSON
        vi.spyOn(client, "read").mockResolvedValueOnce(jsonString);

        const result = await client.readJson(key);
        expect(result).toEqual(jsonData);

        // Test invalid JSON
        const invalidKey = "invalid.json";
        // Mock the read method to return invalid JSON
        vi.spyOn(client, "read").mockResolvedValueOnce("{invalid:json}");
        await expect(client.readJson(invalidKey)).rejects.toThrow();
      });
    });

    describe("write", () => {
      it("should call S3 putObject with correct parameters", async () => {
        const key = "test-key.txt";
        const content = "test content";

        s3Mock.on(PutObjectCommand).resolves({});

        await client.write(key, content);

        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: "test-bucket",
          Key: key,
          Body: content,
          ContentType: "text/plain",
        });
      });

      it("should propagate AWS errors", async () => {
        const error = new Error("Access denied");
        s3Mock.on(PutObjectCommand).rejects(error);

        await expect(client.write("test-key.txt", "content")).rejects.toThrow("Access denied");
      });
    });

    describe("writeJson", () => {
      it("should stringify and write JSON data correctly", async () => {
        const key = "test.json";
        const data = { name: "test", value: 42 };

        // Mock the S3 PutObjectCommand response
        s3Mock.on(PutObjectCommand).resolves({});

        await client.writeJson(key, data);

        // Verify the command was called with correct parameters
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: "test-bucket",
          Key: key,
          Body: JSON.stringify(data),
          ContentType: "application/json",
        });
      });

      it("should handle complex objects", async () => {
        const key = "complex.json";
        const data = {
          name: "test",
          nested: { a: 1, b: true },
          array: [1, 2, 3],
        };

        // Mock the S3 PutObjectCommand response
        s3Mock.on(PutObjectCommand).resolves({});

        await client.writeJson(key, data);

        // Verify the command was called with correct parameters
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: "test-bucket",
          Key: key,
          Body: JSON.stringify(data),
          ContentType: "application/json",
        });
      });
    });

    describe("delete", () => {
      it("should call S3 deleteObject with correct parameters", async () => {
        const key = "test-key.txt";

        s3Mock.on(DeleteObjectCommand).resolves({});

        await client.delete(key);

        expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
          Bucket: "test-bucket",
          Key: key,
        });
      });

      it("should propagate AWS errors", async () => {
        const error = new Error("Object not found");
        s3Mock.on(DeleteObjectCommand).rejects(error);

        await expect(client.delete("non-existent.txt")).rejects.toThrow("Object not found");
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty key strings", async () => {
      await client.init({ bucket: "test-bucket" });

      // Use our helper function to create a proper mock stream
      s3Mock.on(GetObjectCommand).resolves({ Body: createMockStream("content") });

      const result = await client.read("");

      // Verify the result
      expect(result).toBe("content");

      // Verify using proper matcher from aws-sdk-client-mock-vitest
      expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: "test-bucket",
        Key: "",
      });
    });

    it("should handle multiple initializations", async () => {
      // First initialization with first bucket
      await client.init({ bucket: "first-bucket" });
      expect(client.isInitialized()).toBe(true);

      // Check first bucket is used
      s3Mock.on(PutObjectCommand).resolves({});
      await client.write("test.txt", "content");
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: "first-bucket",
        Key: "test.txt",
        Body: "content",
        ContentType: "text/plain",
      });

      // Initialize with a second bucket
      await client.init({ bucket: "second-bucket" });
      expect(client.isInitialized()).toBe(true);

      // Reset previous mock calls to start fresh
      s3Mock.reset();
      s3Mock.on(PutObjectCommand).resolves({});

      // Check second bucket is now used
      await client.write("test.txt", "content");
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: "second-bucket",
        Key: "test.txt",
        Body: "content",
        ContentType: "text/plain",
      });
    });

    it("should reject operations with uninitialized client", async () => {
      const newClient = new S3Client();
      const errorMessage = "S3Client is not initialized";

      // Group related tests with clear comments
      // Read operations
      await expect(newClient.read("test.txt")).rejects.toThrow(errorMessage);
      await expect(newClient.readJson("test.json")).rejects.toThrow(errorMessage);

      // Write operations
      await expect(newClient.write("test.txt", "content")).rejects.toThrow(errorMessage);
      await expect(newClient.writeJson("test.json", {})).rejects.toThrow(errorMessage);

      // Delete operations
      await expect(newClient.delete("test.txt")).rejects.toThrow(errorMessage);
    });
  });
});
