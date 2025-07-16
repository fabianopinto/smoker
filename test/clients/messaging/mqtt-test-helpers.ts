/**
 * Shared test helpers for MQTT client tests
 *
 * This file contains common setup code and utilities for MQTT client tests
 * to reduce duplication and standardize testing approaches.
 */
import { vi } from "vitest";
import { MqttClient } from "../../../src/clients";

// Standard timeout for tests (in ms)
export const TEST_TIMEOUT = 10000;

// Short timeout for quick operations (in ms)
export const SHORT_TIMEOUT = 100;

// Create mock functions for MQTT client operations
export const mockOn = vi.fn();
export const mockOnce = vi.fn();
export const mockPublish = vi.fn();
export const mockSubscribe = vi.fn();
export const mockUnsubscribe = vi.fn();
export const mockEnd = vi.fn();
export const mockRemoveAllListeners = vi.fn();

// Create the mock client object
export const mockMqttClient = {
  on: mockOn,
  once: mockOnce,
  publish: mockPublish,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  end: mockEnd,
  removeAllListeners: mockRemoveAllListeners,
};

/**
 * Set up default mock implementations for MQTT client methods
 *
 * This function configures the mock functions with sensible defaults
 * that make tests more predictable and easier to write.
 */
export function setupDefaultMocks() {
  // Clean up mocks and restore previous implementations
  vi.clearAllMocks();
  vi.restoreAllMocks();

  // Use fake timers for consistent test behavior
  vi.useFakeTimers({ shouldAdvanceTime: false });

  // Default implementation for once() method - make callbacks execute synchronously
  mockOnce.mockImplementation((event: string, callback: (...args: unknown[]) => void) => {
    if (event === "connect") {
      // Call connect callback immediately
      callback();
    }
    return mockMqttClient;
  });

  // Default implementation for on() method
  mockOn.mockImplementation((event: string, callback: (...args: unknown[]) => void) => {
    if (event === "connect") {
      // Call connect callback immediately
      callback();
    }
    return mockMqttClient;
  });

  // Make sure any callback in publish gets called immediately
  mockPublish.mockImplementation((_topic, _message, _opts, callback) => {
    if (callback) callback();
    return mockMqttClient;
  });

  // Make sure any callback in subscribe gets called immediately
  mockSubscribe.mockImplementation((_topics, _opts, callback) => {
    if (callback) callback(null);
    return mockMqttClient;
  });

  // Make sure any callback in unsubscribe gets called immediately
  mockUnsubscribe.mockImplementation((_topics, callback) => {
    if (callback) callback(null);
    return mockMqttClient;
  });

  // Default implementation for end() to ensure clean teardown
  mockEnd.mockImplementation((_force, _opts, callback) => {
    if (callback) callback();
    return mockMqttClient;
  });
}

/**
 * Clean up after tests
 *
 * This function handles common cleanup tasks like restoring timers
 */
export function cleanupAfterTests() {
  // Restore real timers to avoid affecting other test files
  vi.useRealTimers();
}

/**
 * Type-safe way to access private properties of the MQTT client
 *
 * @param client The MQTT client instance
 * @returns A typed object with access to private properties
 */
export function getPrivateProperties(client: MqttClient) {
  return client as unknown as {
    messageCallbacks: Map<string, ((message: string | Buffer) => void)[]>;
    client: typeof mockMqttClient | null;
    brokerUrl: string;
    clientId: string;
    removeCallback: (topic: string, callback: (message: string | Buffer) => void) => void;
  };
}
