/**
 * Core tests for SmokeWorldImpl
 *
 * This file contains tests for the core functionality of SmokeWorldImpl,
 * including initialization, client management, and helper methods.
 */
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
import { ClientType, type ServiceClient } from "../../src/clients";
import { ClientRegistry } from "../../src/clients/registry";
import { type SmokeWorld, SmokeWorldImpl } from "../../src/world";

describe("SmokeWorld Core", () => {
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

  // Mock client registry and factory
  vi.mock("../../src/clients/registry", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../src/clients/registry")>();
    return {
      ...original,
      ClientRegistry: vi.fn().mockReturnValue({
        registerConfigs: vi.fn(),
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

      // Create a spy on the getClientRegistry method
      const getClientRegistrySpy = vi
        .spyOn(SmokeWorldImpl.prototype, "getClientRegistry")
        .mockReturnValue(mockClientRegistry as unknown as ClientRegistry);

      // Create a spy on the createAndRegisterDefaultClients method
      const createAndRegisterSpy = vi
        .spyOn(
          SmokeWorldImpl.prototype as unknown as { createAndRegisterDefaultClients: () => void },
          "createAndRegisterDefaultClients",
        )
        .mockImplementation(function () {
          /* Empty implementation */
        });

      // Prepare the config object
      const config = {
        rest: { baseUrl: "http://example.com" },
        mqtt: { host: "mqtt.example.com" },
      };

      // Create a new instance with config as the second parameter
      // This matches the new constructor signature after refactoring
      new SmokeWorldImpl(
        worldOptions,
        config, // Pass config as second parameter instead of in options.parameters
      );

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

      // Mock the clientFactory getter to return a factory that creates our mock client
      const mockCreateClient = vi.fn().mockReturnValue(mockServiceClient);
      const originalClientFactory = vi
        .spyOn(smokeWorldImpl as unknown as { clientFactory: unknown }, "clientFactory", "get")
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

      // Mock the clientFactory getter to return a factory that creates our mock client
      const mockCreateClient = vi.fn().mockReturnValue(mockServiceClient);
      const originalClientFactory = vi
        .spyOn(smokeWorldImpl as unknown as { clientFactory: unknown }, "clientFactory", "get")
        .mockImplementation(() => ({
          createClient: mockCreateClient,
        }));

      // Mock the clientRegistry getter to return a registry
      const mockRegisterConfig = vi.fn();
      const originalClientRegistry = vi
        .spyOn(smokeWorldImpl as unknown as { clientRegistry: unknown }, "clientRegistry", "get")
        .mockImplementation(() => ({
          registerConfig: mockRegisterConfig,
          getConfig: vi.fn(),
          getAllConfigs: vi.fn().mockReturnValue(new Map()),
        }));

      // Mock the hasClient and getClient methods
      const hasClientSpy = vi.spyOn(smokeWorld, "hasClient").mockReturnValue(true);
      const registerClientSpy = vi.spyOn(smokeWorld, "registerClient").mockImplementation(vi.fn());

      // Call the method being tested
      const config = { baseUrl: "http://example.com" };
      const client = smokeWorld.registerClientWithConfig(ClientType.REST, config);

      // Verify the mocks were called correctly
      expect(mockRegisterConfig).toHaveBeenCalledWith(ClientType.REST, config, undefined);
      // When id is undefined, it falls back to clientType as the second argument
      expect(mockCreateClient).toHaveBeenCalledWith(ClientType.REST, ClientType.REST);
      expect(client).toBe(mockServiceClient);

      // Clean up the mocks
      originalClientFactory.mockRestore();
      originalClientRegistry.mockRestore();
      hasClientSpy.mockRestore();
      registerClientSpy.mockRestore();
    });
  });

  describe("Client Type-Specific Retrieval Methods", () => {
    it("should retrieve REST client with getRest", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("rest"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };

      // Create a spy on registerClient before calling it
      const registerClientSpy = vi.spyOn(smokeWorld, "registerClient");
      smokeWorld.registerClient("rest", mockClient);

      // Verify the spy was called with the correct arguments
      expect(registerClientSpy).toHaveBeenCalledWith("rest", mockClient);

      // Call the method
      const result = smokeWorld.getRest();

      // Verify the result
      expect(result).toBe(mockClient);

      // Clean up the spy
      registerClientSpy.mockRestore();
    });

    it("should retrieve MQTT client with getMqtt", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("mqtt"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      smokeWorld.registerClient("mqtt", mockClient);

      // Call the method
      const result = smokeWorld.getMqtt();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve S3 client with getS3", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("s3"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      smokeWorld.registerClient("s3", mockClient);

      // Call the method
      const result = smokeWorld.getS3();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve CloudWatch client with getCloudWatch", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("cloudwatch"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      smokeWorld.registerClient("cloudwatch", mockClient);

      // Call the method
      const result = smokeWorld.getCloudWatch();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve SSM client with getSsm", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("ssm"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      smokeWorld.registerClient("ssm", mockClient);

      // Call the method
      const result = smokeWorld.getSsm();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve SQS client with getSqs", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("sqs"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      smokeWorld.registerClient("sqs", mockClient);

      // Call the method
      const result = smokeWorld.getSqs();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve Kinesis client with getKinesis", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("kinesis"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      smokeWorld.registerClient("kinesis", mockClient);

      // Call the method
      const result = smokeWorld.getKinesis();

      // Verify the result
      expect(result).toBe(mockClient);
    });

    it("should retrieve Kafka client with getKafka", () => {
      // Setup
      const mockClient: ServiceClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("kafka"),
        cleanupClient: vi.fn().mockResolvedValue(undefined),
      };
      smokeWorld.registerClient("kafka", mockClient);

      // Call the method
      const result = smokeWorld.getKafka();

      // Verify the result
      expect(result).toBe(mockClient);
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
});
