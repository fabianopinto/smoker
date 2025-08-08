/**
 * SQS Client Module
 *
 * This module provides interfaces and implementations for AWS SQS service clients.
 * It defines the contract for SQS operations such as sending, receiving, and deleting
 * messages from queues. The implementation uses the AWS SDK to interact with SQS.
 *
 * The module includes functionality to interact with Amazon SQS message queues,
 * supporting operations like sending messages to queues, receiving messages from queues,
 * deleting messages after processing, and purging queues when needed.
 */

import {
  SQSClient as AwsSqsClient,
  DeleteMessageCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { ERR_VALIDATION, SmokerError } from "../../errors";
import { BaseServiceClient, type ServiceClient } from "../core";

/**
 * Message structure returned from SQS
 *
 * Represents a message received from an AWS SQS queue. Contains the message content,
 * unique identifiers, receipt handle for deletion, and any additional attributes
 * provided by the SQS service.
 *
 * This interface provides a consistent structure for working with SQS messages
 * across the application, making it easier to process message data and manage
 * message lifecycle operations like deletion.
 *
 * @property messageId - Unique identifier assigned by SQS to the message
 * @property body - The message content/payload as a string
 * @property receiptHandle - The receipt handle required to delete the message
 * @property attributes - Additional message attributes as key-value pairs
 */
export interface SqsMessage {
  messageId: string;
  body: string;
  receiptHandle: string;
  attributes: Record<string, unknown>;
}

/**
 * Interface for SQS service client
 *
 * Defines the contract for interacting with AWS Simple Queue Service (SQS),
 * providing methods to send, receive, and delete messages from SQS queues.
 * Extends the base ServiceClient interface to ensure consistent lifecycle management.
 *
 * This interface provides a comprehensive API for working with SQS queues,
 * including support for delayed message delivery, long polling for message
 * reception, and queue management operations like purging. Implementations
 * handle the details of AWS SDK interactions while providing a simplified API
 * for queue operations.
 *
 * @extends {ServiceClient}
 * @see {ServiceClient} The base service client interface
 */
export interface SqsServiceClient extends ServiceClient {
  /**
   * Send a message to the SQS queue
   *
   * @param messageBody - Message content
   * @param delaySeconds - Delay delivery in seconds (default: 0)
   * @return Message ID
   * @throws {SmokerError} if sending fails
   */
  sendMessage(messageBody: string, delaySeconds?: number): Promise<string>;

  /**
   * Receive messages from the SQS queue
   *
   * @param maxMessages - Maximum number of messages to retrieve (default: 1)
   * @param waitTimeSeconds - Time to wait for messages (default: 0)
   * @return Array of received messages
   * @throws {SmokerError} if receiving fails
   */
  receiveMessages(maxMessages?: number, waitTimeSeconds?: number): Promise<SqsMessage[]>;

  /**
   * Delete a message from the SQS queue
   *
   * @param receiptHandle - Receipt handle of the message to delete
   * @throws {SmokerError} if deletion fails
   */
  deleteMessage(receiptHandle: string): Promise<void>;

  /**
   * Purge all messages from the SQS queue
   *
   * @throws {SmokerError} if purge operation fails
   */
  purgeQueue(): Promise<void>;
}

/**
 * SQS client implementation for AWS SQS queue operations
 *
 * This class provides methods to interact with AWS SQS message queues,
 * including sending, receiving, and deleting messages, as well as purging
 * queues. It implements the SqsServiceClient interface and extends
 * BaseServiceClient for consistent lifecycle management.
 *
 * The client handles AWS SDK initialization, authentication, and provides a
 * simplified API for common SQS operations. It supports features like delayed
 * message delivery, long polling for message reception, and proper error
 * handling with detailed error messages.
 *
 * @implements {SqsServiceClient}
 * @extends {BaseServiceClient}
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
   * @throws {SmokerError} if queueUrl is not provided or client creation fails
   */
  protected async initializeClient(): Promise<void> {
    try {
      const region = this.getConfig<string>("region", "us-east-1");
      this.queueUrl = this.getConfig<string>("queueUrl", "");

      if (!this.queueUrl) {
        throw new SmokerError("SQS queue URL is required", {
          code: ERR_VALIDATION,
          domain: "aws",
          details: { component: "sqs" },
          retryable: false,
        });
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
      throw new SmokerError(
        `Failed to initialize SQS client: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "sqs",
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Send a message to the SQS queue
   *
   * @param messageBody - Message content
   * @param delaySeconds - Delay delivery in seconds (default: 0)
   * @return Message ID
   * @throws {SmokerError} if sending fails or client is not initialized
   */
  async sendMessage(messageBody: string, delaySeconds = 0): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // Allow empty message bodies (empty string is valid) - only check for null/undefined
    if (messageBody === null || messageBody === undefined) {
      throw new SmokerError("SQS sendMessage requires message content", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: { component: "sqs", queueUrl: this.queueUrl },
        retryable: false,
      });
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
      throw new SmokerError(
        `Failed to send message to queue ${this.queueUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "sqs",
            queueUrl: this.queueUrl,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Receive messages from the SQS queue
   *
   * @param maxMessages - Maximum number of messages to retrieve (default: 1)
   * @param waitTimeSeconds - Time to wait for messages (default: 0)
   * @return Array of received messages
   * @throws {SmokerError} if receiving fails or client is not initialized
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
      throw new SmokerError(
        `Failed to receive messages from queue ${this.queueUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "sqs",
            queueUrl: this.queueUrl,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Delete a message from the SQS queue
   *
   * @param receiptHandle - Receipt handle of the message to delete
   * @throws {SmokerError} if deletion fails or client is not initialized
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!receiptHandle) {
      throw new SmokerError("SQS deleteMessage requires a receipt handle", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: { component: "sqs", queueUrl: this.queueUrl },
        retryable: false,
      });
    }

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.client.send(command);
    } catch (error) {
      throw new SmokerError(
        `Failed to delete message from queue ${this.queueUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "sqs",
            queueUrl: this.queueUrl,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Purge all messages from the SQS queue
   *
   * @throws {SmokerError} if purge operation fails or client is not initialized
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
      throw new SmokerError(
        `Failed to purge queue ${this.queueUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_VALIDATION,
          domain: "aws",
          details: {
            component: "sqs",
            queueUrl: this.queueUrl,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
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
