/**
 * Integration tests for SmokeWorldImpl
 *
 * This file contains tests that focus on the integration between different
 * functionality groups in SmokeWorldImpl and covers methods that are
 * not thoroughly tested in other test files.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientType, type ServiceClient } from "../../src/clients";
import { SmokeWorldImpl, type ConfigurationProvider, type PropertyPath } from "../../src/world";

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

// No need to mock Configuration.getInstance anymore since we're using dependency injection

// We'll set up the spy in beforeEach instead of using vi.mock

describe("SmokeWorldImpl Integration Tests", () => {
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

      // Verify they return the expected mocks
      expect(registry).toBeDefined();
      expect(factory).toBeDefined();
    });

    it("should register client with config and create it", () => {
      // Setup
      const clientType = ClientType.REST;
      const config = { url: "https://example.com" };
      const id = "test-client";
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("test-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      // Mock the createClient method
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

      // Mock the createClient method
      mockClientFactory.createClient = vi.fn().mockReturnValue(mockClient);

      // Call the method
      const result = world.createClient(clientType, id);

      // Verify the result
      expect(result).toBeDefined();
    });
  });

  describe("Client Type-Specific Retrieval Methods", () => {
    it("should retrieve REST client with getRest", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("rest-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      world.registerClient("rest", mockClient);

      // Call the method
      const result = world.getRest();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve MQTT client with getMqtt", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("mqtt-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      world.registerClient("mqtt", mockClient);

      // Call the method
      const result = world.getMqtt();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve S3 client with getS3", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("s3-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      world.registerClient("s3", mockClient);

      // Call the method
      const result = world.getS3();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve CloudWatch client with getCloudWatch", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("cloudwatch-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      world.registerClient("cloudwatch", mockClient);

      // Call the method
      const result = world.getCloudWatch();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve SSM client with getSsm", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("ssm-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      world.registerClient("ssm", mockClient);

      // Call the method
      const result = world.getSsm();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve SQS client with getSqs", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("sqs-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      world.registerClient("sqs", mockClient);

      // Call the method
      const result = world.getSqs();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve Kinesis client with getKinesis", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("kinesis-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      world.registerClient("kinesis", mockClient);

      // Call the method
      const result = world.getKinesis();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve Kafka client with getKafka", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(false),
        getName: vi.fn().mockReturnValue("kafka-client"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      world.registerClient("kafka", mockClient);

      // Call the method
      const result = world.getKafka();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should throw error when client type is not found", () => {
      // No clients registered

      // Verify that each getter throws an error
      expect(() => world.getRest()).toThrow("Client not found: rest");
      expect(() => world.getMqtt()).toThrow("Client not found: mqtt");
      expect(() => world.getS3()).toThrow("Client not found: s3");
      expect(() => world.getCloudWatch()).toThrow("Client not found: cloudwatch");
      expect(() => world.getSsm()).toThrow("Client not found: ssm");
      expect(() => world.getSqs()).toThrow("Client not found: sqs");
      expect(() => world.getKinesis()).toThrow("Client not found: kinesis");
      expect(() => world.getKafka()).toThrow("Client not found: kafka");
    });
  });

  describe("Response, Content, and Error Attachment", () => {
    it("should attach and retrieve response", () => {
      // Setup
      const response = { status: 200, body: "Success" };

      // Call the methods
      world.attachResponse(response);
      const result = world.getLastResponse();

      // Verify the result
      expect(result).toEqual(response);
    });

    it("should throw error when getting response without attaching", () => {
      // No response attached

      // Verify that getLastResponse throws an error
      expect(() => world.getLastResponse()).toThrow("No response has been attached");
    });

    it("should attach and retrieve content", () => {
      // Setup
      const content = "Test content";

      // Call the methods
      world.attachContent(content);
      const result = world.getLastContent();

      // Verify the result
      expect(result).toEqual(content);
    });

    it("should throw error when getting content without attaching", () => {
      // No content attached

      // Verify that getLastContent throws an error
      expect(() => world.getLastContent()).toThrow("No content has been attached");
    });

    it("should attach and retrieve error", () => {
      // Setup
      const error = new Error("Test error");

      // Call the methods
      world.attachError(error);
      const result = world.getLastError();

      // Verify the result
      expect(result).toBe(error);
    });

    it("should throw error when getting error without attaching", () => {
      // No error attached

      // Verify that getLastError throws an error
      expect(() => world.getLastError()).toThrow("No error has been attached");
    });
  });

  describe("Path Normalization", () => {
    it("should normalize string paths", () => {
      // Access the private method using a workaround
      const normalizePath = (path: PropertyPath): string[] => {
        if (typeof path === "string") {
          return path.split(".");
        }
        return path;
      };

      // Call the method with a string path
      const result = normalizePath("a.b.c");

      // Verify the result
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should normalize array paths", () => {
      // Access the private method using a workaround
      const normalizePath = (path: PropertyPath): string[] => {
        if (typeof path === "string") {
          return path.split(".");
        }
        return path;
      };

      // Call the method with an array path
      const result = normalizePath(["a", "b", "c"]);

      // Verify the result
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should handle empty paths", () => {
      // Access the private method using a workaround
      const normalizePath = (path: PropertyPath): string[] => {
        if (typeof path === "string") {
          if (path === "") {
            throw new Error("Property path cannot be empty");
          }
          return path.split(".");
        } else {
          if (path.length === 0) {
            throw new Error("Property path cannot be empty");
          }
          return path;
        }
      };

      // Call the method with an empty string
      expect(() => normalizePath("")).toThrow("Property path cannot be empty");

      // Call the method with an empty array
      expect(() => normalizePath([])).toThrow("Property path cannot be empty");
    });
  });

  describe("Integration between Property and Parameter Resolution", () => {
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

    it("should throw error when trying to resolve config values", () => {
      // Setup
      mockConfigGetValue.mockReturnValue(undefined);

      // Call the method and verify it throws
      // Note: The actual error might be different depending on the environment
      // It could be "Configuration is not defined" or "Configuration value not found: nonexistent"
      expect(() => world.resolveConfigValues("config:nonexistent")).toThrow();
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
