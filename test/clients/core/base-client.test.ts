/**
 * Unit tests for BaseServiceClient abstract class
 * Tests the core functionality of the base client implementation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseServiceClient } from "../../../src/clients";

// Concrete implementation of BaseServiceClient for testing
class TestServiceClient extends BaseServiceClient {
  // Track calls to abstract methods for testing
  initializeClientCalled = false;
  cleanupClientCalled = false;
  initializeClientShouldFail = false;
  cleanupClientShouldFail = false;

  // Make protected methods public for testing
  public getConfigPublic<T>(key: string, defaultValue: T): T {
    return this.getConfig(key, defaultValue);
  }

  public ensureInitializedPublic(): void {
    this.ensureInitialized();
  }

  public assertNotNullPublic<T>(value: T | null): asserts value is NonNullable<T> {
    this.assertNotNull(value);
  }

  // Implementation of abstract methods
  protected async initializeClient(): Promise<void> {
    this.initializeClientCalled = true;
    if (this.initializeClientShouldFail) {
      throw new Error("Initialization failed");
    }
  }

  async cleanupClient(): Promise<void> {
    this.cleanupClientCalled = true;
    if (this.cleanupClientShouldFail) {
      throw new Error("Cleanup failed");
    }
  }
}

describe("BaseServiceClient", () => {
  let client: TestServiceClient;

  beforeEach(() => {
    // Create a fresh client instance before each test
    client = new TestServiceClient("TestClient", { testKey: "testValue" });
  });

  afterEach(async () => {
    // Clean up after each test
    if (client.isInitialized()) {
      // Reset the failure flag to ensure cleanup succeeds
      client.cleanupClientShouldFail = false;
      try {
        await client.destroy();
      } catch (error) {
        // Ignore cleanup errors in afterEach
        console.warn("Cleanup error in afterEach (ignored):", error);
      }
    }
  });

  describe("Constructor and basic properties", () => {
    it("should set the client name", () => {
      expect(client.getName()).toBe("TestClient");
    });

    it("should accept configuration in constructor", () => {
      expect(client.getConfigPublic("testKey", "default")).toBe("testValue");
    });

    it("should initialize with default configuration when none provided", () => {
      const defaultClient = new TestServiceClient("DefaultClient");
      expect(defaultClient.getName()).toBe("DefaultClient");
      // No config provided, so should use default value
      expect(defaultClient.getConfigPublic("testKey", "default")).toBe("default");
    });
  });

  describe("Initialization and state management", () => {
    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should be initialized after init is called", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);
      expect(client.initializeClientCalled).toBe(true);
    });

    it("should not call initializeClient if already initialized", async () => {
      await client.init();
      client.initializeClientCalled = false; // Reset flag
      await client.init(); // Call init again
      expect(client.initializeClientCalled).toBe(false); // Should not be called again
    });

    it("should handle initialization failure", async () => {
      client.initializeClientShouldFail = true;
      await expect(client.init()).rejects.toThrow("Initialization failed");
      expect(client.isInitialized()).toBe(false);
    });

    it("should reset the client successfully", async () => {
      // First initialize
      await client.init();
      expect(client.isInitialized()).toBe(true);

      // Reset tracking variables
      client.initializeClientCalled = false;
      client.cleanupClientCalled = false;

      // Reset the client
      await client.reset();

      // Should have called both cleanup and initialize
      expect(client.cleanupClientCalled).toBe(true);
      expect(client.initializeClientCalled).toBe(true);
      expect(client.isInitialized()).toBe(true);
    });

    it("should handle reset failure during cleanup", async () => {
      await client.init();
      client.cleanupClientShouldFail = true;

      await expect(client.reset()).rejects.toThrow(
        "Failed to reset client: Failed to destroy client: Cleanup failed",
      );
      expect(client.isInitialized()).toBe(true); // Should still be initialized
    });

    it("should handle reset failure during initialization", async () => {
      await client.init();
      client.initializeClientShouldFail = true;

      await expect(client.reset()).rejects.toThrow("Failed to reset client: Initialization failed");
      expect(client.isInitialized()).toBe(false); // Should not be initialized after failed init
    });

    it("should do nothing on reset if not initialized", async () => {
      // Don't initialize
      expect(client.isInitialized()).toBe(false);

      // Reset tracking variables
      client.initializeClientCalled = false;
      client.cleanupClientCalled = false;

      // Reset the client
      await client.reset();

      // Should not have called either method
      expect(client.cleanupClientCalled).toBe(false);
      expect(client.initializeClientCalled).toBe(false);
    });

    it("should destroy the client successfully", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);

      // Reset tracking variable
      client.cleanupClientCalled = false;

      // Destroy the client
      await client.destroy();

      // Should have called cleanup
      expect(client.cleanupClientCalled).toBe(true);
      expect(client.isInitialized()).toBe(false);
    });

    it("should handle destroy failure", async () => {
      await client.init();
      client.cleanupClientShouldFail = true;

      await expect(client.destroy()).rejects.toThrow("Failed to destroy client: Cleanup failed");
      expect(client.isInitialized()).toBe(true); // Should still be initialized
    });

    it("should do nothing on destroy if not initialized", async () => {
      // Don't initialize
      expect(client.isInitialized()).toBe(false);

      // Reset tracking variable
      client.cleanupClientCalled = false;

      // Destroy the client
      await client.destroy();

      // Should not have called cleanup
      expect(client.cleanupClientCalled).toBe(false);
    });
  });

  describe("Configuration handling", () => {
    it("should return configuration value when key exists", () => {
      expect(client.getConfigPublic("testKey", "default")).toBe("testValue");
    });

    it("should return default value when key doesn't exist", () => {
      expect(client.getConfigPublic("nonExistentKey", "default")).toBe("default");
    });

    it("should handle different types of configuration values", () => {
      const typedClient = new TestServiceClient("TypedClient", {
        stringValue: "string",
        numberValue: 123,
        booleanValue: true,
        objectValue: { key: "value" },
        arrayValue: [1, 2, 3],
      });

      expect(typedClient.getConfigPublic("stringValue", "")).toBe("string");
      expect(typedClient.getConfigPublic("numberValue", 0)).toBe(123);
      expect(typedClient.getConfigPublic("booleanValue", false)).toBe(true);
      expect(typedClient.getConfigPublic("objectValue", {})).toEqual({ key: "value" });
      expect(typedClient.getConfigPublic("arrayValue", [])).toEqual([1, 2, 3]);
    });
  });

  describe("Error handling", () => {
    it("should throw error when ensureInitialized is called without initialization", () => {
      expect(() => client.ensureInitializedPublic()).toThrow("TestClient is not initialized");
    });

    it("should not throw error when ensureInitialized is called after initialization", async () => {
      await client.init();
      expect(() => client.ensureInitializedPublic()).not.toThrow();
    });

    it("should throw error when assertNotNull is called with null", () => {
      expect(() => client.assertNotNullPublic(null)).toThrow("Client not initialized");
    });

    it("should not throw error when assertNotNull is called with non-null value", () => {
      expect(() => client.assertNotNullPublic("not null")).not.toThrow();
      expect(() => client.assertNotNullPublic({})).not.toThrow();
      expect(() => client.assertNotNullPublic(0)).not.toThrow();
    });

    it("should handle non-Error objects in error messages", async () => {
      // Mock the initializeClient method to throw a non-Error object
      vi.spyOn(
        client as unknown as { initializeClient: () => Promise<void> },
        "initializeClient",
      ).mockImplementationOnce(() => {
        throw "String error"; // Not an Error object
      });

      try {
        await client.init();
        // Should not reach here
        expect(true).toBe(false); // Force test to fail if we reach here
      } catch (error: unknown) {
        // The BaseServiceClient doesn't wrap string errors in Error objects
        // It just propagates the original error
        expect(error).toBe("String error");
      }
    });
  });
});
