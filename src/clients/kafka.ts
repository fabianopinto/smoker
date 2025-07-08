/**
 * Kafka client for Apache Kafka operations
 */
import { type Consumer, Kafka, logLevel, type Producer } from "kafkajs";
import { BaseServiceClient, type ServiceClient } from "./clients";

/**
 * Interface for Kafka record metadata
 */
export interface KafkaRecordMetadata {
  topic: string;
  partition: number;
  offset: string;
  timestamp: number;
}

/**
 * Interface for Kafka message
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
 */
export interface KafkaServiceClient extends ServiceClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(topic: string, message: string, key?: string): Promise<KafkaRecordMetadata>;
  subscribe(topics: string | string[], groupId: string): Promise<void>;
  consumeMessages(
    callback: (message: KafkaMessage) => Promise<void>,
    timeoutMs?: number,
  ): Promise<void>;
  waitForMessage(
    matcher: (message: KafkaMessage) => boolean,
    timeoutMs?: number,
  ): Promise<KafkaMessage | null>;
}

/**
 * Kafka client implementation for Apache Kafka operations
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
   */
  constructor() {
    super("KafkaClient");
  }

  /**
   * Initialize the client
   */
  protected async initializeClient(): Promise<void> {
    this.brokers = this.getConfig<string[]>("brokers", []);
    this.clientId = this.getConfig<string>("clientId", "smoke-test-client");
    this.topics = this.getConfig<string[]>("topics", []);
    this.groupId = this.getConfig<string>("groupId", "smoke-test-group");

    if (this.brokers.length === 0) {
      throw new Error("Kafka brokers are required");
    }

    if (this.topics.length === 0) {
      throw new Error("Kafka topics are required");
    }

    try {
      // Create Kafka client
      this.client = new Kafka({
        clientId: this.clientId,
        brokers: this.brokers,
        logLevel: logLevel.ERROR,
      });

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
      throw new Error(
        `Failed to initialize Kafka client: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    this.ensureInitialized();
    // Connection is handled in initializeClient
  }

  /**
   * Disconnect from Kafka
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
      console.warn(
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
   * @param topic The topic name
   * @param message The message content
   * @param key Optional message key
   * @returns Record metadata if successful
   */
  async sendMessage(topic: string, message: string, key?: string): Promise<KafkaRecordMetadata> {
    this.ensureInitialized();
    this.assertNotNull(this.producer);

    const result = await this.producer.send({
      topic,
      messages: [
        {
          value: message,
          key,
        },
      ],
    });

    if (!result || result.length === 0) {
      throw new Error(`Failed to send message to topic ${topic}`);
    }

    const recordInfo = result[0];
    return {
      topic: recordInfo.topicName,
      partition: recordInfo.partition,
      offset: String(recordInfo.baseOffset),
      timestamp:
        typeof recordInfo.timestamp === "string"
          ? parseInt(recordInfo.timestamp, 10)
          : Number(recordInfo.timestamp),
    };
  }

  /**
   * Subscribe to topics
   * @param topics Topic or topics to subscribe to
   * @param groupId Consumer group ID
   */
  async subscribe(topics: string | string[], groupId: string): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.consumer);

    const topicsArray = Array.isArray(topics) ? topics : [topics];

    for (const topic of topicsArray) {
      await this.consumer.subscribe({ topic });
    }

    // Update group ID if different from the one used during initialization
    if (groupId !== this.groupId) {
      this.groupId = groupId;
    }
  }

  /**
   * Consume messages from Kafka topic(s)
   * @param callback Function to process received messages
   * @param timeoutMs How long to consume messages in milliseconds
   */
  async consumeMessages(
    callback: (message: KafkaMessage) => Promise<void>,
    timeoutMs?: number,
  ): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.consumer);

    // Set up a consumer to process messages
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (message.value) {
          const timestamp = message.timestamp
            ? typeof message.timestamp === "string"
              ? parseInt(message.timestamp, 10)
              : Number(message.timestamp)
            : Date.now();

          const headers: Record<string, string | Buffer> = {};
          if (message.headers) {
            for (const [key, value] of Object.entries(message.headers)) {
              if (value !== undefined) {
                headers[key] =
                  typeof value === "string"
                    ? value
                    : Buffer.from(value instanceof Buffer ? value : String(value));
              }
            }
          }

          await callback({
            topic,
            partition,
            offset: String(message.offset),
            key: message.key ? message.key.toString() : undefined,
            value: message.value.toString(),
            timestamp,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
          });
        }
      },
    });

    // If timeout is specified, stop consuming after that time
    if (timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, timeoutMs));
      await this.consumer.stop();
    }
  }

  /**
   * Wait for a specific message in Kafka
   * @param matcher Function to match desired message
   * @param timeoutMs Timeout in milliseconds (default: 30000)
   * @returns The matched message or null if timeout
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
      if (!this.client) {
        resolve(null);
        return;
      }

      const tempConsumer = this.client.consumer({ groupId: tempGroupId });

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
              const timestamp = message.timestamp
                ? typeof message.timestamp === "string"
                  ? parseInt(message.timestamp, 10)
                  : Number(message.timestamp)
                : Date.now();

              const headers: Record<string, string | Buffer> = {};
              if (message.headers) {
                for (const [key, value] of Object.entries(message.headers)) {
                  if (value !== undefined) {
                    headers[key] =
                      typeof value === "string"
                        ? value
                        : Buffer.from(value instanceof Buffer ? value : String(value));
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

              // If message matches criteria, resolve the promise
              if (matcher(kafkaMsg)) {
                await tempConsumer.stop();
                resolve(kafkaMsg);
              }
            },
          });
        })
        .catch((err) => {
          console.error(`Error in waitForMessage: ${err}`);
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
   * Client-specific destroy logic
   */
  protected async destroyClient(): Promise<void> {
    try {
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      if (this.producer) {
        await this.producer.disconnect();
      }
    } catch (error) {
      console.warn(
        `Error disconnecting Kafka client: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.consumer = null;
      this.producer = null;
      this.client = null;
    }
  }
}
