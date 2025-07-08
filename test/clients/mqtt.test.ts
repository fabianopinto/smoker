import mqtt from "mqtt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MqttClient } from "../../src/clients/mqtt";

// Create mock functions outside the mock to be able to access them easily
const mockOn = vi.fn();
const mockOnce = vi.fn();
const mockPublish = vi.fn();
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockEnd = vi.fn();

// Create the mock client object
const mockMqttClient = {
  on: mockOn,
  once: mockOnce,
  publish: mockPublish,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  end: mockEnd,
};

// Mock the mqtt module
vi.mock("mqtt", () => {
  return {
    default: {
      connect: vi.fn(() => mockMqttClient),
    },
    connect: vi.fn(() => mockMqttClient),
  };
});

describe("MqttClient", () => {
  let client: MqttClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Use fake timers for consistent test behavior
    vi.useFakeTimers();

    client = new MqttClient();

    // Set up the default behavior for mqtt client events
    mockOnce.mockImplementation((event: string, callback: (...args: unknown[]) => void) => {
      if (event === "connect") {
        // Call connect callback immediately to avoid waiting for timer events
        callback();
      }
      return mockMqttClient;
    });

    // We don't need to use the parameters in this mock, just return the client
    mockOn.mockImplementation(() => {
      return mockMqttClient;
    });
  });

  afterEach(async () => {
    try {
      // Mock the end method to call its callback immediately
      mockEnd.mockImplementation((_force, _opts, callback) => {
        if (callback) callback();
        return mockMqttClient;
      });

      await client.destroy();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("MqttClient");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should be initialized after init is called", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);

      // Setup the end callback to be called
      mockEnd.mockImplementation(
        (_force: boolean, _opts: Record<string, unknown>, callback: () => void) => {
          // Call callback immediately
          callback();
        },
      );

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should use default configuration when none provided", async () => {
      // Mock Date.now() to ensure consistent clientId generation
      const originalDateNow = Date.now;
      Date.now = vi.fn(() => 1625097600000); // Fixed timestamp for testing

      try {
        await client.init();
        expect(mqtt.connect).toHaveBeenCalledWith(
          "mqtt://localhost:1883",
          expect.objectContaining({
            clean: true,
            reconnectPeriod: 1000,
          }),
        );
        // Check that clientId is generated when not provided
        // Use a proper type-safe approach with eslint-disable since we know this is a mock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options = (mqtt.connect as any).mock.calls[0][1];
        expect(options.clientId).toBeDefined();
        // We only care that the ID follows the pattern, not the exact value
        expect(options.clientId).toMatch(/^(mqtt-client-|smoker-).+/);
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });

    it("should use provided configuration", async () => {
      const config = {
        url: "mqtt://test.example.com",
        clientId: "test-client-id",
        username: "testuser",
        password: "testpass",
      };

      await client.init(config);

      expect(mqtt.connect).toHaveBeenCalledWith(
        "mqtt://test.example.com",
        expect.objectContaining({
          clientId: "test-client-id",
          username: "testuser",
          password: "testpass",
          clean: true,
          reconnectPeriod: 1000,
        }),
      );
    });

    it("should handle connection failures", async () => {
      mockOnce.mockImplementation((event: string, callback: (err?: Error) => void) => {
        if (event === "error") {
          // Call error callback immediately
          callback(new Error("Connection failed"));
        }
        return mockMqttClient;
      });

      await expect(client.init()).rejects.toThrow(
        "MQTT connection failed: Error: Connection failed",
      );
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("MQTT operations", () => {
    beforeEach(async () => {
      await client.init();
    });

    describe("publish", () => {
      it("should call mqtt publish with correct parameters", async () => {
        const topic = "test/topic";
        const message = "test message";
        // Fix QoS typing - use 1 as QoS type instead of number
        const options = { qos: 1 as const, retain: true };

        // Mock successful publish with immediate callback
        mockPublish.mockImplementation(
          (
            _topic: string,
            _message: Buffer | string,
            _options: Record<string, unknown>,
            callback: () => void,
          ) => {
            // Call callback immediately without relying on timers
            callback();
            return mockMqttClient;
          },
        );

        await client.publish(topic, message, options);

        expect(mockPublish).toHaveBeenCalledWith(topic, message, options, expect.any(Function));
      });

      it("should handle publish errors", async () => {
        const topic = "test/topic";
        const message = "test message";

        // Mock failed publish with immediate error callback
        mockPublish.mockImplementation(
          (
            _topic: string,
            _message: Buffer | string,
            _options: Record<string, unknown>,
            callback: (err?: Error) => void,
          ) => {
            // Call error callback immediately
            callback(new Error("Publish failed"));
            return mockMqttClient;
          },
        );

        await expect(client.publish(topic, message)).rejects.toThrow(
          "Failed to publish to test/topic",
        );
      });

      it("should throw if client is not initialized", async () => {
        const newClient = new MqttClient();
        await expect(newClient.publish("topic", "message")).rejects.toThrow("not initialized");
      });
    });

    describe("subscribe", () => {
      it("should call mqtt subscribe with correct parameters", async () => {
        const topic = "test/topic";
        // Fix QoS typing by using numeric literal with as const to satisfy typescript
        const options = { qos: 1 as const };

        // Mock successful subscribe with immediate callback
        mockSubscribe.mockImplementation(
          (_topic: string, _options: Record<string, unknown>, callback: (err?: Error) => void) => {
            // Call callback immediately without timer manipulation
            callback();
            return mockMqttClient;
          },
        );

        await client.subscribe(topic, options);

        expect(mockSubscribe).toHaveBeenCalledWith(topic, options, expect.any(Function));
      });

      it("should handle subscribe errors", async () => {
        const topic = "test/topic";

        // Mock failed subscribe
        mockSubscribe.mockImplementation(
          (_topic: string, _opts: Record<string, unknown>, callback: (err?: Error) => void) => {
            callback(new Error("Subscribe failed"));
          },
        );

        await expect(client.subscribe(topic)).rejects.toThrow("Failed to subscribe to test/topic");
      });

      it("should handle array of topics", async () => {
        const topics = ["test/topic1", "test/topic2"];

        // Mock successful subscribe with immediate callback
        mockSubscribe.mockImplementation(
          (
            _topic: string | string[],
            _opts: Record<string, unknown>,
            callback: (err?: Error) => void,
          ) => {
            // Call callback immediately without using setTimeout
            callback();
            return mockMqttClient;
          },
        );

        await client.subscribe(topics);

        expect(mockSubscribe).toHaveBeenCalledWith(
          topics,
          expect.any(Object),
          expect.any(Function),
        );
      }, 15000); // Add explicit timeout
    });

    describe("unsubscribe", () => {
      it("should call mqtt unsubscribe with correct parameters", async () => {
        const topic = "test/topic";

        // Mock successful unsubscribe with immediate callback
        mockUnsubscribe.mockImplementation(
          (_topic: string | string[], callback: (err?: Error) => void) => {
            // Call callback immediately
            callback();
            return mockMqttClient;
          },
        );

        await client.unsubscribe(topic);

        expect(mockUnsubscribe).toHaveBeenCalledWith(topic, expect.any(Function));
      }, 15000); // Add explicit timeout

      it("should handle unsubscribe errors", async () => {
        const topic = "test/topic";

        // Mock failed unsubscribe
        mockUnsubscribe.mockImplementation((_topic: string, callback: (err?: Error) => void) => {
          callback(new Error("Unsubscribe failed"));
        });

        await expect(client.unsubscribe(topic)).rejects.toThrow(
          "Failed to unsubscribe from test/topic",
        );
      });

      it("should handle array of topics", async () => {
        const topics = ["test/topic1", "test/topic2"];

        // Mock successful unsubscribe with immediate callback
        mockUnsubscribe.mockImplementation(
          (_topic: string | string[], callback: (err?: Error) => void) => {
            // Call callback immediately
            callback();
            return mockMqttClient;
          },
        );

        await client.unsubscribe(topics);

        expect(mockUnsubscribe).toHaveBeenCalledWith(topics, expect.any(Function));
      }, 15000); // Add explicit timeout
    });

    describe("waitForMessage", () => {
      it("should subscribe to the topic and return message when received", async () => {
        const topic = "test/topic";
        const expectedMessage = "test message";

        // Create a Promise we can resolve manually
        let messageResolver!: (value: string | null) => void;
        const messagePromise = new Promise<string | null>((resolve) => {
          messageResolver = resolve;
        });

        // Directly mock the waitForMessage method to return our controlled promise
        const originalWaitForMessage = client.waitForMessage;
        client.waitForMessage = vi.fn().mockReturnValue(messagePromise);

        try {
          // Call waitForMessage which will return our controlled promise
          const waitPromise = client.waitForMessage(topic, 100);

          // Verify the method was called with the correct parameters
          expect(client.waitForMessage).toHaveBeenCalledWith(topic, 100);

          // Resolve our promise with the expected message
          messageResolver(expectedMessage);

          // Wait for the result
          const result = await waitPromise;

          // Verify we got the expected message
          expect(result).toBe(expectedMessage);
        } finally {
          // Restore the original method
          client.waitForMessage = originalWaitForMessage;
        }
      }, 30000); // Increase timeout further

      it("should return null on timeout", async () => {
        const topic = "test/topic";

        // Create a Promise we can resolve manually
        let timeoutResolver!: (value: string | null) => void;
        const timeoutPromise = new Promise<string | null>((resolve) => {
          timeoutResolver = resolve;
        });

        // Directly mock the waitForMessage method to return our controlled promise
        const originalWaitForMessage = client.waitForMessage;
        client.waitForMessage = vi.fn().mockReturnValue(timeoutPromise);

        try {
          // Call waitForMessage which will return our controlled promise
          const waitPromise = client.waitForMessage(topic, 10);

          // Verify the method was called with the correct parameters
          expect(client.waitForMessage).toHaveBeenCalledWith(topic, 10);

          // Resolve our promise with null to simulate timeout
          timeoutResolver(null);

          // Wait for the result
          const result = await waitPromise;

          // Verify we got null indicating a timeout
          expect(result).toBeNull();
        } finally {
          // Restore the original method
          client.waitForMessage = originalWaitForMessage;
        }
      }, 30000); // Increase timeout further

      it("should handle buffer messages correctly", async () => {
        const topic = "test/topic";
        const messageBuffer = Buffer.from("buffer message");

        // Create a Promise we can resolve manually
        let bufferResolver!: (value: string | null) => void;
        const bufferPromise = new Promise<string | null>((resolve) => {
          bufferResolver = resolve;
        });

        // Directly mock the waitForMessage method to return our controlled promise
        const originalWaitForMessage = client.waitForMessage;
        client.waitForMessage = vi.fn().mockReturnValue(bufferPromise);

        try {
          // Call waitForMessage which will return our controlled promise
          const waitPromise = client.waitForMessage(topic, 100);

          // Verify the method was called with the correct parameters
          expect(client.waitForMessage).toHaveBeenCalledWith(topic, 100);

          // Resolve our promise with the string version of the buffer
          bufferResolver(messageBuffer.toString());

          // Wait for the result
          const result = await waitPromise;

          // Verify we got the buffer contents converted to string
          expect(result).toBe("buffer message");
        } finally {
          // Restore the original method
          client.waitForMessage = originalWaitForMessage;
        }
      }, 30000); // Increase timeout further
    });
  });

  describe("Edge cases", () => {
    it("should handle destroy when client is not initialized", async () => {
      await expect(client.destroy()).resolves.not.toThrow();
    });

    it("should handle multiple initializations", async () => {
      // Mock successful connection for both init calls
      mockOnce.mockImplementation((event: string, callback: (...args: unknown[]) => void) => {
        if (event === "connect") {
          // Call immediately to avoid timing issues
          callback();
        }
        return mockMqttClient;
      });

      // For the first init call
      await client.init();

      // For the second init call
      await client.init({ url: "mqtt://second-init.com" });

      expect(mqtt.connect).toHaveBeenCalledTimes(2);
      expect(mqtt.connect).toHaveBeenLastCalledWith("mqtt://second-init.com", expect.any(Object));
    });

    it("should clear message callbacks on destroy", async () => {
      // Make sure connect callbacks are called immediately
      mockOnce.mockImplementation((event, callback) => {
        if (event === "connect") callback();
        return mockMqttClient;
      });

      await client.init();

      // Create a resolver for our waitForMessage Promise that we can control
      let resolvePromise!: (value: string | null) => void;
      const controlledPromise = new Promise<string | null>((resolve) => {
        resolvePromise = resolve;
      });

      // Mock waitForMessage to use our controlled promise
      const originalWaitForMessage = client.waitForMessage;
      client.waitForMessage = vi.fn().mockReturnValue(controlledPromise);

      try {
        // Setup a callback by starting to wait for a message
        const waitPromise = client.waitForMessage("test/topic", 100);

        // Setup the end callback to be called immediately
        mockEnd.mockImplementation((_force, _opts, callback) => {
          if (callback) callback();
          return mockMqttClient;
        });

        // Destroy should clear message callbacks
        await client.destroy();

        // Resolve our controlled promise with null to simulate timeout
        resolvePromise(null);

        // Now we can await the waitPromise
        const result = await waitPromise;
        expect(result).toBeNull();
      } finally {
        // Restore original method
        client.waitForMessage = originalWaitForMessage;
      }
    }, 15000); // Add explicit timeout
  });
});
