/**
 * Unit tests for S3 client implementation
 * Tests the S3Client functionality using aws-sdk-client-mock
 */
import {
  S3Client as AwsS3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S3Client } from "../../../src/clients/aws/s3";
import { createS3Response } from "../../support/aws-test-utils";

// Create the mock client
const s3Mock = mockClient(AwsS3Client);

describe("S3Client", () => {
  let client: S3Client;

  beforeEach(() => {
    // Reset all mocks before each test
    s3Mock.reset();
    vi.clearAllMocks();

    // Create client without configuration initially
    client = new S3Client();
  });

  afterEach(async () => {
    try {
      await client.destroy();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("S3Client");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle custom client ID", () => {
      const customClient = new S3Client("CustomS3Client");
      expect(customClient.getName()).toBe("CustomS3Client");
    });

    it("should not be initialized after destroy is called", async () => {
      // Create client with valid configuration
      client = new S3Client("S3Client", { bucket: "test-bucket" });
      await client.init();
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should throw an error if bucket name is not provided", async () => {
      await expect(client.init()).rejects.toThrow(
        "S3 client requires a 'bucket' name to be provided in configuration",
      );
    });

    it("should use default region when none provided", async () => {
      client = new S3Client("S3Client", { bucket: "test-bucket" });
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    it("should use provided configuration", async () => {
      const config = {
        bucket: "test-bucket",
        region: "eu-west-1",
        accessKeyId: "test-key-id",
        secretAccessKey: "test-secret",
        endpoint: "http://localhost:4566",
      };

      client = new S3Client("S3Client", config);
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    it("should throw an error if client creation fails", async () => {
      // Simulate client creation failure by spying on S3Client constructor
      const mockError = new Error("S3 client creation failed");
      const spy = vi.spyOn(AwsS3Client.prototype, "send").mockImplementation(() => {
        throw mockError;
      });

      client = new S3Client("S3Client", { bucket: "test-bucket" });

      await expect(client.init()).resolves.toBeUndefined();
      // After init succeeds, any operation should fail when send is called
      await expect(client.read("any-key")).rejects.toThrow("S3 client creation failed");

      // Restore original implementation
      spy.mockRestore();
    });
  });

  describe("S3 operations", () => {
    beforeEach(async () => {
      // Create and initialize client with test configuration
      client = new S3Client("S3Client", { bucket: "test-bucket" });
      await client.init();
    });

    describe("read method", () => {
      it("should retrieve object as string", async () => {
        const testContent = "test file content";
        const testKey = "test/file.txt";

        // Setup mock response
        s3Mock.on(GetObjectCommand).resolves(createS3Response(testContent));

        const result = await client.read(testKey);
        expect(result).toBe(testContent);

        // Verify correct parameters were used
        expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
          Bucket: "test-bucket",
          Key: testKey,
        });
      });

      it("should throw error if key is empty", async () => {
        await expect(client.read("")).rejects.toThrow("S3 read operation requires a key");
      });

      it("should throw error if GetObjectCommand fails with Error object", async () => {
        const testKey = "test/missing-file.txt";
        const errorMessage = "Object not found";

        s3Mock.on(GetObjectCommand).rejects(new Error(errorMessage));

        await expect(client.read(testKey)).rejects.toThrow(
          `Failed to read object ${testKey} from bucket test-bucket: ${errorMessage}`,
        );
      });

      it("should handle non-Error objects in GetObjectCommand error (ternary operator)", async () => {
        const testKey = "test/missing-file.txt";
        // Use a plain string instead of an object to avoid type issues
        // This still tests the ternary operator since it's not an Error instance
        const nonErrorValue = "CustomErrorFormat";

        // Reject with non-Error value to test the ternary operator on line 161
        s3Mock.on(GetObjectCommand).rejects(nonErrorValue);

        await expect(client.read(testKey)).rejects.toThrow(
          `Failed to read object ${testKey} from bucket test-bucket: ${String(nonErrorValue)}`,
        );
      });

      it("should throw error if streaming fails", async () => {
        const testKey = "test/file.txt";

        // Reject the GetObjectCommand with a specific error
        s3Mock.on(GetObjectCommand).rejects(new Error("Stream error"));

        await expect(client.read(testKey)).rejects.toThrow(
          // Match using a more generic pattern
          `Failed to read object ${testKey} from bucket test-bucket:`,
        );
      });
    });

    describe("readJson method", () => {
      it("should retrieve and parse JSON object", async () => {
        const testObject = { key: "value", nested: { data: 123 } };
        const testKey = "test/file.json";

        // Setup mock response
        s3Mock.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testObject)));

        const result = await client.readJson(testKey);
        expect(result).toEqual(testObject);
      });

      it("should throw error for invalid JSON", async () => {
        const invalidJson = "{ not valid json }";
        const testKey = "test/invalid.json";

        s3Mock.on(GetObjectCommand).resolves(createS3Response(invalidJson));

        await expect(client.readJson(testKey)).rejects.toThrow(
          `Failed to parse JSON from ${testKey}:`,
        );
      });

      it("should propagate errors from read method", async () => {
        const testKey = "test/nonexistent.json";
        const errorMessage = "Object not found";

        s3Mock.on(GetObjectCommand).rejects(new Error(errorMessage));

        await expect(client.readJson(testKey)).rejects.toThrow(
          `Failed to read object ${testKey} from bucket test-bucket: ${errorMessage}`,
        );
      });

      it("should handle non-Error objects in JSON parsing error (ternary operator)", async () => {
        const testKey = "test/custom-error.json";

        // Create a mock response with valid content
        s3Mock.on(GetObjectCommand).resolves(createS3Response("{ valid: but not json }"));

        // Mock JSON.parse to throw a non-Error object
        const originalJsonParse = JSON.parse;
        JSON.parse = vi.fn().mockImplementation(() => {
          // Throw a non-Error value to test the ternary operator on line 200
          throw { code: "INVALID_JSON", reason: "Custom parser error" };
        });

        try {
          await expect(client.readJson(testKey)).rejects.toThrow(
            `Failed to parse JSON from ${testKey}: [object Object]`,
          );
        } finally {
          // Restore original JSON.parse
          JSON.parse = originalJsonParse;
        }
      });
    });

    describe("write method", () => {
      it("should write string content to S3", async () => {
        const testKey = "test/file.txt";
        const testContent = "Test content to write";

        // Setup mock success response
        s3Mock.on(PutObjectCommand).resolves({});

        await client.write(testKey, testContent);

        // Verify correct parameters were used
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: "test-bucket",
          Key: testKey,
          Body: testContent,
          ContentType: "text/plain",
        });

        // Verify the mock was called
        expect(s3Mock.calls().length).toBeGreaterThan(0);
      });

      it("should throw error if key is empty", async () => {
        await expect(client.write("", "content")).rejects.toThrow(
          "S3 write operation requires a key",
        );
      });

      it("should throw error if PutObjectCommand fails with Error object", async () => {
        const testKey = "test/fail.txt";
        const testContent = "Content that will fail";
        const errorMessage = "Access denied";

        s3Mock.on(PutObjectCommand).rejects(new Error(errorMessage));

        await expect(client.write(testKey, testContent)).rejects.toThrow(
          `Failed to write object ${testKey} to bucket test-bucket: ${errorMessage}`,
        );
      });

      it("should handle non-Error objects in PutObjectCommand error (ternary operator)", async () => {
        const testKey = "test/fail-custom.txt";
        const testContent = "Content that will fail with custom error";
        // Use a string instead of an object to avoid type issues
        // This still tests the ternary operator since it's not an Error instance
        const nonErrorValue = "Custom AWS error";

        // Reject with a non-Error value to test the ternary operator on line 231
        s3Mock.on(PutObjectCommand).rejects(nonErrorValue);

        await expect(client.write(testKey, testContent)).rejects.toThrow(
          `Failed to write object ${testKey} to bucket test-bucket: ${String(nonErrorValue)}`,
        );
      });
    });

    describe("writeJson method", () => {
      it("should serialize and write JSON to S3", async () => {
        const testKey = "test/data.json";
        const testObject = { key: "value", nested: { data: 123 } };

        // Setup mock success response
        s3Mock.on(PutObjectCommand).resolves({});

        await client.writeJson(testKey, testObject);

        // Verify correct parameters were used
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: "test-bucket",
          Key: testKey,
          Body: JSON.stringify(testObject),
          ContentType: "application/json",
        });

        // Verify the mock was called
        expect(s3Mock.calls().length).toBeGreaterThan(0);
      });

      it("should throw error if key is empty", async () => {
        await expect(client.writeJson("", { data: "test" })).rejects.toThrow(
          "S3 writeJson operation requires a key",
        );
      });

      it("should throw error if PutObjectCommand fails with Error object", async () => {
        const testKey = "test/fail.json";
        const testObject = { data: "will fail" };
        const errorMessage = "Access denied";

        s3Mock.on(PutObjectCommand).rejects(new Error(errorMessage));

        await expect(client.writeJson(testKey, testObject)).rejects.toThrow(
          `Failed to write JSON object ${testKey} to bucket test-bucket: ${errorMessage}`,
        );
      });

      it("should handle non-Error objects in writeJson error (ternary operator)", async () => {
        const testKey = "test/fail-custom.json";
        const testObject = { data: "will fail with custom error" };
        // Use a string instead of an object to avoid type issues
        // This still tests the ternary operator since it's not an Error instance
        const nonErrorValue = "NetworkError";

        // Test the ternary operator on line 266 with non-Error rejection
        s3Mock.on(PutObjectCommand).rejects(nonErrorValue);

        await expect(client.writeJson(testKey, testObject)).rejects.toThrow(
          `Failed to write JSON object ${testKey} to bucket test-bucket: ${String(nonErrorValue)}`,
        );
      });

      it("should handle circular reference errors in JSON", async () => {
        const testKey = "test/circular.json";

        // Create an object with a circular reference
        const testObject: Record<string, unknown> = { key: "value" };
        testObject.self = testObject;

        await expect(client.writeJson(testKey, testObject)).rejects.toThrow();
      });
    });

    describe("delete method", () => {
      it("should delete object from S3", async () => {
        const testKey = "test/file-to-delete.txt";

        // Setup mock success response
        s3Mock.on(DeleteObjectCommand).resolves({});

        await client.delete(testKey);

        // Verify correct parameters were used
        expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
          Bucket: "test-bucket",
          Key: testKey,
        });

        // Verify the mock was called
        expect(s3Mock.calls().length).toBeGreaterThan(0);
      });

      it("should throw error if key is empty", async () => {
        await expect(client.delete("")).rejects.toThrow("S3 delete operation requires a key");
      });

      it("should throw error if DeleteObjectCommand fails with Error object", async () => {
        const testKey = "test/protected-file.txt";
        const errorMessage = "Access denied";

        s3Mock.on(DeleteObjectCommand).rejects(new Error(errorMessage));

        await expect(client.delete(testKey)).rejects.toThrow(
          `Failed to delete object ${testKey} from bucket test-bucket: ${errorMessage}`,
        );
      });

      it("should handle non-Error objects in delete error (ternary operator)", async () => {
        const testKey = "test/custom-error-delete.txt";
        // Use a string instead of a number to avoid type issues
        // This still tests the ternary operator since it's not an Error instance
        const nonErrorValue = "503 Service Unavailable";

        // Test the ternary operator on line 294 with non-Error rejection
        s3Mock.on(DeleteObjectCommand).rejects(nonErrorValue);

        await expect(client.delete(testKey)).rejects.toThrow(
          `Failed to delete object ${testKey} from bucket test-bucket: ${String(nonErrorValue)}`,
        );
      });
    });

    describe("streamToString method", () => {
      it("should convert readable stream to string", async () => {
        // Create a readable stream with test content
        const testContent = "test stream content";
        const stream = new Readable({
          read() {
            this.push(Buffer.from(testContent));
            this.push(null); // End of stream
          },
        });

        // Access private method using proper type casting
        const clientWithPrivateMethod = client as unknown as {
          streamToString(stream: NodeJS.ReadableStream): Promise<string>;
        };
        const result = await clientWithPrivateMethod.streamToString(stream);
        expect(result).toBe(testContent);
      });

      it("should handle empty streams", async () => {
        const stream = new Readable({
          read() {
            this.push(null); // Empty stream
          },
        });

        // Access private method using proper type casting
        const clientWithPrivateMethod = client as unknown as {
          streamToString(stream: NodeJS.ReadableStream): Promise<string>;
        };
        const result = await clientWithPrivateMethod.streamToString(stream);
        expect(result).toBe("");
      });

      it("should reject on stream error", async () => {
        const errorMessage = "Stream error";
        const stream = new Readable({
          read() {
            this.emit("error", new Error(errorMessage));
          },
        });

        // Access private method using more specific type assertion
        const clientWithPrivateMethod = client as unknown as {
          streamToString(stream: NodeJS.ReadableStream): Promise<string>;
        };
        await expect(clientWithPrivateMethod.streamToString(stream)).rejects.toThrow(errorMessage);
      });
    });

    describe("cleanupClient method", () => {
      it("should set client to null", async () => {
        // Create client with configuration
        client = new S3Client("S3Client", { bucket: "test-bucket" });
        await client.init();

        // Verify client is initialized
        expect(client.isInitialized()).toBe(true);

        // Call cleanup method
        await client.destroy();

        // Verify client is no longer initialized
        expect(client.isInitialized()).toBe(false);
      });
    });
  });

  describe("Direct client error handling", () => {
    let client: S3Client;

    beforeEach(async () => {
      // Create and initialize client with test configuration
      client = new S3Client("S3Client", { bucket: "test-bucket" });
      await client.init();
    });

    it("should handle Error objects in delete method", async () => {
      const testKey = "test/direct-error-delete.txt";
      const errorMessage = "Direct error handling test";

      // Access the client directly and spy on its send method
      // This bypasses the aws-sdk-client-mock entirely to exercise the actual code path
      // Use a proper type definition to access the client's internals
      interface S3ClientInternal {
        client: AwsS3Client;
      }
      const clientInstance = (client as unknown as S3ClientInternal).client;
      const originalSend = clientInstance.send;

      // Replace send method with one that throws an actual Error
      clientInstance.send = vi.fn().mockImplementation(() => {
        throw new Error(errorMessage);
      });

      try {
        await expect(client.delete(testKey)).rejects.toThrow(
          `Failed to delete object ${testKey} from bucket test-bucket: ${errorMessage}`,
        );

        // Verify the ternary used the error.message (left side)
        expect(clientInstance.send).toHaveBeenCalled();
      } finally {
        // Restore original method
        clientInstance.send = originalSend;
      }
    });

    it("should handle non-Error values in delete method", async () => {
      const testKey = "test/direct-non-error.txt";
      const nonErrorValue = { code: "CustomAWSError", statusCode: 403 };

      // Access the client directly and spy on its send method
      interface S3ClientInternal {
        client: AwsS3Client;
      }
      const clientInstance = (client as unknown as S3ClientInternal).client;
      const originalSend = clientInstance.send;

      // Replace send method with one that throws a non-Error value
      clientInstance.send = vi.fn().mockImplementation(() => {
        throw nonErrorValue; // Directly throw a non-Error object
      });

      try {
        await expect(client.delete(testKey)).rejects.toThrow(
          `Failed to delete object ${testKey} from bucket test-bucket: ${String(nonErrorValue)}`,
        );

        // Verify the ternary used String(error) (right side)
        expect(clientInstance.send).toHaveBeenCalled();
      } finally {
        // Restore original method
        clientInstance.send = originalSend;
      }
    });

    it("should handle non-Error values in write method", async () => {
      const testKey = "test/direct-non-error-write.txt";
      const nonErrorValue = { code: "NetworkFailure" };

      // Access the client directly and spy on its send method
      interface S3ClientInternal {
        client: AwsS3Client;
      }
      const clientInstance = (client as unknown as S3ClientInternal).client;
      const originalSend = clientInstance.send;

      // Replace send method with one that throws a non-Error value
      clientInstance.send = vi.fn().mockImplementation(() => {
        throw nonErrorValue;
      });

      try {
        await expect(client.write(testKey, "content")).rejects.toThrow(
          `Failed to write object ${testKey} to bucket test-bucket: ${String(nonErrorValue)}`,
        );

        expect(clientInstance.send).toHaveBeenCalled();
      } finally {
        // Restore original method
        clientInstance.send = originalSend;
      }
    });

    it("should handle standard Error objects in read method", async () => {
      const testKey = "test/direct-error-read.txt";
      const errorMessage = "Direct read error";

      // Access the client directly and spy on its send method
      interface S3ClientInternal {
        client: AwsS3Client;
      }
      const clientInstance = (client as unknown as S3ClientInternal).client;
      const originalSend = clientInstance.send;

      // Replace send method with one that throws an actual Error
      clientInstance.send = vi.fn().mockImplementation(() => {
        throw new Error(errorMessage);
      });

      try {
        await expect(client.read(testKey)).rejects.toThrow(
          `Failed to read object ${testKey} from bucket test-bucket: ${errorMessage}`,
        );

        expect(clientInstance.send).toHaveBeenCalled();
      } finally {
        // Restore original method
        clientInstance.send = originalSend;
      }
    });

    it("should throw if operations are called before initialization", async () => {
      const newClient = new S3Client();

      await expect(newClient.read("test-key")).rejects.toThrow("not initialized");
      await expect(newClient.readJson("test-key")).rejects.toThrow("not initialized");
      await expect(newClient.write("test-key", "content")).rejects.toThrow("not initialized");
      await expect(newClient.writeJson("test-key", { data: "test" })).rejects.toThrow(
        "not initialized",
      );
      await expect(newClient.delete("test-key")).rejects.toThrow("not initialized");
    });

    it("should handle null response body", async () => {
      const testKey = "test/file.txt";

      // Create a mock response with null body
      s3Mock.on(GetObjectCommand).resolves({
        $metadata: { httpStatusCode: 200 },
        // No Body property
      });

      await expect(client.read(testKey)).rejects.toThrow(
        `Failed to read object ${testKey} from bucket test-bucket: Object ${testKey} in bucket test-bucket has no content`,
      );
    });
  });

  describe("Edge cases", () => {
    let client: S3Client;

    beforeEach(async () => {
      client = new S3Client("S3Client", { bucket: "test-bucket" });
      await client.init();
    });

    it("should handle multiple client instances with different configurations", async () => {
      // Create first client with first bucket
      const firstClient = new S3Client("FirstS3Client", { bucket: "first-bucket" });
      await firstClient.init();
      expect(firstClient.isInitialized()).toBe(true);

      // Create second client with second bucket
      const secondClient = new S3Client("SecondS3Client", { bucket: "second-bucket" });
      await secondClient.init();
      expect(secondClient.isInitialized()).toBe(true);

      // Setup mock responses
      s3Mock.on(GetObjectCommand).resolves(createS3Response("first-content"));

      // Use first client
      await firstClient.read("test-key");

      // Verify correct parameters for first client
      expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: "first-bucket",
        Key: "test-key",
      });

      s3Mock.reset();
      s3Mock.on(GetObjectCommand).resolves(createS3Response("second-content"));

      // Use second client
      await secondClient.read("test-key");

      // Verify correct parameters for second client
      expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: "second-bucket",
        Key: "test-key",
      });

      // Clean up
      await firstClient.destroy();
      await secondClient.destroy();
    });

    it("should handle empty string content in write method", async () => {
      const testKey = "test/empty.txt";
      const emptyContent = "";

      // Setup mock success response
      s3Mock.on(PutObjectCommand).resolves({});

      await client.write(testKey, emptyContent);

      // Verify correct parameters were used
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: "test-bucket",
        Key: testKey,
        Body: emptyContent,
        ContentType: "text/plain",
      });

      // Verify the mock was called
      expect(s3Mock.calls().length).toBeGreaterThan(0);
    });

    it("should handle non-string keys gracefully", async () => {
      // Testing with incorrect types to ensure graceful handling
      await expect(client.read(123 as unknown as string)).rejects.toThrow();
      await expect(client.write(null as unknown as string, "content")).rejects.toThrow();
      await expect(client.delete(undefined as unknown as string)).rejects.toThrow();
    });

    it("should handle special characters in keys", async () => {
      const specialKey = "test/special!@#$%^&*()_+.txt";
      const testContent = "content with special characters";

      // Setup mock response
      s3Mock.on(GetObjectCommand).resolves(createS3Response(testContent));

      const result = await client.read(specialKey);
      expect(result).toBe(testContent);

      // Verify correct parameters were used
      expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: "test-bucket",
        Key: specialKey,
      });
    });

    it("should handle very large JSON objects", async () => {
      const testKey = "test/large.json";

      // Create a large object (100KB)
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${"X".repeat(100)}`;
      }

      // Setup mock responses
      s3Mock.on(PutObjectCommand).resolves({});
      s3Mock.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(largeObject)));

      // Write large object
      await client.writeJson(testKey, largeObject);

      // Read it back
      const result = await client.readJson<Record<string, string>>(testKey);

      // Verify it's the same
      expect(Object.keys(result).length).toBe(1000);
      expect(result.key0).toBe(`value${"X".repeat(100)}`);
    });
  });
});
