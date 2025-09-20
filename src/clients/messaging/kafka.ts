/**
 * @fileoverview Kafka Client Module
 *
 * This module provides interfaces and implementations for Apache Kafka service clients.
 * It defines the contract for Kafka operations such as connecting to brokers,
 * publishing messages, subscribing to topics, and consuming messages.
 *
 * The module includes functionality to interact with Apache Kafka message brokers,
 * supporting operations like producing messages to topics, consuming messages from topics,
 * and managing consumer groups for distributed message processing.
 */

import { BaseLogger } from "@fabianopinto/logger";
import { type Consumer, Kafka, type KafkaConfig, logLevel, type Producer } from "kafkajs";
import {
  ERR_KAFKA_CONNECT,
  ERR_KAFKA_CONSUMER,
  ERR_KAFKA_PRODUCER,
  KafkaConnectionError,
  SmokerError,
} from "../../errors";
import { BaseServiceClient, type ServiceClient } from "../core";

// Create a logger instance for this module
const logger = new BaseLogger({ name: "smoker:kafka" });

/**
 * Interface for Kafka record metadata
 *
 * Represents metadata about a record that was successfully written to a Kafka topic.
 * Contains information about the destination topic, partition assignment, offset
 * position, and timestamp of the record.
 *
 * This interface provides a consistent structure for tracking published messages
 * and their placement within the Kafka broker, which is useful for monitoring,
 * debugging, and implementing exactly-once delivery semantics.
 *
 * @property {string} topic - The Kafka topic the record was written to
 * @property {number} partition - The partition number within the topic
 * @property {string} [offset] - Optional offset position within the partition (may be undefined until confirmed)
 * @property {number} timestamp - The timestamp (in milliseconds) associated with the record
 */
export interface KafkaRecordMetadata {
  topic: string;
  partition: number;
  offset?: string;
  timestamp: number;
}

/**
 * Interface for Kafka message
 *
 * Represents a message received from a Kafka topic. Contains the message content,
 * optional key for partitioning, headers for metadata, and information about the
 * topic, partition, and offset where the message was stored.
 *
 * This interface provides a consistent structure for working with Kafka messages
 * across the application, making it easier to process message data and track
 * message position within the Kafka log for consumer offset management.
 *
 * @property {string | Buffer} [key] - Optional message key used for partitioning or identification
 * @property {string} value - The message content/payload as a string
 * @property {Record<string, string | Buffer>} [headers] - Metadata headers associated with the message
 * @property {number} [partition] - Optional partition number from which the message was consumed
 * @property {number} [timestamp] - Optional timestamp (in milliseconds) when the message was created
 * @property {string} topic - The Kafka topic from which the message was consumed
 * @property {string} offset - The offset position within the partition
 */
export interface KafkaMessage {
  key?: string | Buffer;
  value: string;
  headers?: Record<string, string | Buffer>;
  partition?: number;
  timestamp?: number;
  topic: string;
  offset: string;
}

/**
 * Interface for Kafka service client
 *
 * Defines the contract for interacting with Apache Kafka message brokers,
 * providing methods to connect to brokers, publish messages to topics,
 * subscribe to topics, and consume messages. Extends the base ServiceClient
 * interface to ensure consistent lifecycle management.
 *
 * This interface provides a comprehensive API for working with Kafka messaging,
 * including support for message key-based routing, consumer group management,
 * asynchronous message consumption with callbacks, and utilities for waiting
 * for specific messages to appear in topics. Implementations handle the details
 * of broker interactions while providing a simplified API.
 *
 * @extends {ServiceClient} The base service client interface
 */
export interface KafkaServiceClient extends ServiceClient {
  /**
   * Clean up resources used by the client
   */
  cleanupClient(): Promise<void>;

  /**
   * Connect to the Kafka broker
   *
   * @returns {Promise<void>} Promise that resolves when connection is established
   * @throws {AppError} if connection fails
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the Kafka broker
   *
   * @returns {Promise<void>} Promise that resolves when disconnected
   */
  disconnect(): Promise<void>;

  /**
   * Send a message to a Kafka topic
   *
   * @param {string} topic - The topic name to publish to
   * @param {string} message - The message content
   * @param {string} [key] - Optional message key for partitioning
   * @returns {Promise<KafkaRecordMetadata>} Promise that resolves with record metadata if successful
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if message sending fails
   */
  sendMessage(topic: string, message: string, key?: string): Promise<KafkaRecordMetadata>;

  /**
   * Subscribe to one or more Kafka topics
   *
   * @param {string | string[]} topics - Topic or array of topics to subscribe to
   * @param {string} groupId - Consumer group ID
   * @returns {Promise<void>} Promise that resolves when subscription is complete
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if subscription fails
   */
  subscribe(topics: string | string[], groupId: string): Promise<void>;

  /**
   * Consume messages from subscribed Kafka topics
   *
   * @param { (message: KafkaMessage) => Promise<void> } callback - Function to process received messages
   * @param {number} [timeoutMs] - Optional timeout in milliseconds
   * @returns {Promise<void>} Promise that resolves when consumption ends or times out
   * @throws {AppError} if message consumption fails
   */
  consumeMessages(
    callback: (message: KafkaMessage) => Promise<void>,
    timeoutMs?: number,
  ): Promise<void>;

  /**
   * Wait for a specific message that matches criteria
   *
   * @param { (message: KafkaMessage) => boolean } matcher - Function to match the desired message
   * @param {number} [timeoutMs] - Timeout in milliseconds (default: 30000)
   * @returns {Promise<KafkaMessage | null>} Promise that resolves with matched message, or null if timeout
   * @throws {AppError} if waiting fails
   */
  waitForMessage(
    matcher: (message: KafkaMessage) => boolean,
    timeoutMs?: number,
  ): Promise<KafkaMessage | null>;
}

/**
 * Kafka client implementation for Apache Kafka operations
 *
 * This class provides methods to interact with Apache Kafka message brokers,
 * including connecting to brokers, publishing messages to topics, subscribing
 * to topics, and consuming messages. It implements the KafkaServiceClient
 * interface and extends BaseServiceClient for consistent lifecycle management.
 *
 * The client handles Kafka connection initialization, producer and consumer
 * setup, and provides a simplified API for common Kafka operations. It supports
 * features like message key-based routing, consumer group management, and
 * proper error handling with detailed error messages.
 *
 * @extends {BaseServiceClient} The base service client class
 * @implements {KafkaServiceClient} The Kafka service client interface
 */
export class KafkaClient extends BaseServiceClient implements KafkaServiceClient {
  private client: Kafka | null = null;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private brokers: string[] = [];
  private clientId = "";
  private topics: string[] = [];
  private groupId = "";

  /**
   * Create a new Kafka client
   *
   * @param {string} [clientId="KafkaClient"] - Client identifier (defaults to "KafkaClient")
   * @param {Record<string, unknown>} [config] - Optional client configuration with properties:
   *   - brokers: Array of Kafka broker addresses
   *   - topics: Array of topics to subscribe to
   *   - groupId: Consumer group ID
   *   - clientId: Specific client ID for Kafka connection
   */
  constructor(clientId = "KafkaClient", config?: Record<string, unknown>) {
    super(clientId, config);
  }

  /**
   * Initialize the client
   *
   * @throws {ValidationError} if required configuration is missing
   * @throws {AppError} if initialization fails
   */
  protected async initializeClient(): Promise<void> {
    this.brokers = this.getConfig<string[]>("brokers", []);
    this.clientId = this.getConfig<string>("clientId", "smoke-test-client");
    this.topics = this.getConfig<string[]>("topics", []);
    this.groupId = this.getConfig<string>("groupId", "smoke-test-group");

    if (this.brokers.length === 0) {
      throw new SmokerError("Kafka brokers must be provided", {
        code: ERR_KAFKA_CONNECT,
        domain: "messaging",
        details: { component: "kafka" },
        retryable: false,
      });
    }

    if (this.topics.length === 0) {
      throw new SmokerError("Kafka topics must be provided", {
        code: ERR_KAFKA_CONSUMER,
        domain: "messaging",
        details: { component: "kafka" },
        retryable: false,
      });
    }

    try {
      // Create Kafka client with base configuration
      const kafkaConfig: KafkaConfig = {
        clientId: this.clientId,
        brokers: this.brokers,
      };

      // Only include ssl if explicitly provided in config
      const sslConfig = this.getConfig<boolean | undefined>("ssl", undefined);
      if (sslConfig !== undefined) {
        kafkaConfig.ssl = sslConfig;
      } else {
        // Only add logLevel if ssl is not explicitly provided
        kafkaConfig.logLevel = logLevel.ERROR;
      }

      this.client = new Kafka(kafkaConfig);

      // Initialize producer
      this.producer = this.client.producer();
      await this.producer.connect();

      // Initialize consumer
      this.consumer = this.client.consumer({ groupId: this.groupId });
      await this.consumer.connect();

      // Subscribe to topics
      for (const topic of this.topics) {
        await this.consumer.subscribe({ topic });
      }
    } catch (error) {
      // Structured error log (keeps existing behavior unchanged)
      const errObj = KafkaConnectionError.connecting(this.brokers);
      logger.error(
        errObj,
        `Failed to initialize Kafka client: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new SmokerError(
        `Failed to initialize Kafka client: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: ERR_KAFKA_CONNECT,
          domain: "messaging",
          details: {
            component: "kafka",
            brokers: this.brokers,
            reason: error instanceof Error ? error.message : String(error),
          },
          retryable: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Connect to Kafka
   *
   * @returns {Promise<void>} Promise that resolves when connection is established
   */
  async connect(): Promise<void> {
    this.ensureInitialized();
    // Connection is handled in initializeClient
  }

  /**
   * Disconnect from Kafka
   *
   * @returns {Promise<void>} Promise that resolves when disconnected
   */
  async disconnect(): Promise<void> {
    this.ensureInitialized();

    try {
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      if (this.producer) {
        await this.producer.disconnect();
      }
    } catch (error) {
      logger.warn(
        `Error disconnecting Kafka client: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.consumer = null;
      this.producer = null;
      this.client = null;
    }
  }

  /**
   * Send a message to a Kafka topic
   *
   * @param {string} topic - The topic name
   * @param {string} message - The message content
   * @param {string} [key] - Optional message key
   * @returns {Promise<KafkaRecordMetadata>} Promise that resolves with record metadata if successful
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if sending fails or client is not initialized
   */
  async sendMessage(topic: string, message: string, key?: string): Promise<KafkaRecordMetadata> {
    this.ensureInitialized();
    this.assertNotNull(this.producer);

    if (!topic) {
      throw new SmokerError("Kafka topic is required for sending a message", {
        code: ERR_KAFKA_PRODUCER,
        domain: "messaging",
        details: { component: "kafka" },
        retryable: false,
      });
    }

    try {
      const result = await this.producer.send({
        topic,
        messages: [
          {
            value: message,
            key: key || undefined,
          },
        ],
      });

      // KafkaJS returns an array with one result per topic-partition
      // Since we're only sending to one topic, we can get the first result
      const metadata = result[0];

      return {
        topic: metadata.topicName,
        partition: metadata.partition,
        offset: metadata.baseOffset || String(Date.now()),
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new SmokerError("Failed to send Kafka message", {
        code: ERR_KAFKA_PRODUCER,
        domain: "messaging",
        details: {
          component: "kafka",
          topic,
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Subscribe to topics
   *
   * @param {string | string[]} topics - Topic or topics to subscribe to
   * @param {string} groupId - Consumer group ID
   * @returns {Promise<void>} Promise that resolves when subscription is complete
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if subscription fails or client is not initialized
   */
  async subscribe(topics: string | string[], groupId: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // Normalize topics once for use across try/catch
    const topicsArray = Array.isArray(topics) ? topics : [topics];

    try {
      // Create a new consumer with the given group ID

      if (topicsArray.length === 0) {
        throw new SmokerError("At least one Kafka topic is required for subscription", {
          code: ERR_KAFKA_CONSUMER,
          domain: "messaging",
          details: { component: "kafka" },
          retryable: false,
        });
      }

      // If the consumer is already initialized with a different group ID,
      // disconnect and create a new one with the new group ID
      if (this.consumer && this.groupId !== groupId) {
        await this.consumer.disconnect();
        this.consumer = this.client.consumer({ groupId });
        await this.consumer.connect();
      } else if (!this.consumer) {
        // Initialize consumer if it doesn't exist yet
        this.consumer = this.client.consumer({ groupId });
        await this.consumer.connect();
      }

      // Subscribe to each topic
      for (const topic of topicsArray) {
        await this.consumer.subscribe({ topic });
      }

      this.topics = [...new Set([...this.topics, ...topicsArray])];
      this.groupId = groupId;
    } catch (error) {
      throw new SmokerError("Failed to subscribe to Kafka topics", {
        code: ERR_KAFKA_CONSUMER,
        domain: "messaging",
        details: {
          component: "kafka",
          topics: topicsArray,
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Consume messages from Kafka topic(s)
   *
   * @param { (message: KafkaMessage) => Promise<void> } callback - Function to process received messages
   * @param {number} [timeoutMs] - How long to consume messages in milliseconds
   * @returns {Promise<void>} Promise that resolves when consumption ends
   * @throws {AppError} if consumption fails or client is not initialized
   */
  async consumeMessages(
    callback: (message: KafkaMessage) => Promise<void>,
    timeoutMs?: number,
  ): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.consumer);

    try {
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          // Check if message value exists
          if (!message.value) return;

          // Note: We're intentionally allowing empty buffers to be processed
          // to support the test case for handling empty message values

          // Convert Kafka message to our KafkaMessage type
          const timestamp = this.parseMessageTimestamp(message.timestamp);

          const headers: Record<string, string | Buffer> = {};
          if (message.headers) {
            for (const [key, value] of Object.entries(message.headers)) {
              if (value !== undefined) {
                headers[key] = this.parseHeaderValue(value);
              }
            }
          }

          const kafkaMsg: KafkaMessage = {
            topic,
            partition,
            offset: String(message.offset),
            key: message.key ? message.key.toString() : undefined,
            value: message.value.toString(),
            timestamp,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
          };

          await callback(kafkaMsg);
        },
      });

      // If a timeout is specified, stop consuming after the timeout
      if (timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        await this.consumer.stop();
      }
    } catch (error) {
      throw new SmokerError("Failed to consume Kafka messages", {
        code: ERR_KAFKA_CONSUMER,
        domain: "messaging",
        details: {
          component: "kafka",
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Wait for a specific message in Kafka
   *
   * @param { (message: KafkaMessage) => boolean } matcher - Function to match desired message
   * @param {number} [timeoutMs] - Timeout in milliseconds (default: 30000)
   * @returns {Promise<KafkaMessage | null>} The matched message or null if timeout
   * @throws {AppError} if waiting fails or client is not initialized
   */
  async waitForMessage(
    matcher: (message: KafkaMessage) => boolean,
    timeoutMs = 30000,
  ): Promise<KafkaMessage | null> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // Create promises for message matching and timeout
    const messagePromise = new Promise<KafkaMessage | null>((resolve) => {
      // Create a temporary consumer with a unique group ID
      const tempGroupId = `${this.groupId}-waiter-${Date.now()}`;
      if (!this.isKafkaClientAvailable()) {
        resolve(null);
        return;
      }

      const tempClient = this.client;
      // We've already checked that client is not null above
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const tempConsumer = tempClient!.consumer({ groupId: tempGroupId });

      // Connect the temporary consumer
      tempConsumer
        .connect()
        .then(() => {
          // Subscribe to all configured topics
          return Promise.all(this.topics.map((topic) => tempConsumer.subscribe({ topic })));
        })
        .then(() => {
          // Run the consumer
          return tempConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
              if (!message.value) return;

              // Convert Kafka message to our KafkaMessage type
              const timestamp = this.parseMessageTimestamp(message.timestamp);

              const headers: Record<string, string | Buffer> = {};
              if (message.headers) {
                for (const [key, value] of Object.entries(message.headers)) {
                  if (value !== undefined) {
                    headers[key] = this.parseHeaderValue(value);
                  }
                }
              }

              const kafkaMsg: KafkaMessage = {
                topic,
                partition,
                offset: String(message.offset),
                key: this.parseMessageKey(message.key),
                value: message.value.toString(),
                timestamp,
                headers: Object.keys(headers).length > 0 ? headers : undefined,
              };

              // If message matches criteria, resolve the promise
              if (matcher(kafkaMsg)) {
                await tempConsumer.stop();
                resolve(kafkaMsg);
              }
            },
          });
        })
        .catch((error) => {
          logger.error(`Error in waitForMessage: ${error}`);
          resolve(null);
        });
    });

    // Create a promise that resolves after timeout
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });

    // Wait for either the message or timeout
    return Promise.race([messagePromise, timeoutPromise]);
  }

  /**
   * Parse message timestamp to a numeric value
   *
   * @param {string | number} timestamp - The timestamp from the Kafka message
   * @returns {number} Numeric timestamp value
   */
  parseMessageTimestamp(timestamp?: string | number): number {
    if (!timestamp) {
      return Date.now();
    }

    if (typeof timestamp === "string") {
      return parseInt(timestamp, 10);
    }

    return Number(timestamp);
  }

  /**
   * Parse header value to either string or Buffer
   *
   * @param {unknown} value - The header value to parse
   * @returns {string | Buffer} String or Buffer representation of the value
   */
  parseHeaderValue(value: unknown): string | Buffer {
    if (typeof value === "string") {
      return value;
    }

    if (value instanceof Buffer) {
      return value;
    }

    return Buffer.from(String(value));
  }

  /**
   * Format error message from various error types
   *
   * @param {unknown} error - The error object
   * @returns {string} Formatted error message string
   */
  formatErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Determine if a message should be processed
   *
   * @param {Buffer | null | undefined} value - The message value
   * @returns {boolean} True if the message should be processed, false otherwise
   */
  shouldProcessMessage(value: Buffer | null | undefined): boolean {
    return value !== null && value !== undefined && value.length > 0;
  }

  /**
   * Check if the Kafka client is available
   *
   * @returns {boolean} True if the client is available, false otherwise
   */
  isKafkaClientAvailable(): boolean {
    return this.client !== null && this.client !== undefined;
  }

  /**
   * Parse message key to string or undefined
   *
   * @param {Buffer | null | undefined} [key] - The message key
   * @returns {string | undefined} String representation of key or undefined
   */
  parseMessageKey(key?: Buffer | null): string | undefined {
    if (!key) {
      return undefined;
    }

    if (Buffer.isBuffer(key)) {
      return key.toString();
    }

    return String(key);
  }

  /**
   * Client-specific cleanup logic
   *
   * @returns {Promise<void>} Promise that resolves when cleanup is complete
   */
  async cleanupClient(): Promise<void> {
    try {
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      if (this.producer) {
        await this.producer.disconnect();
      }
    } catch (error) {
      logger.warn(`Error disconnecting Kafka client: ${this.formatErrorMessage(error)}`);
    } finally {
      this.consumer = null;
      this.producer = null;
      this.client = null;
    }
  }
}
