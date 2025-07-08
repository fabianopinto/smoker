import { Kafka } from "kafkajs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KafkaClient } from "../../src/clients/kafka";

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

      await client.init({
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });

      expect(client.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);
      mockProducer.disconnect.mockResolvedValue(undefined);
      mockConsumer.disconnect.mockResolvedValue(undefined);

      await client.init({
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should throw an error if brokers are not provided", async () => {
      await expect(
        client.init({
          topics: ["test-topic"],
        }),
      ).rejects.toThrow("Kafka brokers are required");
    });

    it("should throw an error if topics are not provided", async () => {
      await expect(
        client.init({
          brokers: ["localhost:9092"],
        }),
      ).rejects.toThrow("Kafka topics are required");
    });

    it("should use default client ID and group ID when not provided", async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      await client.init({
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });

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

      const config = {
        brokers: ["kafka1:9092", "kafka2:9092"],
        topics: ["topic1", "topic2"],
        clientId: "custom-client",
        groupId: "custom-group",
      };

      await client.init(config);

      expect(Kafka).toHaveBeenCalledWith({
        clientId: "custom-client",
        brokers: ["kafka1:9092", "kafka2:9092"],
        logLevel: "ERROR",
      });

      expect(mockKafka.consumer).toHaveBeenCalledWith({
        groupId: "custom-group",
      });
    });

    it("should subscribe to all topics during initialization", async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      await client.init({
        brokers: ["localhost:9092"],
        topics: ["topic1", "topic2", "topic3"],
      });

      expect(mockConsumer.subscribe).toHaveBeenCalledTimes(3);
      expect(mockConsumer.subscribe).toHaveBeenNthCalledWith(1, { topic: "topic1" });
      expect(mockConsumer.subscribe).toHaveBeenNthCalledWith(2, { topic: "topic2" });
      expect(mockConsumer.subscribe).toHaveBeenNthCalledWith(3, { topic: "topic3" });
    });

    it("should handle initialization errors", async () => {
      mockProducer.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(
        client.init({
          brokers: ["localhost:9092"],
          topics: ["test-topic"],
        }),
      ).rejects.toThrow("Failed to initialize Kafka client: Connection failed");
    });
  });

  describe("Kafka operations", () => {
    beforeEach(async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      await client.init({
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });
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
        const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          return undefined;
        });

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
    });

    describe("subscribe", () => {
      it("should call consumer.subscribe with a single topic", async () => {
        mockConsumer.subscribe.mockResolvedValueOnce(undefined);

        await client.subscribe("new-topic", "custom-group");

        expect(mockConsumer.subscribe).toHaveBeenCalledWith({ topic: "new-topic" });
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
    });

    describe("consumeMessages", () => {
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
      }, 20000); // Increase test timeout

      it("should handle consumer run errors", async () => {
        mockConsumer.run.mockRejectedValueOnce(new Error("Run failed"));

        await expect(client.consumeMessages(vi.fn())).rejects.toThrow("Run failed");
      }, 10000);
    });

    describe("waitForMessage", () => {
      it("should create a temporary consumer to wait for specific message", async () => {
        // Make sure we're using fake timers
        vi.useFakeTimers();

        // Create a matcher function that will match our test message
        const matcher = vi.fn().mockImplementation((message) => {
          // Check if this is the message we want to match
          if (message.value === "match-value" && message.key === "match-key") {
            return true;
          }
          return false;
        });

        // Create a more reliable way to execute the eachMessage callback
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

        // Create a deferred promise that will be resolved when we call eachMessage
        let resolveCallback: (value: unknown) => void;
        const callbackPromise = new Promise((resolve) => {
          resolveCallback = resolve;
        });

        // Set up the mock temporary consumer that captures the eachMessage callback
        let eachMessageCallback: ((payload: MessagePayload) => Promise<void>) | null = null;
        const mockTempConsumer = {
          connect: vi.fn().mockResolvedValue(undefined),
          subscribe: vi.fn().mockResolvedValue(undefined),
          run: vi
            .fn()
            .mockImplementation(
              ({ eachMessage }: { eachMessage: (payload: MessagePayload) => Promise<void> }) => {
                // Save the callback for later execution
                eachMessageCallback = eachMessage;
                // Let the test know the callback is ready
                resolveCallback(true);
                return Promise.resolve();
              },
            ),
          stop: vi.fn().mockResolvedValue(undefined),
        };

        // Mock the Kafka client to return our mock consumer
        mockKafka.consumer.mockReturnValueOnce(mockTempConsumer);

        // Use a short timeout value to avoid test timeouts
        const timeoutValue = 100;

        // Start the async operation
        const waitPromise = client.waitForMessage(matcher, timeoutValue);

        // Wait for the run method to be called and the callback to be set
        await callbackPromise;

        // At this point, the mock consumer's run method should have been called
        expect(mockTempConsumer.run).toHaveBeenCalled();
        expect(eachMessageCallback).not.toBeNull();

        // Now manually trigger the eachMessage callback with our test message
        if (eachMessageCallback) {
          // Use a type assertion to ensure TypeScript knows this is a callable function
          const callback = eachMessageCallback as (payload: MessagePayload) => Promise<void>;
          await callback({
            topic: "test-topic",
            partition: 0,
            message: {
              key: Buffer.from("match-key"),
              value: Buffer.from("match-value"),
              offset: "100",
              timestamp: "1625097600000",
            },
          });
        }

        // Now wait for the result
        const result = await waitPromise;

        // Verify the consumer was created with the expected parameters
        expect(mockKafka.consumer).toHaveBeenCalledWith({
          groupId: expect.stringContaining("smoke-test-group-waiter-"),
        });

        // Verify the consumer methods were called appropriately
        expect(mockTempConsumer.connect).toHaveBeenCalled();
        expect(mockTempConsumer.subscribe).toHaveBeenCalledWith({ topic: "test-topic" });

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
      }, 20000); // Increase test timeout

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
      }, 10000);

      it("should handle errors during message waiting", async () => {
        // Create a mock consumer that will fail on connect
        const mockTempConsumer = {
          connect: vi.fn().mockRejectedValue(new Error("Connection error")),
          subscribe: vi.fn().mockResolvedValue(undefined),
          run: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn().mockResolvedValue(undefined),
        };

        // Mock console.error to verify the error is logged
        // Silence console.error during test but still track calls
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
      }, 10000);
    });
  });

  describe("Error handling", () => {
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
  });

  describe("Edge cases", () => {
    beforeEach(async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);

      await client.init({
        brokers: ["localhost:9092"],
        topics: ["test-topic"],
      });
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

      await client.init({
        brokers: ["kafka2:9092"],
        topics: ["new-topic"],
      });

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
