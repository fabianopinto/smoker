/**
 * Tests for the ClientFactory class
 *
 * The ClientFactory is responsible for creating and initializing service clients
 * based on configurations retrieved from the ClientRegistry. It supports multiple
 * client types and handles client ID resolution with fallback logic.
 *
 * Test Coverage:
 * - Constructor initialization with registry dependency
 * - Client creation for all supported client types
 * - Client ID resolution (explicit → config → type fallback)
 * - Configuration handling and fallback behavior
 * - Client initialization with error propagation
 * - Error handling for unsupported client types
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientType } from "../../../src/clients/core";
import { ClientFactory } from "../../../src/clients/registry/client-factory";
import { type ClientConfig, ClientRegistry } from "../../../src/clients/registry/client-registry";

/**
 * Import client modules for mocking after setting up mocks
 */
import * as awsModule from "../../../src/clients/aws";
import * as httpModule from "../../../src/clients/http";
import * as messagingModule from "../../../src/clients/messaging";

/**
 * Mock client modules
 */
vi.mock("../../../src/clients/aws");
vi.mock("../../../src/clients/http");
vi.mock("../../../src/clients/messaging");

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client configurations
  CONFIG_REST: { baseUrl: "https://api.test.com", timeout: 5000 } as ClientConfig,
  CONFIG_S3: { region: "us-east-1", bucket: "test-bucket" } as ClientConfig,
  CONFIG_WITH_ID: { baseUrl: "https://api.with-id.com", id: "test-config-id" } as ClientConfig,

  // Test IDs
  ID_EXPLICIT: "test-explicit-id",
  ID_UNKNOWN_TYPE: "unknown-client-type",
};

/**
 * Test Instance Variables
 */
let mockRegistry: ClientRegistry;
let clientFactory: ClientFactory;

/**
 * Tests for the ClientFactory class
 */
describe("ClientFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupClientMocks();
    mockRegistry = createMockRegistry();
    clientFactory = new ClientFactory(mockRegistry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  /**
   * Creates a standardized mock client with common ServiceClient interface
   *
   * @param id - The client ID
   * @param config - The client configuration
   * @returns A mock client with common ServiceClient interface
   */
  function createMockClient(id: string | undefined, config: Record<string, unknown> | undefined) {
    return {
      id,
      config: config || {},
      init: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(false),
      getName: vi.fn().mockReturnValue(id),
      cleanupClient: vi.fn().mockResolvedValue(undefined),
    };
  }

  /**
   * Creates a mock REST client with additional HTTP-specific methods
   *
   * @param id - The client ID
   * @param config - The client configuration
   * @returns A mock REST client with additional HTTP-specific methods
   */
  function createMockRestClient(
    id: string | undefined,
    config: Record<string, unknown> | undefined,
  ) {
    return {
      ...createMockClient(id, config),
      // HTTP-specific properties
      client: {},
      initializeClient: vi.fn(),
      isValidUrl: vi.fn().mockReturnValue(true),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      head: vi.fn(),
      options: vi.fn(),
      request: vi.fn(),
    };
  }

  /**
   * Sets up all client constructor mocks
   */
  function setupClientMocks() {
    // HTTP clients
    vi.spyOn(httpModule, "RestClient").mockImplementation(
      (id, config) =>
        createMockRestClient(id, config) as Partial<httpModule.RestClient> as httpModule.RestClient,
    );

    // Messaging clients
    vi.spyOn(messagingModule, "MqttClient").mockImplementation(
      (id, config) =>
        createMockClient(
          id,
          config,
        ) as Partial<messagingModule.MqttClient> as messagingModule.MqttClient,
    );

    vi.spyOn(messagingModule, "KafkaClient").mockImplementation(
      (id, config) =>
        createMockClient(
          id,
          config,
        ) as Partial<messagingModule.KafkaClient> as messagingModule.KafkaClient,
    );

    // AWS clients
    vi.spyOn(awsModule, "S3Client").mockImplementation(
      (id, config) =>
        createMockClient(id, config) as Partial<awsModule.S3Client> as awsModule.S3Client,
    );

    vi.spyOn(awsModule, "CloudWatchClient").mockImplementation(
      (id, config) =>
        createMockClient(
          id,
          config,
        ) as Partial<awsModule.CloudWatchClient> as awsModule.CloudWatchClient,
    );

    vi.spyOn(awsModule, "SsmClient").mockImplementation(
      (id, config) =>
        createMockClient(id, config) as Partial<awsModule.SsmClient> as awsModule.SsmClient,
    );

    vi.spyOn(awsModule, "SqsClient").mockImplementation(
      (id, config) =>
        createMockClient(id, config) as Partial<awsModule.SqsClient> as awsModule.SqsClient,
    );

    vi.spyOn(awsModule, "KinesisClient").mockImplementation(
      (id, config) =>
        createMockClient(id, config) as Partial<awsModule.KinesisClient> as awsModule.KinesisClient,
    );
  }

  /**
   * Creates a mock ClientRegistry with standard interface
   *
   * @returns A mock ClientRegistry
   */
  function createMockRegistry(): ClientRegistry {
    return {
      getConfig: vi.fn(),
      hasConfig: vi.fn(),
      registerConfig: vi.fn(),
      registerConfigs: vi.fn(),
      getAllConfigs: vi.fn(),
      clearConfigs: vi.fn(),
    } as unknown as ClientRegistry;
  }

  /**
   * Tests for the ClientFactory constructor
   */
  describe("constructor", () => {
    it("should create a ClientFactory instance with the provided registry", () => {
      const testRegistry = createMockRegistry();

      const testFactory = new ClientFactory(testRegistry);

      expect(testFactory).toBeInstanceOf(ClientFactory);
    });
  });

  /**
   * Tests for client creation
   */
  describe("createClient", () => {
    it("should create client with empty config when no configuration exists", () => {
      // Setup mock to return undefined for all config lookups
      const mockGetConfig = vi.fn().mockReturnValue(undefined);

      // Create a test registry with our mock implementation
      const testRegistry = createMockRegistry();
      testRegistry.getConfig = mockGetConfig;

      // Create a test factory with our test registry
      const testFactory = new ClientFactory(testRegistry);

      // Create a properly typed mock RestClient instance with empty config
      const mockClient = createMockClient(ClientType.REST, {});
      const mockRestClient = {
        ...mockClient,
        // Add any required RestClient specific methods here
      } as unknown as httpModule.RestClient;

      // Setup the mock to return our mock client when RestClient is called
      vi.mocked(httpModule.RestClient).mockImplementation(() => mockRestClient);

      // Create a client with no configuration available
      const client = testFactory.createClient(ClientType.REST);

      // Client should be created successfully
      expect(client).toBeDefined();

      // Verify RestClient was called with an empty config object
      expect(httpModule.RestClient).toHaveBeenCalledWith(ClientType.REST, {});

      // Verify getConfig was called once (no fallback to default since we're testing no config case)
      expect(mockGetConfig).toHaveBeenCalledTimes(1);
      expect(mockGetConfig).toHaveBeenCalledWith(ClientType.REST, undefined);
    });

    it("should throw an error when registry throws an error", () => {
      const error = new Error("Registry error");
      mockRegistry.getConfig = vi.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => clientFactory.createClient(ClientType.REST)).toThrow(error);
    });

    it("should create a REST client with the correct configuration", () => {
      // Setup the mock to return our test config
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_REST);

      // Create a mock RestClient instance with proper typing
      const mockClient = createMockRestClient(
        ClientType.REST,
        TEST_FIXTURES.CONFIG_REST,
      ) as unknown as httpModule.RestClient;

      // Setup the mock to return our mock client when RestClient is called
      vi.mocked(httpModule.RestClient).mockImplementation(() => mockClient);

      const client = clientFactory.createClient(ClientType.REST);

      expect(client).toBeDefined();
      expect(httpModule.RestClient).toHaveBeenCalledWith(
        ClientType.REST,
        TEST_FIXTURES.CONFIG_REST,
      );
      expect(mockRegistry.getConfig).toHaveBeenCalledWith(ClientType.REST, undefined);
    });

    it("should create an S3 client with the correct configuration", () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_S3);

      const client = clientFactory.createClient(ClientType.S3);

      expect(client).toBeDefined();
      expect(awsModule.S3Client).toHaveBeenCalledWith(ClientType.S3, TEST_FIXTURES.CONFIG_S3);
      expect(mockRegistry.getConfig).toHaveBeenCalledWith(ClientType.S3, undefined);
    });

    it("should use explicit ID when provided", () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_REST);

      const client = clientFactory.createClient(ClientType.REST, TEST_FIXTURES.ID_EXPLICIT);

      expect(client).toBeDefined();
      expect(httpModule.RestClient).toHaveBeenCalledWith(
        TEST_FIXTURES.ID_EXPLICIT,
        TEST_FIXTURES.CONFIG_REST,
      );
      expect(mockRegistry.getConfig).toHaveBeenCalledWith(
        ClientType.REST,
        TEST_FIXTURES.ID_EXPLICIT,
      );
    });

    it("should use ID from config when explicit ID is not provided", () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_WITH_ID);

      const client = clientFactory.createClient(ClientType.REST);

      expect(client).toBeDefined();
      expect(httpModule.RestClient).toHaveBeenCalledWith(
        TEST_FIXTURES.CONFIG_WITH_ID.id,
        TEST_FIXTURES.CONFIG_WITH_ID,
      );
      expect(mockRegistry.getConfig).toHaveBeenCalledWith(ClientType.REST, undefined);
    });

    it("should use client type as ID when neither explicit ID nor config ID is provided", () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_REST);

      const client = clientFactory.createClient(ClientType.REST);

      expect(client).toBeDefined();
      expect(httpModule.RestClient).toHaveBeenCalledWith(
        ClientType.REST,
        TEST_FIXTURES.CONFIG_REST,
      );
    });

    it("should create a client with empty config when registry returns undefined", () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(undefined);

      const client = clientFactory.createClient(ClientType.REST);

      expect(client).toBeDefined();
      expect(httpModule.RestClient).toHaveBeenCalledWith(ClientType.REST, {});
    });

    it.each([
      { type: ClientType.REST, module: httpModule, constructor: "RestClient" },
      { type: ClientType.MQTT, module: messagingModule, constructor: "MqttClient" },
      { type: ClientType.KAFKA, module: messagingModule, constructor: "KafkaClient" },
      { type: ClientType.S3, module: awsModule, constructor: "S3Client" },
      { type: ClientType.CLOUDWATCH, module: awsModule, constructor: "CloudWatchClient" },
      { type: ClientType.SSM, module: awsModule, constructor: "SsmClient" },
      { type: ClientType.SQS, module: awsModule, constructor: "SqsClient" },
      { type: ClientType.KINESIS, module: awsModule, constructor: "KinesisClient" },
    ])(
      "should create clients for all supported client type %s",
      ({ type, module, constructor }) => {
        const client = clientFactory.createClient(type);
        expect(client).toBeDefined();
        expect(module[constructor as keyof typeof module]).toHaveBeenCalled();
      },
    );

    it("should throw an error for unknown client types", () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue({});

      expect(() => clientFactory.createClient(TEST_FIXTURES.ID_UNKNOWN_TYPE as ClientType)).toThrow(
        `Unknown client type: ${TEST_FIXTURES.ID_UNKNOWN_TYPE}`,
      );
    });
  });

  /**
   * Tests for client initialization
   */
  describe("createAndInitialize", () => {
    it("should throw an error when client initialization fails with non-Error rejection", async () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_REST);
      const mockClient = {
        ...createMockRestClient("test-client", TEST_FIXTURES.CONFIG_REST),
        init: vi.fn().mockRejectedValue("Initialization failed"),
      };
      vi.mocked(httpModule.RestClient).mockReturnValue(
        mockClient as Partial<httpModule.RestClient> as httpModule.RestClient,
      );

      await expect(clientFactory.createAndInitialize(ClientType.REST)).rejects.toThrow(
        "Initialization failed",
      );
    });

    it("should throw an error when client creation fails", async () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_REST);
      vi.mocked(httpModule.RestClient).mockImplementation(() => {
        throw new Error("Failed to create client");
      });

      await expect(clientFactory.createAndInitialize(ClientType.REST)).rejects.toThrow(
        "Failed to create client",
      );
    });
    it("should create and initialize a client successfully", async () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_REST);
      const mockClient = {
        init: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(httpModule.RestClient).mockReturnValue(
        mockClient as Partial<httpModule.RestClient> as httpModule.RestClient,
      );

      const client = await clientFactory.createAndInitialize(ClientType.REST);

      expect(client).toBe(mockClient);
      expect(mockClient.init).toHaveBeenCalledOnce();
    });

    it("should propagate initialization errors", async () => {
      const initError = new Error("Client initialization failed");
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_REST);
      const mockClient = {
        ...createMockRestClient("test-client", TEST_FIXTURES.CONFIG_REST),
        init: vi.fn().mockRejectedValue(initError),
      };
      vi.mocked(httpModule.RestClient).mockReturnValue(
        mockClient as Partial<httpModule.RestClient> as httpModule.RestClient,
      );

      await expect(clientFactory.createAndInitialize(ClientType.REST)).rejects.toThrow(initError);
      expect(mockClient.init).toHaveBeenCalledOnce();
    });

    it("should use explicit ID when provided during initialization", async () => {
      mockRegistry.getConfig = vi.fn().mockReturnValue(TEST_FIXTURES.CONFIG_REST);
      const mockClient = {
        ...createMockRestClient(TEST_FIXTURES.ID_EXPLICIT, TEST_FIXTURES.CONFIG_REST),
        init: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(httpModule.RestClient).mockReturnValue(
        mockClient as Partial<httpModule.RestClient> as httpModule.RestClient,
      );

      await clientFactory.createAndInitialize(ClientType.REST, TEST_FIXTURES.ID_EXPLICIT);

      expect(httpModule.RestClient).toHaveBeenCalledWith(
        TEST_FIXTURES.ID_EXPLICIT,
        TEST_FIXTURES.CONFIG_REST,
      );
      expect(mockClient.init).toHaveBeenCalledOnce();
    });
  });
});
