/**
 * Unit tests for ClientFactory
 * Tests the factory's ability to create and initialize different client types
 * Using a simplified approach to avoid complex mocking issues
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientType } from "../../../src/clients/core";
import type { ClientConfig } from "../../../src/clients/registry";

// Create simple mocks for all client modules
vi.mock("../../../src/clients/http/rest", () => ({
  RestClient: vi.fn(),
}));

vi.mock("../../../src/clients/messaging/mqtt", () => ({
  MqttClient: vi.fn(),
}));

vi.mock("../../../src/clients/aws/s3", () => ({
  S3Client: vi.fn(),
}));

vi.mock("../../../src/clients/aws/cloudwatch", () => ({
  CloudWatchClient: vi.fn(),
}));

vi.mock("../../../src/clients/aws/ssm", () => ({
  SsmClient: vi.fn(),
}));

vi.mock("../../../src/clients/aws/sqs", () => ({
  SqsClient: vi.fn(),
}));

vi.mock("../../../src/clients/aws/kinesis", () => ({
  KinesisClient: vi.fn(),
}));

vi.mock("../../../src/clients/messaging/kafka", () => ({
  KafkaClient: vi.fn(),
}));

// Import after mocking
import { RestClient } from "../../../src/clients";
import { ClientFactory, ClientRegistry, createClientFactory } from "../../../src/clients/registry";

// Temporarily skipping these tests due to termination issues (exit code 130)
// TODO: Fix the underlying issues causing test termination
describe("ClientFactory", () => {
  let registry: ClientRegistry;
  let factory: ClientFactory;
  const testConfig: ClientConfig = { host: "localhost", port: 8080 };

  // Setup for each test
  beforeEach(() => {
    vi.resetAllMocks();

    // Initialize registry with mock config
    registry = new ClientRegistry();
    vi.spyOn(registry, "getConfig").mockReturnValue(testConfig);

    // Create factory instance
    factory = new ClientFactory(registry);
  });

  describe("createClient", () => {
    it("should create a REST client", () => {
      const client = factory.createClient(ClientType.REST);
      expect(client).toBeDefined();
      expect(RestClient).toHaveBeenCalled();
    });

    it("should throw error for unknown client type", () => {
      expect(() => factory.createClient("unknown" as ClientType)).toThrow("Unknown client type");
    });
  });

  describe("createAndInitialize", () => {
    it("should initialize client after creation", async () => {
      // Create a mock client with an init method we can spy on
      const mockClient = {
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn(),
        destroy: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
        getName: vi.fn().mockReturnValue("test-client"),
        cleanupClient: vi.fn(),
      };

      // Use type assertion to bypass TypeScript errors
      // @ts-expect-error - Mocking RestClient return value
      vi.mocked(RestClient).mockReturnValue(mockClient);

      const client = await factory.createAndInitialize(ClientType.REST);

      expect(client).toBeDefined();
      expect(mockClient.init).toHaveBeenCalled();
    });
  });

  describe("createClientFactory", () => {
    it("should create a factory with the given registry", () => {
      const factory = createClientFactory(registry);
      expect(factory).toBeInstanceOf(ClientFactory);
    });
  });
});
