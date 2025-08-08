/**
 * AWS SSM Client Tests
 *
 * This test suite verifies the SsmClient implementation using aws-sdk-client-mock
 * to mock AWS SSM service calls and validate client behavior.
 *
 * Test coverage includes:
 * - Client initialization and configuration validation
 * - Reading parameters from SSM Parameter Store
 * - Writing parameters to SSM Parameter Store
 * - Deleting parameters from SSM Parameter Store
 * - Client lifecycle management
 * - Error handling for invalid inputs and AWS API failures
 */

import {
  DeleteParameterCommand,
  GetParameterCommand,
  ParameterType,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SsmClient } from "../../../src/clients/aws/aws-ssm";

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client identifiers and configuration
  CLIENT_ID: "test-ssm-client",
  TEST_CLIENT_ID: "test",
  REGION: "us-east-1",

  // Parameter data
  PARAMETER_NAME: "/test/parameter",
  PARAMETER_VALUE: "test-value",
  SECURE_PARAMETER_NAME: "/test/secure-parameter",
  SECURE_PARAMETER_VALUE: "secure-value",
  ENCRYPTED_VALUE: "encrypted-value",
  EMPTY_PARAMETER_NAME: "/test/empty-parameter",
  LIST_PARAMETER_NAME: "/test/list-parameter",
  LIST_PARAMETER_VALUE: "value1,value2,value3",
  NONEXISTENT_PARAMETER: "/nonexistent/parameter",

  // Error message constants
  ERROR_ACCESS_DENIED: "AccessDenied",
  ERROR_PARAMETER_ALREADY_EXISTS: "ParameterAlreadyExists",
  ERROR_PARAMETER_NOT_FOUND_CODE: "ParameterNotFound",

  // Error message functions
  ERROR_NOT_INITIALIZED: (clientId: string) => `${clientId} is not initialized. Call init() first`,
  ERROR_PARAMETER_NOT_FOUND: (name: string) => `Parameter not found: ${name}`,
  ERROR_READ_ERROR: (name: string, error: string) => `Failed to read parameter ${name}: ${error}`,
  ERROR_WRITE_ERROR: (name: string, error: string) => `Failed to write parameter ${name}: ${error}`,
  ERROR_DELETE_ERROR: (name: string, error: string) =>
    `Failed to delete parameter ${name}: ${error}`,
};

/**
 * Create mock for SSM client
 */
const ssmMock = mockClient(SSMClient);

/**
 * Tests for the SsmClient implementation
 */
describe("SsmClient", () => {
  let client: SsmClient;

  beforeEach(() => {
    // Reset all mocks before each test
    ssmMock.reset();
    vi.clearAllMocks();

    // Create new client instance
    client = new SsmClient(TEST_FIXTURES.CLIENT_ID, { region: TEST_FIXTURES.REGION });
  });

  /**
   * Tests for client initialization and configuration validation
   */
  describe("initialization", () => {
    it("should initialize successfully with valid configuration", async () => {
      await expect(client.init()).resolves.not.toThrow();
      expect(client.isInitialized()).toBe(true);
    });

    it("should set client name correctly", () => {
      expect(client.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });

    it("should support case-insensitive type and include KeyId for SecureString with kmsKeyId", async () => {
      const clientWithKms = new SsmClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
        kmsKeyId: "kms-123",
      });
      await clientWithKms.init();
      ssmMock.on(PutParameterCommand).resolves({});

      await expect(
        // pass lowercase "securestring" to hit case-insensitive mapping
        clientWithKms.write(
          TEST_FIXTURES.SECURE_PARAMETER_NAME,
          TEST_FIXTURES.SECURE_PARAMETER_VALUE,
          "securestring",
        ),
      ).resolves.not.toThrow();

      expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
        Name: TEST_FIXTURES.SECURE_PARAMETER_NAME,
        Value: TEST_FIXTURES.SECURE_PARAMETER_VALUE,
        Type: ParameterType.SECURE_STRING,
        Overwrite: true,
        KeyId: "kms-123",
      });
    });

    it("should handle non-Error objects during write", async () => {
      await client.init();
      ssmMock.on(PutParameterCommand).rejects("String write error");

      await expect(
        client.write(TEST_FIXTURES.PARAMETER_NAME, TEST_FIXTURES.PARAMETER_VALUE),
      ).rejects.toThrow(
        TEST_FIXTURES.ERROR_WRITE_ERROR(TEST_FIXTURES.PARAMETER_NAME, "String write error"),
      );
    });
  });

  /**
   * Tests for reading parameters from SSM Parameter Store
   */
  describe("read", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should throw validation error when parameter name is empty", async () => {
      await expect(client.read("")).rejects.toThrow("SSM read operation requires a parameter name");
    });

    it("should read parameter successfully", async () => {
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Name: TEST_FIXTURES.PARAMETER_NAME,
          Value: TEST_FIXTURES.PARAMETER_VALUE,
          Type: ParameterType.STRING,
        },
      });

      const result = await client.read(TEST_FIXTURES.PARAMETER_NAME);

      expect(result).toBe(TEST_FIXTURES.PARAMETER_VALUE);
      expect(ssmMock).toHaveReceivedCommandWith(GetParameterCommand, {
        Name: TEST_FIXTURES.PARAMETER_NAME,
        WithDecryption: false,
      });
    });

    it("should read parameter with decryption", async () => {
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Name: TEST_FIXTURES.SECURE_PARAMETER_NAME,
          Value: TEST_FIXTURES.ENCRYPTED_VALUE,
          Type: ParameterType.SECURE_STRING,
        },
      });

      const result = await client.read(TEST_FIXTURES.SECURE_PARAMETER_NAME, true);

      expect(result).toBe(TEST_FIXTURES.ENCRYPTED_VALUE);
      expect(ssmMock).toHaveReceivedCommandWith(GetParameterCommand, {
        Name: TEST_FIXTURES.SECURE_PARAMETER_NAME,
        WithDecryption: true,
      });
    });

    it("should handle empty parameter value", async () => {
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Name: TEST_FIXTURES.EMPTY_PARAMETER_NAME,
          Value: "",
          Type: ParameterType.STRING,
        },
      });

      const result = await client.read(TEST_FIXTURES.EMPTY_PARAMETER_NAME);

      expect(result).toBe("");
    });

    it("should throw error when parameter does not exist", async () => {
      ssmMock
        .on(GetParameterCommand)
        .rejects(new Error(TEST_FIXTURES.ERROR_PARAMETER_NOT_FOUND_CODE));

      await expect(client.read(TEST_FIXTURES.NONEXISTENT_PARAMETER)).rejects.toThrow(
        TEST_FIXTURES.ERROR_READ_ERROR(
          TEST_FIXTURES.NONEXISTENT_PARAMETER,
          TEST_FIXTURES.ERROR_PARAMETER_NOT_FOUND_CODE,
        ),
      );
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new SsmClient(TEST_FIXTURES.TEST_CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.read(TEST_FIXTURES.PARAMETER_NAME)).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.TEST_CLIENT_ID),
      );
    });

    it("should throw error when response is missing Parameter object", async () => {
      // API returns empty response with no Parameter object
      ssmMock.on(GetParameterCommand).resolves({});

      await expect(client.read(TEST_FIXTURES.PARAMETER_NAME)).rejects.toThrow(
        TEST_FIXTURES.ERROR_PARAMETER_NOT_FOUND(TEST_FIXTURES.PARAMETER_NAME),
      );
    });

    it("should throw error when Parameter object has no Value property", async () => {
      // API returns Parameter object but without a Value property
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Name: TEST_FIXTURES.PARAMETER_NAME,
          Type: ParameterType.STRING,
          // Value is intentionally missing
        },
      });

      await expect(client.read(TEST_FIXTURES.PARAMETER_NAME)).rejects.toThrow(
        TEST_FIXTURES.ERROR_PARAMETER_NOT_FOUND(TEST_FIXTURES.PARAMETER_NAME),
      );
    });

    it("should handle non-Error objects during read", async () => {
      ssmMock.on(GetParameterCommand).rejects("String read error");

      await expect(client.read(TEST_FIXTURES.PARAMETER_NAME)).rejects.toThrow(
        TEST_FIXTURES.ERROR_READ_ERROR(TEST_FIXTURES.PARAMETER_NAME, "String read error"),
      );
    });
  });

  /**
   * Tests for writing parameters to SSM Parameter Store
   */
  describe("write", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should throw validation error when parameter name is empty", async () => {
      await expect(client.write("", TEST_FIXTURES.PARAMETER_VALUE)).rejects.toThrow(
        "SSM write operation requires a parameter name",
      );
    });

    it("should throw validation error when parameter value is undefined", async () => {
      await expect(
        // @ts-expect-error testing undefined value branch
        client.write(TEST_FIXTURES.PARAMETER_NAME, undefined),
      ).rejects.toThrow("SSM write operation requires a parameter value");
    });

    it("should write parameter successfully with default options", async () => {
      ssmMock.on(PutParameterCommand).resolves({});

      await expect(
        client.write(TEST_FIXTURES.PARAMETER_NAME, TEST_FIXTURES.PARAMETER_VALUE),
      ).resolves.not.toThrow();

      expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
        Name: TEST_FIXTURES.PARAMETER_NAME,
        Value: TEST_FIXTURES.PARAMETER_VALUE,
        Type: ParameterType.STRING,
        Overwrite: true,
      });
    });

    it("should write parameter with custom type and overwrite option", async () => {
      ssmMock.on(PutParameterCommand).resolves({});

      await expect(
        client.write(
          TEST_FIXTURES.SECURE_PARAMETER_NAME,
          TEST_FIXTURES.SECURE_PARAMETER_VALUE,
          ParameterType.SECURE_STRING,
          false,
        ),
      ).resolves.not.toThrow();

      expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
        Name: TEST_FIXTURES.SECURE_PARAMETER_NAME,
        Value: TEST_FIXTURES.SECURE_PARAMETER_VALUE,
        Type: ParameterType.SECURE_STRING,
        Overwrite: false,
      });
    });

    it("should write StringList parameter", async () => {
      ssmMock.on(PutParameterCommand).resolves({});

      await expect(
        client.write(
          TEST_FIXTURES.LIST_PARAMETER_NAME,
          TEST_FIXTURES.LIST_PARAMETER_VALUE,
          ParameterType.STRING_LIST,
        ),
      ).resolves.not.toThrow();

      expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
        Name: TEST_FIXTURES.LIST_PARAMETER_NAME,
        Value: TEST_FIXTURES.LIST_PARAMETER_VALUE,
        Type: ParameterType.STRING_LIST,
        Overwrite: true,
      });
    });

    it("should handle empty parameter value", async () => {
      ssmMock.on(PutParameterCommand).resolves({});

      await expect(client.write(TEST_FIXTURES.EMPTY_PARAMETER_NAME, "")).resolves.not.toThrow();

      expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
        Name: TEST_FIXTURES.EMPTY_PARAMETER_NAME,
        Value: "",
        Type: ParameterType.STRING,
        Overwrite: true,
      });
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new SsmClient(TEST_FIXTURES.TEST_CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
      });

      await expect(
        uninitializedClient.write(TEST_FIXTURES.PARAMETER_NAME, TEST_FIXTURES.PARAMETER_VALUE),
      ).rejects.toThrow(TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.TEST_CLIENT_ID));
    });

    it("should handle AWS API errors", async () => {
      ssmMock.on(PutParameterCommand).rejects(new Error(TEST_FIXTURES.ERROR_ACCESS_DENIED));

      await expect(
        client.write(TEST_FIXTURES.PARAMETER_NAME, TEST_FIXTURES.PARAMETER_VALUE),
      ).rejects.toThrow(
        TEST_FIXTURES.ERROR_WRITE_ERROR(
          TEST_FIXTURES.PARAMETER_NAME,
          TEST_FIXTURES.ERROR_ACCESS_DENIED,
        ),
      );
    });

    it("should handle parameter already exists error when overwrite is false", async () => {
      ssmMock
        .on(PutParameterCommand)
        .rejects(new Error(TEST_FIXTURES.ERROR_PARAMETER_ALREADY_EXISTS));

      await expect(
        client.write(
          TEST_FIXTURES.PARAMETER_NAME,
          TEST_FIXTURES.PARAMETER_VALUE,
          ParameterType.STRING,
          false,
        ),
      ).rejects.toThrow(
        TEST_FIXTURES.ERROR_WRITE_ERROR(
          TEST_FIXTURES.PARAMETER_NAME,
          TEST_FIXTURES.ERROR_PARAMETER_ALREADY_EXISTS,
        ),
      );
    });
  });

  /**
   * Tests for deleting parameters from SSM Parameter Store
   */
  describe("delete", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should throw validation error when parameter name is empty", async () => {
      await expect(client.delete("")).rejects.toThrow(
        "SSM delete operation requires a parameter name",
      );
    });

    it("should delete parameter successfully", async () => {
      ssmMock.on(DeleteParameterCommand).resolves({});

      await expect(client.delete(TEST_FIXTURES.PARAMETER_NAME)).resolves.not.toThrow();

      expect(ssmMock).toHaveReceivedCommandWith(DeleteParameterCommand, {
        Name: TEST_FIXTURES.PARAMETER_NAME,
      });
    });

    it("should handle deletion of non-existent parameter", async () => {
      ssmMock
        .on(DeleteParameterCommand)
        .rejects(
          new Error(TEST_FIXTURES.ERROR_PARAMETER_NOT_FOUND(TEST_FIXTURES.NONEXISTENT_PARAMETER)),
        );

      await expect(client.delete(TEST_FIXTURES.NONEXISTENT_PARAMETER)).rejects.toThrow(
        TEST_FIXTURES.ERROR_DELETE_ERROR(
          TEST_FIXTURES.NONEXISTENT_PARAMETER,
          TEST_FIXTURES.ERROR_PARAMETER_NOT_FOUND(TEST_FIXTURES.NONEXISTENT_PARAMETER),
        ),
      );
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new SsmClient(TEST_FIXTURES.TEST_CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.delete(TEST_FIXTURES.PARAMETER_NAME)).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.TEST_CLIENT_ID),
      );
    });

    it("should handle AWS API errors", async () => {
      ssmMock.on(DeleteParameterCommand).rejects(new Error(TEST_FIXTURES.ERROR_ACCESS_DENIED));

      await expect(client.delete(TEST_FIXTURES.PARAMETER_NAME)).rejects.toThrow(
        TEST_FIXTURES.ERROR_DELETE_ERROR(
          TEST_FIXTURES.PARAMETER_NAME,
          TEST_FIXTURES.ERROR_ACCESS_DENIED,
        ),
      );
    });
  });

  /**
   * Tests for client lifecycle management
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
