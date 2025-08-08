/**
 * Kafka Client Tests
 *
 * This test suite verifies the KafkaClient implementation using vitest mocks
 * to simulate Kafka service interactions and verify client behavior.
 *
 * Test coverage includes:
 * - Constructor initialization and configuration validation
 * - Client initialization with Kafka connection setup
 * - Producer functionality (send messages, batch operations)
 * - Consumer functionality (subscribe, consume messages, commit offsets)
 * - Message parsing and key handling utilities
 * - Error handling for connection and operation failures
 * - Client cleanup and resource management
 */

import {
  type Consumer,
  type EachMessageHandler,
  type EachMessagePayload,
  Kafka,
  type Producer,
} from "kafkajs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KafkaClient } from "../../../src/clients/messaging/kafka";
import {
  ERR_KAFKA_CONNECT,
  ERR_KAFKA_CONSUMER,
  ERR_KAFKA_PRODUCER,
  ERR_VALIDATION,
  SmokerError,
} from "../../../src/errors";
import { BaseLogger } from "../../../src/lib/logger";

/**
 * Mock Kafka library for unit testing
 */
vi.mock("kafkajs");
const MockedKafka = vi.mocked(Kafka);

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client and broker configuration
  CLIENT_ID: "test-kafka-client",
  GROUP_ID: "test-group",
  TOPIC: "test-topic",
  DEFAULT_CLIENT_ID: "KafkaClient",

  // Test data
  MESSAGE_BODY: "Hello Kafka",
  MESSAGE_KEY: "test-key",
  MESSAGE_PARTITION: 0,
  MESSAGE_OFFSET: "123",
  MESSAGE_TIMESTAMP: 1640995200000,
  TARGET_MESSAGE: "target-message",

  // Additional test scenarios
  ADDITIONAL_TOPICS: ["topic1", "topic2"],
  MULTI_GROUP_ID: "multi-group",

  // Error messages
  ERROR_EMPTY_TOPICS: "At least one topic is required for subscription",
  ERROR_EMPTY_TOPIC: "Topic is required for sending a message",

  // Error message functions
  ERROR_NOT_INITIALIZED: (clientName: string) =>
    `${clientName} is not initialized. Call init() first`,
  ERROR_SEND_FAILED: (topic: string) => `Failed to send message to topic ${topic}`,

  // Configuration objects
  CONFIG_BASIC: {
    brokers: ["localhost:9092"],
    clientId: "test-kafka-client",
    topics: ["test-topic"],
    groupId: "test-group",
  },

  CONFIG_MINIMAL: {
    brokers: ["localhost:9092"],
    topics: ["test-topic"],
    groupId: "test-group",
  },

  CONFIG_MULTI_BROKER: {
    brokers: ["localhost:9092", "localhost:9093", "localhost:9094"],
    clientId: "multi-broker-client",
    topics: ["topic1", "topic2"],
    groupId: "multi-group",
  },
};

/**
 * Type definitions for test helpers
 */
type MessageHandler = (params: {
  topic: string;
  partition: number;
  message: unknown;
}) => Promise<void>;

/**
 * Interface for accessing private properties of KafkaClient in tests
 */
interface KafkaClientTest {
  topics: string[];
  groupId: string;
}

/**
 * Creates a mock Kafka instance for testing
 *
 * @returns Partial Kafka implementation with mocked methods
 */
function createMockKafka(): Partial<Kafka> {
  return {
    producer: vi.fn(),
    consumer: vi.fn(),
  };
}

/**
 * Creates a mock Kafka Producer for testing
 *
 * @returns Partial Producer implementation with mocked methods
 */
function createMockProducer(): Partial<Producer> {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
  };
}

/**
 * Creates a mock Kafka Consumer for testing
 *
 * @returns Partial Consumer implementation with mocked methods
 */
function createMockConsumer(): Partial<Consumer> {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    run: vi.fn(),
    stop: vi.fn(),
  };
}

/**
 * Tests for the KafkaClient class
 */
describe("KafkaClient", () => {
  let kafkaClient: KafkaClient;
  let mockKafka: Partial<Kafka>;
  let mockProducer: Partial<Producer>;
  let mockConsumer: Partial<Consumer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKafka = createMockKafka();
    mockProducer = createMockProducer();
    mockConsumer = createMockConsumer();

    // Ensure mock functions are defined before mocking them
    if (mockKafka.producer) {
      vi.mocked(mockKafka.producer).mockReturnValue(mockProducer as Producer);
    }
    if (mockKafka.consumer) {
      vi.mocked(mockKafka.consumer).mockReturnValue(mockConsumer as Consumer);
    }
    MockedKafka.mockReturnValue(mockKafka as Kafka);

    // Initialize kafkaClient instance
    kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
  });

  /**
   * Returns the mock Kafka instance
   *
   * @returns The mock Kafka instance
   */
  function getMockKafka(): Kafka {
    if (!mockKafka) throw new Error("Mock Kafka not initialized");
    return mockKafka as Kafka;
  }

  /**
   * Returns the mock Producer instance
   *
   * @returns The mock Producer instance
   */
  function getMockProducer(): Producer {
    if (!mockProducer) throw new Error("Mock Producer not initialized");
    return mockProducer as Producer;
  }

  /**
   * Returns the mock Consumer instance
   *
   * @returns The mock Consumer instance
   */
  const getMockConsumer = () => mockConsumer as Consumer;

  /**
   * Tests for constructor initialization and configuration
   */
  describe("constructor", () => {
    it("should create instance with default client ID when not provided", () => {
      const client = new KafkaClient(undefined, TEST_FIXTURES.CONFIG_BASIC);

      expect(client.getName()).toBe(TEST_FIXTURES.DEFAULT_CLIENT_ID);
    });

    it("should create instance with provided client ID", () => {
      const client = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);

      expect(client.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });

    it("should create instance with minimal configuration", () => {
      const client = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_MINIMAL);

      expect(client).toBeDefined();
    });

    it("should create instance with multiple brokers", () => {
      const client = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_MULTI_BROKER);

      expect(client).toBeDefined();
    });

    it("should throw SmokerError when no brokers provided", async () => {
      const client = new KafkaClient(TEST_FIXTURES.CLIENT_ID, {
        ...TEST_FIXTURES.CONFIG_BASIC,
        brokers: [],
      });

      await expect(client.init()).rejects.toBeInstanceOf(SmokerError);
      await expect(client.init()).rejects.toHaveProperty("code", ERR_KAFKA_CONNECT);
      await expect(client.init()).rejects.toHaveProperty("domain", "messaging");
    });

    it("should throw SmokerError when no topics provided", async () => {
      const client = new KafkaClient(TEST_FIXTURES.CLIENT_ID, {
        ...TEST_FIXTURES.CONFIG_BASIC,
        topics: [],
      });

      await expect(client.init()).rejects.toBeInstanceOf(SmokerError);
      await expect(client.init()).rejects.toHaveProperty("code", ERR_KAFKA_CONSUMER);
      await expect(client.init()).rejects.toHaveProperty("domain", "messaging");
    });
  });

  /**
   * Tests for producer functionality including sending messages
   */
  describe("message handling", () => {
    beforeEach(async () => {
      kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
      vi.mocked(getMockProducer().connect).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().connect).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().subscribe).mockResolvedValue(undefined);
      vi.mocked(getMockProducer().send).mockResolvedValue([
        {
          topicName: TEST_FIXTURES.TOPIC,
          partition: TEST_FIXTURES.MESSAGE_PARTITION,
          errorCode: 0,
          offset: TEST_FIXTURES.MESSAGE_OFFSET,
          timestamp: TEST_FIXTURES.MESSAGE_TIMESTAMP.toString(),
        },
      ]);
      await kafkaClient.init();
    });

    it("should send message to topic", async () => {
      await kafkaClient.sendMessage(
        TEST_FIXTURES.TOPIC,
        TEST_FIXTURES.MESSAGE_BODY,
        TEST_FIXTURES.MESSAGE_KEY,
      );

      // Verify the send method was called with the correct topic and message
      const calls = vi.mocked(getMockProducer().send).mock.calls[0][0];
      expect(calls).toMatchObject({
        topic: TEST_FIXTURES.TOPIC,
        messages: [{ key: TEST_FIXTURES.MESSAGE_KEY, value: TEST_FIXTURES.MESSAGE_BODY }],
      });
      // Verify the message contains a timestamp (if added by KafkaJS)
      const message = calls.messages[0];
      if ("timestamp" in message) {
        expect(message.timestamp).toEqual(expect.any(Number));
      }
    });

    it("should throw SmokerError when sending to empty topic", async () => {
      await expect(
        kafkaClient.sendMessage("", TEST_FIXTURES.MESSAGE_BODY, TEST_FIXTURES.MESSAGE_KEY),
      ).rejects.toBeInstanceOf(SmokerError);
      await expect(
        kafkaClient.sendMessage("", TEST_FIXTURES.MESSAGE_BODY, TEST_FIXTURES.MESSAGE_KEY),
      ).rejects.toHaveProperty("code", ERR_KAFKA_PRODUCER);
    });

    it("should wrap producer errors in SmokerError with producer code", async () => {
      vi.mocked(getMockProducer().send).mockRejectedValue(new Error("Send failed"));

      await expect(
        kafkaClient.sendMessage(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE_BODY),
      ).rejects.toBeInstanceOf(SmokerError);
      await expect(
        kafkaClient.sendMessage(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE_BODY),
      ).rejects.toHaveProperty("code", ERR_KAFKA_PRODUCER);
    });

    it("should wrap non-Error exceptions in SmokerError with producer code", async () => {
      vi.mocked(getMockProducer().send).mockRejectedValue("Network timeout");

      await expect(
        kafkaClient.sendMessage(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE_BODY),
      ).rejects.toBeInstanceOf(SmokerError);
      await expect(
        kafkaClient.sendMessage(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE_BODY),
      ).rejects.toHaveProperty("code", ERR_KAFKA_PRODUCER);
    });

    it("should throw SmokerError when topic is empty", async () => {
      await expect(kafkaClient.sendMessage("", TEST_FIXTURES.MESSAGE_BODY)).rejects.toBeInstanceOf(
        SmokerError,
      );
      await expect(kafkaClient.sendMessage("", TEST_FIXTURES.MESSAGE_BODY)).rejects.toHaveProperty(
        "code",
        ERR_KAFKA_PRODUCER,
      );
    });

    it("should handle missing baseOffset in metadata", async () => {
      const mockMetadata = {
        topicName: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        baseOffset: undefined, // This will trigger the ternary operator fallback
        errorCode: 0, // Required property for RecordMetadata
      };
      vi.mocked(getMockProducer().send).mockResolvedValue([mockMetadata]);

      const result = await kafkaClient.sendMessage(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE_BODY);

      // Should use String(Date.now()) when baseOffset is falsy
      expect(result.offset).toMatch(/^\d+$/);
      expect(result.topic).toBe(TEST_FIXTURES.TOPIC);
      expect(result.partition).toBe(TEST_FIXTURES.MESSAGE_PARTITION);
      expect(result.timestamp).toEqual(expect.any(Number));
    });

    it("should throw structured error when client not initialized", async () => {
      kafkaClient = new KafkaClient();

      await expect(
        kafkaClient.sendMessage(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE_BODY),
      ).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });
  });

  /**
   * Tests for subscribing to Kafka topics
   */
  describe("subscribe", () => {
    beforeEach(async () => {
      kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
      vi.mocked(getMockProducer().connect).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().connect).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().subscribe).mockResolvedValue(undefined);
      await kafkaClient.init();
      // Reset spy after initialization to avoid counting init calls in test assertions
      vi.mocked(getMockConsumer().subscribe).mockClear();
    });

    it("should subscribe to single topic", async () => {
      await kafkaClient.subscribe(TEST_FIXTURES.TOPIC, TEST_FIXTURES.GROUP_ID);

      expect(getMockConsumer().subscribe).toHaveBeenCalledWith({
        topic: TEST_FIXTURES.TOPIC,
      });
    });

    it("should subscribe to multiple topics", async () => {
      await kafkaClient.subscribe(TEST_FIXTURES.ADDITIONAL_TOPICS, TEST_FIXTURES.GROUP_ID);

      expect(getMockConsumer().subscribe).toHaveBeenCalledTimes(2);
      expect(getMockConsumer().subscribe).toHaveBeenCalledWith({
        topic: TEST_FIXTURES.ADDITIONAL_TOPICS[0],
      });
      expect(getMockConsumer().subscribe).toHaveBeenCalledWith({
        topic: TEST_FIXTURES.ADDITIONAL_TOPICS[1],
      });
    });

    it("should wrap subscription errors in SmokerError with consumer code", async () => {
      vi.mocked(getMockConsumer().subscribe).mockRejectedValue(new Error("Subscribe failed"));

      await expect(
        kafkaClient.subscribe(TEST_FIXTURES.TOPIC, TEST_FIXTURES.GROUP_ID),
      ).rejects.toBeInstanceOf(SmokerError);
      await expect(
        kafkaClient.subscribe(TEST_FIXTURES.TOPIC, TEST_FIXTURES.GROUP_ID),
      ).rejects.toHaveProperty("code", ERR_KAFKA_CONSUMER);
    });

    it("should throw SmokerError when subscribing to empty topics array", async () => {
      await expect(kafkaClient.subscribe([], TEST_FIXTURES.GROUP_ID)).rejects.toBeInstanceOf(
        SmokerError,
      );
      await expect(kafkaClient.subscribe([], TEST_FIXTURES.GROUP_ID)).rejects.toHaveProperty(
        "code",
        ERR_KAFKA_CONSUMER,
      );
    });

    it("should recreate consumer when subscribing with different groupId", async () => {
      // First subscription with original group ID
      await kafkaClient.subscribe(TEST_FIXTURES.TOPIC, TEST_FIXTURES.GROUP_ID);

      // Reset spy to track only the second subscription
      vi.mocked(getMockConsumer().subscribe).mockClear();
      vi.mocked(getMockConsumer().disconnect).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().connect).mockResolvedValue(undefined);

      // Subscribe with different group ID - should trigger consumer recreation
      await kafkaClient.subscribe(TEST_FIXTURES.ADDITIONAL_TOPICS[0], TEST_FIXTURES.MULTI_GROUP_ID);

      // Should disconnect old consumer and create new one
      expect(getMockConsumer().disconnect).toHaveBeenCalled();
      expect(getMockKafka().consumer).toHaveBeenCalledWith({
        groupId: TEST_FIXTURES.MULTI_GROUP_ID,
      });
      expect(getMockConsumer().connect).toHaveBeenCalled();
      expect(getMockConsumer().subscribe).toHaveBeenCalledWith({
        topic: TEST_FIXTURES.ADDITIONAL_TOPICS[0],
      });
    });

    it("should initialize consumer when consumer doesn't exist", async () => {
      // Create a new client without initializing it (so consumer doesn't exist)
      kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
      // Manually set initialized state without calling init() to avoid consumer creation
      (kafkaClient as unknown as { initialized: boolean; client: Kafka }).initialized = true;
      (kafkaClient as unknown as { initialized: boolean; client: Kafka }).client = getMockKafka();

      vi.mocked(getMockConsumer().connect).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().subscribe).mockResolvedValue(undefined);

      // Subscribe when consumer doesn't exist - should initialize new consumer
      await kafkaClient.subscribe(TEST_FIXTURES.TOPIC, TEST_FIXTURES.GROUP_ID);

      // Should create and connect new consumer
      expect(getMockKafka().consumer).toHaveBeenCalledWith({ groupId: TEST_FIXTURES.GROUP_ID });
      expect(getMockConsumer().connect).toHaveBeenCalled();
      expect(getMockConsumer().subscribe).toHaveBeenCalledWith({
        topic: TEST_FIXTURES.TOPIC,
      });
    });

    it("should wrap non-Error subscribe exceptions in SmokerError with consumer code", async () => {
      // Mock consumer.subscribe to throw a non-Error object (string)
      vi.mocked(getMockConsumer().subscribe).mockRejectedValue("Connection timeout");

      await expect(
        kafkaClient.subscribe(TEST_FIXTURES.TOPIC, TEST_FIXTURES.GROUP_ID),
      ).rejects.toBeInstanceOf(SmokerError);
      await expect(
        kafkaClient.subscribe(TEST_FIXTURES.TOPIC, TEST_FIXTURES.GROUP_ID),
      ).rejects.toHaveProperty("code", ERR_KAFKA_CONSUMER);
    });
  });

  /**
   * Tests for consuming messages from Kafka topics
   */
  describe("consumeMessages", () => {
    beforeEach(async () => {
      await kafkaClient.init();
    });

    it("should consume messages and call callback function", async () => {
      const mockMessage = {
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        message: {
          offset: TEST_FIXTURES.MESSAGE_OFFSET,
          key: Buffer.from(TEST_FIXTURES.MESSAGE_KEY),
          value: Buffer.from(TEST_FIXTURES.MESSAGE_BODY),
          timestamp: String(TEST_FIXTURES.MESSAGE_TIMESTAMP),
          headers: {
            "content-type": "application/json",
            "user-id": Buffer.from("user123"),
          },
        },
      };

      const callbackMock = vi.fn().mockResolvedValue(undefined);
      let messageHandler: EachMessageHandler | undefined;

      // Mock consumer.run to capture the message handler
      vi.mocked(getMockConsumer().run).mockImplementation(async (config) => {
        messageHandler = config?.eachMessage;
        return Promise.resolve();
      });

      // Start consuming messages
      await kafkaClient.consumeMessages(callbackMock);

      // Simulate message arrival with complete EachMessagePayload
      if (messageHandler) {
        const mockPayload = {
          ...mockMessage,
          heartbeat: vi.fn().mockResolvedValue(undefined),
          pause: vi.fn().mockReturnValue(vi.fn()),
        } as unknown as EachMessagePayload;
        await messageHandler(mockPayload);
      }

      // Verify callback was called with transformed message
      expect(callbackMock).toHaveBeenCalledWith({
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        offset: TEST_FIXTURES.MESSAGE_OFFSET,
        key: TEST_FIXTURES.MESSAGE_KEY,
        value: TEST_FIXTURES.MESSAGE_BODY,
        timestamp: TEST_FIXTURES.MESSAGE_TIMESTAMP,
        headers: {
          "content-type": "application/json",
          "user-id": Buffer.from("user123"),
        },
      });
    });

    it("should handle messages without headers", async () => {
      const mockMessage = {
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        message: {
          offset: TEST_FIXTURES.MESSAGE_OFFSET,
          key: null,
          value: Buffer.from(TEST_FIXTURES.MESSAGE_BODY),
          timestamp: String(TEST_FIXTURES.MESSAGE_TIMESTAMP),
          headers: undefined,
        },
      };

      const callbackMock = vi.fn().mockResolvedValue(undefined);
      let messageHandler: MessageHandler | undefined;

      vi.mocked(getMockConsumer().run).mockImplementation(
        async (config?: { eachMessage?: unknown }) => {
          messageHandler = config?.eachMessage as MessageHandler;
          return Promise.resolve();
        },
      );

      await kafkaClient.consumeMessages(callbackMock);
      if (messageHandler) await messageHandler(mockMessage);

      expect(callbackMock).toHaveBeenCalledWith({
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        offset: TEST_FIXTURES.MESSAGE_OFFSET,
        key: undefined,
        value: TEST_FIXTURES.MESSAGE_BODY,
        timestamp: TEST_FIXTURES.MESSAGE_TIMESTAMP,
        headers: undefined,
      });
    });

    it("should skip messages without value", async () => {
      const mockMessage = {
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        message: {
          offset: TEST_FIXTURES.MESSAGE_OFFSET,
          key: Buffer.from(TEST_FIXTURES.MESSAGE_KEY),
          value: null,
          timestamp: String(TEST_FIXTURES.MESSAGE_TIMESTAMP),
        },
      };

      const callbackMock = vi.fn().mockResolvedValue(undefined);
      let messageHandler: MessageHandler | undefined;

      vi.mocked(getMockConsumer().run).mockImplementation(
        async (config?: { eachMessage?: unknown }) => {
          messageHandler = config?.eachMessage as MessageHandler;
          return Promise.resolve();
        },
      );

      await kafkaClient.consumeMessages(callbackMock);
      if (messageHandler) await messageHandler(mockMessage);

      // Callback should not be called for messages without value
      expect(callbackMock).not.toHaveBeenCalled();
    });

    it("should handle timeout and stop consumer", async () => {
      vi.useFakeTimers();

      const callbackMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().run).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().stop).mockResolvedValue(undefined);

      // Start consuming with timeout
      const timeout = 5000; // 5 seconds timeout
      const consumePromise = kafkaClient.consumeMessages(callbackMock, timeout);

      // Fast-forward time to trigger timeout
      await vi.advanceTimersByTimeAsync(timeout);
      await consumePromise;

      // Verify consumer.stop was called
      expect(getMockConsumer().stop).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should wrap consumer.run errors in SmokerError with consumer code", async () => {
      const callbackMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().run).mockRejectedValue(new Error("Consumer run failed"));

      await expect(kafkaClient.consumeMessages(callbackMock)).rejects.toBeInstanceOf(SmokerError);
      await expect(kafkaClient.consumeMessages(callbackMock)).rejects.toHaveProperty(
        "code",
        ERR_KAFKA_CONSUMER,
      );
    });

    it("should wrap non-Error exceptions in consumeMessages in SmokerError with consumer code", async () => {
      const callbackMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().run).mockRejectedValue("Network timeout");

      await expect(kafkaClient.consumeMessages(callbackMock)).rejects.toBeInstanceOf(SmokerError);
      await expect(kafkaClient.consumeMessages(callbackMock)).rejects.toHaveProperty(
        "code",
        ERR_KAFKA_CONSUMER,
      );
    });

    it("should throw structured error when consumer is not initialized", async () => {
      kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
      // Don't call init() - consumer will be null

      const callbackMock = vi.fn().mockResolvedValue(undefined);

      await expect(kafkaClient.consumeMessages(callbackMock)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });
  });

  /**
   * Tests for waiting and processing messages from Kafka topics
   */
  describe("waitForMessage", () => {
    beforeEach(async () => {
      kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
      await kafkaClient.init();
      // Set up topics for waitForMessage to use
      (kafkaClient as unknown as KafkaClientTest).topics = [TEST_FIXTURES.TOPIC];
      (kafkaClient as unknown as KafkaClientTest).groupId = TEST_FIXTURES.GROUP_ID;
    });

    it("should wait for and return matching message", async () => {
      const mockMessage = {
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        message: {
          offset: TEST_FIXTURES.MESSAGE_OFFSET,
          key: Buffer.from(TEST_FIXTURES.MESSAGE_KEY),
          value: Buffer.from(TEST_FIXTURES.TARGET_MESSAGE),
          timestamp: String(TEST_FIXTURES.MESSAGE_TIMESTAMP),
          headers: { "message-type": "target" },
        },
      };

      const matcher = (msg: { value: string }) => msg.value === TEST_FIXTURES.TARGET_MESSAGE;
      const mockTempConsumer = {
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
        run: vi
          .fn()
          .mockImplementation(
            async (config: { eachMessage?: (params: unknown) => Promise<void> }) => {
              // Simulate message arrival immediately to avoid timeout issues
              if (config.eachMessage) {
                await config.eachMessage(mockMessage);
              }
            },
          ),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      // Mock client.consumer to return temp consumer
      vi.mocked(getMockKafka().consumer).mockReturnValue(mockTempConsumer as unknown as Consumer);

      const timeout = 5000; // 5 seconds timeout
      const result = await kafkaClient.waitForMessage(matcher, timeout);

      expect(result).toEqual({
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        offset: TEST_FIXTURES.MESSAGE_OFFSET,
        key: TEST_FIXTURES.MESSAGE_KEY,
        value: TEST_FIXTURES.TARGET_MESSAGE,
        timestamp: TEST_FIXTURES.MESSAGE_TIMESTAMP,
        headers: { "message-type": "target" },
      });
      expect(mockTempConsumer.stop).toHaveBeenCalled();
    });

    it("should return null when message doesn't match within timeout", async () => {
      vi.useFakeTimers();

      const mockTempConsumer = {
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getMockKafka().consumer).mockReturnValue(mockTempConsumer as unknown as Consumer);

      const matcher = (msg: { value: string }) => msg.value === "non-existent-message";
      const timeout = 1000; // 1 second timeout
      const waitPromise = kafkaClient.waitForMessage(matcher, timeout);

      // Fast-forward time to trigger timeout
      await vi.advanceTimersByTimeAsync(timeout);
      const result = await waitPromise;

      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it("should return null when kafka client is not available", async () => {
      // Mock isKafkaClientAvailable to return false
      vi.spyOn(kafkaClient, "isKafkaClientAvailable").mockReturnValue(false);

      const matcher = (msg: { value: string }) => msg.value === "any-message";
      const result = await kafkaClient.waitForMessage(matcher, 1000);

      expect(result).toBeNull();
    });

    it("should handle consumer connection errors", async () => {
      const mockTempConsumer = {
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
        subscribe: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getMockKafka().consumer).mockReturnValue(mockTempConsumer as unknown as Consumer);

      // Spy on the logger used by KafkaClient to avoid noisy output and assert call
      const loggerSpy = vi.spyOn(BaseLogger.prototype, "error").mockImplementation(() => {
        // Intentionally empty - suppressing logger output in tests
      });

      const matcher = (msg: { value: string }) => msg.value === "any-message";
      const result = await kafkaClient.waitForMessage(matcher, 1000);

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith("Error in waitForMessage: Error: Connection failed");

      loggerSpy.mockRestore();
    });

    it("should skip messages without value in waitForMessage", async () => {
      const mockMessageWithoutValue = {
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        message: {
          offset: "123",
          key: Buffer.from(TEST_FIXTURES.MESSAGE_KEY),
          value: null,
          timestamp: String(TEST_FIXTURES.MESSAGE_TIMESTAMP),
        },
      };

      const mockMessageWithValue = {
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        message: {
          offset: "124",
          key: Buffer.from(TEST_FIXTURES.MESSAGE_KEY),
          value: Buffer.from("valid-message"),
          timestamp: String(TEST_FIXTURES.MESSAGE_TIMESTAMP),
        },
      };

      const matcher = (msg: { value: string }) => msg.value === "valid-message";
      const mockTempConsumer = {
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
        run: vi
          .fn()
          .mockImplementation(
            async (config: { eachMessage?: (params: unknown) => Promise<void> }) => {
              // Simulate both messages arriving immediately to avoid timeout issues
              if (config.eachMessage) {
                await config.eachMessage(mockMessageWithoutValue); // Should be skipped
                await config.eachMessage(mockMessageWithValue); // Should match
              }
            },
          ),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getMockKafka().consumer).mockReturnValue(mockTempConsumer as unknown as Consumer);

      const result = await kafkaClient.waitForMessage(matcher, 5000);

      expect(result).toEqual({
        topic: TEST_FIXTURES.TOPIC,
        partition: TEST_FIXTURES.MESSAGE_PARTITION,
        offset: "124",
        key: TEST_FIXTURES.MESSAGE_KEY,
        value: "valid-message",
        timestamp: TEST_FIXTURES.MESSAGE_TIMESTAMP,
        headers: undefined,
      });
    });

    it("should throw error when client is not initialized", async () => {
      kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
      // Don't call init() - client will be null

      const matcher = (msg: { value: string }) => msg.value === "any-message";

      await expect(kafkaClient.waitForMessage(matcher)).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED(TEST_FIXTURES.CLIENT_ID),
      );
    });
  });

  /**
   * Tests for utility methods used for message processing and formatting
   */
  describe("utility methods", () => {
    beforeEach(() => {
      kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
    });

    /**
     * Tests for parseMessageKey method
     */
    describe("parseMessageKey", () => {
      it("should parse Buffer key to string", () => {
        const key = Buffer.from(TEST_FIXTURES.MESSAGE_KEY);
        const result = kafkaClient.parseMessageKey(key);
        expect(result).toBe(TEST_FIXTURES.MESSAGE_KEY);
      });

      it("should return undefined for null key", () => {
        const result = kafkaClient.parseMessageKey(null);
        expect(result).toBeUndefined();
      });

      it("should return undefined for undefined key", () => {
        const result = kafkaClient.parseMessageKey(undefined);
        expect(result).toBeUndefined();
      });

      it("should convert non-Buffer values to string", () => {
        const result = kafkaClient.parseMessageKey("test" as unknown as Buffer);
        expect(result).toBe("test");
      });
    });

    /**
     * Tests for parseMessageTimestamp method
     */
    describe("parseMessageTimestamp", () => {
      it("should parse string timestamp to number", () => {
        const result = kafkaClient.parseMessageTimestamp("1640995200000");
        expect(result).toBe(1640995200000);
      });

      it("should return number timestamp as-is", () => {
        const result = kafkaClient.parseMessageTimestamp(1640995200000);
        expect(result).toBe(1640995200000);
      });

      it("should return current time for undefined timestamp", () => {
        const now = Date.now();
        vi.spyOn(Date, "now").mockReturnValue(now);

        const result = kafkaClient.parseMessageTimestamp(undefined);
        expect(result).toBe(now);
      });
    });

    /**
     * Tests for parseHeaderValue method
     */
    describe("parseHeaderValue", () => {
      it("should return string value as-is", () => {
        const result = kafkaClient.parseHeaderValue("test");
        expect(result).toBe("test");
      });

      it("should return Buffer value as-is", () => {
        const buffer = Buffer.from("test");
        const result = kafkaClient.parseHeaderValue(buffer);
        expect(result).toBe(buffer);
      });
    });

    /**
     * Tests for formatErrorMessage method
     */
    describe("formatErrorMessage", () => {
      it("should format Error objects", () => {
        const error = new Error("Test error");
        const result = kafkaClient.formatErrorMessage(error);
        expect(result).toBe("Test error");
      });

      it("should format non-Error values", () => {
        const result = kafkaClient.formatErrorMessage("String error");
        expect(result).toBe("String error");
      });
    });

    /**
     * Tests for shouldProcessMessage method
     */
    describe("shouldProcessMessage", () => {
      it("should return true for valid Buffer", () => {
        const buffer = Buffer.from("test");
        const result = kafkaClient.shouldProcessMessage(buffer);
        expect(result).toBe(true);
      });

      it("should return false for null", () => {
        const result = kafkaClient.shouldProcessMessage(null);
        expect(result).toBe(false);
      });

      it("should return false for undefined", () => {
        const result = kafkaClient.shouldProcessMessage(undefined);
        expect(result).toBe(false);
      });

      it("should return false for empty Buffer", () => {
        const buffer = Buffer.alloc(0);
        const result = kafkaClient.shouldProcessMessage(buffer);
        expect(result).toBe(false);
      });
    });

    /**
     * Tests for isKafkaClientAvailable method
     */
    describe("isKafkaClientAvailable", () => {
      it("should return false when client is null", () => {
        const result = kafkaClient.isKafkaClientAvailable();
        expect(result).toBe(false);
      });

      it("should return true when client is available", async () => {
        vi.mocked(getMockProducer().connect).mockResolvedValue(undefined);
        vi.mocked(getMockConsumer().connect).mockResolvedValue(undefined);
        vi.mocked(getMockConsumer().subscribe).mockResolvedValue(undefined);

        await kafkaClient.init();
        const result = kafkaClient.isKafkaClientAvailable();
        expect(result).toBe(true);
      });
    });
  });

  /**
   * Tests for client lifecycle management
   */
  describe("lifecycle management", () => {
    let messageHandler: EachMessageHandler | undefined;

    beforeEach(async () => {
      // Set up mocks first
      vi.mocked(getMockProducer().connect).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().connect).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().subscribe).mockResolvedValue(undefined);
      vi.mocked(getMockConsumer().run).mockImplementation((config) => {
        // Store the message handler for later use in tests
        if (config?.eachMessage) {
          messageHandler = config.eachMessage;
        }
        return Promise.resolve();
      });

      // Create and initialize the client after mocks are set up
      kafkaClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
      await kafkaClient.init();
    });

    it("should connect successfully", async () => {
      await expect(kafkaClient.connect()).resolves.not.toThrow();
    });

    it("should throw error when client not initialized", async () => {
      kafkaClient = new KafkaClient();
      await expect(kafkaClient.connect()).rejects.toThrow(
        TEST_FIXTURES.ERROR_NOT_INITIALIZED("KafkaClient"),
      );
    });

    it("should initialize client and connect to Kafka", async () => {
      await kafkaClient.init();
      expect(getMockKafka().producer).toHaveBeenCalled();
      expect(getMockKafka().consumer).toHaveBeenCalledWith({
        groupId: TEST_FIXTURES.CONFIG_BASIC.groupId,
      });
      expect(getMockProducer().connect).toHaveBeenCalled();
      expect(getMockConsumer().connect).toHaveBeenCalled();
      // The consumer should be subscribed to each topic individually
      expect(getMockConsumer().subscribe).toHaveBeenCalledTimes(
        TEST_FIXTURES.CONFIG_BASIC.topics.length,
      );
      TEST_FIXTURES.CONFIG_BASIC.topics.forEach((topic) => {
        expect(getMockConsumer().subscribe).toHaveBeenCalledWith({ topic });
      });

      // The run method should not be called during initialization
      // It's only called when consumeMessages is invoked
      expect(getMockConsumer().run).not.toHaveBeenCalled();

      // The message handler should not be set yet
      expect(messageHandler).toBeUndefined();
    });

    it("should handle initialization errors", async () => {
      const error = new Error("Connection failed");
      // Make sure both producer and consumer connect methods will reject
      vi.mocked(getMockProducer().connect).mockRejectedValue(error);
      vi.mocked(getMockConsumer().connect).mockRejectedValue(error);

      // Create a new instance to avoid interference with other tests
      const testClient = new KafkaClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);

      await expect(testClient.init()).rejects.toThrow(
        `Failed to initialize Kafka client: ${error.message}`,
      );
    });

    it("should clean up resources on close", async () => {
      await kafkaClient.init();
      await kafkaClient.cleanupClient();

      expect(getMockProducer().disconnect).toHaveBeenCalled();
      expect(getMockConsumer().disconnect).toHaveBeenCalled();
    });

    it("should handle cleanup errors gracefully", async () => {
      const error = new Error("Cleanup failed");
      vi.mocked(getMockProducer().disconnect).mockRejectedValue(error);

      await kafkaClient.init();
      await expect(kafkaClient.cleanupClient()).resolves.not.toThrow();
    });
  });
});
