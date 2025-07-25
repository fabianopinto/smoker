/**
 * MQTT Client Tests
 *
 * This test suite verifies the MqttClient implementation using vitest mocks
 * to simulate MQTT broker interactions and verify client behavior.
 *
 * Tests cover:
 * - Client construction and configuration validation
 * - Connection initialization and broker communication
 * - Message publishing with various options
 * - Topic subscription and message handling
 * - Callback management and event processing
 * - Error handling and recovery scenarios
 * - Resource cleanup and connection termination
 */

import mqtt from "mqtt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MqttClient } from "../../../src/clients/messaging/mqtt";

/**
 * Mocks for MQTT client
 */
vi.mock("mqtt");
const MockedMqtt = vi.mocked(mqtt);

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client and broker configuration
  CLIENT_ID: "test-mqtt-client",
  BROKER_URL: "mqtt://localhost:1883",

  // Test data
  TOPIC: "test/topic",
  MESSAGE: "Hello MQTT",
  ADDITIONAL_TOPICS: ["topic1", "topic2", "topic3"],

  // Error messages
  ERROR_CONNECTION_FAILED: "Connection failed",
  ERROR_SUBSCRIPTION_FAILED: "Subscription failed",
  ERROR_STRING: "String error",
  ERROR_NETWORK_TIMEOUT: "Network timeout",
  ERROR_CONNECTION_LOST: "Connection lost",
  ERROR_TOPIC_REQUIRED: "MQTT subscribe requires at least one topic",
  INIT_ERROR_PREFIX: "Failed to initialize MQTT client",
  CONNECT_ERROR_PREFIX: "Failed to connect to MQTT broker at",
  CONNECTION_ERROR_PREFIX: "MQTT connection error",

  // Test configurations
  CONFIG_MINIMAL: { url: "mqtt://localhost:1883" },

  CONFIG_BASIC: {
    url: "mqtt://localhost:1883",
    clientId: "test-mqtt-client",
    username: "testuser",
    password: "testpass",
  },

  // Default values
  DEFAULT_CLIENT_ID: "MqttClient",
  DEFAULT_TIMEOUT: 5000,
};

/**
 * Type definitions for test mocks
 */
type MessageCallback = (message: string | Buffer) => void;
interface MockMqttClient {
  connect: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  connected: boolean;
}

/**
 * Creates a mock MQTT client for testing
 *
 * @returns A mock MQTT client with all required methods mocked
 */
const createMockMqttClient = (): MockMqttClient => ({
  connect: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  on: vi.fn(),
  end: vi.fn(),
  connected: false,
});

/**
 * Retrieves the message callbacks map from an MQTT client instance
 *
 * @param client - The MQTT client instance
 * @returns Map of topic to array of message callbacks
 */
const getMessageCallbacks = (client: MqttClient): Map<string, MessageCallback[]> => {
  return (client as unknown as { messageCallbacks: Map<string, MessageCallback[]> })
    .messageCallbacks;
};

/**
 * Sets up a mock MQTT client to simulate a connected state
 *
 * @param mockClient - The mock MQTT client to set up
 */
const setupConnectedClient = (mockClient: MockMqttClient): void => {
  mockClient.connected = true;
  mockClient.on.mockImplementation((event: string, callback: () => void) => {
    if (event === "connect") {
      setTimeout(() => callback(), 0);
    }
    // Store all event handlers for later access in tests
    // This allows tests to find and call specific event handlers
    return mockClient;
  });
};

/**
 * Sets up a mock MQTT client to simulate a successful publish
 *
 * @param mockClient - The mock MQTT client to set up
 */
const setupSuccessfulPublish = (mockClient: MockMqttClient): void => {
  mockClient.publish.mockImplementation((topic, message, options, callback) => {
    callback(null);
  });
};

/**
 * Sets up a mock MQTT client to simulate a successful subscription
 *
 * @param mockClient - The mock MQTT client to set up
 * @param topic - The topic to simulate subscription to
 */
const setupSuccessfulSubscription = (mockClient: MockMqttClient, topic: string): void => {
  mockClient.subscribe.mockImplementation((topicParam, options, callback) => {
    callback(null, [{ topic, qos: 0 }]);
  });
};

/**
 * Sets up a mock MQTT client to simulate a successful unsubscription
 *
 * @param mockClient - The mock MQTT client to set up
 */
const setupSuccessfulUnsubscription = (mockClient: MockMqttClient): void => {
  mockClient.unsubscribe.mockImplementation((topic, callback) => {
    callback(null);
  });
};

/**
 * Tests for the MqttClient class
 */
describe("MqttClient", () => {
  let mqttClient: MqttClient;
  let mockClient: MockMqttClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockMqttClient();
    MockedMqtt.connect.mockReturnValue(mockClient as unknown as import("mqtt").MqttClient);
    mqttClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
  });

  /**
   * Helper to get typed mock client instance
   *
   * @returns The mock MQTT client instance
   */
  const getMockClient = (): MockMqttClient => mockClient;

  /**
   * Tests for constructor initialization
   */
  describe("constructor", () => {
    it("should create instance with default client ID", () => {
      mqttClient = new MqttClient();
      expect(mqttClient.getName()).toBe(TEST_FIXTURES.DEFAULT_CLIENT_ID);
    });

    it("should create instance with custom client ID", () => {
      mqttClient = new MqttClient(TEST_FIXTURES.CLIENT_ID);
      expect(mqttClient.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });

    it("should create instance with configuration", () => {
      mqttClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_BASIC);
      expect(mqttClient.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });
  });

  /**
   * Tests for client initialization
   */
  describe("initialization", () => {
    it("should initialize client with basic configuration", async () => {
      setupConnectedClient(mockClient);

      await mqttClient.init();

      expect(MockedMqtt.connect).toHaveBeenCalledWith(TEST_FIXTURES.BROKER_URL, {
        clientId: TEST_FIXTURES.CLIENT_ID,
        username: "testuser",
        password: "testpass",
        reconnectPeriod: 5000,
        keepalive: 60,
      });
      expect(mqttClient.isInitialized()).toBe(true);
    });

    it("should initialize with minimal configuration", async () => {
      const minimalConfigWithClientId = {
        ...TEST_FIXTURES.CONFIG_MINIMAL,
        clientId: TEST_FIXTURES.CLIENT_ID,
      };
      mqttClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, minimalConfigWithClientId);
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      await mqttClient.init();

      expect(MockedMqtt.connect).toHaveBeenCalledWith(TEST_FIXTURES.BROKER_URL, {
        clientId: TEST_FIXTURES.CLIENT_ID,
        username: undefined,
        password: undefined,
        reconnectPeriod: 5000,
        keepalive: 60,
      });
      expect(mqttClient.isInitialized()).toBe(true);
    });

    it("should use fallback clientId when configured clientId is empty", async () => {
      // Create config with empty clientId to trigger the ternary fallback
      const configWithEmptyClientId = {
        ...TEST_FIXTURES.CONFIG_MINIMAL,
        clientId: "", // Empty string to make this.clientId falsy
      };

      mqttClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, configWithEmptyClientId);

      // Mock Date.now for predictable testing
      const mockTimestamp = 1234567890;
      const originalDateNow = Date.now;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      setupConnectedClient(mockClient);

      await mqttClient.init();

      // Verify that the fallback clientId pattern is used
      expect(MockedMqtt.connect).toHaveBeenCalledWith(TEST_FIXTURES.BROKER_URL, {
        clientId: `smoker-${mockTimestamp}`,
        username: undefined,
        password: undefined,
        reconnectPeriod: 5000,
        keepalive: 60,
      });

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it("should handle connection errors during initialization", async () => {
      const connectionError = new Error(TEST_FIXTURES.ERROR_CONNECTION_FAILED);
      getMockClient().on.mockImplementation(
        (event: string, callback: (error?: Error | string) => void) => {
          if (event === "error") {
            setTimeout(() => callback(connectionError), 0);
          }
          return mockClient;
        },
      );

      await expect(mqttClient.init()).rejects.toThrow(
        `${TEST_FIXTURES.INIT_ERROR_PREFIX}: ${TEST_FIXTURES.CONNECT_ERROR_PREFIX} ${TEST_FIXTURES.BROKER_URL}: ${TEST_FIXTURES.CONNECTION_ERROR_PREFIX}: ${TEST_FIXTURES.ERROR_CONNECTION_FAILED}`,
      );
      expect(mqttClient.isInitialized()).toBe(false);
    });

    it("should handle non-Error exceptions during initialization", async () => {
      getMockClient().on.mockImplementation(
        (event: string, callback: (error?: Error | string) => void) => {
          if (event === "error") {
            setTimeout(() => callback("String error"), 0);
          }
          return mockClient;
        },
      );

      await expect(mqttClient.init()).rejects.toThrow(
        `${TEST_FIXTURES.INIT_ERROR_PREFIX}: ${TEST_FIXTURES.CONNECT_ERROR_PREFIX} ${TEST_FIXTURES.BROKER_URL}: ${TEST_FIXTURES.CONNECTION_ERROR_PREFIX}: undefined`,
      );
      expect(mqttClient.isInitialized()).toBe(false);
    });

    it("should throw error when broker URL is not provided", async () => {
      mqttClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, { url: "" });

      await expect(mqttClient.init()).rejects.toThrow("MQTT client requires a broker URL");
      expect(mqttClient.isInitialized()).toBe(false);
    });

    it("should handle connection failure and format error message properly", async () => {
      const connectionError = new Error("Connection refused by broker");

      // Mock mqtt.connect to throw an error during connection attempt
      MockedMqtt.connect.mockImplementation(() => {
        throw connectionError;
      });

      // Expect the inner catch block error message format
      await expect(mqttClient.init()).rejects.toThrow(
        `${TEST_FIXTURES.INIT_ERROR_PREFIX}: ${TEST_FIXTURES.CONNECT_ERROR_PREFIX} ${TEST_FIXTURES.BROKER_URL}: ${connectionError.message}`,
      );

      expect(mqttClient.isInitialized()).toBe(false);
    });

    it("should handle non-Error connection failure and format message properly", async () => {
      const connectionError = "String-based connection error";

      // Mock mqtt.connect to throw a non-Error object
      MockedMqtt.connect.mockImplementation(() => {
        throw connectionError;
      });

      // Expect the inner catch block to handle non-Error objects
      await expect(mqttClient.init()).rejects.toThrow(
        `${TEST_FIXTURES.INIT_ERROR_PREFIX}: ${TEST_FIXTURES.CONNECT_ERROR_PREFIX} ${TEST_FIXTURES.BROKER_URL}: ${connectionError}`,
      );

      expect(mqttClient.isInitialized()).toBe(false);
    });

    it("should handle initialization failure and format outer catch error message", async () => {
      const initError = new Error("Initialization process failed");

      // Mock getConfig to throw an error during initialization (before connection attempt)
      const originalGetConfig = (
        mqttClient as unknown as { getConfig: <T>(key: string, defaultValue: T) => T }
      ).getConfig;
      vi.spyOn(
        mqttClient as unknown as { getConfig: <T>(key: string, defaultValue: T) => T },
        "getConfig",
      ).mockImplementation(() => {
        throw initError;
      });

      // Expect the outer catch block error message format (line 209)
      await expect(mqttClient.init()).rejects.toThrow(
        `${TEST_FIXTURES.INIT_ERROR_PREFIX}: ${initError.message}`,
      );

      expect(mqttClient.isInitialized()).toBe(false);

      // Restore original method
      (mqttClient as unknown as { getConfig: <T>(key: string, defaultValue: T) => T }).getConfig =
        originalGetConfig;
    });

    it("should handle non-Error initialization failure in outer catch", async () => {
      const initError = "String-based initialization error";

      // Mock getConfig to throw a non-Error object during initialization
      const originalGetConfig = mqttClient["getConfig"];
      vi.spyOn(
        mqttClient as unknown as { getConfig: <T>(key: string, defaultValue: T) => T },
        "getConfig",
      ).mockImplementation(() => {
        throw initError;
      });

      // Expect the outer catch block to handle non-Error objects (line 209)
      await expect(mqttClient.init()).rejects.toThrow(
        `${TEST_FIXTURES.INIT_ERROR_PREFIX}: ${initError}`,
      );

      expect(mqttClient.isInitialized()).toBe(false);

      // Restore original method
      (mqttClient as unknown as { getConfig: <T>(key: string, defaultValue: T) => T }).getConfig =
        originalGetConfig;
    });

    it("should handle connection timeout", async () => {
      vi.useFakeTimers();

      // Create a new client with short timeout for testing
      const timeoutClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, {
        ...TEST_FIXTURES.CONFIG_BASIC,
        connectTimeout: 1000,
      });

      // Mock connect to never call the connect callback (simulating timeout)
      MockedMqtt.connect.mockReturnValue({
        ...mockClient,
        connected: false,
      } as unknown as import("mqtt").MqttClient);

      // Start initialization (should timeout)
      const initPromise = timeoutClient.init();

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(2000);

      // Expect timeout error
      await expect(initPromise).rejects.toThrow(
        `${TEST_FIXTURES.INIT_ERROR_PREFIX}: ${TEST_FIXTURES.CONNECT_ERROR_PREFIX} ${TEST_FIXTURES.BROKER_URL}: Connection timeout after 1000ms`,
      );

      vi.useRealTimers();
    });

    it("should handle error events after initialization", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      const testError = new Error("Test MQTT error");

      // Set up mock to capture event handlers
      const eventHandlers = new Map<string, (error?: Error) => void>();
      getMockClient().on.mockImplementation((event: string, callback: (error?: Error) => void) => {
        eventHandlers.set(event, callback);
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return getMockClient();
      });

      await mqttClient.init();

      // Get and call the error handler
      const errorHandler = eventHandlers.get("error");
      expect(errorHandler).toBeDefined();

      if (errorHandler) {
        errorHandler(testError);
      }

      // Verify console.error was called with correct message (line 176)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `MQTT client error for ${TEST_FIXTURES.CLIENT_ID}: ${testError.message}`,
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle close events after initialization", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      // Set up mock to capture event handlers
      const eventHandlers = new Map<string, () => void>();
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        eventHandlers.set(event, callback);
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return getMockClient();
      });

      await mqttClient.init();

      // Get and call the close handler
      const closeHandler = eventHandlers.get("close");
      expect(closeHandler).toBeDefined();

      if (closeHandler) {
        closeHandler();
      }

      // Verify console.warn was called with correct message (line 181)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `MQTT connection closed for client ${TEST_FIXTURES.CLIENT_ID}`,
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle offline events after initialization", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      // Set up mock to capture event handlers
      const eventHandlers = new Map<string, () => void>();
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        eventHandlers.set(event, callback);
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return getMockClient();
      });

      await mqttClient.init();

      // Get and call the offline handler
      const offlineHandler = eventHandlers.get("offline");
      expect(offlineHandler).toBeDefined();

      if (offlineHandler) {
        offlineHandler();
      }

      // Verify console.warn was called with correct message (line 186)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `MQTT client ${TEST_FIXTURES.CLIENT_ID} is offline`,
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle message events and call registered callbacks", async () => {
      // Set up mock to capture event handlers including message handler
      const eventHandlers = new Map<string, (topic?: string, message?: Buffer) => void>();
      getMockClient().on.mockImplementation(
        (event: string, callback: (topic?: string, message?: Buffer) => void) => {
          eventHandlers.set(event, callback);
          if (event === "connect") {
            setTimeout(() => callback(), 0);
          }
          return getMockClient();
        },
      );

      await mqttClient.init();

      // Register some callbacks to test lines 191-192
      const messageCallbacks = getMessageCallbacks(mqttClient);
      const testCallback1 = vi.fn();
      const testCallback2 = vi.fn();

      // Add callbacks for a topic (simulating waitForMessage calls)
      const callbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      callbacks.push(testCallback1, testCallback2);
      messageCallbacks.set(TEST_FIXTURES.TOPIC, callbacks);

      // Get the message handler
      const messageHandler = eventHandlers.get("message");
      expect(messageHandler).toBeDefined();

      // Simulate message arrival
      const testMessage = Buffer.from(TEST_FIXTURES.MESSAGE);
      if (messageHandler) {
        messageHandler(TEST_FIXTURES.TOPIC, testMessage);
      }

      // Verify both callbacks were called (line 191-192 coverage)
      expect(testCallback1).toHaveBeenCalledWith(testMessage);
      expect(testCallback2).toHaveBeenCalledWith(testMessage);
    });
  });

  /**
   * Tests for message publishing
   */
  describe("message publishing", () => {
    beforeEach(async () => {
      setupConnectedClient(mockClient);
      await mqttClient.init();
    });

    it("should publish string message successfully", async () => {
      setupSuccessfulPublish(mockClient);

      await mqttClient.publish(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE);

      expect(getMockClient().publish).toHaveBeenCalledWith(
        TEST_FIXTURES.TOPIC,
        TEST_FIXTURES.MESSAGE,
        {},
        expect.any(Function),
      );
    });

    it("should publish Buffer message successfully", async () => {
      const bufferMessage = Buffer.from(TEST_FIXTURES.MESSAGE);
      setupSuccessfulPublish(mockClient);

      await mqttClient.publish(TEST_FIXTURES.TOPIC, bufferMessage);

      expect(getMockClient().publish).toHaveBeenCalledWith(
        TEST_FIXTURES.TOPIC,
        bufferMessage,
        {},
        expect.any(Function),
      );
    });

    it("should publish message with options", async () => {
      const publishOptions = { qos: 1 as const, retain: true };
      getMockClient().publish.mockImplementation((topic, message, options, callback) => {
        callback(null);
      });

      await mqttClient.publish(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE, publishOptions);

      expect(getMockClient().publish).toHaveBeenCalledWith(
        TEST_FIXTURES.TOPIC,
        TEST_FIXTURES.MESSAGE,
        publishOptions,
        expect.any(Function),
      );
    });

    it("should handle publish errors", async () => {
      const publishError = new Error("Publish failed");
      getMockClient().publish.mockImplementation((topic, message, options, callback) => {
        callback(publishError);
      });

      await expect(mqttClient.publish(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE)).rejects.toThrow(
        `Failed to publish message to ${TEST_FIXTURES.TOPIC}: Publish failed`,
      );
    });

    it("should throw error when client not initialized", async () => {
      mqttClient = new MqttClient();

      await expect(mqttClient.publish(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE)).rejects.toThrow(
        "MqttClient is not initialized. Call init() first.",
      );
    });

    it("should throw error when topic is empty", async () => {
      await expect(mqttClient.publish("", TEST_FIXTURES.MESSAGE)).rejects.toThrow(
        "MQTT publish requires a topic",
      );
    });

    it("should handle publish timeout", async () => {
      // Create a client with short publish timeout for testing
      const timeoutClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, {
        ...TEST_FIXTURES.CONFIG_BASIC,
        publishTimeout: 1000,
      });

      setupConnectedClient(mockClient);
      await timeoutClient.init();

      // Set up fake timers after client initialization
      vi.useFakeTimers();

      try {
        // Mock publish to never call callback (simulating hanging publish)
        getMockClient().publish.mockImplementation(() => {
          // Don't call callback to simulate hanging publish
        });

        // Start publish and advance timers to trigger timeout
        const publishPromise = timeoutClient.publish(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE);

        // Advance timers by more than the timeout to trigger the rejection
        vi.advanceTimersByTime(1500);

        // Expect timeout error (line 258)
        await expect(publishPromise).rejects.toThrow(
          `Publish to ${TEST_FIXTURES.TOPIC} timeout after 1000ms`,
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  /**
   * Tests for subscription
   */
  describe("subscribe", () => {
    beforeEach(async () => {
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
      await mqttClient.init();
    });

    it("should subscribe to single topic successfully", async () => {
      setupSuccessfulSubscription(mockClient, TEST_FIXTURES.TOPIC);

      await mqttClient.subscribe(TEST_FIXTURES.TOPIC);

      expect(getMockClient().subscribe).toHaveBeenCalledWith(
        TEST_FIXTURES.TOPIC,
        {},
        expect.any(Function),
      );
    });

    it("should subscribe to multiple topics", async () => {
      getMockClient().subscribe.mockImplementation((topicList, options, callback) => {
        callback(
          null,
          TEST_FIXTURES.ADDITIONAL_TOPICS.map((topic: string) => ({ topic, qos: 0 })),
        );
      });

      await mqttClient.subscribe(TEST_FIXTURES.ADDITIONAL_TOPICS);

      expect(getMockClient().subscribe).toHaveBeenCalledWith(
        TEST_FIXTURES.ADDITIONAL_TOPICS,
        {},
        expect.any(Function),
      );
    });

    it("should subscribe with options", async () => {
      const subscribeOptions = { qos: 1 as const };
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 1 }]);
      });

      await mqttClient.subscribe(TEST_FIXTURES.TOPIC, subscribeOptions);

      expect(getMockClient().subscribe).toHaveBeenCalledWith(
        TEST_FIXTURES.TOPIC,
        subscribeOptions,
        expect.any(Function),
      );
    });

    it("should handle subscription errors", async () => {
      const subscribeError = new Error(TEST_FIXTURES.ERROR_SUBSCRIPTION_FAILED);
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(subscribeError);
      });

      await expect(mqttClient.subscribe(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        `Failed to subscribe to ${TEST_FIXTURES.TOPIC}: ${TEST_FIXTURES.ERROR_SUBSCRIPTION_FAILED}`,
      );
    });

    it("should handle subscription errors with multiple topics", async () => {
      const subscribeError = new Error(TEST_FIXTURES.ERROR_SUBSCRIPTION_FAILED);
      getMockClient().subscribe.mockImplementation((topicList, options, callback) => {
        callback(subscribeError);
      });

      await expect(mqttClient.subscribe(TEST_FIXTURES.ADDITIONAL_TOPICS)).rejects.toThrow(
        `Failed to subscribe to topic1, topic2, topic3: ${TEST_FIXTURES.ERROR_SUBSCRIPTION_FAILED}`,
      );
    });

    it("should throw error when client not initialized", async () => {
      mqttClient = new MqttClient();

      await expect(mqttClient.subscribe(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        "MqttClient is not initialized. Call init() first.",
      );
    });

    it("should throw error when topic is empty", async () => {
      await expect(mqttClient.subscribe("")).rejects.toThrow(TEST_FIXTURES.ERROR_TOPIC_REQUIRED);
    });

    it("should throw error when topic array is empty", async () => {
      await expect(mqttClient.subscribe([])).rejects.toThrow(TEST_FIXTURES.ERROR_TOPIC_REQUIRED);
    });

    it("should handle subscribe timeout for single topic", async () => {
      // Create a client with short subscribe timeout for testing
      const timeoutClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, {
        ...TEST_FIXTURES.CONFIG_BASIC,
        subscribeTimeout: 1000,
      });

      setupConnectedClient(mockClient);
      await timeoutClient.init();

      // Set up fake timers after client initialization
      vi.useFakeTimers();

      try {
        // Mock subscribe to never call callback (simulating hanging subscribe)
        getMockClient().subscribe.mockImplementation(() => {
          // Don't call callback to simulate hanging subscribe
        });

        // Start subscribe and advance timers to trigger timeout
        const subscribePromise = timeoutClient.subscribe(TEST_FIXTURES.TOPIC);

        // Advance timers by more than the timeout to trigger the rejection
        vi.advanceTimersByTime(1500);

        // Expect timeout error (lines 308-314)
        await expect(subscribePromise).rejects.toThrow(
          `Subscribe to ${TEST_FIXTURES.TOPIC} timeout after 1000ms`,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("should handle subscribe timeout for multiple topics", async () => {
      // Create a client with short subscribe timeout for testing
      const timeoutClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, {
        ...TEST_FIXTURES.CONFIG_BASIC,
        subscribeTimeout: 1000,
      });

      setupConnectedClient(mockClient);
      await timeoutClient.init();

      // Set up fake timers after client initialization
      vi.useFakeTimers();

      try {
        // Mock subscribe to never call callback (simulating hanging subscribe)
        getMockClient().subscribe.mockImplementation(() => {
          // Don't call callback to simulate hanging subscribe
        });

        // Start subscribe and advance timers to trigger timeout
        const subscribePromise = timeoutClient.subscribe(TEST_FIXTURES.ADDITIONAL_TOPICS);

        // Advance timers by more than the timeout to trigger the rejection
        vi.advanceTimersByTime(1500);

        // Expect timeout error with comma-separated topics (lines 308-314)
        await expect(subscribePromise).rejects.toThrow(
          `Subscribe to topic1, topic2, topic3 timeout after 1000ms`,
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  /**
   * Tests for topic unsubscription
   */
  describe("topic unsubscription", () => {
    beforeEach(async () => {
      setupConnectedClient(mockClient);
      await mqttClient.init();
    });

    it("should unsubscribe from single topic successfully", async () => {
      setupSuccessfulUnsubscription(mockClient);

      await mqttClient.unsubscribe(TEST_FIXTURES.TOPIC);

      expect(getMockClient().unsubscribe).toHaveBeenCalledWith(
        TEST_FIXTURES.TOPIC,
        expect.any(Function),
      );
    });

    it("should unsubscribe from multiple topics", async () => {
      getMockClient().unsubscribe.mockImplementation((topicList, callback) => {
        callback(null);
      });

      await mqttClient.unsubscribe(TEST_FIXTURES.ADDITIONAL_TOPICS);

      expect(getMockClient().unsubscribe).toHaveBeenCalledWith(
        TEST_FIXTURES.ADDITIONAL_TOPICS,
        expect.any(Function),
      );
    });

    it("should handle unsubscription errors", async () => {
      const unsubscribeError = new Error("Unsubscription failed");
      getMockClient().unsubscribe.mockImplementation((topic, callback) => {
        callback(unsubscribeError);
      });

      await expect(mqttClient.unsubscribe(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        `Failed to unsubscribe from ${TEST_FIXTURES.TOPIC}: Unsubscription failed`,
      );
    });

    it("should throw error when client not initialized", async () => {
      mqttClient = new MqttClient();

      await expect(mqttClient.unsubscribe(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        "MqttClient is not initialized. Call init() first.",
      );
    });
  });

  /**
   * Tests for message waiting
   */
  describe("waitForMessage", () => {
    beforeEach(async () => {
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
      await mqttClient.init();
    });

    it("should wait for and return message", async () => {
      // Mock successful subscription
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Start waiting for message
      const waitPromise = mqttClient.waitForMessage(
        TEST_FIXTURES.TOPIC,
        TEST_FIXTURES.DEFAULT_TIMEOUT,
      );

      // Give the waitForMessage method time to set up its internal callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Simulate message arrival by directly calling the internal callback system
      // This simulates what happens when the MQTT client receives a message
      const messageCallbacks = getMessageCallbacks(mqttClient);
      const callbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      if (callbacks.length > 0) {
        setTimeout(() => {
          // Call the callback with the message (simulating MQTT message reception)
          const callback = callbacks[0];
          if (typeof callback === "function") {
            callback(TEST_FIXTURES.MESSAGE);
          }
        }, 10);
      }

      const result = await waitPromise;
      expect(result).toBe(TEST_FIXTURES.MESSAGE);
    });

    it("should wait for and return Buffer message as string", async () => {
      const testMessage = Buffer.from(TEST_FIXTURES.MESSAGE);

      // Mock successful subscription
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Start waiting for message
      const waitPromise = mqttClient.waitForMessage(
        TEST_FIXTURES.TOPIC,
        TEST_FIXTURES.DEFAULT_TIMEOUT,
      );

      // Give the waitForMessage method time to set up its internal callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Simulate message arrival by directly calling the internal callback system
      // This simulates what happens when the MQTT client receives a Buffer message
      const messageCallbacks = getMessageCallbacks(mqttClient);
      const callbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      if (callbacks.length > 0) {
        setTimeout(() => {
          // Call the callback with the Buffer message (simulating MQTT message reception)
          const callback = callbacks[0];
          if (typeof callback === "function") {
            callback(testMessage);
          }
        }, 10);
      }

      const result = await waitPromise;
      // Buffer messages should be converted to string by waitForMessage
      expect(result).toBe(TEST_FIXTURES.MESSAGE);
    });

    it("should return null on timeout", async () => {
      vi.useFakeTimers();

      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      const waitPromise = mqttClient.waitForMessage(TEST_FIXTURES.TOPIC, 1000);

      // Fast-forward time to trigger timeout
      await vi.advanceTimersByTimeAsync(1000);
      const result = await waitPromise;

      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it("should handle subscription errors in waitForMessage", async () => {
      const subscribeError = new Error("Subscription failed");
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(subscribeError);
      });

      await expect(mqttClient.waitForMessage(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        `Error waiting for message on topic ${TEST_FIXTURES.TOPIC}: Failed to subscribe to ${TEST_FIXTURES.TOPIC}: Subscription failed`,
      );
    });

    it("should throw error when client not initialized", async () => {
      mqttClient = new MqttClient();

      await expect(mqttClient.waitForMessage(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        "MqttClient is not initialized. Call init() first.",
      );
    });

    it("should throw error when topic is empty", async () => {
      await expect(mqttClient.waitForMessage("")).rejects.toThrow(
        "Topic is required for waitForMessage",
      );
    });

    it("should use default timeout when not specified", async () => {
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Start waiting without timeout parameter (should use default 30000ms)
      const waitPromise = mqttClient.waitForMessage(TEST_FIXTURES.TOPIC);

      // Verify the method accepts no timeout parameter and returns a Promise
      expect(waitPromise).toBeInstanceOf(Promise);

      // Give the waitForMessage method time to set up its internal callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Simulate message arrival by directly calling the internal callback system
      const messageCallbacks = getMessageCallbacks(mqttClient);
      const callbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      if (callbacks.length > 0) {
        setTimeout(() => {
          // Call the callback with the message (simulating MQTT message reception)
          const callback = callbacks[0];
          if (typeof callback === "function") {
            callback(TEST_FIXTURES.MESSAGE);
          }
        }, 10);
      }

      const result = await waitPromise;
      expect(result).toBe(TEST_FIXTURES.MESSAGE);
    });
  });

  /**
   * Tests for message callback management
   */
  describe("message callback management", () => {
    beforeEach(async () => {
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
      await mqttClient.init();
    });

    it("should handle message events and trigger callbacks", async () => {
      // Mock successful subscription
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Start waiting for message to register callback
      const waitPromise = mqttClient.waitForMessage(
        TEST_FIXTURES.TOPIC,
        TEST_FIXTURES.DEFAULT_TIMEOUT,
      );

      // Give the waitForMessage method time to set up its internal callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify callback is registered in the message callback system
      const messageCallbacks = getMessageCallbacks(mqttClient);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(true);
      expect(messageCallbacks.get(TEST_FIXTURES.TOPIC)).toHaveLength(1);

      // Simulate message arrival by directly calling the internal callback system
      // This simulates what happens when the MQTT client receives a message event
      const callbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      if (callbacks.length > 0) {
        setTimeout(() => {
          // Call the callback with the message (simulating MQTT message reception)
          const callback = callbacks[0];
          if (typeof callback === "function") {
            callback(TEST_FIXTURES.MESSAGE);
          }
        }, 10);
      }

      const result = await waitPromise;
      expect(result).toBe(TEST_FIXTURES.MESSAGE);
    });

    it("should clean up callbacks after message received", async () => {
      // Mock successful subscription
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Start waiting for message to register callback
      const waitPromise = mqttClient.waitForMessage(
        TEST_FIXTURES.TOPIC,
        TEST_FIXTURES.DEFAULT_TIMEOUT,
      );

      // Give the waitForMessage method time to set up its internal callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify callback is registered
      const messageCallbacks = getMessageCallbacks(mqttClient);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(true);
      expect(messageCallbacks.get(TEST_FIXTURES.TOPIC)).toHaveLength(1);

      // Simulate message arrival by directly calling the internal callback system
      const callbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      if (callbacks.length > 0) {
        setTimeout(() => {
          // Call the callback with the message (simulating MQTT message reception)
          const callback = callbacks[0];
          if (typeof callback === "function") {
            callback(TEST_FIXTURES.MESSAGE);
          }
        }, 10);
      }

      // Wait for message processing to complete
      const result = await waitPromise;
      expect(result).toBe(TEST_FIXTURES.MESSAGE);

      // Verify callback is cleaned up after message received
      // The waitForMessage implementation should remove the callback after receiving a message
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(false);
    });

    it("should clean up callbacks on timeout", async () => {
      const shortTimeout = 100; // Use a short timeout for faster test execution

      // Mock successful subscription
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Start waiting for message with short timeout - this will register a callback
      const waitPromise = mqttClient.waitForMessage(TEST_FIXTURES.TOPIC, shortTimeout);

      // Give the waitForMessage method time to set up its internal callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify callback is registered before timeout
      const messageCallbacks = getMessageCallbacks(mqttClient);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(true);
      expect(messageCallbacks.get(TEST_FIXTURES.TOPIC)).toHaveLength(1);

      // Wait for the timeout to occur (no message sent, so it should timeout)
      const result = await waitPromise;
      expect(result).toBeNull(); // Should return null on timeout

      // Verify callback is cleaned up after timeout
      // The waitForMessage implementation should remove the callback after timeout
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(false);
    });

    it("should handle removeCallback when topic has no callbacks", async () => {
      // Mock successful subscription
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Create a spy on the removeCallback method to test line 405 directly
      // Using a more specific type for better type safety
      type MqttClientWithPrivate = MqttClient & {
        removeCallback: (topic: string, callback: MessageCallback) => void;
      };
      const removeCallbackSpy = vi.spyOn(
        mqttClient as unknown as MqttClientWithPrivate,
        "removeCallback",
      );

      // Start waiting for message to register callback
      const waitPromise = mqttClient.waitForMessage(TEST_FIXTURES.TOPIC, 100); // Short timeout

      // Give the waitForMessage method time to set up its internal callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify callback is registered
      const messageCallbacks = getMessageCallbacks(mqttClient);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(true);
      const originalCallbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      expect(originalCallbacks).toHaveLength(1);

      // Manually clear the callbacks to simulate the case where get() returns undefined
      // This will cause line 405 to use the || [] fallback when removeCallback is called
      messageCallbacks.delete(TEST_FIXTURES.TOPIC);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(false);

      // Wait for timeout to trigger removeCallback on a non-existent topic
      await waitPromise; // This will be null due to timeout

      // Verify removeCallback was called (it gets called during timeout cleanup)
      expect(removeCallbackSpy).toHaveBeenCalled();

      // The test passes if no errors are thrown when removeCallback handles null/undefined (line 405)
      // The || [] fallback in line 405 should prevent any errors
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(false);

      removeCallbackSpy.mockRestore();
    });

    it("should handle removeCallback with multiple callbacks and preserve remaining ones", async () => {
      // Mock successful subscription
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Create multiple waitForMessage calls with shorter timeouts to register multiple callbacks
      const shortTimeout = 200;
      const waitPromise1 = mqttClient.waitForMessage(TEST_FIXTURES.TOPIC, shortTimeout);
      const waitPromise2 = mqttClient.waitForMessage(TEST_FIXTURES.TOPIC, shortTimeout);
      const waitPromise3 = mqttClient.waitForMessage(TEST_FIXTURES.TOPIC, shortTimeout);

      // Give time for all callbacks to be registered
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify multiple callbacks are registered
      const messageCallbacks = getMessageCallbacks(mqttClient);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(true);
      const callbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      expect(callbacks).toHaveLength(3);

      // Get a reference to the first callback before triggering it
      const firstCallback = callbacks[0];

      setTimeout(() => {
        // Call the first callback with the message (simulating MQTT message reception)
        if (typeof firstCallback === "function") {
          firstCallback(TEST_FIXTURES.MESSAGE);
        }
      }, 10);

      // Wait for the first promise to resolve
      const result1 = await waitPromise1;
      expect(result1).toBe(TEST_FIXTURES.MESSAGE);

      // Verify that line 413 was executed: remaining callbacks should still be in the Map
      // After removing one callback, there should be 2 remaining
      const remainingCallbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      expect(remainingCallbacks).toHaveLength(2);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(true); // Topic should still exist

      // Trigger the second callback to test line 413 again
      const secondCallback = remainingCallbacks[0];
      setTimeout(() => {
        if (typeof secondCallback === "function") {
          secondCallback("second message");
        }
      }, 10);

      const result2 = await waitPromise2;
      expect(result2).toBe("second message");

      // After second callback removal, should still have 1 remaining (line 413 again)
      const finalCallbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      expect(finalCallbacks).toHaveLength(1);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(true);

      // Let the third promise timeout to clean up naturally
      const result3 = await waitPromise3;
      expect(result3).toBeNull(); // Should timeout

      // After all callbacks are removed, the topic should be deleted
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(false);
    });
  });

  /**
   * Tests for client cleanup
   */
  describe("cleanupClient", () => {
    beforeEach(async () => {
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
      await mqttClient.init();
    });

    it("should cleanup client resources", async () => {
      getMockClient().end.mockImplementation((force, options, callback) => {
        if (callback) callback();
      });

      await mqttClient.cleanupClient();

      expect(getMockClient().end).toHaveBeenCalledWith(false, {}, expect.any(Function));
    });

    it("should handle cleanup errors gracefully", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());
      // Simplifying mock implementation to avoid unused parameter warnings
      getMockClient().end.mockImplementation(() => {
        throw new Error("Cleanup failed");
      });

      await expect(mqttClient.cleanupClient()).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Error disconnecting MQTT client: Cleanup failed",
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle cleanup when client is already null", async () => {
      // Create a fresh client that hasn't been initialized (client will be null)
      const freshClient = new MqttClient(TEST_FIXTURES.CLIENT_ID, TEST_FIXTURES.CONFIG_MINIMAL);

      // Verify client is null before cleanup
      expect(freshClient["client"]).toBeNull();

      // Cleanup should complete without errors even when client is null
      await expect(freshClient.cleanupClient()).resolves.not.toThrow();

      // Verify no MQTT client methods were called since client was null
      expect(getMockClient().end).not.toHaveBeenCalled();

      // Client should still be null after cleanup
      expect(freshClient["client"]).toBeNull();
    });

    it("should clear message callbacks during cleanup", async () => {
      setupConnectedClient(mockClient);
      await mqttClient.init();

      // Mock successful subscription to set up message callbacks
      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(null, [{ topic: TEST_FIXTURES.TOPIC, qos: 0 }]);
      });

      // Subscribe to a topic to create message callbacks
      await mqttClient.subscribe(TEST_FIXTURES.TOPIC);

      // Manually add some callbacks to simulate active waitForMessage calls
      const messageCallbacks = getMessageCallbacks(mqttClient);
      const testCallback1 = vi.fn();
      const testCallback2 = vi.fn();

      // Add callbacks to the topic
      const callbacks = messageCallbacks.get(TEST_FIXTURES.TOPIC) || [];
      callbacks.push(testCallback1, testCallback2);
      messageCallbacks.set(TEST_FIXTURES.TOPIC, callbacks);

      // Verify callbacks are present before cleanup
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(true);
      expect(messageCallbacks.get(TEST_FIXTURES.TOPIC)).toHaveLength(2);
      expect(messageCallbacks.size).toBeGreaterThan(0);

      // Simulate message arrival using the proper MQTT client message flow
      // This directly triggers the MQTT client's internal message event handler
      const testMessage = Buffer.from(TEST_FIXTURES.MESSAGE);

      // Simulate the MQTT "message" event being fired (this is how real MQTT messages arrive)
      const messageEventHandler = getMockClient().on.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1];
      if (messageEventHandler) {
        messageEventHandler(TEST_FIXTURES.TOPIC, testMessage);
      }

      // Verify callbacks were called with the message
      expect(testCallback1).toHaveBeenCalledWith(testMessage);
      expect(testCallback2).toHaveBeenCalledWith(testMessage);

      // Mock successful client cleanup
      getMockClient().end.mockImplementation((force, options, callback) => {
        if (callback) callback();
      });

      // Perform cleanup
      await mqttClient.cleanupClient();

      // Verify all message callbacks are cleared
      expect(messageCallbacks.size).toBe(0);
      expect(messageCallbacks.has(TEST_FIXTURES.TOPIC)).toBe(false);

      // Reset callback mocks and try sending another message after cleanup
      testCallback1.mockClear();
      testCallback2.mockClear();

      // Send another message after cleanup - callbacks should not be called
      const messageEventHandlerAfterCleanup = getMockClient().on.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1];
      if (messageEventHandlerAfterCleanup) {
        messageEventHandlerAfterCleanup(TEST_FIXTURES.TOPIC, Buffer.from(TEST_FIXTURES.MESSAGE));
      }

      // Verify callbacks were NOT called after cleanup
      expect(testCallback1).not.toHaveBeenCalled();
      expect(testCallback2).not.toHaveBeenCalled();
    });

    it("should handle cleanup timeout", async () => {
      vi.useFakeTimers();

      // Mock end method to never call callback (simulate hanging)
      getMockClient().end.mockImplementation(() => {
        // Don't call callback to simulate hanging
      });

      const cleanupPromise = mqttClient.cleanupClient();

      // Fast-forward past cleanup timeout
      await vi.advanceTimersByTimeAsync(6000);

      await expect(cleanupPromise).resolves.not.toThrow();

      vi.useRealTimers();
    });
  });

  /**
   * Tests for error handling
   */
  describe("error handling", () => {
    beforeEach(async () => {
      setupConnectedClient(mockClient);
      await mqttClient.init();
    });

    it("should handle non-Error exceptions in publish", async () => {
      getMockClient().publish.mockImplementation((topic, message, options, callback) => {
        callback(TEST_FIXTURES.ERROR_STRING);
      });

      await expect(mqttClient.publish(TEST_FIXTURES.TOPIC, TEST_FIXTURES.MESSAGE)).rejects.toThrow(
        `Failed to publish message to ${TEST_FIXTURES.TOPIC}: ${TEST_FIXTURES.ERROR_STRING}`,
      );
    });

    it("should handle non-Error exceptions in subscribe", async () => {
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
      await mqttClient.init();

      getMockClient().subscribe.mockImplementation((topic, options, callback) => {
        callback(TEST_FIXTURES.ERROR_NETWORK_TIMEOUT);
      });

      await expect(mqttClient.subscribe(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        `Failed to subscribe to ${TEST_FIXTURES.TOPIC}: ${TEST_FIXTURES.ERROR_NETWORK_TIMEOUT}`,
      );
    });

    it("should handle non-Error exceptions in unsubscribe", async () => {
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
      await mqttClient.init();

      getMockClient().unsubscribe.mockImplementation((topic, callback) => {
        callback(TEST_FIXTURES.ERROR_CONNECTION_LOST);
      });

      await expect(mqttClient.unsubscribe(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        `Failed to unsubscribe from ${TEST_FIXTURES.TOPIC}: ${TEST_FIXTURES.ERROR_CONNECTION_LOST}`,
      );
    });

    it("should handle non-Error exceptions in waitForMessage", async () => {
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
      await mqttClient.init();

      // Mock subscribe to throw a non-Error exception directly
      const originalSubscribe = mqttClient.subscribe;
      vi.spyOn(mqttClient, "subscribe").mockImplementation(() => {
        // Using string literal instead of Error object to test error instanceof Error condition
        throw "Non-error exception string";
      });

      await expect(mqttClient.waitForMessage(TEST_FIXTURES.TOPIC)).rejects.toThrow(
        `Error waiting for message on topic ${TEST_FIXTURES.TOPIC}: Non-error exception string`,
      );

      // Restore original method
      mqttClient.subscribe = originalSubscribe;
    });

    it("should handle non-Error exceptions in cleanup", async () => {
      mockClient.connected = true;
      getMockClient().on.mockImplementation((event: string, callback: () => void) => {
        if (event === "connect") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
      await mqttClient.init();

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());
      getMockClient().end.mockImplementation(() => {
        // Using string literal instead of Error object to test error instanceof Error condition
        throw "String cleanup error";
      });

      await expect(mqttClient.cleanupClient()).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Error disconnecting MQTT client: String cleanup error",
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
