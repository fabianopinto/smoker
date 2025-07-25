/**
 * Base Service Client Tests
 *
 * These tests verify the base functionality for all service clients including
 * lifecycle management, configuration handling, and error management.
 *
 * Test coverage includes:
 * - Constructor initialization with name and configuration
 * - Client lifecycle (init, destroy, reset, isInitialized)
 * - Configuration retrieval with default values
 * - Protected method utilities (ensureInitialized, assertNotNull)
 * - Error handling and state management
 * - Abstract method implementation patterns
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseServiceClient } from "../../../src/clients/core";

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client naming constants
  CLIENT_NAME: "test-client",
  DEFAULT_CLIENT_NAME: "default-client",

  // Configuration values
  TEST_KEY_VALUE: "testValue",
  TIMEOUT_VALUE: 1000,
  ENABLED_VALUE: true,
  DEFAULT_STRING: "default",
  NONEXISTENT_KEY: "nonExistent",

  // Error message constants
  CLIENT_NOT_INITIALIZED: "Client not initialized",
  FAILED_CLEANUP: "Cleanup failed",
  FAILED_RESET: "Failed to reset client",
};

/**
 * Test implementation of BaseServiceClient§
 * Exposes protected methods for testing while maintaining type safety
 */
class TestClient extends BaseServiceClient {
  // Abstract method implementation (will be mocked in tests)
  protected async initializeClient(): Promise<void> {
    // Implementation will be replaced by mock
  }

  // Expose protected methods for direct testing with type safety
  exposeGetConfig<T>(key: string, defaultValue: T): T {
    return this.getConfig(key, defaultValue);
  }

  exposeEnsureInitialized(): void {
    return this.ensureInitialized();
  }

  exposeAssertNotNull<T>(value: T | null): void {
    return this.assertNotNull(value);
  }

  async exposeCleanupClient(): Promise<void> {
    return this.cleanupClient();
  }
}

/**
 * Type for accessing protected methods via prototype spying
 * This provides better isolation for testing protected methods
 */
type TestClientWithProtected = TestClient & {
  initializeClient: () => Promise<void>;
};

/**
 * Test instance and spies
 * These are used for testing protected methods and lifecycle management
 */
let testInstance: TestClient;
let initializeClientSpy: ReturnType<typeof vi.spyOn>;

/**
 * Tests for the ServiceClient interface and implementations
 */
describe("ServiceClient", () => {
  /**
   * Tests for the BaseServiceClient abstract class
   */
  describe("BaseServiceClient", () => {
    beforeEach(() => {
      // Reset all mocks before each test
      vi.resetAllMocks();

      // Create a fresh test client for each test
      testInstance = new TestClient(TEST_FIXTURES.CLIENT_NAME, {
        testKey: TEST_FIXTURES.TEST_KEY_VALUE,
        timeout: TEST_FIXTURES.TIMEOUT_VALUE,
        enabled: TEST_FIXTURES.ENABLED_VALUE,
      });

      // Mock the initializeClient method using prototype spying
      // This provides better isolation for testing protected methods
      initializeClientSpy = vi
        .spyOn(TestClient.prototype as TestClientWithProtected, "initializeClient")
        .mockResolvedValue(undefined);
    });

    afterEach(() => {
      // Restore all mocks after each test
      vi.restoreAllMocks();
    });

    /**
     * Tests for the constructor
     * Verifies client initialization with name and config
     */
    describe("constructor", () => {
      it("should initialize with the provided name and config", async () => {
        await testInstance.init();

        expect(initializeClientSpy).toHaveBeenCalledOnce();
        expect(testInstance.getName()).toBe(TEST_FIXTURES.CLIENT_NAME);
        expect(testInstance.exposeGetConfig("testKey", "")).toBe(TEST_FIXTURES.TEST_KEY_VALUE);
      });

      it("should initialize with default empty config when not provided", () => {
        const localMock = vi.fn();

        class LocalTestClient extends BaseServiceClient {
          protected initializeClient = localMock;
          exposeGetConfig = this.getConfig;
        }

        const defaultClient = new LocalTestClient(TEST_FIXTURES.DEFAULT_CLIENT_NAME);

        expect(defaultClient.getName()).toBe(TEST_FIXTURES.DEFAULT_CLIENT_NAME);
        expect(
          defaultClient.exposeGetConfig(
            TEST_FIXTURES.NONEXISTENT_KEY,
            TEST_FIXTURES.DEFAULT_STRING,
          ),
        ).toBe(TEST_FIXTURES.DEFAULT_STRING);
      });
    });

    /**
     * Tests for the getName method
     * Verifies that the client name is correctly returned
     */
    describe("getName", () => {
      it("should return the client name", () => {
        expect(testInstance.getName()).toBe(TEST_FIXTURES.CLIENT_NAME);
      });
    });

    /**
     * Tests for the init method
     * Verifies client initialization behavior and error handling
     */
    describe("init", () => {
      it("should initialize the client successfully", async () => {
        expect(testInstance.isInitialized()).toBe(false);

        await testInstance.init();

        expect(testInstance.isInitialized()).toBe(true);
        expect(initializeClientSpy).toHaveBeenCalledOnce();
      });

      it("should skip initialization if already initialized", async () => {
        await testInstance.init();
        initializeClientSpy.mockClear();

        await testInstance.init();

        expect(testInstance.isInitialized()).toBe(true);
        expect(initializeClientSpy).not.toHaveBeenCalled();
      });

      it("should not set initialized flag if initialization fails", async () => {
        initializeClientSpy.mockRejectedValueOnce(new Error("Initialization failed"));

        await expect(testInstance.init()).rejects.toThrow("Initialization failed");
        expect(testInstance.isInitialized()).toBe(false);
        expect(initializeClientSpy).toHaveBeenCalledOnce();
      });

      it("should handle string errors during initialization", async () => {
        initializeClientSpy.mockRejectedValueOnce("String error during initialization");

        await expect(testInstance.init()).rejects.toThrow("String error during initialization");
        expect(testInstance.isInitialized()).toBe(false);
      });
    });

    /**
     * Tests for the isInitialized method
     * Verifies initialization state tracking
     */
    describe("isInitialized", () => {
      it("should return false when not initialized", () => {
        expect(testInstance.isInitialized()).toBe(false);
      });

      it("should return true after successful initialization", async () => {
        await testInstance.init();

        expect(testInstance.isInitialized()).toBe(true);
      });

      it("should return false after destruction", async () => {
        await testInstance.init();
        const cleanupClientSpy = vi
          .spyOn(BaseServiceClient.prototype, "cleanupClient")
          .mockResolvedValue();

        await testInstance.destroy();

        expect(testInstance.isInitialized()).toBe(false);
        expect(cleanupClientSpy).toHaveBeenCalledOnce();
      });
    });

    /**
     * Tests for the reset method
     * Verifies client reset functionality (destroy + init)
     */
    describe("reset", () => {
      it("should reset the client successfully", async () => {
        await testInstance.init();
        expect(testInstance.isInitialized()).toBe(true);
        const destroySpy = vi.spyOn(testInstance, "destroy").mockResolvedValue();
        const initSpy = vi.spyOn(testInstance, "init").mockResolvedValue();

        await testInstance.reset();

        expect(destroySpy).toHaveBeenCalledOnce();
        expect(initSpy).toHaveBeenCalledOnce();
      });

      it("should do nothing if client is not initialized", async () => {
        expect(testInstance.isInitialized()).toBe(false);
        const destroySpy = vi.spyOn(testInstance, "destroy");
        const initSpy = vi.spyOn(testInstance, "init");

        await testInstance.reset();

        expect(destroySpy).not.toHaveBeenCalled();
        expect(initSpy).not.toHaveBeenCalled();
      });

      it("should throw error with Error object message when destroy fails", async () => {
        await testInstance.init();
        vi.spyOn(testInstance, "destroy").mockRejectedValueOnce(
          new Error(`Failed to destroy client: ${TEST_FIXTURES.FAILED_CLEANUP}`),
        );

        await expect(testInstance.reset()).rejects.toThrow(
          `${TEST_FIXTURES.FAILED_RESET}: Failed to destroy client: ${TEST_FIXTURES.FAILED_CLEANUP}`,
        );
      });

      it("should throw error with string message when destroy fails with string", async () => {
        await testInstance.init();
        vi.spyOn(testInstance, "destroy").mockRejectedValueOnce(
          "Failed to destroy client: String cleanup error",
        );

        await expect(testInstance.reset()).rejects.toThrow(
          `${TEST_FIXTURES.FAILED_RESET}: Failed to destroy client: String cleanup error`,
        );
      });

      it("should throw error when init fails during reset", async () => {
        await testInstance.init();
        vi.spyOn(testInstance, "destroy").mockResolvedValueOnce();
        vi.spyOn(testInstance, "init").mockRejectedValueOnce(new Error("Init failed during reset"));

        await expect(testInstance.reset()).rejects.toThrow(
          `${TEST_FIXTURES.FAILED_RESET}: Init failed during reset`,
        );
      });

      it("should handle non-Error objects in reset error handling (ternary operator coverage)", async () => {
        await testInstance.init();
        vi.spyOn(testInstance, "destroy").mockResolvedValueOnce();
        vi.spyOn(testInstance, "init").mockRejectedValueOnce("String error value");

        await expect(testInstance.reset()).rejects.toThrow(
          `${TEST_FIXTURES.FAILED_RESET}: String error value`,
        );
      });
    });

    /**
     * Tests for the destroy method
     * Verifies client cleanup and state management
     */
    describe("destroy", () => {
      it("should destroy the client successfully", async () => {
        await testInstance.init();
        expect(testInstance.isInitialized()).toBe(true);
        // Spy directly on the protected cleanupClient method using prototype
        const cleanupSpy = vi
          .spyOn(BaseServiceClient.prototype, "cleanupClient")
          .mockResolvedValue();

        await testInstance.destroy();

        expect(testInstance.isInitialized()).toBe(false);
        expect(cleanupSpy).toHaveBeenCalledOnce();
      });

      it("should do nothing if client is not initialized", async () => {
        expect(testInstance.isInitialized()).toBe(false);
        const cleanupSpy = vi.spyOn(BaseServiceClient.prototype, "cleanupClient");

        await testInstance.destroy();

        expect(testInstance.isInitialized()).toBe(false);
        expect(cleanupSpy).not.toHaveBeenCalled();
      });

      it("should throw error with string value when cleanupClient rejects with string", async () => {
        await testInstance.init();
        vi.spyOn(BaseServiceClient.prototype, "cleanupClient").mockRejectedValueOnce(
          "String cleanup error",
        );

        await expect(testInstance.destroy()).rejects.toThrow(
          "Failed to destroy client: String cleanup error",
        );
        expect(testInstance.isInitialized()).toBe(true); // Still initialized since destroy failed
      });

      it("should throw error with Error object message when cleanup fails", async () => {
        await testInstance.init();
        vi.spyOn(BaseServiceClient.prototype, "cleanupClient").mockRejectedValueOnce(
          new Error(TEST_FIXTURES.FAILED_CLEANUP),
        );

        await expect(testInstance.destroy()).rejects.toThrow(
          `Failed to destroy client: ${TEST_FIXTURES.FAILED_CLEANUP}`,
        );
        expect(testInstance.isInitialized()).toBe(true); // Still initialized since destroy failed
      });

      it("should handle non-Error objects in error handling (ternary operator coverage)", async () => {
        await testInstance.init();
        vi.spyOn(BaseServiceClient.prototype, "cleanupClient").mockRejectedValue(
          "String cleanup error",
        );

        await expect(testInstance.destroy()).rejects.toThrow(
          "Failed to destroy client: String cleanup error",
        );
        expect(testInstance.isInitialized()).toBe(true); // Still initialized since destroy failed
      });
    });

    /**
     * Tests for the cleanupClient method
     * Verifies the default cleanup implementation
     */
    describe("cleanupClient", () => {
      it("should call the default implementation which does nothing", async () => {
        const cleanupSpy = vi.spyOn(BaseServiceClient.prototype, "cleanupClient");

        await testInstance.destroy();

        // Only called if the client is initialized
        expect(cleanupSpy).not.toHaveBeenCalled();

        // Initialize and test again
        await testInstance.init();
        cleanupSpy.mockClear();
        await testInstance.destroy();
        expect(cleanupSpy).toHaveBeenCalledOnce();
      });
    });

    /**
     * Tests for the getConfig method
     * Verifies configuration value retrieval with defaults
     */
    describe("getConfig", () => {
      it("should return the config value when it exists", () => {
        expect(testInstance.exposeGetConfig("testKey", "default")).toBe(
          TEST_FIXTURES.TEST_KEY_VALUE,
        );
        expect(testInstance.exposeGetConfig("timeout", 0)).toBe(TEST_FIXTURES.TIMEOUT_VALUE);
        expect(testInstance.exposeGetConfig("enabled", false)).toBe(TEST_FIXTURES.ENABLED_VALUE);
      });

      it("should return the default value when config key does not exist", () => {
        expect(testInstance.exposeGetConfig(TEST_FIXTURES.NONEXISTENT_KEY, "default")).toBe(
          "default",
        );
        expect(testInstance.exposeGetConfig("missing", 42)).toBe(42);
      });
    });

    /**
     * Tests for the ensureInitialized method
     * Verifies initialization state validation
     */
    describe("ensureInitialized", () => {
      it("should not throw when client is initialized", async () => {
        await testInstance.init();

        expect(() => testInstance.exposeEnsureInitialized()).not.toThrow();
      });

      it("should throw when client is not initialized", () => {
        expect(() => testInstance.exposeEnsureInitialized()).toThrow(
          `${TEST_FIXTURES.CLIENT_NAME} is not initialized. Call init() first`,
        );
      });
    });

    /**
     * Tests for the assertNotNull method
     * Verifies null/undefined value validation
     */
    describe("assertNotNull", () => {
      it("should not throw when value is not null", () => {
        expect(() => testInstance.exposeAssertNotNull({})).not.toThrow();
        expect(() => testInstance.exposeAssertNotNull("value")).not.toThrow();
        expect(() => testInstance.exposeAssertNotNull(0)).not.toThrow();
        expect(() => testInstance.exposeAssertNotNull(false)).not.toThrow();
      });

      it("should throw when value is null", () => {
        expect(() => testInstance.exposeAssertNotNull(null)).toThrow(
          TEST_FIXTURES.CLIENT_NOT_INITIALIZED,
        );
      });

      it("should throw when value is undefined", () => {
        expect(() => testInstance.exposeAssertNotNull(undefined)).toThrow(
          TEST_FIXTURES.CLIENT_NOT_INITIALIZED,
        );
      });
    });
  });
});
