import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { KinesisClient } from "@aws-sdk/client-kinesis";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SSMClient } from "@aws-sdk/client-ssm";
import type { IWorldOptions } from "@cucumber/cucumber";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the setWorldConstructor to prevent errors when importing world module
vi.mock("@cucumber/cucumber", async (importOriginal) => {
  const cucumber = await importOriginal<typeof import("@cucumber/cucumber")>();
  return {
    ...cucumber,
    setWorldConstructor: vi.fn(),
  };
});

// Import the SmokeWorld type and implementation
// Import types first to prevent issues with mocks
import {
  ClientType,
  type ClientRegistry,
  type MqttServiceClient,
  type RestServiceClient,
  type S3ServiceClient,
  type ServiceClient,
} from "../../src/clients";
import { SmokeWorldImpl, type SmokeWorld } from "../../src/world";

describe("SmokeWorld", () => {
  let smokeWorld: SmokeWorld;
  let smokeWorldImpl: SmokeWorldImpl;
  const worldOptions: IWorldOptions = {
    parameters: {},
    attach: vi.fn(),
    log: vi.fn(),
    link: vi.fn(),
  };

  // Mock AWS clients
  const mockCloudWatchClient = mockClient(CloudWatchLogsClient);
  const mockS3Client = mockClient(S3Client);
  const mockSQSClient = mockClient(SQSClient);
  const mockSSMClient = mockClient(SSMClient);
  const mockKinesisClient = mockClient(KinesisClient);

  // const mockRegisterConfigs = vi.fn();

  // Mock client registry and factory
  vi.mock("../../src/clients/registry", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../src/clients")>();
    return {
      ...original,
      ClientRegistry: vi.fn().mockReturnValue({
        registerConfigs: vi.fn(), //mockRegisterConfigs,
        registerConfigArray: vi.fn(),
        registerConfig: vi.fn(),
        getConfig: vi.fn(),
        getAllConfigs: vi.fn().mockReturnValue(new Map()),
      }),
      ClientFactory: vi.fn().mockImplementation(() => ({
        createClient: vi.fn().mockReturnValue({
          init: vi.fn().mockResolvedValue(undefined),
          reset: vi.fn().mockResolvedValue(undefined),
          destroy: vi.fn().mockResolvedValue(undefined),
        }),
      })),
    };
  });

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    mockCloudWatchClient.reset();
    mockS3Client.reset();
    mockSQSClient.reset();
    mockSSMClient.reset();
    mockKinesisClient.reset();

    // Create a new instance for each test without config
    smokeWorldImpl = new SmokeWorldImpl(worldOptions);
    smokeWorld = smokeWorldImpl;
  });

  describe("Constructor", () => {
    it("should initialize without config", () => {
      // Create a fresh instance with mocked registry and factory
      const mockRegistry = {
        registerConfigs: vi.fn(),
        registerConfigArray: vi.fn(),
        registerConfig: vi.fn(),
        getConfig: vi.fn(),
        getAllConfigs: vi.fn().mockReturnValue(new Map()),
      };

      const mockFactory = {
        createClient: vi.fn().mockReturnValue({
          init: vi.fn().mockResolvedValue(undefined),
          reset: vi.fn().mockResolvedValue(undefined),
          destroy: vi.fn().mockResolvedValue(undefined),
          isInitialized: vi.fn().mockReturnValue(true),
          getName: vi.fn().mockReturnValue("test-client"),
          cleanupClient: vi.fn(),
        }),
      };

      // Mock the constructor implementations
      vi.spyOn(
        smokeWorldImpl as unknown as { clientRegistry: unknown },
        "clientRegistry",
        "get",
      ).mockReturnValue(mockRegistry);
      vi.spyOn(
        smokeWorldImpl as unknown as { clientFactory: unknown },
        "clientFactory",
        "get",
      ).mockReturnValue(mockFactory);

      // Verify registry and factory are correctly initialized
      const clientRegistry = smokeWorldImpl.getClientRegistry();
      const clientFactory = smokeWorldImpl.getClientFactory();

      expect(clientRegistry).toBeDefined();
      expect(clientFactory).toBeDefined();
      expect(clientRegistry).toBe(mockRegistry);
      expect(clientFactory).toBe(mockFactory);
      expect(clientRegistry.registerConfigs).not.toHaveBeenCalled();
    });

    it("should initialize with config and create default clients", () => {
      // Reset all mocks before this test
      vi.resetAllMocks();

      // Create a mock for ClientRegistry with a spy on registerConfigs
      const mockRegisterConfigs = vi.fn();
      const mockClientRegistry = {
        registerConfigs: mockRegisterConfigs,
        registerConfigArray: vi.fn(),
        registerConfig: vi.fn(),
        getConfig: vi.fn(),
        getAllConfigs: vi.fn().mockReturnValue(new Map()),
      };

      // Mock the getClientRegistry method to return our mock
      const getClientRegistrySpy = vi
        .spyOn(SmokeWorldImpl.prototype, "getClientRegistry")
        .mockReturnValue(mockClientRegistry as unknown as ClientRegistry);

      // Create a spy on the createAndRegisterDefaultClients method
      const createAndRegisterSpy = vi
        .spyOn(
          SmokeWorldImpl.prototype as unknown as { createAndRegisterDefaultClients(): void },
          "createAndRegisterDefaultClients",
        )
        .mockImplementation(function () {
          /* Empty implementation */
        });

      // Prepare the config object
      const config = {
        rest: { baseUrl: "http://example.com" },
        s3: { region: "us-east-1" },
      };

      // Create a new instance with config
      new SmokeWorldImpl(worldOptions, config);

      // Verify that createAndRegisterDefaultClients was called
      // This confirms the constructor behaves differently when config is provided
      expect(createAndRegisterSpy).toHaveBeenCalled();

      // Verify registerConfigs was called with the config
      // This verifies the behavior in src/world/world.ts:L163
      expect(mockRegisterConfigs).toHaveBeenCalledWith(config);

      // Clean up spies
      getClientRegistrySpy.mockRestore();
      createAndRegisterSpy.mockRestore();
    });
  });

  describe("Client Registration and Creation", () => {
    it("should register a client", () => {
      const mockClient = { init: vi.fn(), reset: vi.fn(), destroy: vi.fn() };
      smokeWorld.registerClient("test-client", mockClient as unknown as ServiceClient);

      expect(smokeWorld.hasClient("test-client")).toBe(true);
      expect(smokeWorld.getClient("test-client")).toBe(mockClient);
    });

    it("should create a client", () => {
      // Create a mock service client with all required methods
      const mockServiceClient = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("test-client"),
        cleanupClient: vi.fn(),
      };

      // Create a mock createClient function
      const mockCreateClient = vi.fn().mockReturnValue(mockServiceClient);

      // Mock the clientFactory getter
      const originalClientFactory = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientFactory: { createClient: unknown } },
          "clientFactory",
          "get",
        )
        .mockImplementation(() => ({
          createClient: mockCreateClient,
        }));

      // Call the method being tested
      const client = smokeWorld.createClient(ClientType.REST);

      // Verify the mock was called correctly
      expect(mockCreateClient).toHaveBeenCalledWith(ClientType.REST, undefined);
      expect(client).toBe(mockServiceClient);

      // Clean up the mock
      originalClientFactory.mockRestore();
    });

    it("should register a client with config", () => {
      // Create a mock service client with all required methods
      const mockServiceClient = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("test-client"),
        cleanupClient: vi.fn(),
      };

      // Create mock functions
      const mockCreateClient = vi.fn().mockReturnValue(mockServiceClient);
      const mockRegisterConfig = vi.fn();

      // Mock the clientFactory getter
      const originalClientFactory = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientFactory: { createClient: unknown } },
          "clientFactory",
          "get",
        )
        .mockImplementation(() => ({
          createClient: mockCreateClient,
        }));

      // Mock the clientRegistry getter
      const originalClientRegistry = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientRegistry: { registerConfig: unknown } },
          "clientRegistry",
          "get",
        )
        .mockImplementation(() => ({
          registerConfig: mockRegisterConfig,
          registerConfigs: vi.fn(),
          registerConfigArray: vi.fn(),
          getConfig: vi.fn(),
          getAllConfigs: vi.fn().mockReturnValue(new Map()),
        }));

      // Mock the hasClient and getClient methods
      const hasClientSpy = vi.spyOn(smokeWorld, "hasClient").mockReturnValue(true);
      const registerClientSpy = vi.spyOn(smokeWorld, "registerClient").mockImplementation(vi.fn());

      // Call the method being tested
      const config = { baseUrl: "http://example.com" };
      const client = smokeWorld.registerClientWithConfig(ClientType.REST, config, "custom");

      // Verify the mocks were called correctly
      expect(mockRegisterConfig).toHaveBeenCalledWith(ClientType.REST, config, "custom");
      expect(mockCreateClient).toHaveBeenCalledWith(ClientType.REST, "custom");
      expect(registerClientSpy).toHaveBeenCalledWith("rest:custom", mockServiceClient);
      expect(client).toBe(mockServiceClient);

      // Clean up the mocks
      originalClientFactory.mockRestore();
      originalClientRegistry.mockRestore();
      hasClientSpy.mockRestore();
      registerClientSpy.mockRestore();
    });

    it("should register multiple client configs", () => {
      // Create mock service clients with all required methods
      const mockServiceClient1 = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("service1"),
        cleanupClient: vi.fn(),
      };
      const mockServiceClient2 = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("service2"),
        cleanupClient: vi.fn(),
      };

      // Create mock functions
      const mockCreateClient = vi
        .fn()
        .mockReturnValueOnce(mockServiceClient1)
        .mockReturnValueOnce(mockServiceClient2);
      const mockRegisterConfigArray = vi.fn();

      // Mock the clientFactory getter
      const originalClientFactory = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientFactory: { createClient: unknown } },
          "clientFactory",
          "get",
        )
        .mockImplementation(() => ({
          createClient: mockCreateClient,
        }));

      // Mock the clientRegistry getter
      const originalClientRegistry = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientRegistry: { registerConfigArray: unknown } },
          "clientRegistry",
          "get",
        )
        .mockImplementation(() => ({
          registerConfigArray: mockRegisterConfigArray,
          registerConfigs: vi.fn(),
          registerConfig: vi.fn(),
          getConfig: vi.fn(),
          getAllConfigs: vi.fn().mockReturnValue(new Map()),
        }));

      // Mock the registerClient method
      const registerClientSpy = vi.spyOn(smokeWorld, "registerClient");

      // Call the method being tested
      const configs = [
        { baseUrl: "http://example1.com", id: "api1" },
        { baseUrl: "http://example2.com", id: "api2" },
      ];

      const clients = smokeWorld.registerClientConfigs(ClientType.REST, configs);

      // Verify the mocks were called correctly
      expect(mockRegisterConfigArray).toHaveBeenCalledWith(ClientType.REST, configs);
      expect(mockCreateClient).toHaveBeenCalledTimes(2);
      expect(mockCreateClient).toHaveBeenNthCalledWith(1, ClientType.REST, "api1");
      expect(mockCreateClient).toHaveBeenNthCalledWith(2, ClientType.REST, "api2");
      expect(clients).toHaveLength(2);
      expect(clients[0]).toBe(mockServiceClient1);
      expect(clients[1]).toBe(mockServiceClient2);

      // Clean up the mocks
      originalClientFactory.mockRestore();
      originalClientRegistry.mockRestore();
      registerClientSpy.mockRestore();
    });
  });

  describe("Client Access Methods", () => {
    it("should get client by name", () => {
      const mockClient = { init: vi.fn(), reset: vi.fn(), destroy: vi.fn() };
      smokeWorld.registerClient("test-client", mockClient as unknown as ServiceClient);

      expect(smokeWorld.getClient("test-client")).toBe(mockClient);
    });

    it("should throw error when getting non-existent client", () => {
      expect(() => smokeWorld.getClient("non-existent")).toThrow("Client not found: non-existent");
    });

    it("should check if client exists", () => {
      const mockClient = { init: vi.fn(), reset: vi.fn(), destroy: vi.fn() };
      smokeWorld.registerClient("test-client", mockClient as unknown as ServiceClient);

      expect(smokeWorld.hasClient("test-client")).toBe(true);
      expect(smokeWorld.hasClient("non-existent")).toBe(false);
    });

    it("should get typed clients with default IDs", () => {
      // Register mock clients with default names
      const mockRestClient = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("rest"),
        cleanupClient: vi.fn(),
      };
      const mockS3Client = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("s3"),
        cleanupClient: vi.fn(),
      };

      smokeWorld.registerClient("rest", mockRestClient as ServiceClient);
      smokeWorld.registerClient("s3", mockS3Client as ServiceClient);

      expect(smokeWorld.getRest()).toBe(mockRestClient);
      expect(smokeWorld.getS3()).toBe(mockS3Client);
    });

    it("should get typed clients with custom IDs", () => {
      // Register mock clients with custom IDs
      const mockMqttClient = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("mqtt:custom"),
        cleanupClient: vi.fn(),
      };
      const mockCloudWatchClient = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("cloudwatch:logs"),
        cleanupClient: vi.fn(),
      };

      smokeWorld.registerClient("mqtt:custom", mockMqttClient as ServiceClient);
      smokeWorld.registerClient("cloudwatch:logs", mockCloudWatchClient as ServiceClient);

      expect(smokeWorld.getMqtt("custom")).toBe(mockMqttClient);
      expect(smokeWorld.getCloudWatch("logs")).toBe(mockCloudWatchClient);
    });

    it("should throw error when getting non-existent typed client", () => {
      expect(() => smokeWorld.getSqs()).toThrow("Client not found: sqs");
      expect(() => smokeWorld.getKafka("custom")).toThrow("Client not found: kafka:custom");
    });
  });

  describe("Client Lifecycle Management", () => {
    it("should initialize clients without config", async () => {
      const mockClient1 = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client1"),
        cleanupClient: vi.fn(),
      };
      const mockClient2 = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client2"),
        cleanupClient: vi.fn(),
      };

      smokeWorld.registerClient("client1", mockClient1 as ServiceClient);
      smokeWorld.registerClient("client2", mockClient2 as ServiceClient);

      await smokeWorld.initializeClients();

      expect(mockClient1.init).toHaveBeenCalled();
      expect(mockClient2.init).toHaveBeenCalled();
    });

    it("should initialize clients with config", async () => {
      // Create mock functions
      const mockRegisterConfigs = vi.fn();
      const mockClientInit = vi.fn().mockResolvedValue(undefined);

      // Create a spy on the createAndRegisterDefaultClients method
      const createAndRegisterSpy = vi.spyOn(
        SmokeWorldImpl.prototype as unknown as { createAndRegisterDefaultClients(): void },
        "createAndRegisterDefaultClients",
      );

      // Mock the clientRegistry getter
      const originalClientRegistry = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientRegistry: { registerConfigs: unknown } },
          "clientRegistry",
          "get",
        )
        .mockImplementation(() => ({
          registerConfigs: mockRegisterConfigs,
          registerConfigArray: vi.fn(),
          registerConfig: vi.fn(),
          getConfig: vi.fn(),
          getAllConfigs: vi.fn().mockReturnValue(new Map()),
        }));

      // Create a mock client
      const mockClient = {
        init: mockClientInit,
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client"),
        cleanupClient: vi.fn(),
      };

      // Register the mock client
      smokeWorld.registerClient("client", mockClient as unknown as ServiceClient);

      // Call the method being tested
      const config = { rest: { baseUrl: "http://example.com" } };
      await smokeWorld.initializeClients(config);

      // Verify the mocks were called correctly
      expect(mockRegisterConfigs).toHaveBeenCalledWith(config);
      expect(createAndRegisterSpy).toHaveBeenCalled();
      expect(mockClientInit).toHaveBeenCalled();

      // Clean up the mocks
      originalClientRegistry.mockRestore();
      createAndRegisterSpy.mockRestore();
    });

    it("should reset clients", async () => {
      const mockClient1 = {
        init: vi.fn(),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client1"),
        cleanupClient: vi.fn(),
      };
      const mockClient2 = {
        init: vi.fn(),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client2"),
        cleanupClient: vi.fn(),
      };

      smokeWorld.registerClient("client1", mockClient1 as ServiceClient);
      smokeWorld.registerClient("client2", mockClient2 as ServiceClient);

      await smokeWorld.resetClients();

      expect(mockClient1.reset).toHaveBeenCalled();
      expect(mockClient2.reset).toHaveBeenCalled();
    });

    it("should destroy clients", async () => {
      const mockClient1 = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client1"),
        cleanupClient: vi.fn(),
      };
      const mockClient2 = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("client2"),
        cleanupClient: vi.fn(),
      };

      smokeWorld.registerClient("client1", mockClient1 as ServiceClient);
      smokeWorld.registerClient("client2", mockClient2 as ServiceClient);

      await smokeWorld.destroyClients();

      expect(mockClient1.destroy).toHaveBeenCalled();
      expect(mockClient2.destroy).toHaveBeenCalled();
      expect(smokeWorld.hasClient("client1")).toBe(false);
      expect(smokeWorld.hasClient("client2")).toBe(false);
    });
  });

  describe("createAndRegisterDefaultClients", () => {
    it("should create and register clients for all configurations", () => {
      // Setup mock configurations
      const mockConfigs = new Map([
        ["rest", { baseUrl: "http://example.com" }],
        ["s3:custom", { region: "us-east-1" }],
        ["mqtt:broker1", { url: "mqtt://broker.example.com" }],
      ]);

      // Create mock clients
      const mockRestClient = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("rest"),
        cleanupClient: vi.fn(),
      };
      const mockS3Client = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("s3:custom"),
        cleanupClient: vi.fn(),
      };
      const mockMqttClient = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("mqtt:broker1"),
        cleanupClient: vi.fn(),
      };

      // Create mock functions
      const mockGetAllConfigs = vi.fn().mockReturnValue(mockConfigs);
      const mockCreateClient = vi
        .fn()
        .mockReturnValueOnce(mockRestClient)
        .mockReturnValueOnce(mockS3Client)
        .mockReturnValueOnce(mockMqttClient);

      // Mock the clientRegistry getter
      const originalClientRegistry = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientRegistry: { getAllConfigs: unknown } },
          "clientRegistry",
          "get",
        )
        .mockImplementation(() => ({
          getAllConfigs: mockGetAllConfigs,
          registerConfigs: vi.fn(),
          registerConfigArray: vi.fn(),
          registerConfig: vi.fn(),
          getConfig: vi.fn(),
        }));

      // Mock the clientFactory getter
      const originalClientFactory = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientFactory: { createClient: unknown } },
          "clientFactory",
          "get",
        )
        .mockImplementation(() => ({
          createClient: mockCreateClient,
        }));

      // Mock hasClient, getClient, and registerClient methods
      const hasClientSpy = vi.spyOn(smokeWorld, "hasClient").mockReturnValue(false); // All clients don't exist yet
      const registerClientSpy = vi.spyOn(smokeWorld, "registerClient");

      // Mock the typed client getter methods
      const getRestSpy = vi
        .spyOn(smokeWorld, "getRest")
        .mockReturnValue(mockRestClient as unknown as RestServiceClient);
      const getS3Spy = vi
        .spyOn(smokeWorld, "getS3")
        .mockReturnValue(mockS3Client as unknown as S3ServiceClient);
      const getMqttSpy = vi
        .spyOn(smokeWorld, "getMqtt")
        .mockReturnValue(mockMqttClient as unknown as MqttServiceClient);

      // Call the private method
      (
        smokeWorldImpl as unknown as { createAndRegisterDefaultClients(): void }
      ).createAndRegisterDefaultClients();

      // Verify clients were created with correct types and IDs
      expect(mockCreateClient).toHaveBeenCalledTimes(3);
      expect(mockCreateClient).toHaveBeenNthCalledWith(1, "rest", undefined);
      expect(mockCreateClient).toHaveBeenNthCalledWith(2, "s3", "custom");
      expect(mockCreateClient).toHaveBeenNthCalledWith(3, "mqtt", "broker1");

      // Verify clients were registered with correct names
      expect(registerClientSpy).toHaveBeenCalledTimes(3);
      expect(registerClientSpy).toHaveBeenNthCalledWith(1, "rest", mockRestClient);
      expect(registerClientSpy).toHaveBeenNthCalledWith(2, "s3:custom", mockS3Client);
      expect(registerClientSpy).toHaveBeenNthCalledWith(3, "mqtt:broker1", mockMqttClient);

      // Clean up the mocks
      originalClientRegistry.mockRestore();
      originalClientFactory.mockRestore();
      hasClientSpy.mockRestore();
      registerClientSpy.mockRestore();
      getRestSpy.mockRestore();
      getS3Spy.mockRestore();
      getMqttSpy.mockRestore();
    });

    it("should skip existing clients", () => {
      // Setup mock configurations
      const mockConfigs = new Map([
        ["rest", { baseUrl: "http://example.com" }],
        ["s3:custom", { region: "us-east-1" }],
      ]);

      // Create mock clients
      const existingClient = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("rest"),
        cleanupClient: vi.fn(),
      };

      const mockS3Client = {
        init: vi.fn(),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("s3:custom"),
        cleanupClient: vi.fn(),
      };

      // Create mock functions
      const mockGetAllConfigs = vi.fn().mockReturnValue(mockConfigs);
      const mockCreateClient = vi.fn().mockReturnValue(mockS3Client);

      // Mock the clientRegistry getter
      const originalClientRegistry = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientRegistry: { getAllConfigs: unknown } },
          "clientRegistry",
          "get",
        )
        .mockImplementation(() => ({
          getAllConfigs: mockGetAllConfigs,
          registerConfigs: vi.fn(),
          registerConfigArray: vi.fn(),
          registerConfig: vi.fn(),
          getConfig: vi.fn(),
        }));

      // Mock the clientFactory getter
      const originalClientFactory = vi
        .spyOn(
          smokeWorldImpl as unknown as { clientFactory: { createClient: unknown } },
          "clientFactory",
          "get",
        )
        .mockImplementation(() => ({
          createClient: mockCreateClient,
        }));

      // Mock hasClient to return true for "rest" and false for others
      const hasClientSpy = vi
        .spyOn(smokeWorld, "hasClient")
        .mockImplementation((name: string) => name === "rest");

      // Mock registerClient
      const registerClientSpy = vi.spyOn(smokeWorld, "registerClient");

      // Mock the typed client getter methods
      const getRestSpy = vi
        .spyOn(smokeWorld, "getRest")
        .mockReturnValue(existingClient as unknown as RestServiceClient);
      const getS3Spy = vi
        .spyOn(smokeWorld, "getS3")
        .mockReturnValue(mockS3Client as unknown as S3ServiceClient);

      // Call the private method
      (
        smokeWorldImpl as unknown as { createAndRegisterDefaultClients(): void }
      ).createAndRegisterDefaultClients();

      // Verify only one client was created (s3:custom)
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      expect(mockCreateClient).toHaveBeenCalledWith("s3", "custom");

      // Verify the s3 client was registered but not the rest client (since it already exists)
      expect(registerClientSpy).toHaveBeenCalledTimes(1);
      expect(registerClientSpy).toHaveBeenCalledWith("s3:custom", mockS3Client);

      // Clean up the mocks
      originalClientRegistry.mockRestore();
      originalClientFactory.mockRestore();
      hasClientSpy.mockRestore();
      registerClientSpy.mockRestore();
      getRestSpy.mockRestore();
      getS3Spy.mockRestore();
    });

    it("should throw error when getting non-existent response", () => {
      expect(() => smokeWorld.getLastResponse()).toThrow("No response has been attached");
    });

    it("should attach and get content", () => {
      const testContent = "Test content string";
      smokeWorld.attachContent(testContent);
      expect(smokeWorld.getLastContent()).toBe(testContent);
    });

    it("should throw error when getting non-existent content", () => {
      expect(() => smokeWorld.getLastContent()).toThrow("No content has been attached");
    });

    it("should attach and get error", () => {
      const testError = new Error("Test error");
      smokeWorld.attachError(testError);
      expect(smokeWorld.getLastError()).toBe(testError);
    });

    it("should throw error when getting non-existent error", () => {
      expect(() => smokeWorld.getLastError()).toThrow("No error has been attached");
    });
  });

  describe("Content and Error Management", () => {
    it("should attach and get response", () => {
      const testResponse = { status: 200, body: "Test response" };
      smokeWorld.attachResponse(testResponse);
      expect(smokeWorld.getLastResponse()).toBe(testResponse);
    });

    it("should throw error when getting non-existent response", () => {
      expect(() => smokeWorld.getLastResponse()).toThrow("No response has been attached");
    });

    it("should attach and get content", () => {
      const testContent = "Test content";
      smokeWorld.attachContent(testContent);
      expect(smokeWorld.getLastContent()).toBe(testContent);
    });

    it("should throw error when getting non-existent content", () => {
      expect(() => smokeWorld.getLastContent()).toThrow("No content has been attached");
    });

    it("should attach and get error", () => {
      const testError = new Error("Test error");
      smokeWorld.attachError(testError);
      expect(smokeWorld.getLastError()).toBe(testError);
    });

    it("should throw error when getting non-existent error", () => {
      expect(() => smokeWorld.getLastError()).toThrow("No error has been attached");
    });
  });

  describe("Property Map", () => {
    it("should store and retrieve properties correctly", () => {
      // Set simple properties
      smokeWorld.setProperty("user.name", "John");
      smokeWorld.setProperty("user.age", 30);

      // Check properties exist
      expect(smokeWorld.hasProperty("user.name")).toBe(true);
      expect(smokeWorld.hasProperty("user.age")).toBe(true);

      // Get properties
      expect(smokeWorld.getProperty("user.name")).toBe("John");
      expect(smokeWorld.getProperty("user.age")).toBe(30);
    });

    it("should handle nested properties", () => {
      // Set nested properties
      smokeWorld.setProperty("user.address", {
        street: "123 Main St",
        city: "Anytown",
      });

      // Get nested properties using dot notation
      expect(smokeWorld.getProperty("user.address.street")).toBe("123 Main St");
      expect(smokeWorld.getProperty("user.address.city")).toBe("Anytown");

      // Get nested properties using array notation
      expect(smokeWorld.getProperty(["user", "address", "street"])).toBe("123 Main St");
    });

    it("should remove properties correctly", () => {
      // Set properties
      smokeWorld.setProperty("test.prop1", "value1");
      smokeWorld.setProperty("test.prop2", "value2");

      // Remove one property
      smokeWorld.removeProperty("test.prop1");

      // Check property was removed
      expect(smokeWorld.hasProperty("test.prop1")).toBe(false);
      expect(smokeWorld.hasProperty("test.prop2")).toBe(true);

      // Should throw when accessing removed property
      expect(() => smokeWorld.getProperty("test.prop1")).toThrow();
    });

    it("should get the entire property map", () => {
      // Set properties
      smokeWorld.setProperty("a", 1);
      smokeWorld.setProperty("b.c", 2);

      // Get the entire map
      const map = smokeWorld.getPropertyMap();

      // Check map structure
      expect(map).toEqual({
        a: 1,
        b: {
          c: 2,
        },
      });
    });
  });
});
