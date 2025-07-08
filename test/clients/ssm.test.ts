import {
  SSMClient as AwsSSMClient,
  DeleteParameterCommand,
  GetParameterCommand,
  ParameterType,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SsmClient } from "../../src/clients/ssm";

// Create the mock client
const ssmMock = mockClient(AwsSSMClient);

describe("SsmClient with aws-sdk-client-mock", () => {
  let client: SsmClient;

  beforeEach(() => {
    // Reset all mocks before each test
    ssmMock.reset();
    client = new SsmClient();
  });

  afterEach(async () => {
    await client.destroy();
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("SsmClient");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should be initialized after init is called", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should use default region when none provided", async () => {
      await client.init();

      // Verify the client was properly initialized
      // Note: Creating an SSM client doesn't actually make any AWS calls,
      // so we can't check ssmMock.calls()
      expect(client.isInitialized()).toBe(true);
    });

    it("should use provided configuration", async () => {
      const config = {
        region: "eu-west-1",
        accessKeyId: "test-key-id",
        secretAccessKey: "test-secret",
        endpoint: "http://localhost:4566",
      };

      await client.init(config);

      // Verify the client was properly initialized
      // Note: Creating an SSM client doesn't actually make any AWS calls,
      // so we can't check ssmMock.calls()
      expect(client.isInitialized()).toBe(true);
    });
  });

  describe("SSM operations", () => {
    beforeEach(async () => {
      await client.init();
    });

    describe("read", () => {
      it("should call GetParameterCommand with correct parameters", async () => {
        const paramName = "/test/parameter";
        const paramValue = "test-value";

        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: paramValue,
            Name: paramName,
            Type: "String",
            ARN: `arn:aws:ssm:us-east-1:123456789012:parameter${paramName}`,
            Version: 1,
          },
        });

        const result = await client.read(paramName);

        // Assert using the specialized matcher
        expect(ssmMock).toHaveReceivedCommandWith(GetParameterCommand, {
          Name: paramName,
          WithDecryption: false,
        });

        expect(result).toBe(paramValue);
      });

      it("should handle WithDecryption parameter for secure strings", async () => {
        const paramName = "/test/secure-parameter";
        const paramValue = "secret-value";

        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: paramValue,
            Name: paramName,
            Type: "SecureString",
            ARN: `arn:aws:ssm:us-east-1:123456789012:parameter${paramName}`,
            Version: 1,
          },
        });

        const result = await client.read(paramName, true);

        expect(ssmMock).toHaveReceivedCommandWith(GetParameterCommand, {
          Name: paramName,
          WithDecryption: true,
        });

        expect(result).toBe(paramValue);
      });

      it("should throw error when Parameter is missing", async () => {
        ssmMock.on(GetParameterCommand).resolves({
          // Parameter is missing
        });

        await expect(client.read("/test/missing")).rejects.toThrow("Parameter not found:");
      });

      it("should throw error when Parameter.Value is missing", async () => {
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            // Value is missing
            Name: "/test/invalid",
            Type: "String",
            ARN: "arn:aws:ssm:us-east-1:123456789012:parameter/test/invalid",
            Version: 1,
          },
        });

        await expect(client.read("/test/invalid")).rejects.toThrow("Parameter not found:");
      });

      it("should handle errors from AWS", async () => {
        ssmMock.on(GetParameterCommand).rejects(new Error("Parameter does not exist"));

        await expect(client.read("/test/nonexistent")).rejects.toThrow("Parameter does not exist");
      });
    });

    describe("write", () => {
      it("should call PutParameterCommand with correct parameters for String type", async () => {
        const paramName = "/test/parameter";
        const paramValue = "test-value";

        ssmMock.on(PutParameterCommand).resolves({});

        await client.write(paramName, paramValue);

        // Assert using the specialized matcher
        expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
          Name: paramName,
          Value: paramValue,
          Type: ParameterType.STRING,
          Overwrite: true,
        });
      });

      it("should call PutParameterCommand with correct parameters for StringList type", async () => {
        const paramName = "/test/list-parameter";
        const paramValue = "item1,item2,item3";

        ssmMock.on(PutParameterCommand).resolves({});

        await client.write(paramName, paramValue, "StringList");

        expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
          Name: paramName,
          Value: paramValue,
          Type: ParameterType.STRING_LIST,
          Overwrite: true,
        });
      });

      it("should call PutParameterCommand with correct parameters for SecureString type", async () => {
        const paramName = "/test/secure-parameter";
        const paramValue = "secret-value";

        ssmMock.on(PutParameterCommand).resolves({});

        await client.write(paramName, paramValue, "SecureString");

        // For SecureString parameters, let's use a more flexible check since KeyId may be handled differently
        // Verify the command was called with the expected parameters
        expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
          Name: paramName,
          Value: paramValue,
          Type: ParameterType.SECURE_STRING,
          Overwrite: true,
          // Not checking KeyId since it might be conditionally included
        });
      });

      it("should handle lowercase type parameter", async () => {
        const paramName = "/test/parameter";
        const paramValue = "test-value";

        ssmMock.on(PutParameterCommand).resolves({});

        await client.write(paramName, paramValue, "string");

        expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
          Name: paramName,
          Value: paramValue,
          Type: ParameterType.STRING,
          Overwrite: true,
        });
      });

      it("should use KMS Key ID for SecureString when configured", async () => {
        const paramName = "/test/secure-parameter";
        const paramValue = "secret-value";
        const kmsKeyId =
          "arn:aws:kms:us-east-1:123456789012:key/1234abcd-12ab-34cd-56ef-1234567890ab";

        // Initialize with KMS key ID
        await client.destroy();
        await client.init({
          kmsKeyId,
        });

        ssmMock.on(PutParameterCommand).resolves({});

        await client.write(paramName, paramValue, "SecureString");

        expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
          Name: paramName,
          Value: paramValue,
          Type: ParameterType.SECURE_STRING,
          Overwrite: true,
          KeyId: kmsKeyId,
        });
      });

      it("should respect overwrite flag", async () => {
        const paramName = "/test/parameter";
        const paramValue = "test-value";

        ssmMock.on(PutParameterCommand).resolves({});

        await client.write(paramName, paramValue, "String", false);

        expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
          Name: paramName,
          Value: paramValue,
          Type: ParameterType.STRING,
          Overwrite: false,
        });
      });

      it("should handle errors from AWS", async () => {
        ssmMock.on(PutParameterCommand).rejects(new Error("Parameter limit exceeded"));

        await expect(client.write("/test/parameter", "value")).rejects.toThrow(
          "Parameter limit exceeded",
        );
      });
    });

    describe("delete", () => {
      it("should call DeleteParameterCommand with correct parameters", async () => {
        const paramName = "/test/parameter";

        ssmMock.on(DeleteParameterCommand).resolves({});

        await client.delete(paramName);

        expect(ssmMock).toHaveReceivedCommandWith(DeleteParameterCommand, {
          Name: paramName,
        });
      });

      it("should handle errors from AWS", async () => {
        ssmMock.on(DeleteParameterCommand).rejects(new Error("Parameter not found"));

        await expect(client.delete("/test/nonexistent")).rejects.toThrow("Parameter not found");
      });
    });
  });

  describe("Error handling", () => {
    it("should throw error if client is not initialized", async () => {
      const newClient = new SsmClient();

      await expect(newClient.read("/test/parameter")).rejects.toThrow("not initialized");
      await expect(newClient.write("/test/parameter", "value")).rejects.toThrow("not initialized");
      await expect(newClient.delete("/test/parameter")).rejects.toThrow("not initialized");
    });
  });
});
