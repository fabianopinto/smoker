/**
 * AWS S3 Client Tests
 *
 * This file contains comprehensive tests for the S3Client implementation,
 * covering initialization, read/write operations, error handling, and AWS SDK interactions.
 *
 * Test coverage includes:
 * - Client initialization and configuration validation
 * - Reading text and JSON objects from S3
 * - Writing text and JSON objects to S3
 * - Deleting objects from S3
 * - Error handling for various failure scenarios
 * - Stream handling and error propagation
 * - Lifecycle management
 */

import {
  S3Client as AwsS3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S3Client } from "../../../src/clients/aws/aws-s3";
import { ERR_S3_READ, ERR_VALIDATION, SmokerError } from "../../../src/errors";

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client configuration
  CLIENT_ID: "test-s3-client",
  BUCKET: "test-bucket",
  REGION: "us-east-1",

  // File paths
  TEXT_FILE_PATH: "test/file.txt",
  JSON_FILE_PATH: "test/data.json",
  NON_EXISTENT_FILE_PATH: "nonexistent/file.txt",

  // Test content
  TEXT_CONTENT: "Hello, World!",
  JSON_CONTENT: { name: "Test", value: 123 },
  INVALID_JSON: "{ invalid json }",
  UNINITIALIZED_CLIENT: "uninitialized-client",
  EMPTY_OBJECT: {},

  // Error message constants
  ERROR_MISSING_BUCKET: "S3 client requires a 'bucket' name to be provided in configuration",
  ERROR_NO_SUCH_KEY: "NoSuchKey",
  ERROR_ACCESS_DENIED: "AccessDenied",

  // Error message functions
  ERROR_NOT_INITIALIZED: (clientId: string) => `${clientId} is not initialized. Call init() first`,
};

/**
 * Mock stream interface for testing
 */
interface MockStream {
  on: (event: string, callback: (data?: Buffer) => void) => void;
}

/**
 * Create mock for S3 client
 */
const s3Mock = mockClient(AwsS3Client);

/**
 * Tests for S3Client
 */
describe("S3Client", () => {
  let client: S3Client;

  beforeEach(() => {
    // Reset mocks before each test
    s3Mock.reset();
    vi.clearAllMocks();

    // Create a new client instance for each test
    client = new S3Client(TEST_FIXTURES.CLIENT_ID, {
      bucket: TEST_FIXTURES.BUCKET,
      region: TEST_FIXTURES.REGION,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Client initialization tests
   */
  describe("initialization", () => {
    it("should initialize successfully with valid configuration", async () => {
      await expect(client.init()).resolves.not.toThrow();
      expect(client.isInitialized()).toBe(true);
    });

    it("should throw structured error when bucket is missing", async () => {
      const clientWithoutBucket = new S3Client(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
      });

      await expect(clientWithoutBucket.init()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "s3",
      );
    });

    it("should set client name correctly", async () => {
      await client.init();
      expect(client.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new S3Client(TEST_FIXTURES.UNINITIALIZED_CLIENT, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.read(TEST_FIXTURES.TEXT_FILE_PATH)).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.UNINITIALIZED_CLIENT),
      );
    });
  });

  /**
   * Tests for reading objects from S3
   */
  describe("read", () => {
    let mockStream: MockStream;

    beforeEach(async () => {
      await client.init();

      // Setup a default mock stream for successful reads
      mockStream = {
        on: vi.fn((event: string, callback: (data?: Buffer) => void) => {
          if (event === "data") {
            setTimeout(() => callback(Buffer.from(TEST_FIXTURES.TEXT_CONTENT)), 0);
          } else if (event === "end") {
            setTimeout(() => callback(), 0);
          }
        }),
      };
    });

    it("should read text content successfully when object exists", async () => {
      s3Mock.on(GetObjectCommand).resolves({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Body: mockStream as any,
      });

      const result = await client.read(TEST_FIXTURES.TEXT_FILE_PATH);

      expect(result).toBe(TEST_FIXTURES.TEXT_CONTENT);
      expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: TEST_FIXTURES.BUCKET,
        Key: TEST_FIXTURES.TEXT_FILE_PATH,
      });
    });

    it("should return empty string when reading an empty object", async () => {
      const emptyStream = {
        on: vi.fn((event: string, callback: (data?: Buffer) => void) => {
          if (event === "data") {
            // Don't emit any data for empty file
          } else if (event === "end") {
            setTimeout(() => callback(), 0);
          }
        }),
      };
      s3Mock.on(GetObjectCommand).resolves({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Body: emptyStream as any,
      });

      const result = await client.read(TEST_FIXTURES.TEXT_FILE_PATH);

      expect(result).toBe("");
      expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: TEST_FIXTURES.BUCKET,
        Key: TEST_FIXTURES.TEXT_FILE_PATH,
      });
    });

    it("should throw validation error when key is empty in read", async () => {
      await expect(client.read("")).rejects.toThrow("S3 read operation requires a key");
    });

    it("should handle stream error during read with structured error", async () => {
      // Mock a minimal stream-like object and cast to any to satisfy the AWS SDK type for tests
      const erroringStream = {
        on: vi.fn((event: string, callback: (arg?: unknown) => void) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("stream failure")), 0);
          }
        }),
      };
      s3Mock.on(GetObjectCommand).resolves({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Body: erroringStream as any,
      });

      await expect(client.read(TEST_FIXTURES.TEXT_FILE_PATH)).rejects.toSatisfy(
        (err) => SmokerError.isSmokerError(err) && err.code === ERR_S3_READ,
      );
    });

    it("should throw structured error when object does not exist in S3", async () => {
      s3Mock.on(GetObjectCommand).rejects(new Error(TEST_FIXTURES.ERROR_NO_SUCH_KEY));

      await expect(client.read(TEST_FIXTURES.NON_EXISTENT_FILE_PATH)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_S3_READ &&
          err.domain === "aws" &&
          err.details?.component === "s3",
      );
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new S3Client(TEST_FIXTURES.UNINITIALIZED_CLIENT, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.read(TEST_FIXTURES.TEXT_FILE_PATH)).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.UNINITIALIZED_CLIENT),
      );
    });

    it("should handle missing Body in response with structured error", async () => {
      s3Mock.on(GetObjectCommand).resolves({});

      await expect(client.read(TEST_FIXTURES.TEXT_FILE_PATH)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_S3_READ &&
          err.domain === "aws" &&
          err.details?.component === "s3",
      );
    });
  });

  /**
   * Tests for reading and parsing JSON objects from S3
   */
  describe("readJson", () => {
    let mockStream: Readable;

    beforeEach(async () => {
      await client.init();
    });

    it("should read and parse valid JSON object successfully", async () => {
      const jsonContent = JSON.stringify(TEST_FIXTURES.JSON_CONTENT);
      mockStream = Readable.from([jsonContent]);
      s3Mock.on(GetObjectCommand).resolves({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Body: mockStream as any,
      });

      const result = await client.readJson(TEST_FIXTURES.JSON_FILE_PATH);

      expect(result).toEqual(TEST_FIXTURES.JSON_CONTENT);
      expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: TEST_FIXTURES.BUCKET,
        Key: TEST_FIXTURES.JSON_FILE_PATH,
      });
    });

    it("should return empty object when reading empty JSON object", async () => {
      mockStream = Readable.from(["{}"]);
      s3Mock.on(GetObjectCommand).resolves({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Body: mockStream as any,
      });

      const result = await client.readJson(TEST_FIXTURES.JSON_FILE_PATH);

      expect(result).toEqual({});
    });

    it("should throw structured error when JSON content is invalid", async () => {
      mockStream = Readable.from([TEST_FIXTURES.INVALID_JSON]);
      s3Mock.on(GetObjectCommand).resolves({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Body: mockStream as any,
      });

      await expect(client.readJson(TEST_FIXTURES.JSON_FILE_PATH)).rejects.toMatchObject({
        code: ERR_S3_READ,
        domain: "aws",
        details: expect.objectContaining({ component: "s3" }),
      });
    });

    it("should throw structured error when client is not initialized", async () => {
      const uninitializedClient = new S3Client(TEST_FIXTURES.UNINITIALIZED_CLIENT, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.readJson(TEST_FIXTURES.JSON_FILE_PATH)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });
  });

  /**
   * Tests for writing objects to S3
   */
  describe("write", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should write object successfully when valid parameters are provided", async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      await client.write(TEST_FIXTURES.TEXT_FILE_PATH, TEST_FIXTURES.TEXT_CONTENT);

      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: TEST_FIXTURES.BUCKET,
        Key: TEST_FIXTURES.TEXT_FILE_PATH,
        Body: TEST_FIXTURES.TEXT_CONTENT,
      });
    });

    it("should write empty content when empty string is provided", async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      await client.write(TEST_FIXTURES.TEXT_FILE_PATH, "");

      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: TEST_FIXTURES.BUCKET,
        Key: TEST_FIXTURES.TEXT_FILE_PATH,
        Body: "",
      });
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new S3Client(TEST_FIXTURES.UNINITIALIZED_CLIENT, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });

      await expect(
        uninitializedClient.write(TEST_FIXTURES.TEXT_FILE_PATH, TEST_FIXTURES.TEXT_CONTENT),
      ).rejects.toThrow(TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.UNINITIALIZED_CLIENT));
    });

    it("should handle AWS API errors during write operation", async () => {
      s3Mock.on(PutObjectCommand).rejects(new Error(TEST_FIXTURES.ERROR_ACCESS_DENIED));

      await expect(
        client.write(TEST_FIXTURES.TEXT_FILE_PATH, TEST_FIXTURES.TEXT_CONTENT),
      ).rejects.toThrow(
        `Failed to write object ${TEST_FIXTURES.TEXT_FILE_PATH} to bucket ${TEST_FIXTURES.BUCKET}: ${TEST_FIXTURES.ERROR_ACCESS_DENIED}`,
      );
    });
  });

  /**
   * Tests for writing JSON objects to S3
   */
  describe("writeJson", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should serialize and write JSON object successfully", async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      await expect(
        client.writeJson(TEST_FIXTURES.JSON_FILE_PATH, TEST_FIXTURES.JSON_CONTENT),
      ).resolves.not.toThrow();

      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: TEST_FIXTURES.BUCKET,
        Key: TEST_FIXTURES.JSON_FILE_PATH,
        ContentType: "application/json",
      });
    });

    it("should write empty JSON object when empty object is provided", async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      await client.writeJson(TEST_FIXTURES.JSON_FILE_PATH, TEST_FIXTURES.EMPTY_OBJECT);

      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: TEST_FIXTURES.BUCKET,
        Key: TEST_FIXTURES.JSON_FILE_PATH,
        Body: JSON.stringify(TEST_FIXTURES.EMPTY_OBJECT, null, 2),
        ContentType: "application/json",
      });
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new S3Client(TEST_FIXTURES.UNINITIALIZED_CLIENT, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });

      await expect(
        uninitializedClient.writeJson(TEST_FIXTURES.JSON_FILE_PATH, TEST_FIXTURES.JSON_CONTENT),
      ).rejects.toThrow(TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.UNINITIALIZED_CLIENT));
    });

    it("should handle AWS API errors during JSON write operation", async () => {
      s3Mock.on(PutObjectCommand).rejects(new Error(TEST_FIXTURES.ERROR_ACCESS_DENIED));

      await expect(
        client.writeJson(TEST_FIXTURES.JSON_FILE_PATH, TEST_FIXTURES.JSON_CONTENT),
      ).rejects.toThrow(
        `Failed to write JSON object ${TEST_FIXTURES.JSON_FILE_PATH} to bucket ${TEST_FIXTURES.BUCKET}: ${TEST_FIXTURES.ERROR_ACCESS_DENIED}`,
      );
    });

    it("should throw validation error when key is empty in writeJson", async () => {
      await expect(client.writeJson("", TEST_FIXTURES.JSON_CONTENT)).rejects.toThrow(
        "S3 writeJson operation requires a key",
      );
    });

    it("should handle JSON serialization errors (circular structure)", async () => {
      // Create circular object
      const circular: Record<string, unknown> = {} as Record<string, unknown> & { self?: unknown };
      (circular as Record<string, unknown> & { self?: unknown }).self = circular;

      await expect(client.writeJson(TEST_FIXTURES.JSON_FILE_PATH, circular)).rejects.toThrow(
        `Failed to write JSON object ${TEST_FIXTURES.JSON_FILE_PATH} to bucket ${TEST_FIXTURES.BUCKET}: Converting circular structure to JSON`,
      );
    });
  });

  /**
   * Tests for deleting objects from S3
   */
  describe("delete", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should delete object successfully when object exists", async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});

      await client.delete(TEST_FIXTURES.TEXT_FILE_PATH);

      expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
        Bucket: TEST_FIXTURES.BUCKET,
        Key: TEST_FIXTURES.TEXT_FILE_PATH,
      });
    });

    it("should handle AWS API errors during delete operation", async () => {
      s3Mock.on(DeleteObjectCommand).rejects(new Error(TEST_FIXTURES.ERROR_ACCESS_DENIED));

      await expect(client.delete(TEST_FIXTURES.TEXT_FILE_PATH)).rejects.toThrow(
        `Failed to delete object ${TEST_FIXTURES.TEXT_FILE_PATH} from bucket ${TEST_FIXTURES.BUCKET}: ${TEST_FIXTURES.ERROR_ACCESS_DENIED}`,
      );
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new S3Client(TEST_FIXTURES.UNINITIALIZED_CLIENT, {
        bucket: TEST_FIXTURES.BUCKET,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.delete(TEST_FIXTURES.TEXT_FILE_PATH)).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.UNINITIALIZED_CLIENT),
      );
    });

    it("should handle non-existent files gracefully", async () => {
      // AWS S3 delete operation is idempotent, so it won't throw for non-existent files
      // But we should still test this case for our implementation
      s3Mock.on(DeleteObjectCommand).resolves({});

      await expect(client.delete(TEST_FIXTURES.NON_EXISTENT_FILE_PATH)).resolves.not.toThrow();
    });

    it("should throw validation error when key is empty in delete", async () => {
      await expect(client.delete("")).rejects.toThrow("S3 delete operation requires a key");
    });
  });

  /**
   * Tests for lifecycle management
   */
  describe("lifecycle management", () => {
    it("should cleanup successfully", async () => {
      await client.init();
      await expect(client.destroy()).resolves.not.toThrow();
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle cleanup when client is not initialized", async () => {
      await expect(client.destroy()).resolves.not.toThrow();
    });

    it("should handle multiple cleanup calls", async () => {
      await client.init();
      await client.destroy();
      await expect(client.destroy()).resolves.not.toThrow();
    });
  });
});
