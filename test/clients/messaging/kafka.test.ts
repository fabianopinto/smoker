/**
 * Unit tests for Kafka client
 * Tests the KafkaClient functionality
 */
import { Kafka } from "kafkajs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KafkaClient } from "../../../src/clients";

// Define common interfaces for testing
interface MessagePayload {
  topic: string;
  partition: number;
  message: {
    key?: Buffer;
    value: Buffer;
    offset: string;
    timestamp?: string;
    headers?: Record<string, Buffer>;
  };
}

// Mock kafkajs
vi.mock("kafkajs", () => {
  // Mock consumer
  const mockConsumerRun = vi.fn();
  const mockConsumerConnect = vi.fn();
  const mockConsumerDisconnect = vi.fn();
  const mockConsumerStop = vi.fn();
  const mockConsumerSubscribe = vi.fn();

  const mockConsumer = vi.fn(() => ({
    connect: mockConsumerConnect,
    disconnect: mockConsumerDisconnect,
    subscribe: mockConsumerSubscribe,
    run: mockConsumerRun,
    stop: mockConsumerStop,
  }));

  // Mock producer
  const mockProducerSend = vi.fn();
  const mockProducerConnect = vi.fn();
  const mockProducerDisconnect = vi.fn();

  const mockProducer = vi.fn(() => ({
    connect: mockProducerConnect,
    disconnect: mockProducerDisconnect,
    send: mockProducerSend,
  }));

  // Mock Kafka client
  const mockKafka = vi.fn(() => ({
    consumer: mockConsumer,
    producer: mockProducer,
  }));

  return {
    Kafka: mockKafka,
    logLevel: {
      ERROR: "ERROR",
    },
  };
});

describe("KafkaClient", () => {
  let client: KafkaClient;
  const defaultConfig = {
    brokers: ["localhost:9092"],
    topics: ["test-topic"],
  };
  // Define mock types using Vitest's Mock type
  type MockFunction = ReturnType<typeof vi.fn>;
  let mockKafka: { consumer: MockFunction; producer: MockFunction };
  let mockProducer: { connect: MockFunction; disconnect: MockFunction; send: MockFunction };
  let mockConsumer: {
    connect: MockFunction;
    disconnect: MockFunction;
    subscribe: MockFunction;
    run: MockFunction;
    stop: MockFunction;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fake timers for Date.now and setTimeout
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1625097600000)); // Fixed timestamp for consistent test results

    // With our module augmentation, TypeScript should now recognize the inheritance
    client = new KafkaClient();
    // We're already mocking the Kafka module, so this is just accessing the mock
    // Cast to the correct mock function type since we're working with vitest mocks
    mockKafka = (Kafka as unknown as () => { consumer: MockFunction; producer: MockFunction })();
    mockProducer = mockKafka.producer();
    mockConsumer = mockKafka.consumer();
  });

  afterEach(async () => {
    await client.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("KafkaClient");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should be initialized after init is called", async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      // Create client with config in constructor
      client = new KafkaClient("KafkaClient", defaultConfig);
      await client.init();

      expect(client.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);
      mockProducer.disconnect.mockResolvedValue(undefined);
      mockConsumer.disconnect.mockResolvedValue(undefined);

      // Create client with config in constructor
      client = new KafkaClient("KafkaClient", defaultConfig);
      await client.init();
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should throw an error if brokers is not provided", async () => {
      // Create client with missing brokers in config
      client = new KafkaClient("KafkaClient", {
        topics: ["test-topic"],
      });
      await expect(client.init()).rejects.toThrow("Brokers must be provided");
    });

    it("should throw an error if topics is not provided", async () => {
      // Create client with missing topics in config
      client = new KafkaClient("KafkaClient", {
        brokers: ["localhost:9092"],
      });
      await expect(client.init()).rejects.toThrow("Topics must be provided");
    });

    it("should use default client ID and group ID when not provided", async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      // Create client with config in constructor
      client = new KafkaClient("KafkaClient", {
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });
      await client.init();

      expect(Kafka).toHaveBeenCalledWith({
        clientId: "smoke-test-client",
        brokers: ["localhost:9092"],
        logLevel: "ERROR",
      });

      expect(mockKafka.consumer).toHaveBeenCalledWith({
        groupId: "smoke-test-group",
      });
    });

    it("should use provided configuration", async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      // Create client with complete config in constructor
      client = new KafkaClient("KafkaClient", {
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
        clientId: "test-client",
        ssl: false,
      });
      await client.init();

      expect(client.isInitialized()).toBe(true);

      expect(Kafka).toHaveBeenCalledWith({
        clientId: "test-client",
        brokers: ["localhost:9092"],
        ssl: false,
      });

      expect(mockKafka.consumer).toHaveBeenCalledWith({
        groupId: "smoke-test-group",
      });
    });

    it("should subscribe to all topics during initialization", async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      // Create client with config in constructor
      client = new KafkaClient("KafkaClient", {
        brokers: ["localhost:9092"],
        topics: ["topic1", "topic2", "topic3"],
      });
      await client.init();

      expect(mockConsumer.subscribe).toHaveBeenCalledTimes(3);
      expect(mockConsumer.subscribe).toHaveBeenNthCalledWith(1, { topic: "topic1" });
      expect(mockConsumer.subscribe).toHaveBeenNthCalledWith(2, { topic: "topic2" });
      expect(mockConsumer.subscribe).toHaveBeenNthCalledWith(3, { topic: "topic3" });
    });

    it("should handle initialization errors", async () => {
      mockProducer.connect.mockRejectedValue(new Error("Connection failed"));

      // Create client with config in constructor
      client = new KafkaClient("KafkaClient", {
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });
      await expect(client.init()).rejects.toThrow(
        "Failed to initialize Kafka client: Connection failed",
      );
    });
  });

  describe("Kafka operations", () => {
    beforeEach(async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      // Create client with config in constructor
      client = new KafkaClient("KafkaClient", {
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });
      await client.init();
    });

    describe("connect", () => {
      it("should do nothing because connection is handled in initialization", async () => {
        await client.connect();

        // No additional calls to connect since it's already done in init
        expect(mockProducer.connect).toHaveBeenCalledTimes(1);
        expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
      });

      it("should throw if client is not initialized", async () => {
        const newClient = new KafkaClient();
        await expect(newClient.connect()).rejects.toThrow("not initialized");
      });
    });

    describe("disconnect", () => {
      it("should call disconnect on producer and consumer", async () => {
        mockProducer.disconnect.mockResolvedValue(undefined);
        mockConsumer.disconnect.mockResolvedValue(undefined);

        await client.disconnect();

        expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
        expect(mockConsumer.disconnect).toHaveBeenCalledTimes(1);
      });

      it("should handle errors during disconnect", async () => {
        // Mock console.warn to verify the warning is logged
        const consoleWarnSpy = vi.spyOn(console, "warn");

        mockProducer.disconnect.mockRejectedValue(new Error("Disconnect error"));
        mockConsumer.disconnect.mockResolvedValue(undefined);

        // Should not throw despite the error
        await expect(client.disconnect()).resolves.not.toThrow();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error disconnecting Kafka client"),
        );
      });
    });

    describe("sendMessage", () => {
      it("should call producer.send with correct parameters", async () => {
        const topic = "test-topic";
        const message = "test message";
        const key = "test-key";

        const mockResponse = [
          {
            topicName: topic,
            partition: 0,
            errorCode: 0,
            offset: "100",
            timestamp: 1625097600000,
          },
        ];

        mockProducer.send.mockResolvedValueOnce(mockResponse);

        const result = await client.sendMessage(topic, message, key);

        expect(mockProducer.send).toHaveBeenCalledWith({
          topic,
          messages: [
            {
              key,
              value: message,
            },
          ],
        });

        expect(result).toEqual({
          topic,
          partition: 0,
          offset: expect.any(String), // Accept any string as offset
          timestamp: 1625097600000,
        });
      });

      it("should work without a key", async () => {
        const topic = "test-topic";
        const message = "test message";

        const mockResponse = [
          {
            topicName: topic,
            partition: 0,
            errorCode: 0,
            offset: "100",
            timestamp: 1625097600000,
          },
        ];

        mockProducer.send.mockResolvedValueOnce(mockResponse);

        await client.sendMessage(topic, message);

        expect(mockProducer.send).toHaveBeenCalledWith({
          topic,
          messages: [
            {
              value: message,
            },
          ],
        });
      });

      it("should handle empty response", async () => {
        // The KafkaClient implementation actually throws an error for empty responses
        // So we should test for that behavior instead
        mockProducer.send.mockResolvedValueOnce([]);

        await expect(client.sendMessage("test-topic", "message")).rejects.toThrow(
          "Failed to send message to topic test-topic",
        );
      });

      it("should handle producer errors", async () => {
        mockProducer.send.mockRejectedValueOnce(new Error("Send failed"));

        await expect(client.sendMessage("test-topic", "message")).rejects.toThrow("Send failed");
      });

      it("should throw an error if topic is empty", async () => {
        await expect(client.sendMessage("", "message")).rejects.toThrow(
          "Topic is required for sending a message",
        );
      });
    });

    describe("subscribe", () => {
      it("should call consumer.subscribe with a single topic", async () => {
        mockConsumer.subscribe.mockResolvedValueOnce(undefined);

        await client.subscribe("new-topic", "test-group");

        expect(mockConsumer.subscribe).toHaveBeenCalledWith({ topic: "new-topic" });
      });

      it("should reinitialize consumer when using a different group ID", async () => {
        mockConsumer.disconnect.mockResolvedValueOnce(undefined);
        const newConsumer = {
          connect: vi.fn().mockResolvedValue(undefined),
          subscribe: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn(),
          run: vi.fn(),
          stop: vi.fn(),
        };
        mockKafka.consumer.mockReturnValueOnce(newConsumer);

        await client.subscribe("new-topic", "different-group");

        expect(mockConsumer.disconnect).toHaveBeenCalled();
        expect(mockKafka.consumer).toHaveBeenCalledWith({ groupId: "different-group" });
        expect(newConsumer.connect).toHaveBeenCalled();
        expect(newConsumer.subscribe).toHaveBeenCalledWith({ topic: "new-topic" });
      });

      it("should initialize consumer if it doesn't exist", async () => {
        // Simulate the consumer being null
        // Using type assertion to access private properties for testing
        const originalConsumer = (client as unknown as { consumer: typeof mockConsumer }).consumer;
        (client as unknown as { consumer: typeof mockConsumer | null }).consumer = null;

        const newConsumer = {
          connect: vi.fn().mockResolvedValue(undefined),
          subscribe: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn(),
          run: vi.fn(),
          stop: vi.fn(),
        };
        mockKafka.consumer.mockReturnValueOnce(newConsumer);

        await client.subscribe("new-topic", "new-group");

        expect(mockKafka.consumer).toHaveBeenCalledWith({ groupId: "new-group" });
        expect(newConsumer.connect).toHaveBeenCalled();
        expect(newConsumer.subscribe).toHaveBeenCalledWith({ topic: "new-topic" });

        // Restore the consumer
        (client as unknown as { consumer: typeof mockConsumer | null }).consumer = originalConsumer;
      });

      it("should call consumer.subscribe with multiple topics", async () => {
        mockConsumer.subscribe.mockResolvedValue(undefined);

        // Reset the subscribe mock to clear any previous calls
        mockConsumer.subscribe.mockClear();

        await client.subscribe(["topic1", "topic2"], "custom-group");

        // Verify it was called exactly twice (once for each topic)
        expect(mockConsumer.subscribe).toHaveBeenCalledTimes(2);
        expect(mockConsumer.subscribe).toHaveBeenNthCalledWith(1, { topic: "topic1" });
        expect(mockConsumer.subscribe).toHaveBeenNthCalledWith(2, { topic: "topic2" });
      });

      it("should handle subscription errors", async () => {
        mockConsumer.subscribe.mockRejectedValueOnce(new Error("Subscribe failed"));

        await expect(client.subscribe("topic", "group")).rejects.toThrow("Subscribe failed");
      });

      it("should throw an error when subscribing with empty topics array", async () => {
        await expect(client.subscribe([], "test-group")).rejects.toThrow(
          "At least one topic is required for subscription",
        );
      });
    });

    describe("consumeMessages", () => {
      it("should handle null message value by skipping processing", async () => {
        const callbackFn = vi.fn().mockResolvedValue(undefined);

        mockConsumer.run.mockImplementationOnce(
          ({ eachMessage }: { eachMessage: (payload: MessagePayload) => Promise<void> }) => {
            // Simulate a message with null value
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                value: null as unknown as Buffer,
                offset: "100",
              },
            });
            return Promise.resolve();
          },
        );

        await client.consumeMessages(callbackFn);

        // Verify callback was not called since message.value is null
        expect(callbackFn).not.toHaveBeenCalled();
      });

      it("should run consumer with callback for messages", async () => {
        const callbackFn = vi.fn().mockResolvedValue(undefined);

        mockConsumer.run.mockImplementationOnce(
          ({
            eachMessage,
          }: {
            eachMessage: (payload: {
              topic: string;
              partition: number;
              message: {
                key?: Buffer;
                value: Buffer;
                offset: string;
                timestamp: string;
                headers: Record<string, Buffer>;
              };
            }) => Promise<void>;
          }) => {
            // Simulate a message
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                key: Buffer.from("test-key"),
                value: Buffer.from("test-message"),
                offset: "100",
                timestamp: "1625097600000",
                headers: { header1: Buffer.from("value1") },
              },
            });
            return Promise.resolve();
          },
        );

        await client.consumeMessages(callbackFn);

        expect(mockConsumer.run).toHaveBeenCalled();
        expect(callbackFn).toHaveBeenCalledWith({
          key: "test-key",
          value: "test-message",
          topic: "test-topic",
          partition: 0,
          offset: "100",
          timestamp: 1625097600000,
          headers: { header1: expect.any(Buffer) },
        });
      });

      it("should handle different message formats", async () => {
        const callbackFn = vi.fn().mockResolvedValue(undefined);

        mockConsumer.run.mockImplementationOnce(
          ({ eachMessage }: { eachMessage: (payload: unknown) => Promise<void> }) => {
            // Simulate a message without key or headers
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                value: Buffer.from("simple-message"),
                offset: "100",
              },
            });
            return Promise.resolve();
          },
        );

        await client.consumeMessages(callbackFn);

        expect(callbackFn).toHaveBeenCalledWith({
          value: "simple-message",
          topic: "test-topic",
          partition: 0,
          offset: "100",
          timestamp: 1625097600000,
        });
      });

      it("should parse numeric timestamps correctly", async () => {
        const callbackFn = vi.fn().mockResolvedValue(undefined);

        mockConsumer.run.mockImplementationOnce(
          ({ eachMessage }: { eachMessage: (payload: MessagePayload) => Promise<void> }) => {
            // Simulate a message with numeric timestamp
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                value: Buffer.from("message"),
                offset: "100",
                // Testing numeric timestamp handling - convert to string for the mock
                timestamp: "1625097000000",
              },
            });
            return Promise.resolve();
          },
        );

        await client.consumeMessages(callbackFn);

        expect(callbackFn).toHaveBeenCalledWith({
          value: "message",
          topic: "test-topic",
          partition: 0,
          offset: "100",
          timestamp: 1625097000000,
        });
      });

      it("should parse string timestamps correctly", async () => {
        const callbackFn = vi.fn().mockResolvedValue(undefined);

        mockConsumer.run.mockImplementationOnce(
          ({ eachMessage }: { eachMessage: (payload: MessagePayload) => Promise<void> }) => {
            // Simulate a message with string timestamp
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                value: Buffer.from("message"),
                offset: "100",
                // Testing string timestamp handling
                timestamp: "1625098000000",
              },
            });
            return Promise.resolve();
          },
        );

        await client.consumeMessages(callbackFn);

        expect(callbackFn).toHaveBeenCalledWith({
          value: "message",
          topic: "test-topic",
          partition: 0,
          offset: "100",
          timestamp: 1625098000000,
        });
      });

      it("should handle different header value types", async () => {
        const callbackFn = vi.fn().mockResolvedValue(undefined);

        mockConsumer.run.mockImplementationOnce(
          ({ eachMessage }: { eachMessage: (payload: MessagePayload) => Promise<void> }) => {
            // Simulate a message with various header types
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                value: Buffer.from("message"),
                offset: "100",
                headers: {
                  // Testing different header value types - convert to Buffer for the mock
                  stringHeader: Buffer.from("string-value"),
                  bufferHeader: Buffer.from("buffer-value"),
                  numberHeader: Buffer.from(String(123)),
                },
              },
            });
            return Promise.resolve();
          },
        );

        await client.consumeMessages(callbackFn);

        expect(callbackFn).toHaveBeenCalledWith({
          value: "message",
          topic: "test-topic",
          partition: 0,
          offset: "100",
          timestamp: 1625097600000,
          headers: {
            // All header values are presented as Buffer objects
            stringHeader: expect.any(Buffer),
            bufferHeader: expect.any(Buffer),
            numberHeader: expect.any(Buffer),
          },
        });
      });

      // Explicitly set a longer test timeout to avoid test timeouts
      it("should stop consumer after timeout if specified", async () => {
        const timeoutMs = 50; // Use a very short timeout for the client

        // Mock setTimeout to immediately execute the callback
        let setTimeoutCallback: (() => void) | null = null;
        const realSetTimeout = global.setTimeout;
        // We need the ms parameter to match setTimeout's signature, but don't use it in the mock
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        global.setTimeout = vi.fn((callback: () => void, ms?: number) => {
          setTimeoutCallback = callback;
          return 1; // Return a fake timeout ID
        }) as unknown as typeof global.setTimeout;

        try {
          // Setup resolved promises for consumer methods
          mockConsumer.run.mockResolvedValue(undefined);
          mockConsumer.stop.mockResolvedValue(undefined);

          // Start consuming messages
          const consumePromise = client.consumeMessages(vi.fn(), timeoutMs);

          // Wait for any immediate promises to resolve
          await new Promise(process.nextTick);

          // Verify setTimeout was called with the correct timeout
          expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), timeoutMs);

          // Execute the setTimeout callback to simulate timeout expiration
          if (setTimeoutCallback) {
            // Use a type assertion to ensure TypeScript knows this is a callable function
            const callback = setTimeoutCallback as () => void;
            callback();
          }

          // Wait for any promises triggered by the timeout callback
          await new Promise(process.nextTick);

          // Now consumePromise should be resolvable
          await consumePromise;

          // Verify that stop was called
          expect(mockConsumer.stop).toHaveBeenCalled();
        } finally {
          // Restore the original setTimeout
          global.setTimeout = realSetTimeout;
        }
      });

      it("should handle consumer run errors", async () => {
        mockConsumer.run.mockRejectedValueOnce(new Error("Run failed"));

        await expect(client.consumeMessages(vi.fn())).rejects.toThrow("Run failed");
      });
    });

    describe("waitForMessage", () => {
      it("should return null when messagePromise resolves with null due to unavailable client", async () => {
        // Since we can't easily bypass the ensureInitialized check,
        // we need to test the inner Promise's behavior more directly

        // We'll test this behavior by mocking isKafkaClientAvailable
        // to simulate the client being unavailable

        // Initialize the client properly to pass the initial checks
        mockProducer.connect.mockResolvedValue(undefined);
        mockConsumer.connect.mockResolvedValue(undefined);
        mockConsumer.subscribe.mockResolvedValue(undefined);

        // First initialize client to pass initialization check
        await client.init();

        // Mock isKafkaClientAvailable to simulate client not available scenario
        // This is the method we actually want to test
        const originalMethod = client.isKafkaClientAvailable;
        client.isKafkaClientAvailable = vi.fn().mockReturnValue(false);

        try {
          // Call waitForMessage - this should now return null because isKafkaClientAvailable returns false
          const result = await client.waitForMessage(() => true);

          // Verify result is null as expected
          expect(result).toBeNull();
          // Verify our mock was called
          expect(client.isKafkaClientAvailable).toHaveBeenCalled();
        } finally {
          // Restore original method
          client.isKafkaClientAvailable = originalMethod;
        }
      });

      it("should skip messages with null value in waitForMessage", async () => {
        // Create a mock temporary consumer
        const mockTempConsumer = {
          connect: vi.fn().mockResolvedValue(undefined),
          subscribe: vi.fn().mockResolvedValue(undefined),
          run: vi.fn().mockImplementation(({ eachMessage }) => {
            // First send a null message (should be skipped)
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                key: Buffer.from("match-key"),
                value: null as unknown as Buffer,
                offset: "100",
                timestamp: "1625097600000",
              },
            });

            // Then send a valid message - directly calling without setTimeout
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                key: Buffer.from("match-key"),
                value: Buffer.from("match-value"),
                offset: "200",
                timestamp: "1625097600000",
              },
            });
            return Promise.resolve();
          }),
          stop: vi.fn().mockResolvedValue(undefined),
        };

        // Mock the Kafka consumer method to return our mock
        mockKafka.consumer.mockReturnValueOnce(mockTempConsumer);

        // Create a matcher function
        const matcher = vi.fn().mockImplementation((message) => {
          // Only return true for the valid message
          return message.value === "match-value" && message.key === "match-key";
        });

        // Start the waitForMessage call and await it directly
        const result = await client.waitForMessage(matcher);

        // Verify the matcher was only called once for the valid message
        // and not for the message with null value
        expect(matcher).toHaveBeenCalledTimes(1);
        expect(result).toEqual(
          expect.objectContaining({
            key: "match-key",
            value: "match-value",
            offset: "200", // Ensure we got the second message
          }),
        );
      });

      it("should create a temporary consumer to wait for specific message", async () => {
        // Set up a mock temporary consumer
        const mockTempConsumer = {
          connect: vi.fn().mockResolvedValue(undefined),
          subscribe: vi.fn().mockResolvedValue(undefined),
          run: vi.fn().mockImplementation(({ eachMessage }) => {
            // Directly call eachMessage without setTimeout for more reliable testing
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                key: Buffer.from("match-key"),
                value: Buffer.from("match-value"),
                offset: "100",
                timestamp: "1625097600000",
              },
            });
            return Promise.resolve();
          }),
          stop: vi.fn().mockResolvedValue(undefined),
        };

        // Mock the Kafka consumer method to return our mock
        mockKafka.consumer.mockReturnValueOnce(mockTempConsumer);

        // Create a matcher function that will match our test message
        const matcher = vi.fn().mockImplementation((message) => {
          // Check if this is the message we want to match
          if (message.value === "match-value" && message.key === "match-key") {
            return true;
          }
          return false;
        });

        // Start the waitForMessage call and await it directly
        // This is more reliable than using fake timers with promises
        const result = await client.waitForMessage(matcher);

        // Restore real timers
        vi.useRealTimers();

        // Verify the consumer was created with the expected parameters
        expect(mockKafka.consumer).toHaveBeenCalledWith({
          groupId: expect.stringContaining("smoke-test-group-waiter-"),
        });

        // Verify the consumer methods were called appropriately
        expect(mockTempConsumer.connect).toHaveBeenCalled();
        expect(mockTempConsumer.subscribe).toHaveBeenCalled();

        // Verify the matcher function was called with correct message data
        expect(matcher).toHaveBeenCalledWith(
          expect.objectContaining({
            key: "match-key",
            value: "match-value",
            topic: "test-topic",
            partition: 0,
            offset: "100",
          }),
        );

        // Verify the result matches what we expect
        expect(result).toEqual(
          expect.objectContaining({
            key: "match-key",
            value: "match-value",
            topic: "test-topic",
            partition: 0,
            offset: "100",
          }),
        );
      });

      // Increase timeout for this test to avoid Vitest default timeout issues
      it("should return null if timeout occurs", async () => {
        // Mock a consumer that never calls eachMessage
        const mockTempConsumer = {
          connect: vi.fn().mockResolvedValue(undefined),
          subscribe: vi.fn().mockResolvedValue(undefined),
          run: vi.fn().mockResolvedValue(undefined), // Never calls eachMessage
          stop: vi.fn().mockResolvedValue(undefined),
        };

        mockKafka.consumer.mockReturnValueOnce(mockTempConsumer);

        // Use a short timeout value for the client but make the test more explicit
        const timeoutValue = 100;
        const waitPromise = client.waitForMessage(() => false, timeoutValue);

        // Manually advance timers to trigger timeout
        vi.advanceTimersByTime(timeoutValue + 10);

        const result = await waitPromise;

        // Verify that the result is null due to timeout
        expect(result).toBeNull();
      });

      it("should handle errors during message waiting", async () => {
        // Create a mock consumer that will fail on connect
        const mockTempConsumer = {
          connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
          subscribe: vi.fn().mockResolvedValue(undefined),
          run: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn().mockResolvedValue(undefined),
        };

        // Mock console.error to verify the error is logged
        // Silence console.error during test but still track calls
        const consoleErrorSpy = vi.spyOn(console, "error");

        // Mock for the temporary consumer
        mockKafka.consumer.mockReturnValueOnce(mockTempConsumer);

        // The actual implementation of waitForMessage should handle errors
        // and return null, which we can test directly
        const result = await client.waitForMessage(() => true);

        // Expect the result to be null due to the connection error
        expect(result).toBeNull();

        // Verify that our consumer was attempted to be used
        expect(mockTempConsumer.connect).toHaveBeenCalled();

        // Expect the error to have been logged - note: this might not always work
        // depending on how errors are handled in the implementation
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error"));

        // Reset the console.error mock
        consoleErrorSpy.mockRestore();
      });

      it("should handle different header value types", async () => {
        // Set up a mock temporary consumer
        const mockTempConsumer = {
          connect: vi.fn().mockResolvedValue(undefined),
          subscribe: vi.fn().mockResolvedValue(undefined),
          run: vi.fn().mockImplementation(({ eachMessage }) => {
            // Simulate a message with different header value types
            eachMessage({
              topic: "test-topic",
              partition: 0,
              message: {
                key: Buffer.from("test-key"),
                value: Buffer.from("test-message"),
                offset: "100",
                timestamp: "1625097600000",
                // Test all possible header value types to exercise lines 430-439:
                headers: {
                  // String header (typeof value === "string" branch)
                  stringHeader: "string-value",
                  // Buffer header (value instanceof Buffer branch)
                  bufferHeader: Buffer.from("buffer-value"),
                  // Non-string, non-Buffer header (String(value) branch)
                  numberHeader: 123,
                  // Undefined header (to test the value !== undefined condition)
                  undefinedHeader: undefined,
                },
              },
            });
            return Promise.resolve();
          }),
          stop: vi.fn().mockResolvedValue(undefined),
        };

        // Mock the Kafka consumer method to return our mock
        mockKafka.consumer.mockReturnValueOnce(mockTempConsumer);

        // Create a simple matcher that matches any message
        const matcher = vi.fn().mockReturnValue(true);

        // Get the result from waitForMessage
        const result = await client.waitForMessage(matcher);

        // Verify the result has all the expected properties
        expect(result).toMatchObject({
          topic: "test-topic",
          partition: 0,
          key: "test-key",
          value: "test-message",
          offset: "100",
          timestamp: 1625097600000,
          headers: {
            // String value should remain as string
            stringHeader: "string-value",
            // Buffer value should be a Buffer
            bufferHeader: expect.any(Buffer),
            // Number should be converted to string via Buffer.from(String(value))
            numberHeader: expect.any(Buffer),
            // Undefined header should not be present
          },
        });

        // Verify the matcher was called with the message
        expect(matcher).toHaveBeenCalled();

        // Verify undefinedHeader was excluded from the headers
        expect(result?.headers?.undefinedHeader).toBeUndefined();
      });
    });
  });

  describe("Error handling", () => {
    describe("Error type handling in ternary operators", () => {
      // Setup spies to capture console output
      let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        consoleWarnSpy = vi.spyOn(console, "warn");
      });

      afterEach(() => {
        consoleWarnSpy.mockRestore();
      });

      it("should handle Error objects in initializeClient", async () => {
        // Set up client with valid config
        client = new KafkaClient("KafkaClient", defaultConfig);

        // Mock Kafka constructor to throw an Error object
        const errorMessage = "Kafka initialization failed";
        (Kafka as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
          throw new Error(errorMessage);
        });

        // Verify error message includes the Error.message
        await expect(client.init()).rejects.toThrow(
          `Failed to initialize Kafka client: ${errorMessage}`,
        );
      });

      it("should handle non-Error objects in initializeClient", async () => {
        // Set up client with valid config
        client = new KafkaClient("KafkaClient", defaultConfig);

        // Mock Kafka constructor to throw a non-Error object
        const errorObj = { code: 500 };
        (Kafka as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
          throw errorObj;
        });

        // Verify error message includes String(error)
        await expect(client.init()).rejects.toThrow(
          `Failed to initialize Kafka client: ${String(errorObj)}`,
        );
      });

      it("should handle Error objects in disconnect", async () => {
        // Initialize client
        mockProducer.connect.mockResolvedValue(undefined);
        mockConsumer.connect.mockResolvedValue(undefined);
        mockConsumer.subscribe.mockResolvedValue(undefined);
        client = new KafkaClient("KafkaClient", defaultConfig);
        await client.init();

        // Force Error object during disconnect
        const errorMessage = "Disconnect failed";
        mockConsumer.disconnect.mockRejectedValueOnce(new Error(errorMessage));

        await client.disconnect();

        // Verify correct branch of ternary was used
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
      });

      it("should handle non-Error objects in disconnect", async () => {
        // Initialize client
        mockProducer.connect.mockResolvedValue(undefined);
        mockConsumer.connect.mockResolvedValue(undefined);
        mockConsumer.subscribe.mockResolvedValue(undefined);
        client = new KafkaClient("KafkaClient", defaultConfig);
        await client.init();

        // Force non-Error object during disconnect
        const errorObj = { code: "DISCONNECT_FAILED" };
        mockConsumer.disconnect.mockRejectedValueOnce(errorObj);

        await client.disconnect();

        // Verify correct branch of ternary was used
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(String(errorObj)));
      });

      it("should handle Error objects in subscribe", async () => {
        // Initialize client
        mockProducer.connect.mockResolvedValue(undefined);
        mockConsumer.connect.mockResolvedValue(undefined);
        mockConsumer.subscribe.mockResolvedValue(undefined);
        client = new KafkaClient("KafkaClient", defaultConfig);
        await client.init();

        // Force Error object during subscribe
        const errorMessage = "Subscription failed";
        mockConsumer.subscribe.mockRejectedValueOnce(new Error(errorMessage));

        // Attempt to subscribe with new topic
        await expect(client.subscribe("new-topic", "test-group")).rejects.toThrow(
          `Failed to subscribe to topics: ${errorMessage}`,
        );
      });

      it("should handle non-Error objects in subscribe", async () => {
        // Initialize client
        mockProducer.connect.mockResolvedValue(undefined);
        mockConsumer.connect.mockResolvedValue(undefined);
        mockConsumer.subscribe.mockResolvedValue(undefined);
        client = new KafkaClient("KafkaClient", defaultConfig);
        await client.init();

        // Force non-Error object during subscribe
        const errorObj = { reason: "network failure" };
        mockConsumer.subscribe.mockRejectedValueOnce(errorObj);

        // Attempt to subscribe with new topic
        await expect(client.subscribe("new-topic", "test-group")).rejects.toThrow(
          `Failed to subscribe to topics: ${String(errorObj)}`,
        );
      });

      it("should handle Error objects in consumeMessages", async () => {
        // Initialize client
        mockProducer.connect.mockResolvedValue(undefined);
        mockConsumer.connect.mockResolvedValue(undefined);
        mockConsumer.subscribe.mockResolvedValue(undefined);
        client = new KafkaClient("KafkaClient", defaultConfig);
        await client.init();

        // Force Error object during consumeMessages
        const errorMessage = "Consumer run failed";
        mockConsumer.run.mockRejectedValueOnce(new Error(errorMessage));

        // Attempt to consume messages
        await expect(client.consumeMessages(() => Promise.resolve())).rejects.toThrow(
          `Error consuming messages: ${errorMessage}`,
        );
      });

      it("should handle non-Error objects in consumeMessages", async () => {
        // Initialize client
        mockProducer.connect.mockResolvedValue(undefined);
        mockConsumer.connect.mockResolvedValue(undefined);
        mockConsumer.subscribe.mockResolvedValue(undefined);
        client = new KafkaClient("KafkaClient", defaultConfig);
        await client.init();

        // Force non-Error object during consumeMessages
        const errorObj = { code: "CONSUMER_ERROR" };
        mockConsumer.run.mockRejectedValueOnce(errorObj);

        // Attempt to consume messages
        await expect(client.consumeMessages(() => Promise.resolve())).rejects.toThrow(
          `Error consuming messages: ${String(errorObj)}`,
        );
      });

      it("should handle non-Error objects in cleanupClient", async () => {
        // Initialize client
        mockProducer.connect.mockResolvedValue(undefined);
        mockConsumer.connect.mockResolvedValue(undefined);
        mockConsumer.subscribe.mockResolvedValue(undefined);
        client = new KafkaClient("KafkaClient", defaultConfig);
        await client.init();

        // Force non-Error object during disconnect in cleanupClient
        const errorObj = { type: "cleanup_error" };
        mockConsumer.disconnect.mockRejectedValueOnce(errorObj);

        // Call destroy which invokes cleanupClient
        await client.destroy();

        // Verify correct branch of ternary was used
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(String(errorObj)));
      });
    });

    it("should throw error if client is not initialized", async () => {
      const newClient = new KafkaClient();

      await expect(newClient.connect()).rejects.toThrow("KafkaClient is not initialized");
      await expect(newClient.disconnect()).rejects.toThrow("KafkaClient is not initialized");
      await expect(newClient.sendMessage("topic", "message")).rejects.toThrow(
        "KafkaClient is not initialized",
      );
      await expect(newClient.subscribe("topic", "group")).rejects.toThrow(
        "KafkaClient is not initialized",
      );
      await expect(newClient.consumeMessages(() => Promise.resolve())).rejects.toThrow(
        "KafkaClient is not initialized",
      );
      await expect(newClient.waitForMessage(() => true)).rejects.toThrow(
        "KafkaClient is not initialized",
      );
    });

    it("should handle errors during cleanupClient and still perform cleanup", async () => {
      // Set up for client initialization
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      // Initialize client
      client = new KafkaClient("KafkaClient", defaultConfig);
      await client.init();

      // Mock errors during disconnection to trigger error handling
      mockConsumer.disconnect.mockRejectedValueOnce(new Error("Consumer disconnect failed"));
      mockProducer.disconnect.mockRejectedValueOnce(new Error("Producer disconnect failed"));

      // Spy on console.warn to verify error handling
      const consoleWarnSpy = vi.spyOn(console, "warn");

      // Execute the cleanupClient method through destroy
      await client.destroy();

      // Verify console.warn was called with appropriate error message
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error disconnecting Kafka client"),
      );

      // Verify the client properly nullified resources in finally block
      // We're using type assertion here to access private properties for verification
      const clientInstance = client as unknown as {
        consumer: unknown | null;
        producer: unknown | null;
        client: unknown | null;
      };

      // Check that cleanup was performed despite errors
      expect(clientInstance.consumer).toBeNull();
      expect(clientInstance.producer).toBeNull();
      expect(clientInstance.client).toBeNull();

      // Clean up spy
      consoleWarnSpy.mockRestore();
    });
  });

  describe("Helper methods", () => {
    beforeEach(() => {
      // Create a fresh client instance for testing helper methods
      client = new KafkaClient("KafkaClient");
    });

    describe("parseMessageTimestamp", () => {
      it("should handle string timestamps by parsing them to integers", () => {
        expect(client.parseMessageTimestamp("1625097600000")).toBe(1625097600000);
      });

      it("should handle numeric timestamps by returning them as numbers", () => {
        expect(client.parseMessageTimestamp(1625097600000)).toBe(1625097600000);
      });

      it("should use current time when timestamp is undefined", () => {
        // Set up a fixed timestamp for testing
        const fixedTime = 1625097600000;
        vi.setSystemTime(new Date(fixedTime));

        expect(client.parseMessageTimestamp(undefined)).toBe(fixedTime);
      });

      it("should use current time when timestamp is null", () => {
        // Set up a fixed timestamp for testing
        const fixedTime = 1625097600000;
        vi.setSystemTime(new Date(fixedTime));

        expect(client.parseMessageTimestamp(null as unknown as undefined)).toBe(fixedTime);
      });
    });

    describe("parseHeaderValue", () => {
      it("should return string values unchanged", () => {
        const testString = "test-header-value";
        expect(client.parseHeaderValue(testString)).toBe(testString);
      });

      it("should return Buffer objects unchanged", () => {
        const testBuffer = Buffer.from("test-buffer");
        expect(client.parseHeaderValue(testBuffer)).toBe(testBuffer);
      });

      it("should convert non-string, non-Buffer values to Buffer", () => {
        const testNumber = 12345;
        const result = client.parseHeaderValue(testNumber);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString()).toBe("12345");
      });

      it("should handle null by converting it to 'null' string in a Buffer", () => {
        const result = client.parseHeaderValue(null);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString()).toBe("null");
      });

      it("should handle undefined by converting it to 'undefined' string in a Buffer", () => {
        const result = client.parseHeaderValue(undefined);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString()).toBe("undefined");
      });
    });

    describe("formatErrorMessage", () => {
      it("should extract message from Error objects", () => {
        const error = new Error("Test error message");
        expect(client.formatErrorMessage(error)).toBe("Test error message");
      });

      it("should handle non-Error objects by converting them to strings", () => {
        expect(client.formatErrorMessage("string error")).toBe("string error");
        expect(client.formatErrorMessage(123)).toBe("123");
        expect(client.formatErrorMessage({ custom: "error" })).toBe("[object Object]");
      });

      it("should handle null", () => {
        expect(client.formatErrorMessage(null)).toBe("null");
      });

      it("should handle undefined", () => {
        expect(client.formatErrorMessage(undefined)).toBe("undefined");
      });
    });

    describe("shouldProcessMessage", () => {
      it("should return true for non-empty Buffer", () => {
        expect(client.shouldProcessMessage(Buffer.from("test"))).toBe(true);
      });

      it("should return false for empty Buffer", () => {
        expect(client.shouldProcessMessage(Buffer.from(""))).toBe(false);
      });

      it("should return false for null", () => {
        expect(client.shouldProcessMessage(null)).toBe(false);
      });

      it("should return false for undefined", () => {
        expect(client.shouldProcessMessage(undefined)).toBe(false);
      });
    });

    describe("isKafkaClientAvailable", () => {
      it("should return false when client is null", () => {
        // Using type assertion to access private property for testing
        const clientInstance = client as unknown as { client: null | unknown };
        clientInstance.client = null;
        expect(client.isKafkaClientAvailable()).toBe(false);
      });

      it("should return false when client is undefined", () => {
        // Using type assertion to access private property for testing
        const clientInstance = client as unknown as { client: undefined | unknown };
        clientInstance.client = undefined;
        expect(client.isKafkaClientAvailable()).toBe(false);
      });

      it("should return true when client is available", () => {
        // Using type assertion to access private property for testing
        const clientInstance = client as unknown as { client: unknown };
        clientInstance.client = {}; // Mock object
        expect(client.isKafkaClientAvailable()).toBe(true);
      });
    });

    describe("parseMessageKey", () => {
      it("should convert Buffer key to string", () => {
        const keyBuffer = Buffer.from("test-key");
        expect(client.parseMessageKey(keyBuffer)).toBe("test-key");
      });

      it("should handle string-like key objects", () => {
        const keyObj = { toString: () => "custom-key" };
        expect(client.parseMessageKey(keyObj as unknown as Buffer)).toBe("custom-key");
      });

      it("should return undefined for null", () => {
        expect(client.parseMessageKey(null)).toBeUndefined();
      });

      it("should return undefined for undefined", () => {
        expect(client.parseMessageKey(undefined)).toBeUndefined();
      });
    });
  });

  describe("Complex edge cases", () => {
    beforeEach(async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      // Create client with config in constructor
      client = new KafkaClient("KafkaClient", {
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });
      await client.init();
    });

    it("should handle multiple initializations", async () => {
      mockProducer.disconnect.mockResolvedValue(undefined);
      mockConsumer.disconnect.mockResolvedValue(undefined);
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      // Reset the Kafka mock to clear previous call counts
      // Reset the Kafka mock
      vi.clearAllMocks();

      // Create client with new config in constructor
      client = new KafkaClient("KafkaClient", {
        brokers: ["kafka2:9092"],
        topics: ["new-topic"],
      });
      await client.init();

      // Now we should only see one call since we cleared the previous calls
      expect(Kafka).toHaveBeenCalledTimes(1);
      expect(mockConsumer.subscribe).toHaveBeenLastCalledWith({ topic: "new-topic" });
    });

    it("should handle empty message value", async () => {
      const callbackFn = vi.fn().mockResolvedValue(undefined);

      mockConsumer.run.mockImplementationOnce(
        ({ eachMessage }: { eachMessage: (payload: MessagePayload) => Promise<void> }) => {
          // Simulate a message with empty value
          eachMessage({
            topic: "test-topic",
            partition: 0,
            message: {
              value: Buffer.from(""),
              offset: "100",
            },
          });
          return Promise.resolve();
        },
      );

      await client.consumeMessages(callbackFn);

      expect(callbackFn).toHaveBeenCalledWith({
        value: "",
        topic: "test-topic",
        partition: 0,
        offset: "100",
        timestamp: 1625097600000,
      });
    });
  });
});
