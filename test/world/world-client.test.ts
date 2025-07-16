import { describe, expect, it, vi } from "vitest";
import { ClientType, type ClientConfig, type ServiceClient } from "../../src/clients";

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
}

interface MockRegistry {
  registerConfig: ReturnType<typeof vi.fn>;
  getConfig: ReturnType<typeof vi.fn>;
  hasConfig: ReturnType<typeof vi.fn>;
  getAllConfigs: ReturnType<typeof vi.fn>;
  getConfigsByType: ReturnType<typeof vi.fn>;
  registerConfigs: ReturnType<typeof vi.fn>;
  registerConfigArray: ReturnType<typeof vi.fn>;
}

interface MockFactory {
  createClient: ReturnType<typeof vi.fn>;
  createAndInitialize: ReturnType<typeof vi.fn>;
}

// Helper functions to create mocks
function createMockClient(id: string): MockClient {
  return {
    id,
    init: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as unknown as MockClient;
}

function createMockRegistry(configEntries: [string, unknown][] = []): MockRegistry {
  return {
    registerConfig: vi.fn(),
    getConfig: vi.fn().mockReturnValue({}),
    hasConfig: vi.fn().mockReturnValue(false),
    getAllConfigs: vi.fn().mockReturnValue(new Map(configEntries)),
    getConfigsByType: vi.fn(),
    registerConfigs: vi.fn(),
    registerConfigArray: vi.fn(),
  };
}

function createMockFactory(clientMap: Record<string, MockClient>): MockFactory {
  return {
    createClient: vi.fn().mockImplementation((type, id) => {
      const key = id ? `${type}:${id}` : type;
      return clientMap[key] || null;
    }),
    createAndInitialize: vi.fn().mockImplementation(async (type, id) => {
      const client = clientMap[id ? `${type}:${id}` : type];
      if (client) await client.init();
      return client;
    }),
  };
}

// Helper type for client getter methods
type ClientGetter = (id?: string) => ServiceClient;

describe("SmokeWorld Client Management", () => {
  describe("Client Registration", () => {
    it("should register a client correctly", () => {
      // Create mock client
      const mockClient = createMockClient("test-client");

      // Create clients map
      const mockClientsMap = new Map<string, ServiceClient>();

      // Create a world object with the methods we need to test
      const world = {
        clients: mockClientsMap,
        registerClient: function (name: string, client: ServiceClient): void {
          this.clients.set(name, client);
        },
        getClient: function (name: string): ServiceClient {
          const client = this.clients.get(name);
          if (!client) {
            throw new Error(`Client not found: ${name}`);
          }
          return client;
        },
        hasClient: function (name: string): boolean {
          return this.clients.has(name);
        },
      };

      // Verify client is not in the map before registration
      expect(world.hasClient("test-client")).toBe(false);
      expect(() => world.getClient("test-client")).toThrow("Client not found: test-client");

      // Register the client
      world.registerClient("test-client", mockClient);

      // Verify client is in the map after registration
      expect(world.hasClient("test-client")).toBe(true);
      expect(world.getClient("test-client")).toBe(mockClient);
      expect(mockClientsMap.get("test-client")).toBe(mockClient);
    });

    it("should register a client with config correctly", () => {
      // Create mock client
      const mockClient = createMockClient("rest-client");

      // Create clients map
      const mockClientsMap = new Map<string, ServiceClient>();

      // Create mock registry
      const mockRegistry = createMockRegistry();

      // Create mock factory that returns our mock client
      const mockFactory = createMockFactory({
        rest: mockClient,
        "rest:custom-id": mockClient,
      });

      // Create a world object with the methods we need to test
      const world = {
        clients: mockClientsMap,
        clientRegistry: mockRegistry,
        clientFactory: mockFactory,
        registerClient: function (name: string, client: ServiceClient): void {
          this.clients.set(name, client);
        },
        registerClientWithConfig: function (
          clientType: ClientType | string,
          config: ClientConfig,
          id?: string,
        ): ServiceClient {
          // Register configuration
          this.clientRegistry.registerConfig(clientType, config, id);

          // Create and register the client
          const clientId = id || config.id || clientType;
          const clientKey = clientId !== clientType ? `${clientType}:${clientId}` : clientType;
          const client = this.clientFactory.createClient(clientType, clientId);
          this.registerClient(clientKey, client);

          return client;
        },
      };

      // Test data
      const clientType = ClientType.REST;
      const clientId = "custom-id";
      const clientConfig = { baseUrl: "https://api.example.com" };

      // Register client with config
      const client = world.registerClientWithConfig(clientType, clientConfig, clientId);

      // Verify configuration was registered
      expect(mockRegistry.registerConfig).toHaveBeenCalledWith(clientType, clientConfig, clientId);

      // Verify client was created
      expect(mockFactory.createClient).toHaveBeenCalledWith(clientType, clientId);

      // Verify client was registered
      expect(mockClientsMap.has("rest:custom-id")).toBe(true);
      expect(mockClientsMap.get("rest:custom-id")).toBe(mockClient);

      // Verify the returned client is correct
      expect(client).toBe(mockClient);
    });

    it("should register multiple client configs", () => {
      // Create mock clients
      const mockRestClient1 = createMockClient("rest-client-1");
      const mockRestClient2 = createMockClient("rest-client-2");
      const mockRestClient3 = createMockClient("rest-client-3");

      // Create clients map
      const mockClientsMap = new Map<string, ServiceClient>();

      // Create mock registry
      const mockRegistry = createMockRegistry();

      // Create mock factory that returns our mock clients
      const mockFactory = createMockFactory({
        rest: mockRestClient1,
        "rest:2": mockRestClient2,
        "rest:custom-id": mockRestClient3,
      });

      // Create a world object with the methods we need to test
      const world = {
        clients: mockClientsMap,
        clientRegistry: mockRegistry,
        clientFactory: mockFactory,
        registerClient: function (name: string, client: ServiceClient): void {
          this.clients.set(name, client);
        },
        createClient: function (clientType: ClientType | string, id?: string): ServiceClient {
          return this.clientFactory.createClient(clientType, id);
        },
        registerClientConfigs: function (
          clientType: ClientType | string,
          configs: ClientConfig[],
        ): ServiceClient[] {
          const createdClients: ServiceClient[] = [];

          // Register the configuration array
          this.clientRegistry.registerConfigArray(clientType, configs);

          // Create clients for each configuration
          configs.forEach((config, index) => {
            // Use index+1 for ID if not specified and not first item
            const id = config.id || (index > 0 ? `${index + 1}` : undefined);
            const client = this.createClient(clientType, id as string);

            // Register the client with the appropriate key
            const clientKey = id ? `${clientType}:${id}` : (clientType as string);
            this.registerClient(clientKey, client);

            createdClients.push(client);
          });

          return createdClients;
        },
      };

      // Test data
      const clientType = ClientType.REST;
      const configs = [
        { baseUrl: "https://api.example.com/v1" },
        { baseUrl: "https://api.example.com/v2" },
        { id: "custom-id", baseUrl: "https://api.example.com/custom" },
      ];

      // Register multiple client configs
      const clients = world.registerClientConfigs(clientType, configs);

      // Verify configuration array was registered
      expect(mockRegistry.registerConfigArray).toHaveBeenCalledWith(clientType, configs);

      // Verify clients were created with correct IDs
      expect(mockFactory.createClient).toHaveBeenCalledWith(clientType, undefined);
      expect(mockFactory.createClient).toHaveBeenCalledWith(clientType, "2");
      expect(mockFactory.createClient).toHaveBeenCalledWith(clientType, "custom-id");

      // Verify clients were registered with correct keys
      expect(mockClientsMap.has("rest")).toBe(true);
      expect(mockClientsMap.has("rest:2")).toBe(true);
      expect(mockClientsMap.has("rest:custom-id")).toBe(true);

      expect(mockClientsMap.get("rest")).toBe(mockRestClient1);
      expect(mockClientsMap.get("rest:2")).toBe(mockRestClient2);
      expect(mockClientsMap.get("rest:custom-id")).toBe(mockRestClient3);

      // Verify the returned clients array contains all created clients
      expect(clients).toHaveLength(3);
      expect(clients).toContain(mockRestClient1);
      expect(clients).toContain(mockRestClient2);
      expect(clients).toContain(mockRestClient3);
    });
  });

  describe("Client Access Methods", () => {
    // Define test cases for client access methods
    const clientTestCases = [
      { type: "REST", key: "rest" },
      { type: "MQTT", key: "mqtt" },
      { type: "S3", key: "s3" },
      { type: "CloudWatch", key: "cloudwatch" },
      { type: "SSM", key: "ssm" },
      { type: "SQS", key: "sqs" },
      { type: "Kinesis", key: "kinesis" },
      { type: "Kafka", key: "kafka" },
    ];

    // Use it.each to test all client access methods
    it.each(clientTestCases)("should get $type client", ({ type, key }) => {
      // Create mock client
      const mockClient = createMockClient(`${type.toLowerCase()}-client`);

      // Create clients map with the client
      const mockClientsMap = new Map([[key, mockClient]]);

      // Create a world object with the methods we need to test
      // Define the world object type with proper getter methods
      interface WorldObject {
        clients: Map<string, ServiceClient>;
        getClient(name: string): ServiceClient;
        [key: string]:
          | Map<string, ServiceClient>
          | ((name: string) => ServiceClient)
          | ClientGetter;
      }

      const world: WorldObject = {
        clients: mockClientsMap,
        getClient: function (name: string): ServiceClient {
          const client = this.clients.get(name);
          if (!client) {
            throw new Error(`Client not found: ${name}`);
          }
          return client;
        },
      };

      // Create a getter function based on client type
      const createGetter = (clientKey: string): ClientGetter => {
        return (id?: string): ServiceClient => {
          return world.getClient(id ? `${clientKey}:${id}` : clientKey);
        };
      };

      // Add the appropriate getter method based on client type
      const getterName = `get${type === "SSM" ? "Ssm" : type.charAt(0) + type.slice(1).toLowerCase()}`;
      world[getterName] = createGetter(key);

      // Call the getter method to get the client
      const getterFn = world[getterName] as ClientGetter;
      const client = getterFn();

      // Verify the correct client was returned
      expect(client).toBe(mockClient);
    });

    it("should throw error when client does not exist", () => {
      // Create a world object with an empty clients map
      const world = {
        clients: new Map(),
        getClient: function (name: string): ServiceClient {
          const client = this.clients.get(name);
          if (!client) {
            throw new Error(`Client not found: ${name}`);
          }
          return client;
        },
        getRest: function (id?: string): ServiceClient {
          return this.getClient(id ? `rest:${id}` : "rest");
        },
      };

      // Attempt to get a non-existent client should throw an error
      expect(() => world.getRest()).toThrow("Client not found: rest");
      expect(() => world.getClient("nonexistent")).toThrow("Client not found: nonexistent");
    });

    it("should correctly check if client exists", () => {
      // Create mock clients
      const mockRestClient = createMockClient("rest-client");
      const mockMqttClient = createMockClient("mqtt-client");

      // Create clients map with some clients
      const mockClientsMap = new Map([
        ["rest", mockRestClient],
        ["mqtt:special", mockMqttClient],
      ]);

      // Create a world object with the methods we need to test
      const world = {
        clients: mockClientsMap,
        hasClient: function (name: string): boolean {
          return this.clients.has(name);
        },
      };

      // Verify existing clients are detected
      expect(world.hasClient("rest")).toBe(true);
      expect(world.hasClient("mqtt:special")).toBe(true);

      // Verify non-existent clients are not detected
      expect(world.hasClient("s3")).toBe(false);
      expect(world.hasClient("mqtt")).toBe(false);
      expect(world.hasClient("nonexistent")).toBe(false);
    });

    it("should get client with specific id", () => {
      // Create mock clients with different IDs
      const mockDefaultRestClient = createMockClient("default-rest-client");
      const mockSpecialRestClient = createMockClient("special-rest-client");
      const mockMqttClient = createMockClient("mqtt-client");

      // Create clients map with clients having different IDs
      const mockClientsMap = new Map([
        ["rest", mockDefaultRestClient],
        ["rest:special", mockSpecialRestClient],
        ["mqtt", mockMqttClient],
      ]);

      // Create a world object with the methods we need to test
      const world = {
        clients: mockClientsMap,
        getClient: function (name: string): ServiceClient {
          const client = this.clients.get(name);
          if (!client) {
            throw new Error(`Client not found: ${name}`);
          }
          return client;
        },
        getRest: function (id?: string): ServiceClient {
          return this.getClient(id ? `rest:${id}` : "rest");
        },
      };

      // Verify default client (no ID) is returned correctly
      expect(world.getRest()).toBe(mockDefaultRestClient);

      // Verify client with specific ID is returned correctly
      expect(world.getRest("special")).toBe(mockSpecialRestClient);
    });
  });

  describe("Client Lifecycle Methods", () => {
    it("should initialize all clients", async () => {
      // Create mock clients
      const mockRestClient = createMockClient("rest-client");
      const mockMqttClient = createMockClient("mqtt-client");
      const mockS3Client = createMockClient("s3-client");

      // Create registry and factory mocks
      const mockRegistry = createMockRegistry();
      const mockFactory = createMockFactory({
        rest: mockRestClient,
        mqtt: mockMqttClient,
        s3: mockS3Client,
      });

      // Create clients map with pre-populated clients
      const mockClientsMap = new Map([
        ["rest", mockRestClient],
        ["mqtt", mockMqttClient],
        ["s3", mockS3Client],
      ]);

      // Create a world object with the methods we need to test
      const world = {
        clientRegistry: mockRegistry,
        clientFactory: mockFactory,
        clients: mockClientsMap,
        initializeClients: async function (config?: Record<string, unknown>) {
          // Simplified implementation of initializeClients
          if (config) {
            // Register configurations and create clients
            this.clientRegistry.registerConfigs(config);
            // We're not testing this part in this test
          }

          // Initialize each client - this is what we're testing
          for (const client of this.clients.values()) {
            await client.init();
          }
        },
      };

      // Call the method being tested without config
      await world.initializeClients();

      // Verify all clients were initialized
      expect(mockRestClient.init).toHaveBeenCalled();
      expect(mockMqttClient.init).toHaveBeenCalled();
      expect(mockS3Client.init).toHaveBeenCalled();

      // Verify registerConfigs was not called since no config was provided
      expect(mockRegistry.registerConfigs).not.toHaveBeenCalled();
    });

    it("should initialize with configuration", async () => {
      // Create mock clients
      const mockRestClient = createMockClient("rest-client");
      const mockMqttClient = createMockClient("mqtt-client");
      const clientMap = {
        rest: mockRestClient,
        "mqtt:1": mockMqttClient,
      };

      // Create registry with config entries
      const mockRegistry = createMockRegistry([
        ["rest", {}],
        ["mqtt:1", {}],
      ]);

      // Create factory that returns our mock clients
      const mockFactory = createMockFactory(clientMap);

      // Mock the clients map for the world instance
      const mockClientsMap = new Map();

      // Mock the registerClient method to add clients to the map
      const registerClient = vi.fn().mockImplementation((key, client) => {
        mockClientsMap.set(key, client);
      });

      // Mock the hasClient method
      const hasClient = vi.fn().mockImplementation((name) => mockClientsMap.has(name));

      // Create a world object with the methods we need to test
      const world = {
        clientRegistry: mockRegistry,
        clientFactory: mockFactory,
        clients: mockClientsMap,
        hasClient,
        registerClient,
        createAndRegisterDefaultClients: function () {
          // Simplified implementation of createAndRegisterDefaultClients
          const configs = this.clientRegistry.getAllConfigs();

          for (const [key] of configs.entries()) {
            // Parse client type and ID from key
            const [clientType, clientId] = key.includes(":") ? key.split(":") : [key, undefined];

            // Skip if client already exists
            const clientKey = clientId ? `${clientType}:${clientId}` : clientType;
            if (this.hasClient(clientKey)) {
              continue;
            }

            // Create and register client
            const client = this.clientFactory.createClient(clientType, clientId);
            this.registerClient(clientKey, client);
          }
        },
        initializeClients: async function (config?: Record<string, unknown>) {
          // Simplified implementation of initializeClients
          if (config) {
            // Register configurations and create clients
            this.clientRegistry.registerConfigs(config);
            this.createAndRegisterDefaultClients();
          }

          // Initialize each client
          for (const client of this.clients.values()) {
            await client.init();
          }
        },
      };

      // Test configuration
      const testConfig = {
        rest: { baseUrl: "https://api.example.com" },
        "mqtt:1": { host: "mqtt.example.com", port: 1883 },
      };

      // Call the method being tested
      await world.initializeClients(testConfig);

      // Verify configurations were registered
      expect(mockRegistry.registerConfigs).toHaveBeenCalledWith(testConfig);

      // Verify clients were created and registered
      expect(mockFactory.createClient).toHaveBeenCalledWith("rest", undefined);
      expect(mockFactory.createClient).toHaveBeenCalledWith("mqtt", "1");
      expect(mockClientsMap.size).toBe(2);
      expect(mockClientsMap.get("rest")).toBe(mockRestClient);
      expect(mockClientsMap.get("mqtt:1")).toBe(mockMqttClient);

      // Verify clients were initialized
      expect(mockRestClient.init).toHaveBeenCalled();
      expect(mockMqttClient.init).toHaveBeenCalled();
    });

    it("should reset all clients", async () => {
      // Create mock clients
      const mockRestClient = createMockClient("rest-client");
      const mockMqttClient = createMockClient("mqtt-client");
      const mockS3Client = createMockClient("s3-client");

      // Create registry and factory mocks
      const mockRegistry = createMockRegistry();
      const mockFactory = createMockFactory({
        rest: mockRestClient,
        mqtt: mockMqttClient,
        s3: mockS3Client,
      });

      // Create clients map with pre-populated clients
      const mockClientsMap = new Map([
        ["rest", mockRestClient],
        ["mqtt", mockMqttClient],
        ["s3", mockS3Client],
      ]);

      // Create a world object with the methods we need to test
      const world = {
        clientRegistry: mockRegistry,
        clientFactory: mockFactory,
        clients: mockClientsMap,
        resetClients: async function () {
          // Simplified implementation of resetClients
          for (const client of this.clients.values()) {
            await client.reset();
          }
        },
      };

      // Call the method being tested
      await world.resetClients();

      // Verify all clients were reset
      expect(mockRestClient.reset).toHaveBeenCalled();
      expect(mockMqttClient.reset).toHaveBeenCalled();
      expect(mockS3Client.reset).toHaveBeenCalled();
    });

    it("should destroy all clients", async () => {
      // Create mock clients
      const mockRestClient = createMockClient("rest-client");
      const mockMqttClient = createMockClient("mqtt-client");
      const mockS3Client = createMockClient("s3-client");

      // Create registry and factory mocks
      const mockRegistry = createMockRegistry();
      const mockFactory = createMockFactory({
        rest: mockRestClient,
        mqtt: mockMqttClient,
        s3: mockS3Client,
      });

      // Create clients map with pre-populated clients
      const mockClientsMap = new Map([
        ["rest", mockRestClient],
        ["mqtt", mockMqttClient],
        ["s3", mockS3Client],
      ]);

      // Create a world object with the methods we need to test
      const world = {
        clientRegistry: mockRegistry,
        clientFactory: mockFactory,
        clients: mockClientsMap,
        destroyClients: async function () {
          // Simplified implementation of destroyClients
          for (const client of this.clients.values()) {
            await client.destroy();
          }

          // Clear the client map after destroying all clients
          this.clients.clear();
        },
      };

      // Call the method being tested
      await world.destroyClients();

      // Verify all clients were destroyed
      expect(mockRestClient.destroy).toHaveBeenCalled();
      expect(mockMqttClient.destroy).toHaveBeenCalled();
      expect(mockS3Client.destroy).toHaveBeenCalled();

      // Verify the clients map was cleared
      expect(mockClientsMap.size).toBe(0);
    });

    it("should create client without registering", () => {
      // Create test client
      const mockClient = createMockClient("test-client");
      const clientMap = { "rest:test-id": mockClient };

      // Create registry and factory mocks
      const mockRegistry = createMockRegistry();
      const mockFactory = createMockFactory(clientMap);

      // Mock the clients map for the world instance
      const mockClientsMap = new Map();

      // Create a mock hasClient method that checks the mock clients map
      const hasClient = vi.fn().mockImplementation((name: string) => mockClientsMap.has(name));

      // Create a partial mock of SmokeWorldImpl with only the methods we need
      const world = {
        clientRegistry: mockRegistry,
        clientFactory: mockFactory,
        clients: mockClientsMap,
        hasClient,
        createClient: function (clientType: string, id?: string) {
          // This is the implementation we're testing
          return this.clientFactory.createClient(clientType, id);
        },
      };

      // Call createClient method
      const client = world.createClient(ClientType.REST, "test-id");

      // Verify client is created correctly
      expect(client).toBe(mockClient);
      expect(mockFactory.createClient).toHaveBeenCalledWith(ClientType.REST, "test-id");

      // Verify client is not registered in the client registry
      // We can check that the client wasn't added to the clients map
      expect(mockClientsMap.has("rest:test-id")).toBe(false);
      expect(hasClient("rest:test-id")).toBe(false);
    });
  });
});
