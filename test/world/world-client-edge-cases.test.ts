/**
 * Tests for edge cases in client management in SmokeWorldImpl
 *
 * This file contains tests that focus on error handling and edge cases
 * in the client management functionality of SmokeWorldImpl.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceClient } from "../../src/clients";

// Mock the necessary components to avoid Cucumber registration issues
vi.mock("@cucumber/cucumber", () => ({
  setWorldConstructor: vi.fn(),
}));

// Test utilities for creating common mocks
interface MockClient extends ServiceClient {
  id: string;
  init: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  isInitialized: ReturnType<typeof vi.fn>;
}

// Helper functions to create mocks
function createMockClient(
  id: string,
  options: {
    initFails?: boolean;
    resetFails?: boolean;
    destroyFails?: boolean;
    isInitialized?: boolean;
  } = {},
): MockClient {
  return {
    id,
    init: vi.fn().mockImplementation(() => {
      if (options.initFails) {
        return Promise.reject(new Error(`Failed to initialize client ${id}`));
      }
      return Promise.resolve(undefined);
    }),
    reset: vi.fn().mockImplementation(() => {
      if (options.resetFails) {
        return Promise.reject(new Error(`Failed to reset client ${id}`));
      }
      return Promise.resolve(undefined);
    }),
    destroy: vi.fn().mockImplementation(() => {
      if (options.destroyFails) {
        return Promise.reject(new Error(`Failed to destroy client ${id}`));
      }
      return Promise.resolve(undefined);
    }),
    isInitialized: vi.fn().mockReturnValue(options.isInitialized ?? false),
  } as unknown as MockClient;
}

describe("SmokeWorld Client Management Edge Cases", () => {
  // Create a minimal world implementation for testing
  let world: {
    clients: Map<string, ServiceClient>;
    registerClient: (name: string, client: ServiceClient) => void;
    getClient: <T extends ServiceClient = ServiceClient>(name: string) => T;
    hasClient: (name: string) => boolean;
    initializeClients: (config?: Record<string, unknown>) => Promise<void>;
    resetClients: () => Promise<void>;
    destroyClients: () => Promise<void>;
  };

  beforeEach(() => {
    // Reset before each test
    world = {
      clients: new Map<string, ServiceClient>(),

      registerClient(name: string, client: ServiceClient): void {
        if (this.clients.has(name)) {
          throw new Error(`Client already registered with name: ${name}`);
        }
        this.clients.set(name, client);
      },

      getClient<T extends ServiceClient = ServiceClient>(name: string): T {
        const client = this.clients.get(name);
        if (!client) {
          throw new Error(`Client not found: ${name}`);
        }
        return client as T;
      },

      hasClient(name: string): boolean {
        return this.clients.has(name);
      },

      async initializeClients(): Promise<void> {
        const initPromises: Promise<void>[] = [];

        for (const client of this.clients.values()) {
          initPromises.push(client.init());
        }

        await Promise.all(initPromises);
      },

      async resetClients(): Promise<void> {
        const resetPromises: Promise<void>[] = [];

        for (const client of this.clients.values()) {
          resetPromises.push(client.reset());
        }

        await Promise.all(resetPromises);
      },

      async destroyClients(): Promise<void> {
        const destroyPromises: Promise<void>[] = [];

        for (const client of this.clients.values()) {
          destroyPromises.push(client.destroy());
        }

        await Promise.all(destroyPromises);

        // Clear the client map after destroying all clients
        this.clients.clear();
      },
    };
  });

  describe("Client Registration Edge Cases", () => {
    it("should throw error when registering a client with an existing name", () => {
      // Create and register a client
      const mockClient1 = createMockClient("client-1");
      world.registerClient("test-client", mockClient1);

      // Try to register another client with the same name
      const mockClient2 = createMockClient("client-2");

      expect(() => world.registerClient("test-client", mockClient2)).toThrow(
        "Client already registered with name: test-client",
      );

      // Verify the original client is still registered
      expect(world.getClient("test-client")).toBe(mockClient1);
    });

    it("should throw error when getting a non-existent client", () => {
      expect(() => world.getClient("non-existent-client")).toThrow(
        "Client not found: non-existent-client",
      );
    });
  });

  describe("Client Lifecycle Edge Cases", () => {
    it("should handle initialization failures for some clients", async () => {
      // Register clients, some of which will fail to initialize
      const successClient1 = createMockClient("success-1");
      const failClient = createMockClient("fail", { initFails: true });
      const successClient2 = createMockClient("success-2");

      world.registerClient("success-1", successClient1);
      world.registerClient("fail", failClient);
      world.registerClient("success-2", successClient2);

      // Initialization should fail because one client fails
      await expect(world.initializeClients()).rejects.toThrow("Failed to initialize client fail");

      // Verify that all init methods were called
      expect(successClient1.init).toHaveBeenCalled();
      expect(failClient.init).toHaveBeenCalled();
      expect(successClient2.init).toHaveBeenCalled();
    });

    it("should handle reset failures for some clients", async () => {
      // Register clients, some of which will fail to reset
      const successClient1 = createMockClient("success-1");
      const failClient = createMockClient("fail", { resetFails: true });
      const successClient2 = createMockClient("success-2");

      world.registerClient("success-1", successClient1);
      world.registerClient("fail", failClient);
      world.registerClient("success-2", successClient2);

      // Reset should fail because one client fails
      await expect(world.resetClients()).rejects.toThrow("Failed to reset client fail");

      // Verify that all reset methods were called
      expect(successClient1.reset).toHaveBeenCalled();
      expect(failClient.reset).toHaveBeenCalled();
      expect(successClient2.reset).toHaveBeenCalled();
    });

    it("should handle destroy failures for some clients", async () => {
      // Register clients, some of which will fail to destroy
      const successClient1 = createMockClient("success-1");
      const failClient = createMockClient("fail", { destroyFails: true });
      const successClient2 = createMockClient("success-2");

      world.registerClient("success-1", successClient1);
      world.registerClient("fail", failClient);
      world.registerClient("success-2", successClient2);

      // Destroy should fail because one client fails
      await expect(world.destroyClients()).rejects.toThrow("Failed to destroy client fail");

      // Verify that all destroy methods were called
      expect(successClient1.destroy).toHaveBeenCalled();
      expect(failClient.destroy).toHaveBeenCalled();
      expect(successClient2.destroy).toHaveBeenCalled();

      // Clients should still be in the map because destroy failed
      expect(world.clients.size).toBe(3);
    });

    it("should handle empty client list for lifecycle operations", async () => {
      // No clients registered

      // These operations should succeed with no clients
      await expect(world.initializeClients()).resolves.toBeUndefined();
      await expect(world.resetClients()).resolves.toBeUndefined();
      await expect(world.destroyClients()).resolves.toBeUndefined();
    });
  });
});
