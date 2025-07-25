/**
 * AWS SQS Client Tests
 *
 * This test suite verifies the SqsClient implementation using aws-sdk-client-mock
 * to mock AWS SQS service calls and validate client behavior.
 *
 * Test coverage includes:
 * - Client initialization and configuration validation
 * - Sending messages to SQS queues with various parameters
 * - Receiving messages from SQS queues with attribute handling
 * - Deleting messages after processing
 * - Purging queue operations
 * - Error handling for invalid inputs and AWS API failures
 * - Lifecycle management (initialization and cleanup)
 */

import {
  SQSClient as AwsSqsClient,
  DeleteMessageCommand,
  type Message,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SqsClient } from "../../../src/clients/aws/aws-sqs";

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client identifiers and configuration
  CLIENT_ID: "test-sqs-client",
  REGION: "us-east-1",
  QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",

  // Message data
  MESSAGE_BODY: "Test message body",
  MESSAGE_ID: "test-message-id",
  RECEIPT_HANDLE: "test-receipt-handle",
  NON_EXISTENT_RECEIPT_HANDLE: "non-existent-receipt",
  DELAY_SECONDS: 30,
  ERROR_MESSAGE: "StringError",

  // Receive message parameters
  MAX_MESSAGES: 5,
  WAIT_TIME_SECONDS: 20,

  // Error message constants
  ERROR_MISSING_QUEUE_URL: "SQS queue URL is required",
  ERROR_MISSING_MESSAGE_CONTENT: "SQS sendMessage requires message content",
  ERROR_MISSING_RECEIPT_HANDLE: "SQS deleteMessage requires a receipt handle",

  // Error message functions
  ERROR_NOT_INITIALIZED: (clientId: string) => `${clientId} is not initialized. Call init() first`,
  ERROR_SEND_ERROR: (queueUrl: string, error: string) =>
    `Failed to send message to queue ${queueUrl}: ${error}`,
  ERROR_RECEIVE_ERROR: (queueUrl: string, error: string) =>
    `Failed to receive messages from queue ${queueUrl}: ${error}`,
  ERROR_DELETE_ERROR: (queueUrl: string, error: string) =>
    `Failed to delete message from queue ${queueUrl}: ${error}`,
  ERROR_PURGE_ERROR: (queueUrl: string, error: string) =>
    `Failed to purge queue ${queueUrl}: ${error}`,
};

/**
 * Create mock for SQS client
 */
const sqsMock = mockClient(AwsSqsClient);

/**
 * Tests for SqsClient
 */
describe("SqsClient", () => {
  let client: SqsClient;

  beforeEach(() => {
    // Reset all mocks before each test
    sqsMock.reset();
    vi.clearAllMocks();

    // Create new client instance
    client = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
      queueUrl: TEST_FIXTURES.QUEUE_URL,
      region: TEST_FIXTURES.REGION,
    });
  });

  /**
   * Tests for client initialization and configuration validation
   */
  describe("initialization", () => {
    it("should initialize successfully with valid configuration", async () => {
      await expect(client.init()).resolves.not.toThrow();
      expect(client.isInitialized()).toBe(true);
    });

    it("should throw error when queueUrl is missing", async () => {
      const clientWithoutQueueUrl = new SqsClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
      });

      await expect(clientWithoutQueueUrl.init()).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_QUEUE_URL,
      );
    });

    it("should set client name correctly", async () => {
      await client.init();
      expect(client.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });
  });

  /**
   * Tests for sending messages to SQS queues
   */
  describe("sendMessage", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should send message successfully", async () => {
      sqsMock.on(SendMessageCommand).resolves({ MessageId: TEST_FIXTURES.MESSAGE_ID });

      const result = await client.sendMessage(TEST_FIXTURES.MESSAGE_BODY);

      expect(result).toBe(TEST_FIXTURES.MESSAGE_ID);
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
        MessageBody: TEST_FIXTURES.MESSAGE_BODY,
        DelaySeconds: 0,
      });
    });

    it("should send message with delay", async () => {
      sqsMock.on(SendMessageCommand).resolves({ MessageId: TEST_FIXTURES.MESSAGE_ID });

      const result = await client.sendMessage(
        TEST_FIXTURES.MESSAGE_BODY,
        TEST_FIXTURES.DELAY_SECONDS,
      );

      expect(result).toBe(TEST_FIXTURES.MESSAGE_ID);
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
        MessageBody: TEST_FIXTURES.MESSAGE_BODY,
        DelaySeconds: TEST_FIXTURES.DELAY_SECONDS,
      });
    });

    it("should handle empty message body", async () => {
      sqsMock.on(SendMessageCommand).resolves({ MessageId: TEST_FIXTURES.MESSAGE_ID });

      const result = await client.sendMessage("");

      expect(result).toBe(TEST_FIXTURES.MESSAGE_ID);
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
        MessageBody: "",
        DelaySeconds: 0,
      });
    });

    it("should throw error when message body is null", async () => {
      // Create a function that passes null to bypass TypeScript type checking
      const testWithNullBody = () => client.sendMessage(null as unknown as string);

      await expect(testWithNullBody()).rejects.toThrow(TEST_FIXTURES.ERROR_MISSING_MESSAGE_CONTENT);
    });

    it("should throw error when message body is undefined", async () => {
      // Create a function that passes undefined to bypass TypeScript type checking
      const testWithUndefinedBody = () => client.sendMessage(undefined as unknown as string);

      await expect(testWithUndefinedBody()).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_MESSAGE_CONTENT,
      );
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new SqsClient("test", {
        queueUrl: TEST_FIXTURES.QUEUE_URL,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.sendMessage(TEST_FIXTURES.MESSAGE_BODY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED("test"),
      );
    });

    it("should handle error when sending message", async () => {
      sqsMock.on(SendMessageCommand).rejects(new Error(TEST_FIXTURES.ERROR_MESSAGE));

      await expect(client.sendMessage(TEST_FIXTURES.MESSAGE_BODY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_SEND_ERROR(TEST_FIXTURES.QUEUE_URL, TEST_FIXTURES.ERROR_MESSAGE),
      );
    });

    it("should handle string error when sending message", async () => {
      sqsMock.on(SendMessageCommand).rejects(TEST_FIXTURES.ERROR_MESSAGE);

      await expect(client.sendMessage(TEST_FIXTURES.MESSAGE_BODY)).rejects.toThrow(
        TEST_FIXTURES.ERROR_SEND_ERROR(TEST_FIXTURES.QUEUE_URL, TEST_FIXTURES.ERROR_MESSAGE),
      );
    });

    it("should handle missing MessageId with fallback", async () => {
      sqsMock.on(SendMessageCommand).resolves({});

      const result = await client.sendMessage(TEST_FIXTURES.MESSAGE_BODY);

      // Should generate a fallback message ID when AWS doesn't provide one
      expect(result).toMatch(/^message-id-\d+$/);
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
        MessageBody: TEST_FIXTURES.MESSAGE_BODY,
        DelaySeconds: 0,
      });
    });
  });

  /**
   * Tests for receiving messages from SQS queues
   */
  describe("receiveMessages", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should receive messages successfully", async () => {
      const mockMessages = [
        {
          MessageId: TEST_FIXTURES.MESSAGE_ID,
          Body: TEST_FIXTURES.MESSAGE_BODY,
          ReceiptHandle: TEST_FIXTURES.RECEIPT_HANDLE,
          MessageAttributes: { SenderId: { DataType: "String", StringValue: "user-1" } },
        },
        {
          MessageId: `${TEST_FIXTURES.MESSAGE_ID}-2`,
          Body: `${TEST_FIXTURES.MESSAGE_BODY} 2`,
          ReceiptHandle: `${TEST_FIXTURES.RECEIPT_HANDLE}-2`,
          MessageAttributes: { SenderId: { DataType: "String", StringValue: "user-2" } },
        },
      ];
      sqsMock.on(ReceiveMessageCommand).resolves({
        Messages: mockMessages,
      });

      const result = await client.receiveMessages();

      expect(result).toEqual([
        {
          messageId: TEST_FIXTURES.MESSAGE_ID,
          body: TEST_FIXTURES.MESSAGE_BODY,
          receiptHandle: TEST_FIXTURES.RECEIPT_HANDLE,
          attributes: { SenderId: { DataType: "String", StringValue: "user-1" } },
        },
        {
          messageId: `${TEST_FIXTURES.MESSAGE_ID}-2`,
          body: `${TEST_FIXTURES.MESSAGE_BODY} 2`,
          receiptHandle: `${TEST_FIXTURES.RECEIPT_HANDLE}-2`,
          attributes: { SenderId: { DataType: "String", StringValue: "user-2" } },
        },
      ]);

      expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0,
      });
    });

    it("should handle missing message properties with default values", async () => {
      // Mock messages with missing properties to test default value handling
      const mockIncompleteMessages = [
        {
          // Missing MessageId - should default to ""
          Body: `${TEST_FIXTURES.MESSAGE_BODY} with missing ID`,
          ReceiptHandle: `${TEST_FIXTURES.RECEIPT_HANDLE}-incomplete`,
          // Missing MessageAttributes - should default to {}
        },
        {
          MessageId: `${TEST_FIXTURES.MESSAGE_ID}-incomplete`,
          // Missing Body - should default to ""
          // Missing ReceiptHandle - should default to ""
          MessageAttributes: undefined, // Should handle undefined and convert to {}
        },
      ] as Partial<Message>[]; // Use a more specific type for test messages
      sqsMock.on(ReceiveMessageCommand).resolves({ Messages: mockIncompleteMessages });

      const result = await client.receiveMessages();

      // Verify default values are applied correctly
      expect(result).toEqual([
        {
          messageId: "", // Default value for missing MessageId
          body: `${TEST_FIXTURES.MESSAGE_BODY} with missing ID`,
          receiptHandle: `${TEST_FIXTURES.RECEIPT_HANDLE}-incomplete`,
          attributes: {}, // Default value for missing MessageAttributes
        },
        {
          messageId: `${TEST_FIXTURES.MESSAGE_ID}-incomplete`,
          body: "", // Default value for missing Body
          receiptHandle: "", // Default value for missing ReceiptHandle
          attributes: {}, // Default value for undefined MessageAttributes
        },
      ]);

      // Verify the command was called with the correct parameters
      expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
        MaxNumberOfMessages: 1, // Default value
        WaitTimeSeconds: 0, // Default value
      });
    });

    it("should receive multiple messages with custom parameters", async () => {
      const mockMessages = [
        {
          MessageId: "msg-1",
          Body: "Message 1",
          ReceiptHandle: "receipt-1",
          Attributes: {},
        },
      ];
      sqsMock.on(ReceiveMessageCommand).resolves({ Messages: mockMessages });

      const result = await client.receiveMessages(
        TEST_FIXTURES.MAX_MESSAGES,
        TEST_FIXTURES.WAIT_TIME_SECONDS,
      );

      expect(result).toHaveLength(1);
      expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
        MaxNumberOfMessages: TEST_FIXTURES.MAX_MESSAGES,
        WaitTimeSeconds: TEST_FIXTURES.WAIT_TIME_SECONDS,
      });
    });

    it("should return empty array when no messages available", async () => {
      sqsMock.on(ReceiveMessageCommand).resolves({ Messages: [] });

      const result = await client.receiveMessages();

      expect(result).toEqual([]);
    });

    it("should handle undefined Messages in response", async () => {
      sqsMock.on(ReceiveMessageCommand).resolves({});

      const result = await client.receiveMessages();

      expect(result).toEqual([]);
    });

    it("should handle messages with missing optional fields", async () => {
      const mockMessages = [
        {
          MessageId: "msg-1",
          Body: "Message 1",
          ReceiptHandle: "receipt-1",
          // Missing Attributes
        },
      ];
      sqsMock.on(ReceiveMessageCommand).resolves({
        Messages: mockMessages,
      });

      const result = await client.receiveMessages();

      expect(result).toEqual([
        {
          messageId: "msg-1",
          body: "Message 1",
          receiptHandle: "receipt-1",
          attributes: {},
        },
      ]);
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new SqsClient("test", {
        queueUrl: TEST_FIXTURES.QUEUE_URL,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.receiveMessages()).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED("test"),
      );
    });

    it("should handle error when receiving messages", async () => {
      sqsMock.on(ReceiveMessageCommand).rejects(new Error(TEST_FIXTURES.ERROR_MESSAGE));

      await expect(client.receiveMessages()).rejects.toThrow(
        TEST_FIXTURES.ERROR_RECEIVE_ERROR(TEST_FIXTURES.QUEUE_URL, TEST_FIXTURES.ERROR_MESSAGE),
      );
    });

    it("should handle string error when receiving messages", async () => {
      sqsMock.on(ReceiveMessageCommand).rejects(TEST_FIXTURES.ERROR_MESSAGE);

      await expect(client.receiveMessages()).rejects.toThrow(
        TEST_FIXTURES.ERROR_RECEIVE_ERROR(TEST_FIXTURES.QUEUE_URL, TEST_FIXTURES.ERROR_MESSAGE),
      );
    });
  });

  /**
   * Tests for deleting messages after processing
   */
  describe("deleteMessage", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should delete message successfully", async () => {
      sqsMock.on(DeleteMessageCommand).resolves({});

      await expect(client.deleteMessage(TEST_FIXTURES.RECEIPT_HANDLE)).resolves.not.toThrow();

      expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
        ReceiptHandle: TEST_FIXTURES.RECEIPT_HANDLE,
      });
    });

    it("should handle deletion of non-existent message", async () => {
      sqsMock.on(DeleteMessageCommand).resolves({});

      await expect(
        client.deleteMessage(TEST_FIXTURES.NON_EXISTENT_RECEIPT_HANDLE),
      ).resolves.not.toThrow();
    });

    it("should throw error when receipt handle is undefined", async () => {
      // Test with undefined receipt handle
      await expect(client.deleteMessage(undefined as unknown as string)).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_RECEIPT_HANDLE,
      );

      // Verify that the AWS SDK was not called
      expect(sqsMock).not.toHaveReceivedCommand(DeleteMessageCommand);
    });

    it("should throw error when receipt handle is empty string", async () => {
      // Test with empty string receipt handle
      await expect(client.deleteMessage("")).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_RECEIPT_HANDLE,
      );

      // Verify that the AWS SDK was not called
      expect(sqsMock).not.toHaveReceivedCommand(DeleteMessageCommand);
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new SqsClient("test", {
        queueUrl: TEST_FIXTURES.QUEUE_URL,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.deleteMessage("receipt-handle")).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED("test"),
      );
    });

    it("should handle error when deleting message", async () => {
      sqsMock.on(DeleteMessageCommand).rejects(new Error(TEST_FIXTURES.ERROR_MESSAGE));

      await expect(client.deleteMessage("invalid-receipt")).rejects.toThrow(
        TEST_FIXTURES.ERROR_DELETE_ERROR(TEST_FIXTURES.QUEUE_URL, TEST_FIXTURES.ERROR_MESSAGE),
      );
    });
  });

  /**
   * Tests for purging queue operations
   */
  describe("purgeQueue", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should purge queue successfully", async () => {
      sqsMock.on(PurgeQueueCommand).resolves({});

      await expect(client.purgeQueue()).resolves.not.toThrow();

      expect(sqsMock).toHaveReceivedCommandWith(PurgeQueueCommand, {
        QueueUrl: TEST_FIXTURES.QUEUE_URL,
      });
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new SqsClient("test", {
        queueUrl: TEST_FIXTURES.QUEUE_URL,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.purgeQueue()).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED("test"),
      );
    });

    it("should handle error when purging queue", async () => {
      sqsMock.on(PurgeQueueCommand).rejects(new Error(TEST_FIXTURES.ERROR_MESSAGE));

      await expect(client.purgeQueue()).rejects.toThrow(
        TEST_FIXTURES.ERROR_PURGE_ERROR(TEST_FIXTURES.QUEUE_URL, TEST_FIXTURES.ERROR_MESSAGE),
      );
    });

    it("should handle string error when purging queue", async () => {
      sqsMock.on(PurgeQueueCommand).rejects(TEST_FIXTURES.ERROR_MESSAGE);

      await expect(client.purgeQueue()).rejects.toThrow(
        TEST_FIXTURES.ERROR_PURGE_ERROR(TEST_FIXTURES.QUEUE_URL, TEST_FIXTURES.ERROR_MESSAGE),
      );
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
