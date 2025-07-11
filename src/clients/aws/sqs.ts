/**
 * SQS client for AWS SQS queue operations
 *
 * Provides functionality to interact with Amazon SQS message queues.
 * Supports sending, receiving, and deleting messages from queues.
 */
import {
  SQSClient as AwsSqsClient,
  DeleteMessageCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { BaseServiceClient, type ServiceClient } from "../core";

/**
 * Message structure returned from SQS
 */
export interface SqsMessage {
  messageId: string;
  body: string;
  receiptHandle: string;
  attributes: Record<string, unknown>;
}

/**
 * Interface for SQS client operations
 */
export interface SqsServiceClient extends ServiceClient {
  /**
   * Send a message to the SQS queue
   *
   * @param messageBody - Message content
   * @param delaySeconds - Delay delivery in seconds (default: 0)
   * @returns Message ID
   * @throws Error if sending fails
   */
  sendMessage(messageBody: string, delaySeconds?: number): Promise<string>;

  /**
   * Receive messages from the SQS queue
   *
   * @param maxMessages - Maximum number of messages to retrieve (default: 1)
   * @param waitTimeSeconds - Time to wait for messages (default: 0)
   * @returns Array of received messages
   * @throws Error if receiving fails
   */
  receiveMessages(maxMessages?: number, waitTimeSeconds?: number): Promise<SqsMessage[]>;

  /**
   * Delete a message from the SQS queue
   *
   * @param receiptHandle - Receipt handle of the message to delete
   * @throws Error if deletion fails
   */
  deleteMessage(receiptHandle: string): Promise<void>;

  /**
   * Purge all messages from the SQS queue
   *
   * @throws Error if purge operation fails
   */
  purgeQueue(): Promise<void>;
}

/**
 * SQS client implementation for AWS SQS queue operations
 */
export class SqsClient extends BaseServiceClient implements SqsServiceClient {
  private client: AwsSqsClient | null = null;
  private queueUrl = "";

  /**
   * Create a new SQS client
   *
   * @param clientId - Client identifier (defaults to "SqsClient")
   * @param config - Optional client configuration with properties:
   *   - queueUrl: (required) URL of the SQS queue
   *   - region: AWS region (default: "us-east-1")
   *   - accessKeyId: AWS access key ID
   *   - secretAccessKey: AWS secret access key
   *   - endpoint: Optional custom endpoint for local development
   */
  constructor(clientId = "SqsClient", config?: Record<string, unknown>) {
    super(clientId, config);
  }

  /**
   * Initialize the client with AWS configuration
   *
   * @throws Error if queueUrl is not provided or client creation fails
   */
  protected async initializeClient(): Promise<void> {
    try {
      const region = this.getConfig<string>("region", "us-east-1");
      this.queueUrl = this.getConfig<string>("queueUrl", "");

      if (!this.queueUrl) {
        throw new Error("SQS queue URL is required");
      }

      this.client = new AwsSqsClient({
        region,
        credentials: {
          accessKeyId: this.getConfig<string>("accessKeyId", ""),
          secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
        },
        endpoint: this.getConfig<string>("endpoint", "") || undefined,
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize SQS client: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send a message to the SQS queue
   *
   * @param messageBody - Message content
   * @param delaySeconds - Delay delivery in seconds (default: 0)
   * @returns Message ID
   * @throws Error if sending fails or client is not initialized
   */
  async sendMessage(messageBody: string, delaySeconds = 0): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // Allow empty message bodies (empty string is valid) - only check for null/undefined
    if (messageBody === null || messageBody === undefined) {
      throw new Error("SQS sendMessage requires message content");
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        DelaySeconds: delaySeconds,
      });

      const response = await this.client.send(command);
      return response.MessageId || `message-id-${Date.now()}`;
    } catch (error) {
      throw new Error(
        `Failed to send message to queue ${this.queueUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Receive messages from the SQS queue
   *
   * @param maxMessages - Maximum number of messages to retrieve (default: 1)
   * @param waitTimeSeconds - Time to wait for messages (default: 0)
   * @returns Array of received messages
   * @throws Error if receiving fails or client is not initialized
   */
  async receiveMessages(maxMessages = 1, waitTimeSeconds = 0): Promise<SqsMessage[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: waitTimeSeconds,
      });

      const response = await this.client.send(command);

      if (!response.Messages || response.Messages.length === 0) {
        return [];
      }

      return response.Messages.map((message) => ({
        messageId: message.MessageId || "",
        body: message.Body || "",
        receiptHandle: message.ReceiptHandle || "",
        attributes: message.MessageAttributes || {},
      }));
    } catch (error) {
      throw new Error(
        `Failed to receive messages from queue ${this.queueUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a message from the SQS queue
   *
   * @param receiptHandle - Receipt handle of the message to delete
   * @throws Error if deletion fails or client is not initialized
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!receiptHandle) {
      throw new Error("SQS deleteMessage requires a receipt handle");
    }

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(
        `Failed to delete message from queue ${this.queueUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Purge all messages from the SQS queue
   *
   * @throws Error if purge operation fails or client is not initialized
   */
  async purgeQueue(): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    try {
      const command = new PurgeQueueCommand({
        QueueUrl: this.queueUrl,
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(
        `Failed to purge queue ${this.queueUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Client-specific cleanup logic
   * Releases AWS SQS client resources
   */
  async cleanupClient(): Promise<void> {
    // SQS client doesn't need explicit cleanup beyond nullifying the reference
    this.client = null;
  }
}
