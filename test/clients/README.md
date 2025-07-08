# Client Testing Guide

This guide provides specific strategies and best practices for testing different types of service clients in the Smoker framework.

## Client Test Organization

Each client test should follow a consistent structure:

```typescript
describe("ClientName", () => {
  // Setup and teardown
  beforeEach(() => {
    /* Setup code */
  });
  afterEach(() => {
    /* Cleanup code */
  });

  describe("Basic functionality", () => {
    // Tests for client name, initialization, destruction
  });

  describe("Initialization with config", () => {
    // Tests for configuration options and validation
  });

  describe("Client operations", () => {
    // Tests for specific operations
    describe("operation1", () => {
      /* Operation-specific tests */
    });
    describe("operation2", () => {
      /* Operation-specific tests */
    });
  });

  describe("Error handling", () => {
    // Tests for error conditions and error propagation
  });

  describe("Edge cases", () => {
    // Tests for unusual inputs or boundary conditions
  });
});
```

## AWS SDK Client Testing

The Smoker framework uses `aws-sdk-client-mock` and `aws-sdk-client-mock-vitest` for AWS SDK client testing.

### Setup

```typescript
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// Create mock client
const s3Mock = mockClient(S3Client);

describe("S3Client", () => {
  let client: S3Client;

  beforeEach(() => {
    // Reset all mocks before each test
    s3Mock.reset();
    client = new S3Client();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
```

### Response Mocking

```typescript
// Mock success response
s3Mock.on(GetObjectCommand).resolves({
  Body: createMockStream("test content"),
});

// Mock error response
s3Mock.on(PutObjectCommand).rejects(new Error("Access denied"));
```

### Command Verification

```typescript
// Verify command was called with specific parameters
expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
  Bucket: "test-bucket",
  Key: "test-key",
  Body: "test content",
});

// Verify command call count
expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 1);
```

### AWS Stream Handling

AWS services often return streams that need special handling in tests:

```typescript
// Helper function for mock streams
function createMockStream(content: string) {
  return {
    on: (event: string, callback: Function) => {
      if (event === "data") callback(Buffer.from(content));
      if (event === "end") callback();
      return mockStream;
    },
    transformToByteArray: async () => new Uint8Array(Buffer.from(content)),
    transformToString: async () => content,
  };
}

// Helper for error streams
function createErrorStream(errorMessage: string) {
  return {
    on: (event: string, callback: Function) => {
      if (event === "error") callback(new Error(errorMessage));
      return mockStream;
    },
  };
}
```

### Testing Common AWS Client Types

#### CloudWatch

```typescript
import { CloudWatchLogsClient, PutLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
const cloudWatchMock = mockClient(CloudWatchLogsClient);

// Mock log events response
cloudWatchMock.on(PutLogEventsCommand).resolves({
  nextSequenceToken: "next-token",
});
```

#### S3

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
const s3Mock = mockClient(S3Client);

// Mock S3 object response
s3Mock.on(GetObjectCommand).resolves({
  Body: createMockStream("file content"),
});
```

#### SQS

```typescript
import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
const sqsMock = mockClient(SQSClient);

// Mock SQS message response
sqsMock.on(ReceiveMessageCommand).resolves({
  Messages: [
    {
      MessageId: "msg-1",
      Body: "message content",
      ReceiptHandle: "receipt-1",
    },
  ],
});
```

#### Kinesis

```typescript
import { KinesisClient, GetRecordsCommand } from "@aws-sdk/client-kinesis";
const kinesisMock = mockClient(KinesisClient);

// Mock Kinesis records response
kinesisMock.on(GetRecordsCommand).resolves({
  Records: [
    {
      Data: Buffer.from("record data"),
      PartitionKey: "partition-key",
      SequenceNumber: "seq-1",
    },
  ],
});
```

#### SSM

```typescript
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
const ssmMock = mockClient(SSMClient);

// Mock SSM parameter response
ssmMock.on(GetParameterCommand).resolves({
  Parameter: {
    Name: "/path/to/param",
    Type: "String",
    Value: "parameter-value",
  },
});
```

## Non-AWS Client Testing

For non-AWS clients like Kafka, MQTT, and REST, use `vi.mock()` to create manual mocks.

### Kafka Client Testing

```typescript
import { Kafka } from "kafkajs";

// Mock kafkajs
vi.mock("kafkajs", () => {
  // Mock producer and consumer implementations
  const mockProducerSend = vi.fn();
  const mockProducer = vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: mockProducerSend,
  }));

  // Return the mock implementation
  return {
    Kafka: vi.fn(() => ({
      producer: mockProducer,
      consumer: mockConsumer,
    })),
    logLevel: { ERROR: "ERROR" },
  };
});
```

### MQTT Client Testing

```typescript
import mqtt from "mqtt";

vi.mock("mqtt", () => {
  const mockPublish = vi.fn().mockImplementation((topic, message, options, callback) => {
    if (callback) callback(null);
  });

  return {
    connect: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation((event, callback) => {
        if (event === "connect") callback();
        return this;
      }),
      publish: mockPublish,
      subscribe: vi.fn(),
      end: vi.fn(),
    }),
    default: {
      connect: vi.fn(),
    },
  };
});
```

### REST Client Testing

```typescript
import axios from "axios";

vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn().mockResolvedValue({
        data: { result: "success" },
        status: 200,
      }),
      post: vi.fn().mockResolvedValue({
        data: { id: "new-resource" },
        status: 201,
      }),
    },
  };
});
```

## Common Testing Scenarios

### Testing Initialization

```typescript
it("should be initialized after init is called", async () => {
  await client.init({ config: "value" });
  expect(client.isInitialized()).toBe(true);
});

it("should throw an error if required config is missing", async () => {
  await expect(client.init({})).rejects.toThrow("Required config missing");
});
```

### Testing Timeouts

```typescript
it("should handle operation timeouts", async () => {
  // Setup fake timers
  vi.useFakeTimers();

  // Start operation that will timeout
  const promise = client.waitForResponse(5000);

  // Advance time past the timeout
  vi.advanceTimersByTime(5100);

  // Verify timeout behavior
  await expect(promise).rejects.toThrow("Operation timed out");

  // Restore real timers
  vi.useRealTimers();
});
```

### Testing Multiple Initializations

```typescript
it("should handle multiple initializations", async () => {
  // First init
  await client.init({ param: "value1" });

  // Operation with first config
  await client.operation();
  expect(mockImplementation).toHaveBeenCalledWith("value1");

  // Second init with different config
  await client.init({ param: "value2" });

  // Reset mocks to check second operation
  mockImplementation.mockClear();

  // Operation with second config
  await client.operation();
  expect(mockImplementation).toHaveBeenCalledWith("value2");
});
```

## Test Debugging Tips

1. Use `console.log()` to inspect values during test execution
2. Set breakpoints in your IDE for interactive debugging
3. Run individual test files with `npx vitest run path/to/test.ts`
4. Use `it.only()` to run just one test while debugging

For more general testing guidelines, see the [main testing guide](../README.md).
