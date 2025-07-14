/**
 * Focused tests for MQTT client initialization
 * Tests the initializeClient method and related error handling
 */
import mqtt from "mqtt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MqttClient } from "../../../src/clients";
import {
  cleanupAfterTests,
  mockEnd,
  mockMqttClient,
  mockOn,
  mockOnce,
  setupDefaultMocks,
  SHORT_TIMEOUT,
  TEST_TIMEOUT,
} from "./mqtt-test-helpers";

// Mock the mqtt module
vi.mock("mqtt", () => {
  return {
    default: {
      connect: vi.fn(() => mockMqttClient),
    },
    connect: vi.fn(() => mockMqttClient),
  };
});

describe("MqttClient Initialization Tests", () => {
  let client: MqttClient;

  beforeEach(() => {
    // Set up default mocks for consistent test behavior
    setupDefaultMocks();
  });

  afterEach(async () => {
    try {
      // Always attempt to destroy the client to clean up resources
      if (client) {
        await client.destroy();
      }
    } catch {
      // Ignore errors during cleanup
    } finally {
      // Clean up after tests
      cleanupAfterTests();
    }
  });

  describe("Connection configuration", () => {
    it(
      "should throw error if broker URL is empty",
      async () => {
        // Create client with empty URL
        client = new MqttClient("TestClient", { url: "" });

        // Initialization should fail
        await expect(client.init()).rejects.toThrow("MQTT client requires a broker URL");
      },
      TEST_TIMEOUT,
    );

    it(
      "should use default broker URL if not provided",
      async () => {
        // Create client without URL config
        client = new MqttClient("TestClient", {});

        // Initialize client
        await client.init();

        // Should connect with default URL
        expect(mqtt.connect).toHaveBeenCalledWith(
          "mqtt://localhost:1883",
          expect.objectContaining({
            clientId: expect.any(String),
          }),
        );
      },
      TEST_TIMEOUT,
    );

    it(
      "should use custom reconnect period if provided",
      async () => {
        // Create client with custom reconnect period
        client = new MqttClient("TestClient", {
          url: "mqtt://test.example.com",
          reconnectPeriod: 10000,
        });

        // Initialize client
        await client.init();

        // Should connect with custom reconnect period
        expect(mqtt.connect).toHaveBeenCalledWith(
          "mqtt://test.example.com",
          expect.objectContaining({
            reconnectPeriod: 10000,
          }),
        );
      },
      TEST_TIMEOUT,
    );

    it(
      "should use custom keep alive interval if provided",
      async () => {
        // Create client with custom keep alive
        client = new MqttClient("TestClient", {
          url: "mqtt://test.example.com",
          keepAlive: 60,
        });

        // Initialize client
        await client.init();

        // Should connect with custom keep alive
        expect(mqtt.connect).toHaveBeenCalledWith(
          "mqtt://test.example.com",
          expect.objectContaining({
            keepalive: 60,
          }),
        );
      },
      TEST_TIMEOUT,
    );
  });

  describe("Connection events", () => {
    it(
      "should register handlers for connect, error, close, offline, and message events",
      async () => {
        // Create and initialize client
        client = new MqttClient("TestClient");
        await client.init();

        // Verify event handlers are registered
        expect(mockOn).toHaveBeenCalledWith("connect", expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith("close", expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith("offline", expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith("message", expect.any(Function));
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle connection error during initialization",
      async () => {
        // Mock the mqtt.connect to throw an error
        (mqtt.connect as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
          throw new Error("Connection refused");
        });

        // Create client
        client = new MqttClient("TestClient");

        // Should reject with error
        await expect(client.init()).rejects.toThrow("Connection refused");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle close event after initialization",
      async () => {
        // Create and initialize client
        client = new MqttClient("TestClient");
        await client.init();

        // Find the close event handler
        const closeHandlers = mockOn.mock.calls
          .filter(([event]) => event === "close")
          .map(([, handler]) => handler);

        // Should have at least one close handler
        expect(closeHandlers.length).toBeGreaterThan(0);

        // Create a spy for console.warn to verify warning is logged
        const warnSpy = vi.spyOn(console, "warn");

        // Call the close handler
        const closeHandler = closeHandlers[0];
        if (closeHandler) {
          closeHandler();
        }

        // Should log warning
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("MQTT connection closed"));

        // Restore console.warn
        warnSpy.mockRestore();
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle error event after initialization",
      async () => {
        // Store the original implementation of console.error
        const originalConsoleError = console.error;

        // Create a mock for console.error
        const errorMock = vi.fn();
        console.error = errorMock;

        try {
          // Create client with configuration
          client = new MqttClient("TestClient");

          // Store the error handler to be called later
          let errorHandler: ((err: Error) => void) | undefined;

          // Mock the on method to capture the error handler
          mockOn.mockImplementation((event: string, callback: (...args: unknown[]) => void) => {
            if (event === "connect") {
              // Call connect callback immediately
              callback();
            } else if (event === "error") {
              // Store the error handler for later use
              errorHandler = callback as (err: Error) => void;
            }
            return mockMqttClient;
          });

          // Initialize client - this will set up the error handler
          await client.init();

          // Verify that an error handler was registered
          expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
          expect(errorHandler).toBeDefined();

          // Create a test error
          const testError = new Error("MQTT client error");

          // Simulate an error event by calling the handler
          if (errorHandler) {
            errorHandler(testError);
          }

          // Verify error was logged with correct format
          // The client ID might be randomly generated, so we just check for the error message pattern
          expect(errorMock).toHaveBeenCalledWith(
            expect.stringMatching(/MQTT client error for .+: MQTT client error/),
          );

          // Verify client remains initialized after error
          expect(client.isInitialized()).toBe(true);
        } finally {
          // Restore original console.error
          console.error = originalConsoleError;
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe("Initialization failures", () => {
    it(
      "should throw if mqtt.connect throws an error",
      async () => {
        // Mock mqtt.connect to throw
        vi.mocked(mqtt.connect).mockImplementationOnce(() => {
          throw new Error("Connection failed");
        });

        // Create client
        client = new MqttClient("TestClient");

        // Should throw on initialization
        await expect(client.init()).rejects.toThrow("Connection failed");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle connection timeout",
      async () => {
        // Create client with short connection timeout
        client = new MqttClient("TestClient", {
          connectionTimeout: SHORT_TIMEOUT,
        });

        // Override both on and once to prevent any callbacks from being called
        mockOn.mockReturnValue(mockMqttClient);
        mockOnce.mockReturnValue(mockMqttClient);

        // Attempt to initialize
        const initPromise = client.init();

        // Advance timers to trigger timeout
        vi.advanceTimersByTime(SHORT_TIMEOUT);

        // Should reject with timeout error
        await expect(initPromise).rejects.toThrow("Connection timeout");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle connection refused",
      async () => {
        // Create client
        client = new MqttClient("TestClient");

        // Mock the error directly in the mqtt.connect call
        vi.mocked(mqtt.connect).mockImplementationOnce(() => {
          // Immediately throw a connection refused error
          const error = new Error("Connection refused") as NodeJS.ErrnoException;
          error.code = "ECONNREFUSED";
          throw error;
        });

        // Attempt to initialize
        // Should reject with specific error message containing connection refused
        await expect(client.init()).rejects.toThrow(/Connection refused/);
      },
      TEST_TIMEOUT,
    );
  });

  describe("Multiple initialization attempts", () => {
    it(
      "should not reinitialize if already initialized",
      async () => {
        // Create client
        client = new MqttClient("TestClient");

        // Mock isInitialized to control the test flow
        const isInitializedSpy = vi.spyOn(client, "isInitialized");
        isInitializedSpy.mockReturnValueOnce(false).mockReturnValue(true);

        // Initialize once
        await client.init();

        // Clear mocks to track new calls
        vi.mocked(mqtt.connect).mockClear();

        // Initialize again
        await client.init();

        // Should not connect again
        expect(mqtt.connect).not.toHaveBeenCalled();
      },
      TEST_TIMEOUT,
    );

    it(
      "should be able to reinitialize after destroy",
      async () => {
        // Create client
        client = new MqttClient("TestClient");

        // Mock isInitialized to control the test flow
        const isInitializedSpy = vi.spyOn(client, "isInitialized");
        isInitializedSpy
          .mockReturnValueOnce(false) // First init check
          .mockReturnValue(true) // After init
          .mockReturnValueOnce(false) // After destroy
          .mockReturnValue(true); // After reinit

        // Mock the end method to call its callback immediately
        mockEnd.mockImplementation((_force, _opts, callback) => {
          if (callback) callback();
          return mockMqttClient;
        });

        // Initialize
        await client.init();

        // Destroy - reset the isInitialized state
        await client.destroy();
        isInitializedSpy.mockReset();
        isInitializedSpy.mockReturnValueOnce(false).mockReturnValue(true);

        // Clear mocks to track new calls
        vi.mocked(mqtt.connect).mockClear();

        // Reinitialize
        await client.init();

        // Should connect again
        expect(mqtt.connect).toHaveBeenCalled();
      },
      TEST_TIMEOUT,
    );
  });
});
