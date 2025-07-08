# Service Client Hierarchy for BDD Testing

This document describes the service client hierarchy for BDD smoke testing. The architecture provides a consistent, extensible approach to interacting with external services in BDD tests.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Client Interfaces](#client-interfaces)
3. [Base Implementation](#base-implementation)
4. [Service-Specific Clients](#service-specific-clients)
5. [BDD World Integration](#bdd-world-integration)
6. [Usage in Step Definitions](#usage-in-step-definitions)
7. [Extending the Framework](#extending-the-framework)

## Architecture Overview

The service client architecture follows these design principles:

- **Contract-first design**: All clients implement a common interface
- **Separation of concerns**: Base functionality shared across multiple clients
- **Extensibility**: Easy to add new service clients
- **Consistency**: Uniform approach to service interactions
- **Testability**: Simple to mock and test

The architecture consists of:

- Core interfaces defining the client contract
- Abstract base implementation with common functionality
- Concrete implementations for specific services
- Integration with the BDD world

## Service Client Hierarchy

This directory contains a hierarchical service client system for interacting with various services in a BDD test environment.

### Architecture Overview

The client hierarchy follows a consistent pattern:

1. **Common Interface** (`ServiceClient` in `clients.ts`): Defines the base contract all clients must implement
2. **Base Implementation** (`BaseServiceClient` in `clients.ts`): Provides shared functionality and utility methods
3. **Service-Specific Interfaces**: Define the contract for specific service types (e.g., `RestServiceClient`, `MqttServiceClient`)
4. **Service-Specific Implementations**: Concrete implementations that extend the base class

### Available Service Clients

- **REST Client** (`rest.ts`): HTTP/HTTPS API interactions using Axios
- **MQTT Client** (`mqtt.ts`): MQTT messaging with pub/sub capabilities
- **S3 Client** (`s3.ts`): AWS S3 object storage operations
- **CloudWatch Client** (`cloudwatch.ts`): AWS CloudWatch Logs interactions
- **SSM Client** (`ssm.ts`): AWS Systems Manager Parameter Store operations
- **SQS Client** (`sqs.ts`): AWS SQS queue messaging
- **Kinesis Client** (`kinesis.ts`): AWS Kinesis data streams
- **Kafka Client** (`kafka.ts`): Apache Kafka message broker interactions

### Code Organization Standards

#### File Naming

- **Lowercase filenames**: All implementation files use lowercase kebab-case (e.g., `rest.ts`, `cloud-watch.ts`)
- **No class-based naming**: Files are named after the service, not the class (e.g., `mqtt.ts` not `MqttClient.ts`)

#### Code Structure

Each client file follows a consistent structure:

1. File header with description
2. Imports (type-only imports are used for TypeScript types with `verbatimModuleSyntax` enabled)
3. Interface definitions for service-specific types
4. Service-specific interface extending `ServiceClient`
5. Implementation class extending `BaseServiceClient`

#### Method Patterns

All clients implement consistent method patterns:

- `init(config)`: Initialize with configuration
- `isInitialized()`: Check initialization status
- `destroy()`: Clean up resources
- Service-specific methods (read/write/send/receive)

## Client Interfaces

### ServiceClient Interface

The `ServiceClient` interface defines the contract that all service clients must implement:

```typescript
export interface ServiceClient {
  getName(): string;
  init(config?: Record<string, unknown>): Promise<void>;
  isInitialized(): boolean;
  reset(): Promise<void>;
  destroy(): Promise<void>;
}
```

Each service also defines its own interface extending this base contract with service-specific methods.

## Base Implementation

The `BaseServiceClient` abstract class provides common functionality for all clients:

```typescript
export abstract class BaseServiceClient implements ServiceClient {
  // Common implementation details
  protected name: string;
  protected initialized: boolean = false;
  protected config: Record<string, unknown> = {};

  constructor(name: string) {
    this.name = name;
  }

  // Implementation of common methods
  getName(): string {
    /* ... */
  }
  async init(config?: Record<string, unknown>): Promise<void> {
    /* ... */
  }
  isInitialized(): boolean {
    /* ... */
  }
  async reset(): Promise<void> {
    /* ... */
  }
  async destroy(): Promise<void> {
    /* ... */
  }

  // Abstract methods for client-specific behavior
  protected abstract initializeClient(): Promise<void>;

  // Helper methods
  protected getConfig<T>(key: string, defaultValue?: T): T {
    /* ... */
  }
  protected ensureInitialized(): void {
    /* ... */
  }
}
```

## Service-Specific Clients

The framework includes the following service clients:

### REST Client

For HTTP RESTful API interactions:

```typescript
export interface RestServiceClient {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}
```

### S3 Client

For AWS S3 storage operations:

```typescript
export interface S3ServiceClient {
  read(key: string): Promise<string>;
  readJson<T>(key: string): Promise<T>;
  write(key: string, content: string): Promise<void>;
  writeJson(key: string, data: any): Promise<void>;
  delete(key: string): Promise<void>;
}
```

### SSM Client

For AWS Parameter Store operations:

```typescript
export interface SsmServiceClient {
  read(name: string, withDecryption?: boolean): Promise<string>;
  write(name: string, value: string, type?: string, overwrite?: boolean): Promise<void>;
  delete(name: string): Promise<void>;
}
```

### Additional Clients

- **MQTT Client**: For message queue interactions
- **CloudWatch Client**: For monitoring log streams
- **SQS Client**: For AWS SQS queue operations
- **Kinesis Client**: For AWS Kinesis stream processing
- **Kafka Client**: For Kafka stream processing

## BDD World Integration

The service clients are integrated with the BDD framework through the `SmokeWorld` class:

```typescript
export interface SmokeWorldInterface extends World {
  // Client registration and access methods
  registerClient(name: string, client: ServiceClient): void;
  getClient<T extends ServiceClient>(name: string): T;
  hasClient(name: string): boolean;

  // Predefined client access methods
  getRest(): RestServiceClient;
  getMqtt(): MqttServiceClient;
  getS3(): S3ServiceClient;
  getCloudWatch(): CloudWatchServiceClient;
  getSsm(): SsmServiceClient;
  getSqs(): SqsServiceClient;
  getKinesis(): KinesisServiceClient;
  getKafka(): KafkaServiceClient;

  // Client initialization and cleanup
  initializeClients(config?: Record<string, Record<string, unknown>>): Promise<void>;
  destroyClients(): Promise<void>;
}
```

## Usage in Step Definitions

Using service clients in BDD step definitions:

```typescript
// Initialize all clients in a Before hook
Before(async function (this: SmokeWorld) {
  await this.initializeClients();
});

// Clean up in an After hook
After(async function (this: SmokeWorld) {
  await this.destroyClients();
});

// Use REST client
When("I send a GET request to {string}", async function (this: SmokeWorld, path: string) {
  const response = await this.getRest().get(path);
  this.attachResponse(response);
});

// Use S3 client
When(
  "I store {string} at key {string} in S3",
  async function (this: SmokeWorld, content: string, key: string) {
    await this.getS3().write(key, content);
  },
);
```

## Extending the Framework

### Adding a New Service Client

To add a new service client:

1. Create a new file in `src/clients/` (e.g., `new-service.ts`)
2. Define the service interface:

```typescript
export interface NewServiceClient {
  // Service-specific methods
  doSomething(): Promise<void>;
}
```

3. Implement the client:

```typescript
export class NewServiceClient extends BaseServiceClient implements NewServiceClient {
  constructor() {
    super("NewServiceClient");
  }

  protected async initializeClient(): Promise<void> {
    // Service-specific initialization
  }

  async doSomething(): Promise<void> {
    this.ensureInitialized();
    // Implementation
  }
}
```

4. Update the exports in `src/clients/index.ts`:

```typescript
export { NewServiceClient } from "./new-service";
export type { NewServiceClient } from "./new-service";
```

5. Register the client in `SmokeWorld`:

```typescript
// In the constructor:
this.newServiceClient = new NewServiceClient();
this.registerClient('new-service', this.newServiceClient);

// Add a getter method:
getNewService(): NewServiceClient {
  return this.newServiceClient;
}
```

### Contributing to the Framework

When adding or modifying service clients, follow these guidelines:

1. **Maintain the contract**: All clients must implement the `ServiceClient` interface
2. **Follow TypeScript best practices**: Use proper typing, avoid `any` types
3. **Add comprehensive tests**: Test client functionality thoroughly
4. **Document your changes**: Update this document with new clients or significant changes

## Testing Best Practices

### AWS SDK Testing Strategy

For testing AWS SDK clients (S3, CloudWatch, SSM, SQS, Kinesis), follow these best practices:

#### Use aws-sdk-client-mock

Use the `aws-sdk-client-mock` library for consistent, reliable mocking of AWS SDK clients:

```typescript
import { mockClient } from "aws-sdk-client-mock";
import { S3Client as AwsS3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import "aws-sdk-client-mock-vitest"; // Adds toHaveReceivedCommand matchers

// Create the mock client
const s3Mock = mockClient(AwsS3Client);

describe("S3Client", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    s3Mock.reset();
  });

  // Your tests here...
});
```

#### Use Command Matchers

Use the specialized matchers from `aws-sdk-client-mock-vitest` for better assertions:

```typescript
// Mock the response
s3Mock.on(GetObjectCommand).resolves({
  Body: createMockStream("test content"),
});

// Call the client method
const result = await client.read("test-key.txt");

// Assert using the specialized matcher
expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
  Bucket: "test-bucket",
  Key: "test-key.txt",
});
```

#### Handle Stream Data Properly

When mocking AWS responses with stream data (like S3 GetObject), create proper mock implementations:

```typescript
// Helper function for stream data
function createMockStream(content?: string) {
  return {
    on: (event, callback) => {
      if (event === "data" && content) {
        callback(Buffer.from(content));
      }
      if (event === "end") {
        callback();
      }
      return mockStream;
    },
    transformToString: async () => content || "",
    // Other required properties...
  } as any; // Type assertion for simplicity
}
```

#### Set Up and Clear Mocks Properly

Properly set up and clear mocks in the test lifecycle:

```typescript
describe("AWS Service Tests", () => {
  beforeEach(() => {
    // Reset mock before each test
    awsServiceMock.reset();

    // Use fake timers for consistent test behavior
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers after each test
    vi.useRealTimers();
  });
});
```

### Non-AWS SDK Testing Strategy

For non-AWS services (MQTT, Kafka, REST), use standard Vitest mocking capabilities:

```typescript
// Mock external modules
vi.mock("mqtt", () => ({
  default: {
    connect: vi.fn(() => mockMqttClient),
  },
}));

// Create mock functions and objects
const mockPublish = vi.fn();
const mockMqttClient = {
  on: vi.fn(),
  publish: mockPublish,
};

describe("MqttClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
});
```

### General Testing Best Practices

1. **Use FakeTimers**: Use `vi.useFakeTimers()` for predictable time-based tests
2. **Reset Mocks**: Always reset mocks between tests
3. **Test Edge Cases**: Include tests for error conditions and edge cases
4. **Isolated Tests**: Tests should be independent and not rely on each other
5. **Clear Assertions**: Each test should have clear, specific assertions
