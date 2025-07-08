/**
 * SQS client for AWS SQS queue operations
 */
import {
  SQSClient as AwsSqsClient,
  DeleteMessageCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { BaseServiceClient } from "./clients";

/**
 * Interface for SQS client operations
 */
export interface SqsServiceClient {
  sendMessage(messageBody: string, delaySeconds?: number): Promise<string>;
  receiveMessages(maxMessages?: number, waitTimeSeconds?: number): Promise<SqsMessage[]>;
  deleteMessage(receiptHandle: string): Promise<void>;
  purgeQueue(): Promise<void>;
}

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
 * SQS client implementation for AWS SQS queue operations
 */
export class SqsClient extends BaseServiceClient implements SqsServiceClient {
  private client: AwsSqsClient | null = null;
  private queueUrl = "";

  /**
   * Create a new SQS client
   */
  constructor() {
    super("SqsClient");
  }

  /**
   * Initialize the client
   */
  protected async initializeClient(): Promise<void> {
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
  }

  /**
   * Send a message to the SQS queue
   * @param messageBody Message content
   * @param delaySeconds Delay delivery in seconds (default: 0)
   * @returns Message ID
   */
  async sendMessage(messageBody: string, delaySeconds = 0): Promise<string> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: messageBody,
      DelaySeconds: delaySeconds,
    });

    const response = await this.client.send(command);
    return response.MessageId || `message-id-${Date.now()}`;
  }

  /**
   * Receive messages from the SQS queue
   * @param maxMessages Maximum number of messages to retrieve (default: 1)
   * @param waitTimeSeconds Time to wait for messages (default: 0)
   * @returns Array of received messages
   */
  async receiveMessages(maxMessages = 1, waitTimeSeconds = 0): Promise<SqsMessage[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

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
  }

  /**
   * Delete a message from the SQS queue
   * @param receiptHandle Receipt handle of the message to delete
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await this.client.send(command);
  }

  /**
   * Purge all messages from the SQS queue
   */
  async purgeQueue(): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    const command = new PurgeQueueCommand({
      QueueUrl: this.queueUrl,
    });

    await this.client.send(command);
  }
}
