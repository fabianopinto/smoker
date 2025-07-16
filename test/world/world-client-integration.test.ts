/**
 * Integration tests for client functionality in SmokeWorldImpl
 *
 * This file contains tests that focus on the integration between client management
 * and other functionality in SmokeWorldImpl.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientType, type ServiceClient } from "../../src/clients";
import { SmokeWorldImpl, type ConfigurationProvider } from "../../src/world";

// Mock the necessary components to avoid Cucumber registration issues
vi.mock("@cucumber/cucumber", () => {
  // Using a minimal World implementation for testing
  class World {
    // Add a dummy method to avoid ESLint warning about empty class
    /* eslint-disable-next-line @typescript-eslint/no-empty-function */
    attach() {}
  }

  return {
    setWorldConstructor: vi.fn(),
    World,
  };
});

// Mock the ClientRegistry and ClientFactory
vi.mock("../../src/clients/registry", () => {
  return {
    ClientRegistry: vi.fn(),
    ClientFactory: vi.fn(),
  };
});

// Create a mock getValue function that we can access in tests
const mockGetValue = vi.fn();

// Create a mock ConfigurationProvider for testing
const mockConfigProvider = {
  getValue: mockGetValue,
};

describe("SmokeWorld Client Integration", () => {
  let world: SmokeWorldImpl;
  // These variables are used in the tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClientRegistry: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClientFactory: Record<string, any>;
  let mockConfigGetValue: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset the mockGetValue function for each test
    mockGetValue.mockReset();
    mockConfigGetValue = mockGetValue;

    // Create mock objects for each test
    mockClientRegistry = {
      getClientConfigs: vi.fn().mockReturnValue({}),
      registerConfig: vi.fn(),
      registerConfigs: vi.fn(),
      getClientConfig: vi.fn(),
      getAllConfigs: vi.fn().mockReturnValue(new Map()),
    };

    mockClientFactory = {
      createClient: vi.fn().mockImplementation(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("test-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      })),
    };

    // Create a new world instance with minimal required options and our mock config provider
    world = new SmokeWorldImpl(
      {
        attach: vi.fn(),
        log: vi.fn(),
        parameters: {},
        link: vi.fn(),
      },
      undefined, // No initial config
      mockConfigProvider as ConfigurationProvider, // Pass our mock config provider
    );

    // Override the getClientRegistry and getClientFactory methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (world as any).getClientRegistry = () => mockClientRegistry;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (world as any).getClientFactory = () => mockClientFactory;

    // Also set the internal properties directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (world as any).clientRegistry = mockClientRegistry;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (world as any).clientFactory = mockClientFactory;
  });

  describe("Client Registration and Creation", () => {
    it("should get client registry and factory", () => {
      // Access the getters to ensure they work
      const registry = world.getClientRegistry();
      const factory = world.getClientFactory();

      // Verify the getters return the expected objects
      expect(registry).toBe(mockClientRegistry);
      expect(factory).toBe(mockClientFactory);
    });

    it("should register client with config", () => {
      // Setup
      const clientType = ClientType.REST;
      const id = "test-id";
      const config = { baseUrl: "https://example.com" };

      // Create a mock client
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("test-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      // Set up the factory to return our mock client
      mockClientFactory.createClient = vi.fn().mockReturnValue(mockClient);

      // Call the method
      const result = world.registerClientWithConfig(clientType, config, id);

      // Verify the result
      expect(result).toBeDefined();
    });

    it("should create client without registering it", () => {
      // Setup
      const clientType = ClientType.REST;
      const id = "test-client";
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("test-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      // Set up the factory to return our mock client
      mockClientFactory.createClient = vi.fn().mockReturnValue(mockClient);

      // Call the method
      const result = world.createClient(clientType, id);

      // Verify the result
      expect(result).toBeDefined();
    });
  });

  describe("Client Lifecycle Management", () => {
    it("should initialize all clients", async () => {
      // Setup
      const mockClient1: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("client1"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      const mockClient2: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("client2"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      // Create a clients map with our mock clients
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (world as any).clients = new Map([
        ["client1", mockClient1],
        ["client2", mockClient2],
      ]);

      // Call the method
      await world.initializeClients();

      // Verify all clients were initialized
      expect(mockClient1.init).toHaveBeenCalled();
      expect(mockClient2.init).toHaveBeenCalled();
    });

    it("should reset all clients", async () => {
      // Setup
      const mockClient1: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client1"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      const mockClient2: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client2"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      // Create a clients map with our mock clients
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (world as any).clients = new Map([
        ["client1", mockClient1],
        ["client2", mockClient2],
      ]);

      // Call the method
      await world.resetClients();

      // Verify all clients were reset
      expect(mockClient1.reset).toHaveBeenCalled();
      expect(mockClient2.reset).toHaveBeenCalled();
    });

    it("should destroy all clients", async () => {
      // Setup
      const mockClient1: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client1"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      const mockClient2: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client2"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      // Create a clients map with our mock clients
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (world as any).clients = new Map([
        ["client1", mockClient1],
        ["client2", mockClient2],
      ]);

      // Call the method
      await world.destroyClients();

      // Verify all clients were destroyed
      expect(mockClient1.destroy).toHaveBeenCalled();
      expect(mockClient2.destroy).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((world as any).clients.size).toBe(0);
    });
  });

  describe("Integration between Client and Parameter Resolution", () => {
    it("should resolve step parameter with both config and property references", () => {
      // Setup
      world.setProperty("api.endpoint", "example.com");
      mockConfigGetValue.mockImplementation((path) => {
        if (path === "api.protocol") return "https";
        return undefined;
      });

      // Call the method
      const result = world.resolveStepParameter("config:api.protocol://prop:api.endpoint/path");

      // Verify the result
      expect(result).toBe("https://example.com/path");
    });

    it("should handle property references in resolveStepParameter", () => {
      // Setup
      world.setProperty("user.name", "John");
      world.setProperty("user.id", "123");

      // Call the method
      const result = world.resolveStepParameter("User prop:user.name has ID prop:user.id");

      // Verify the result
      expect(result).toBe("User John has ID 123");
    });

    it("should handle config references in resolveStepParameter", () => {
      // Setup
      mockConfigGetValue.mockImplementation((path) => {
        if (path === "env") return "production";
        if (path === "version") return "1.0.0";
        return undefined;
      });

      // Call the method
      const result = world.resolveStepParameter("Environment: config:env, Version: config:version");

      // Verify the result
      expect(result).toBe("Environment: production, Version: 1.0.0");
    });

    it("should handle config root key in resolveConfigValues", () => {
      // Setup
      world.setProperty("config.rootKey", "app");
      mockConfigGetValue.mockImplementation((path) => {
        if (path === "app.setting") return "value";
        return undefined;
      });

      // Call the method
      const result = world.resolveConfigValues("config:setting");

      // Verify the result
      expect(result).toBe("value");
    });

    it("should fall back to direct path when root key doesn't work", () => {
      // Setup
      world.setProperty("config.rootKey", "app");
      mockConfigGetValue.mockImplementation((path) => {
        if (path === "app.setting") return undefined;
        if (path === "setting") return "direct value";
        return undefined;
      });

      // Call the method
      const result = world.resolveConfigValues("config:setting");

      // Verify the result
      expect(result).toBe("direct value");
    });

    it("should throw error when config value is not found", () => {
      // Setup
      mockConfigGetValue.mockReturnValue(undefined);

      // Call the method and verify it throws
      expect(() => world.resolveConfigValues("config:nonexistent")).toThrow(
        "Configuration value not found: nonexistent",
      );
    });

    it("should throw error when property value is not found", () => {
      // No properties set

      // Call the method and verify it throws
      expect(() => world.resolvePropertyValues("prop:nonexistent")).toThrow(
        "Property not found: nonexistent",
      );
    });
  });
});
