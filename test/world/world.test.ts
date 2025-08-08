/**
 * Tests for the SmokeWorldImpl class
 *
 * These tests verify the functionality of the SmokeWorld implementation which
 * serves as the central component of the smoke testing framework.
 *
 * Test Coverage:
 * - Constructor and initialization
 * - Client registration and access
 * - Client lifecycle management
 * - Test data storage and retrieval
 * - Property management
 * - Parameter resolution (config and property references)
 * - Edge cases and error handling
 */

import { type IWorldOptions } from "@cucumber/cucumber";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientType, type ServiceClient } from "../../src/clients/core";
import { type ClientConfig, ClientFactory, ClientRegistry } from "../../src/clients/registry";
import { ERR_VALIDATION, SmokerError } from "../../src/errors";
import { Configuration } from "../../src/support/config";
import { DefaultConfigurationProvider, SmokeWorldImpl } from "../../src/world/world";
import { WorldProperties } from "../../src/world/world-properties";

/**
 * Mock @cucumber/cucumber
 *
 * Completely isolate Cucumber to avoid side effects during testing
 */
vi.mock("@cucumber/cucumber", () => {
  // Create a simple mock World class that doesn't have side effects
  class MockWorld {
    attach: (data: unknown, mediaType?: string) => void;
    log: (text: string) => void;
    parameters: Record<string, unknown>;

    constructor(options: unknown) {
      // Type guard for options
      const opts = (options as Record<string, unknown>) || {};
      this.attach =
        typeof opts.attach === "function"
          ? (opts.attach as (data: unknown, mediaType?: string) => void)
          : () => undefined;
      this.log =
        typeof opts.log === "function" ? (opts.log as (text: string) => void) : () => undefined;
      this.parameters =
        typeof opts.parameters === "object" && opts.parameters
          ? (opts.parameters as Record<string, unknown>)
          : {};
    }
  }

  return {
    setWorldConstructor: vi.fn(),
    World: MockWorld,
    // Mock other needed interfaces
  };
});

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // World options
  WORLD_OPTIONS: { attach: vi.fn(), log: vi.fn(), parameters: {} } as unknown as IWorldOptions,

  // Client configs
  CONFIG_REST: { baseUrl: "https://api.example.com", timeout: 5000 } as ClientConfig,
  CONFIG_S3: { region: "us-west-2", bucket: "test-bucket" } as ClientConfig,

  // Client identifiers
  CLIENT_ID: "test-client",
  REST_CLIENT_ID: "api",
  NON_EXISTENT_CLIENT: "non-existent",

  // Client types
  CLIENT_TYPE_REST: ClientType.REST,
  CLIENT_TYPE_S3: ClientType.S3,
  CLIENT_TYPE_CUSTOM: "custom-client",

  // Property values
  PROPERTY_KEY: "testKey",
  PROPERTY_VALUE: "testValue",
  PROPERTY_OBJECT: { name: "Test", value: 42 },
  INVALID_PROPERTY_KEY: "invalid-key$#%",

  // Test data
  RESPONSE_DATA: { status: 200, data: { id: 123, name: "Test Item" } },
  CONTENT_DATA: "Sample content text",
  ERROR_DATA: new Error("Test error message"),

  // Config values
  CONFIG_PATH: "test.config.value",
  CONFIG_VALUE: "configValue",
  CONFIG_ROOT_KEY: "service",

  // Parameter resolution
  CONFIG_REFERENCE: "config:test.value",
  PROPERTY_REFERENCE: "property:testKey",
};

// Mock ServiceClient
class MockServiceClient implements ServiceClient {
  // Store type and id as private fields rather than public properties
  private readonly _type: string;
  private readonly _id?: string;

  constructor(type: string, id?: string) {
    this._type = type;
    this._id = id;
  }

  // Implementation of the ServiceClient interface
  isInitialized = vi.fn().mockResolvedValue(undefined);
  getName = vi.fn().mockImplementation(() => this._id || this._type);
  cleanupClient = vi.fn().mockResolvedValue(undefined);
  init = vi.fn().mockResolvedValue(undefined);
  reset = vi.fn().mockResolvedValue(undefined);
  destroy = vi.fn().mockResolvedValue(undefined);

  // Add getter methods for type and id (not part of the interface but needed for tests)
  getType(): string {
    return this._type;
  }

  getId(): string | undefined {
    return this._id;
  }
}

/**
 * Tests for the SmokeWorldImpl class
 */
describe("SmokeWorldImpl", () => {
  // Test instance
  let world: SmokeWorldImpl<unknown>;

  // Mocked dependencies
  let mockRegistry: ClientRegistry & {
    registerConfigs: ReturnType<typeof vi.fn>;
    registerConfig: ReturnType<typeof vi.fn>;
    getConfig: ReturnType<typeof vi.fn>;
    hasConfig: ReturnType<typeof vi.fn>;
    getAllConfigs: ReturnType<typeof vi.fn>;
    clearConfigs: ReturnType<typeof vi.fn>;
  };
  let mockFactory: ClientFactory;
  let mockProvider: DefaultConfigurationProvider;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create proper mock ClientRegistry with mock functions preserved
    mockRegistry = {
      registerConfig: vi.fn(),
      registerConfigs: vi.fn(),
      getConfig: vi.fn(),
      hasConfig: vi.fn(),
      getAllConfigs: vi.fn().mockReturnValue(new Map()),
      clearConfigs: vi.fn(),
    } as ClientRegistry & {
      registerConfig: ReturnType<typeof vi.fn>;
      registerConfigs: ReturnType<typeof vi.fn>;
      getConfig: ReturnType<typeof vi.fn>;
      hasConfig: ReturnType<typeof vi.fn>;
      getAllConfigs: ReturnType<typeof vi.fn>;
      clearConfigs: ReturnType<typeof vi.fn>;
    };

    // Create mock ClientFactory
    mockFactory = {
      createClient: vi.fn().mockImplementation((type, id) => new MockServiceClient(type, id)),
    } as unknown as ClientFactory;

    // Create mock ConfigurationProvider
    mockProvider = {
      getValue: vi.fn(),
    } as unknown as DefaultConfigurationProvider;

    // Mock Configuration.getInstance
    vi.spyOn(Configuration, "getInstance").mockReturnValue({
      getValue: vi.fn().mockResolvedValue(TEST_FIXTURES.CONFIG_VALUE),
    } as unknown as Configuration);

    // Create a new world instance with injected dependencies
    world = new SmokeWorldImpl(
      TEST_FIXTURES.WORLD_OPTIONS,
      undefined,
      mockRegistry,
      mockFactory,
      mockProvider,
    );

    // Pre-register clients with IDs for typed getter tests
    const restClient = new MockServiceClient(
      TEST_FIXTURES.CLIENT_TYPE_REST,
      TEST_FIXTURES.REST_CLIENT_ID,
    );
    world.registerClient(
      `${TEST_FIXTURES.CLIENT_TYPE_REST}:${TEST_FIXTURES.REST_CLIENT_ID}`,
      restClient,
    );

    // Pre-register a CloudWatch client with the expected ID
    const cloudWatchClient = new MockServiceClient("cloudwatch", TEST_FIXTURES.CLIENT_ID);
    world.registerClient(`cloudwatch:${TEST_FIXTURES.CLIENT_ID}`, cloudWatchClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Tests for constructor and initialization
   */
  describe("constructor", () => {
    it("should initialize with expected values", () => {
      expect(world).toBeInstanceOf(SmokeWorldImpl);
      expect(world["clients"]).toBeInstanceOf(Map);
      // We should have the pre-registered clients
      expect(world["clients"].size).toBe(2); // REST and CloudWatch clients are pre-registered
      expect(
        world["clients"].has(`${TEST_FIXTURES.CLIENT_TYPE_REST}:${TEST_FIXTURES.REST_CLIENT_ID}`),
      ).toBe(true);
      expect(world["clients"].has(`cloudwatch:${TEST_FIXTURES.CLIENT_ID}`)).toBe(true);
      expect(world["lastResponse"]).toBe(null);
      expect(world["lastContent"]).toBe("");
      expect(world["lastError"]).toBe(null);
      // Verify that the WorldProperties instance is initialized with no properties
      const worldProperties = world.getWorldProperties();
      expect(worldProperties).toBeInstanceOf(WorldProperties);
      // We can test that no properties exist by trying to get a non-existent property
      expect(world.hasProperty("testProperty")).toBe(false);
    });

    it("should register initial configuration if provided", () => {
      const config = {
        [TEST_FIXTURES.CLIENT_TYPE_REST]: TEST_FIXTURES.CONFIG_REST,
      };

      // Clear previous calls to registerConfigs from beforeEach
      vi.clearAllMocks();

      // Create new world with config and injected dependencies
      world = new SmokeWorldImpl(
        TEST_FIXTURES.WORLD_OPTIONS,
        config,
        mockRegistry,
        mockFactory,
        mockProvider,
      );

      expect(mockRegistry.registerConfigs).toHaveBeenCalledWith(config);
    });

    it("should create and register default clients from config", () => {
      // Setup mock to return configs
      const configs = new Map();
      configs.set(TEST_FIXTURES.CLIENT_TYPE_REST, TEST_FIXTURES.CONFIG_REST);
      mockRegistry.getAllConfigs.mockReturnValue(configs);

      // Clear previous mocks to ensure clean test
      vi.clearAllMocks();

      // Create a new world with injected dependencies but NO initial config
      // to ensure the clients aren't created yet
      world = new SmokeWorldImpl(
        TEST_FIXTURES.WORLD_OPTIONS,
        undefined, // No config here
        mockRegistry,
        mockFactory,
        mockProvider,
      );

      // Clear any existing clients to ensure clean state
      world["clients"] = new Map();

      // Spy on registerClient method
      const spy = vi.spyOn(world, "registerClient");

      // Call the method we want to test directly
      world["createAndRegisterDefaultClients"]();

      // Check that the client was created and registered
      expect(mockFactory.createClient).toHaveBeenCalledWith(
        TEST_FIXTURES.CLIENT_TYPE_REST,
        undefined,
      );
      expect(spy).toHaveBeenCalled();
    });
  });

  /**
   * Tests for client registration and access
   */
  describe("client management", () => {
    beforeEach(() => {
      // Create mock clients
      const mockRestClient = new MockServiceClient(TEST_FIXTURES.CLIENT_TYPE_REST);
      const mockS3Client = new MockServiceClient(TEST_FIXTURES.CLIENT_TYPE_S3);

      // Register mock clients
      world.registerClient(TEST_FIXTURES.CLIENT_TYPE_REST, mockRestClient);
      world.registerClient(TEST_FIXTURES.CLIENT_TYPE_S3, mockS3Client);
    });

    describe("registerClient", () => {
      it("should register a client with a name", () => {
        const client = new MockServiceClient(TEST_FIXTURES.CLIENT_TYPE_CUSTOM);
        world.registerClient(TEST_FIXTURES.CLIENT_TYPE_CUSTOM, client);

        expect(world.hasClient(TEST_FIXTURES.CLIENT_TYPE_CUSTOM)).toBe(true);
      });
    });

    describe("getClient", () => {
      it("should return a registered client by name", () => {
        const client = world.getClient(TEST_FIXTURES.CLIENT_TYPE_REST);

        expect(client).toBeInstanceOf(MockServiceClient);
        // Use type assertion to access the mock-specific method
        expect((client as MockServiceClient).getType()).toBe(TEST_FIXTURES.CLIENT_TYPE_REST);
      });

      it("should throw a structured error for non-existent client", () => {
        try {
          world.getClient(TEST_FIXTURES.NON_EXISTENT_CLIENT);
          throw new Error("expected getClient to throw");
        } catch (err) {
          expect(SmokerError.isSmokerError(err)).toBe(true);
          if (SmokerError.isSmokerError(err)) {
            expect(err.code).toBe(ERR_VALIDATION);
            expect(err.domain).toBe("world");
          }
        }
      });
    });

    describe("hasClient", () => {
      it("should return true if client exists", () => {
        expect(world.hasClient(TEST_FIXTURES.CLIENT_TYPE_REST)).toBe(true);
      });

      it("should return false if client does not exist", () => {
        expect(world.hasClient(TEST_FIXTURES.NON_EXISTENT_CLIENT)).toBe(false);
      });
    });

    describe("createClient", () => {
      it("should create a client without registering it", () => {
        const client = world.createClient(TEST_FIXTURES.CLIENT_TYPE_REST);

        expect(mockFactory.createClient).toHaveBeenCalledWith(
          TEST_FIXTURES.CLIENT_TYPE_REST,
          undefined,
        );
        expect(client).toBeInstanceOf(MockServiceClient);
      });

      it("should create a client with an ID", () => {
        const client = world.createClient(TEST_FIXTURES.CLIENT_TYPE_REST, TEST_FIXTURES.CLIENT_ID);

        expect(mockFactory.createClient).toHaveBeenCalledWith(
          TEST_FIXTURES.CLIENT_TYPE_REST,
          TEST_FIXTURES.CLIENT_ID,
        );
        expect(client).toBeInstanceOf(MockServiceClient);
      });
    });

    describe("registerClientWithConfig", () => {
      it("should register config and create client", () => {
        const client = world.registerClientWithConfig(
          TEST_FIXTURES.CLIENT_TYPE_REST,
          TEST_FIXTURES.CONFIG_REST,
          TEST_FIXTURES.REST_CLIENT_ID,
        );

        expect(mockRegistry.registerConfig).toHaveBeenCalledWith(
          TEST_FIXTURES.CLIENT_TYPE_REST,
          TEST_FIXTURES.CONFIG_REST,
          TEST_FIXTURES.REST_CLIENT_ID,
        );

        expect(mockFactory.createClient).toHaveBeenCalledWith(
          TEST_FIXTURES.CLIENT_TYPE_REST,
          TEST_FIXTURES.REST_CLIENT_ID,
        );

        expect(client).toBeInstanceOf(MockServiceClient);
      });

      it("should use config.id if no explicit id is provided", () => {
        const configWithId = { ...TEST_FIXTURES.CONFIG_REST, id: TEST_FIXTURES.REST_CLIENT_ID };

        world.registerClientWithConfig(TEST_FIXTURES.CLIENT_TYPE_REST, configWithId);

        // Check clientKey calculation in the implementation (testing ternary)
        expect(mockFactory.createClient).toHaveBeenCalledWith(
          TEST_FIXTURES.CLIENT_TYPE_REST,
          TEST_FIXTURES.REST_CLIENT_ID,
        );
      });
    });

    // Tests for the typed client getter methods
    describe("typed client getters", () => {
      it("should get a REST client with the correct type", () => {
        const spy = vi.spyOn(world, "getClient");
        world.getRest();

        expect(spy).toHaveBeenCalledWith("rest");
      });

      it("should get a REST client with an ID", () => {
        const spy = vi.spyOn(world, "getClient");
        world.getRest(TEST_FIXTURES.REST_CLIENT_ID);

        expect(spy).toHaveBeenCalledWith(`rest:${TEST_FIXTURES.REST_CLIENT_ID}`);
      });

      // Similar tests can be added for other client types
      it("should get an S3 client with the correct type", () => {
        const spy = vi.spyOn(world, "getClient");
        world.getS3();

        expect(spy).toHaveBeenCalledWith("s3");
      });

      it("should get a CloudWatch client with an ID", () => {
        const spy = vi.spyOn(world, "getClient");
        world.getCloudWatch(TEST_FIXTURES.CLIENT_ID);

        expect(spy).toHaveBeenCalledWith(`cloudwatch:${TEST_FIXTURES.CLIENT_ID}`);
      });
    });
  });

  /**
   * Tests for client lifecycle methods
   */
  describe("client lifecycle", () => {
    beforeEach(() => {
      // Create and register mock clients
      const mockRestClient = new MockServiceClient(TEST_FIXTURES.CLIENT_TYPE_REST);
      const mockS3Client = new MockServiceClient(TEST_FIXTURES.CLIENT_TYPE_S3);

      world.registerClient(TEST_FIXTURES.CLIENT_TYPE_REST, mockRestClient);
      world.registerClient(TEST_FIXTURES.CLIENT_TYPE_S3, mockS3Client);
    });

    describe("initializeClients", () => {
      it("should initialize all registered clients", async () => {
        await world.initializeClients();

        // Get the registered clients
        const restClient = world.getClient(TEST_FIXTURES.CLIENT_TYPE_REST);
        const s3Client = world.getClient(TEST_FIXTURES.CLIENT_TYPE_S3);

        expect(restClient.init).toHaveBeenCalled();
        expect(s3Client.init).toHaveBeenCalled();
      });

      it("should register configs and create clients if config is provided", async () => {
        const config = { [TEST_FIXTURES.CLIENT_TYPE_CUSTOM]: TEST_FIXTURES.CONFIG_REST };
        // Cast to SmokeWorldImpl to access private method
        const spy = vi.spyOn(
          world as unknown as { createAndRegisterDefaultClients: () => Promise<void> },
          "createAndRegisterDefaultClients",
        );

        await world.initializeClients(config);

        expect(mockRegistry.registerConfigs).toHaveBeenCalledWith(config);
        expect(spy).toHaveBeenCalled();
      });
    });

    describe("resetClients", () => {
      it("should reset all registered clients", async () => {
        await world.resetClients();

        // Get the registered clients
        const restClient = world.getClient(TEST_FIXTURES.CLIENT_TYPE_REST);
        const s3Client = world.getClient(TEST_FIXTURES.CLIENT_TYPE_S3);

        expect(restClient.reset).toHaveBeenCalled();
        expect(s3Client.reset).toHaveBeenCalled();
      });
    });

    describe("destroyClients", () => {
      it("should destroy all registered clients and clear the map", async () => {
        // Get the registered clients before destroy
        const restClient = world.getClient(TEST_FIXTURES.CLIENT_TYPE_REST);
        const spyRestClientDestroy = vi.spyOn(restClient, "destroy");

        const s3Client = world.getClient(TEST_FIXTURES.CLIENT_TYPE_S3);
        const spyS3ClientDestroy = vi.spyOn(s3Client, "destroy");

        await world.destroyClients();

        // Verify both clients' destroy methods were called
        expect(spyRestClientDestroy).toHaveBeenCalledOnce();
        expect(spyS3ClientDestroy).toHaveBeenCalledOnce();

        // The clients map should be cleared
        expect(world["clients"].size).toBe(0);
      });
    });
  });

  /**
   * Tests for test data storage methods
   */
  describe("test data storage", () => {
    describe("responses", () => {
      it("should store and retrieve a response", () => {
        world.attachResponse(TEST_FIXTURES.RESPONSE_DATA);

        expect(world.getLastResponse()).toBe(TEST_FIXTURES.RESPONSE_DATA);
      });

      it("should throw an error when getting a response that doesn't exist", () => {
        expect(() => {
          world.getLastResponse();
        }).toThrow("No response has been attached");
      });
    });

    describe("content", () => {
      it("should store and retrieve content", () => {
        world.attachContent(TEST_FIXTURES.CONTENT_DATA);

        expect(world.getLastContent()).toBe(TEST_FIXTURES.CONTENT_DATA);
      });

      it("should throw an error when getting content that doesn't exist", () => {
        expect(() => {
          world.getLastContent();
        }).toThrow("No content has been attached");
      });
    });

    describe("errors", () => {
      it("should store and retrieve an error", () => {
        world.attachError(TEST_FIXTURES.ERROR_DATA);

        expect(world.getLastError()).toBe(TEST_FIXTURES.ERROR_DATA);
      });

      it("should throw an error when getting an error that doesn't exist", () => {
        expect(() => {
          world.getLastError();
        }).toThrow("No error has been attached");
      });
    });
  });

  /**
   * Tests for property management methods
   */
  describe("property management", () => {
    describe("setProperty", () => {
      it("should set a property value", () => {
        world.setProperty(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);

        // Verify the property was set by checking with hasProperty and getProperty
        expect(world.hasProperty(TEST_FIXTURES.PROPERTY_KEY)).toBe(true);
        expect(world.getProperty(TEST_FIXTURES.PROPERTY_KEY)).toBe(TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should set an object property value", () => {
        world.setProperty(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_OBJECT);

        // Verify the object property was set by using getProperty
        expect(world.getProperty(TEST_FIXTURES.PROPERTY_KEY)).toEqual(
          TEST_FIXTURES.PROPERTY_OBJECT,
        );
      });

      it("should throw an error for invalid property key", () => {
        expect(() => {
          world.setProperty(TEST_FIXTURES.INVALID_PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
        }).toThrow(/Invalid property key/);
      });
    });

    describe("getProperty", () => {
      it("should get a property value", () => {
        world.setProperty(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);

        expect(world.getProperty(TEST_FIXTURES.PROPERTY_KEY)).toBe(TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should return default value if property doesn't exist", () => {
        const defaultValue = "default";

        expect(world.getProperty("nonExistent", defaultValue)).toBe(defaultValue);
      });

      it("should return undefined if property doesn't exist and no default", () => {
        expect(world.getProperty("nonExistent")).toBeUndefined();
      });

      it("should throw an error for invalid property key", () => {
        expect(() => {
          world.getProperty(TEST_FIXTURES.INVALID_PROPERTY_KEY);
        }).toThrow(/Invalid property key/);
      });
    });

    describe("hasProperty", () => {
      it("should return true if property exists", () => {
        world.setProperty(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);

        expect(world.hasProperty(TEST_FIXTURES.PROPERTY_KEY)).toBe(true);
      });

      it("should return false if property doesn't exist", () => {
        expect(world.hasProperty("nonExistent")).toBe(false);
      });

      it("should throw an error for invalid property key", () => {
        expect(() => {
          world.hasProperty(TEST_FIXTURES.INVALID_PROPERTY_KEY);
        }).toThrow(/Invalid property key/);
      });
    });

    describe("deleteProperty", () => {
      it("should delete an existing property", () => {
        world.setProperty(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
        world.deleteProperty(TEST_FIXTURES.PROPERTY_KEY);

        expect(world.hasProperty(TEST_FIXTURES.PROPERTY_KEY)).toBe(false);
      });

      it("should throw an error when deleting non-existent property", () => {
        expect(() => {
          world.deleteProperty("nonExistent");
        }).toThrow(/Property not found: nonExistent/);
      });

      it("should throw an error for invalid property key", () => {
        expect(() => {
          world.deleteProperty(TEST_FIXTURES.INVALID_PROPERTY_KEY);
        }).toThrow(/Invalid property key/);
      });

      it("should delegate to WorldProperties for property deletion", () => {
        // Create a spy on the WorldProperties.delete method
        const deleteSpy = vi.spyOn(world.getWorldProperties(), "delete");

        // Set and delete a property
        world.setProperty(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
        world.deleteProperty(TEST_FIXTURES.PROPERTY_KEY);

        // Verify WorldProperties.delete was called with the right key
        expect(deleteSpy).toHaveBeenCalledWith(TEST_FIXTURES.PROPERTY_KEY);
        expect(world.hasProperty(TEST_FIXTURES.PROPERTY_KEY)).toBe(false);
      });
    });

    describe("isPropertyReference", () => {
      it("should delegate to WorldProperties.isPropertyReference", () => {
        // Create a spy on WorldProperties.isPropertyReference
        const isPropertyReferenceSpy = vi.spyOn(world.getWorldProperties(), "isPropertyReference");

        // Call the method and verify delegation
        world.isPropertyReference("property:someKey");

        expect(isPropertyReferenceSpy).toHaveBeenCalledWith("property:someKey");
      });

      it("should return true for valid property reference", () => {
        expect(world.isPropertyReference("property:someKey")).toBe(true);
      });

      it("should return false for non-property reference", () => {
        expect(world.isPropertyReference("not-a-property-reference")).toBe(false);
      });
    });

    describe("getWorldProperties", () => {
      it("should return the WorldProperties instance", () => {
        const worldProperties = world.getWorldProperties();

        expect(worldProperties).toBeDefined();
        expect(worldProperties).toBeInstanceOf(WorldProperties);
      });

      it("should return a WorldProperties instance that can modify world state", () => {
        // Get the WorldProperties instance
        const worldProperties = world.getWorldProperties();

        // Use it to set a property
        worldProperties.set("directSetKey", "directSetValue");

        // Verify the property is accessible through the world
        expect(world.hasProperty("directSetKey")).toBe(true);
        expect(world.getProperty("directSetKey")).toBe("directSetValue");
      });
    });
  });

  /**
   * Tests for parameter resolution methods
   */
  describe("parameter resolution", () => {
    beforeEach(() => {
      // Mock configuration provider
      mockProvider.getValue = vi.fn().mockImplementation(async (path) => {
        if (path === TEST_FIXTURES.CONFIG_PATH) {
          return TEST_FIXTURES.CONFIG_VALUE;
        }
        if (path === "test.value") {
          return "testValue";
        }
        if (path === "env.name") {
          return "development";
        }
        return undefined;
      });

      // Set some properties for tests
      world.setProperty("testKey", TEST_FIXTURES.PROPERTY_VALUE);
      world.setProperty("name", "User");
    });

    describe("resolveConfigValue", () => {
      it("should resolve a configuration reference", async () => {
        const input = `Value is ${TEST_FIXTURES.CONFIG_REFERENCE}`;
        const result = await world.resolveConfigValue(input);

        expect(result).toBe("Value is testValue");
        expect(mockProvider.getValue).toHaveBeenCalledWith("test.value");
      });

      it("should throw an error for invalid configuration reference format", async () => {
        const input = "config:invalid..format";

        await expect(world.resolveConfigValue(input)).rejects.toThrow(
          /Invalid configuration reference format/,
        );
      });

      it("should throw an error if configuration value is not found", async () => {
        mockProvider.getValue = vi.fn().mockResolvedValue(undefined);

        await expect(world.resolveConfigValue("config:missing.value")).rejects.toThrow(
          /Configuration value not found/,
        );
      });
    });

    describe("resolvePropertyValue", () => {
      it("should resolve an exact property reference", () => {
        // Test with exact property reference
        const result = world.resolvePropertyValue(TEST_FIXTURES.PROPERTY_REFERENCE);

        expect(result).toBe(TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should throw a structured error for invalid property reference format", () => {
        const input = "property:invalid.format";
        try {
          world.resolvePropertyValue(input);
          throw new Error("expected resolvePropertyValue to throw");
        } catch (err) {
          expect(SmokerError.isSmokerError(err)).toBe(true);
          if (SmokerError.isSmokerError(err)) {
            expect(err.code).toBe(ERR_VALIDATION);
            expect(err.domain).toBe("world");
          }
        }
      });

      it("should throw a structured error if property is not found", () => {
        try {
          world.resolvePropertyValue("property:missing");
          throw new Error("expected resolvePropertyValue to throw");
        } catch (err) {
          expect(SmokerError.isSmokerError(err)).toBe(true);
          if (SmokerError.isSmokerError(err)) {
            expect(err.code).toBe(ERR_VALIDATION);
            expect(err.domain).toBe("world");
          }
        }
      });
    });

    describe("resolveStepParameter", () => {
      it("should return original string if no references", async () => {
        const input = "No references here";
        const result = await world.resolveStepParameter(input);

        expect(result).toBe(input);
      });
    });

    describe("resolveParam", () => {
      it("should return null and undefined as is", async () => {
        expect(await world.resolveParam(null)).toBe(null);
        expect(await world.resolveParam(undefined)).toBe(undefined);
      });

      it("should resolve string parameters", async () => {
        const input = TEST_FIXTURES.PROPERTY_REFERENCE;
        const result = await world.resolveParam(input);

        expect(result).toBe(TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should resolve array parameters recursively", async () => {
        const input = [TEST_FIXTURES.PROPERTY_REFERENCE, TEST_FIXTURES.CONFIG_REFERENCE];
        const result = await world.resolveParam(input);

        expect(result).toEqual([TEST_FIXTURES.PROPERTY_VALUE, "testValue"]);
      });

      it("should resolve object parameters recursively", async () => {
        const input = {
          prop: TEST_FIXTURES.PROPERTY_REFERENCE,
          config: TEST_FIXTURES.CONFIG_REFERENCE,
        };
        const result = await world.resolveParam(input);

        expect(result).toEqual({
          prop: TEST_FIXTURES.PROPERTY_VALUE,
          config: "testValue",
        });
      });

      it("should return primitive types as is", async () => {
        expect(await world.resolveParam(42)).toBe(42);
        expect(await world.resolveParam(true)).toBe(true);
      });
    });
  });
});

/**
 * Tests for the DefaultConfigurationProvider class
 */
describe("DefaultConfigurationProvider", () => {
  let provider: DefaultConfigurationProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Configuration.getInstance
    vi.spyOn(Configuration, "getInstance").mockReturnValue({
      getValue: vi.fn().mockResolvedValue("configValue"),
    } as unknown as Configuration);

    provider = new DefaultConfigurationProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getValue", () => {
    it("should get a value from the configuration", async () => {
      const value = await provider.getValue("test.key");

      expect(value).toBe("configValue");
      expect(Configuration.getInstance().getValue).toHaveBeenCalledWith("test.key", undefined);
    });

    it("should pass default value to configuration", async () => {
      const defaultValue = "default";
      await provider.getValue("test.key", defaultValue);

      expect(Configuration.getInstance().getValue).toHaveBeenCalledWith("test.key", defaultValue);
    });
  });
});
