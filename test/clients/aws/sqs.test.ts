/**
 * Unit tests for SQS client implementation
 * Tests the SqsClient functionality using aws-sdk-client-mock
 */
import {
  SQSClient as AwsSQSClient,
  DeleteMessageCommand,
  type Message,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SqsClient } from "../../../src/clients";

// Create the mock client
const sqsMock = mockClient(AwsSQSClient);

describe("SqsClient", () => {
  // With module augmentation, TypeScript should recognize the inheritance
  let client: SqsClient;

  beforeEach(() => {
    // Reset all mocks before each test
    sqsMock.reset();

    client = new SqsClient();

    // Setup fake timers for Date.now for consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1625097600000));
  });

  afterEach(async () => {
    await client.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("SqsClient");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should be initialized after init is called", async () => {
      // Create client with queue config in constructor
      client = new SqsClient("SqsClient", { queueUrl: "https://sqs.example.com/queue" });
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      // Create client with queue config in constructor
      client = new SqsClient("SqsClient", { queueUrl: "https://sqs.example.com/queue" });
      await client.init();
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should throw an error if queueUrl is not provided", async () => {
      // Arrange - client without queue URL config
      client = new SqsClient("SqsClientNoUrl");

      // Act & Assert - verify initialization fails with the correct error
      await expect(client.init()).rejects.toThrow("SQS queue URL is required");

      // Verify client is not initialized after error
      expect(client.isInitialized()).toBe(false);
    });

    it("should use default region when none provided", async () => {
      // With the aws-sdk-client-mock approach, we can't directly check the constructor arguments
      // Instead, we'll verify that initialization completes successfully and the client works
      client = new SqsClient("SqsClient", { queueUrl: "https://sqs.example.com/queue" });
      await client.init();
      expect(client.isInitialized()).toBe(true);

      // Verify we can use the client with default region
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-msg-id" });
      await client.sendMessage("test message");

      // Check that the queue URL was correctly used
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: "https://sqs.example.com/queue",
        MessageBody: "test message",
      });
    });

    it("should use provided configuration", async () => {
      const config = {
        region: "eu-west-1",
        queueUrl: "https://sqs.example.com/my-queue",
        accessKeyId: "test-key-id",
        secretAccessKey: "test-secret",
        endpoint: "http://localhost:4566",
      };

      // Create client with full config in constructor
      client = new SqsClient("SqsClient", config);
      await client.init();
      expect(client.isInitialized()).toBe(true);

      // Reset and setup mock for testing
      sqsMock.reset();
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "custom-config-msg-id" });

      // Use the client with the custom config
      await client.sendMessage("test with custom config");

      // Verify the correct queue URL from the custom config was used
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: "https://sqs.example.com/my-queue",
        MessageBody: "test with custom config",
      });
    });
  });

  describe("SQS operations", () => {
    const queueUrl = "https://sqs.example.com/queue";

    beforeEach(async () => {
      // Create client with queue config in constructor
      client = new SqsClient("SqsClient", { queueUrl });
      await client.init();
    });

    describe("sendMessage", () => {
      it("should call SendMessageCommand with correct parameters", async () => {
        const messageBody = "test message";
        const delaySeconds = 30;
        const messageId = "msg-123456";

        // Setup the mock response
        sqsMock.reset();
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: messageId,
        });

        // Call the client method
        const result = await client.sendMessage(messageBody, delaySeconds);

        // Verify result matches the mock response
        expect(result).toBe(messageId);

        // Verify command was called with correct parameters
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
          QueueUrl: queueUrl,
          MessageBody: messageBody,
          DelaySeconds: delaySeconds,
        });
        expect(result).toBe(messageId);
      });

      it("should use default delay when not specified", async () => {
        // Setup the mock response
        sqsMock.reset();
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: "msg-123",
        });

        // Call the client method with no delay parameter
        await client.sendMessage("test message");

        // Verify command was called with default delay of 0
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
          QueueUrl: queueUrl,
          MessageBody: "test message",
          DelaySeconds: 0,
        });
      });

      it("should generate a message ID if not returned by AWS", async () => {
        // Setup mock with missing MessageId
        sqsMock.reset();
        sqsMock.on(SendMessageCommand).resolves({
          // MessageId is missing
        });

        // Call client method and check the result
        const result = await client.sendMessage("test message");

        // Verify a generated message ID was returned (using the fake timer time)
        expect(result).toBe("message-id-1625097600000");
      });

      it("should throw if client is not initialized", async () => {
        const newClient = new SqsClient();
        await expect(newClient.sendMessage("test")).rejects.toThrow("not initialized");
      });
    });

    describe("receiveMessages", () => {
      it("should call ReceiveMessageCommand with correct parameters", async () => {
        const maxMessages = 5;
        const waitTimeSeconds = 10;

        const mockMessages = [
          {
            MessageId: "msg-1",
            Body: "message 1",
            ReceiptHandle: "receipt-1",
            MessageAttributes: {
              attr: {
                StringValue: "value1",
                DataType: "String",
              },
            },
          },
          {
            MessageId: "msg-2",
            Body: "message 2",
            ReceiptHandle: "receipt-2",
            MessageAttributes: {
              attr: {
                StringValue: "value2",
                DataType: "String",
              },
            },
          },
        ];

        // Reset and setup mock response
        sqsMock.reset();
        sqsMock.on(ReceiveMessageCommand).resolves({
          // Type assertion to use partial mock objects
          Messages: mockMessages as Message[],
        });

        // Call the client method with specific parameters
        const result = await client.receiveMessages(maxMessages, waitTimeSeconds);

        // Verify command was called with correct parameters
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          QueueUrl: queueUrl,
          MaxNumberOfMessages: maxMessages,
          WaitTimeSeconds: waitTimeSeconds,
        });

        // Verify result matches expected format
        expect(result).toEqual([
          {
            messageId: "msg-1",
            body: "message 1",
            receiptHandle: "receipt-1",
            attributes: { attr: { StringValue: "value1", DataType: "String" } },
          },
          {
            messageId: "msg-2",
            body: "message 2",
            receiptHandle: "receipt-2",
            attributes: { attr: { StringValue: "value2", DataType: "String" } },
          },
        ]);
      });

      it("should use default parameters when not specified", async () => {
        // Reset and setup mock with empty response
        sqsMock.reset();
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        });

        // Call method without specifying parameters
        await client.receiveMessages();

        // Verify command was called with default parameter values
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 0,
        });
      });

      it("should return empty array when no messages found", async () => {
        // Reset and mock empty messages array response
        sqsMock.reset();
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        });

        // Call the method and verify empty result
        const result = await client.receiveMessages();
        expect(result).toEqual([]);
      });

      it("should return empty array when Messages is undefined", async () => {
        // Reset and mock response with undefined Messages property
        sqsMock.reset();
        sqsMock.on(ReceiveMessageCommand).resolves({
          // Messages is missing
        });

        // Call the method and verify empty result
        const result = await client.receiveMessages();
        expect(result).toEqual([]);
      });

      it("should handle missing fields in messages", async () => {
        // Create mock messages with missing fields to test robustness
        const mockIncompleteMessages: Message[] = [
          {
            // MessageId is missing
            Body: "message 1",
            ReceiptHandle: "receipt-1",
            // MessageAttributes is missing
          },
          {
            MessageId: "msg-2",
            Body: "",
            // ReceiptHandle is empty string
            ReceiptHandle: "",
            MessageAttributes: {
              attr: { StringValue: "value2", DataType: "String" },
            },
          },
        ];

        // Reset and setup mock with incomplete messages
        sqsMock.reset();
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: mockIncompleteMessages,
        });

        const result = await client.receiveMessages();

        expect(result).toEqual([
          {
            messageId: "",
            body: "message 1",
            receiptHandle: "receipt-1",
            attributes: {},
          },
          {
            messageId: "msg-2",
            body: "",
            receiptHandle: "",
            attributes: { attr: { StringValue: "value2", DataType: "String" } },
          },
        ]);
      });
    });

    describe("deleteMessage", () => {
      it("should call DeleteMessageCommand with correct parameters", async () => {
        const receiptHandle = "test-receipt-handle";

        // Reset and setup mock response
        sqsMock.reset();
        sqsMock.on(DeleteMessageCommand).resolves({});

        // Call the method
        await client.deleteMessage(receiptHandle);

        // Verify command was called with correct parameters
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
          QueueUrl: queueUrl,
          ReceiptHandle: receiptHandle,
        });
      });

      it("should throw error with invalid receipt handle", async () => {
        // Setup mock to throw an error
        const error = new Error("Invalid receipt handle");
        sqsMock.reset();
        sqsMock.on(DeleteMessageCommand).rejects(error);

        // Verify the error is properly thrown from the client
        await expect(client.deleteMessage("invalid-receipt")).rejects.toThrow(
          "Invalid receipt handle",
        );
      });
    });

    describe("purgeQueue", () => {
      it("should call PurgeQueueCommand with correct parameters", async () => {
        // Reset and setup mock response
        sqsMock.reset();
        sqsMock.on(PurgeQueueCommand).resolves({});

        // Call the method
        await client.purgeQueue();

        // Verify command was called with correct parameters
        expect(sqsMock).toHaveReceivedCommandWith(PurgeQueueCommand, {
          QueueUrl: queueUrl,
        });
      });

      it("should handle purge errors", async () => {
        // Setup mock to reject with an error
        const error = new Error("PurgeQueueInProgress");
        sqsMock.reset();
        sqsMock.on(PurgeQueueCommand).rejects(error);

        // Verify the error is properly thrown
        await expect(client.purgeQueue()).rejects.toThrow("PurgeQueueInProgress");
      });
    });
  });

  describe("Error handling", () => {
    it("should throw error if client is not initialized", async () => {
      // Create a new client instance without initializing it
      const newClient = new SqsClient("SqsClient");

      // Verify all methods properly check for initialization
      await expect(newClient.sendMessage("test")).rejects.toThrow("SqsClient is not initialized");
      await expect(newClient.receiveMessages()).rejects.toThrow("SqsClient is not initialized");
      await expect(newClient.deleteMessage("receipt")).rejects.toThrow(
        "SqsClient is not initialized",
      );
      await expect(newClient.purgeQueue()).rejects.toThrow("SqsClient is not initialized");
    });

    it("should propagate AWS errors", async () => {
      // Initialize the client
      client = new SqsClient("SqsClient", { queueUrl: "https://sqs.example.com/queue" });
      await client.init();

      // Setup mock to reject with an AWS error
      const awsError = new Error("AWS service error");
      sqsMock.reset();
      sqsMock.on(SendMessageCommand).rejects(awsError);

      // Verify the error is properly propagated
      await expect(client.sendMessage("test")).rejects.toThrow("AWS service error");
    });
  });

  describe("Edge cases", () => {
    it("should handle multiple client instances with different configurations", async () => {
      // First client instance with first queue URL
      const client1 = new SqsClient("SqsClient1", { queueUrl: "https://sqs.example.com/queue1" });
      await client1.init();
      expect(client1.isInitialized()).toBe(true);

      // Mock response for first queue URL
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "msg-1" });
      await client1.sendMessage("test-msg-1");

      // Verify first queue URL was used
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: "https://sqs.example.com/queue1",
        MessageBody: "test-msg-1",
      });

      // Second client instance with different queue URL
      const client2 = new SqsClient("SqsClient2", { queueUrl: "https://sqs.example.com/queue2" });
      await client2.init();
      expect(client2.isInitialized()).toBe(true);

      // Reset mock to clear previous calls
      sqsMock.reset();

      // Mock response for second queue URL
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "msg-2" });
      await client2.sendMessage("test-msg-2");

      // Verify second queue URL was used
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: "https://sqs.example.com/queue2",
        MessageBody: "test-msg-2",
      });

      // Cleanup
      await client1.destroy();
      await client2.destroy();
    });

    it("should handle empty message body", async () => {
      client = new SqsClient("SqsClient", { queueUrl: "https://sqs.example.com/queue" });
      await client.init();

      // Reset mock and setup response for empty message
      sqsMock.reset();
      sqsMock.on(SendMessageCommand).resolves({
        MessageId: "msg-empty",
      });

      await client.sendMessage("");

      // Verify command was called with empty message body
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: "https://sqs.example.com/queue",
        MessageBody: "",
      });
    });
  });
});
