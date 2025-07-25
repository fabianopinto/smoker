# Service Client Guide

[← Back to README](../README.md) | [Test Development Guide](TEST_DEVELOPMENT.md) | [Operations Guide](OPERATIONS_GUIDE.md) | [Development Guide](DEVELOPMENT_GUIDE.md)

This comprehensive guide provides documentation for all service clients available in the Smoker framework, including their lifecycle management, APIs, configuration, registration, and extension capabilities.

## Table of Contents

- [Overview](#overview)
- [Client Lifecycle](#client-lifecycle)
- [Available Clients](#available-clients)
- [Default Clients](#default-clients)
- [Custom Clients via Configuration](#custom-clients-via-configuration)
- [Clients Programmatically](#clients-programmatically)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)

## Overview

The Smoker framework provides a comprehensive service client architecture that enables smoke tests to interact with various external systems. The client system is built around the `ServiceClient` interface, which defines a common contract for all client implementations.

### Key Features

- **Unified Interface**: All clients implement the same `ServiceClient` interface for consistency
- **Lifecycle Management**: Standardized initialization, reset, and cleanup operations
- **Type Safety**: Full TypeScript support with generic type parameters and compile-time validation
- **Configuration-Driven**: Flexible configuration system supporting multiple sources and external references
- **Extensible Architecture**: Easy to add new client types and implementations through well-defined patterns
- **Registry Pattern**: Centralized client registration and factory management with dependency injection

### Architecture Components

- **ServiceClient Interface**: Base contract for all client implementations
- **BaseServiceClient**: Abstract base class providing common functionality and utilities
- **ClientRegistry**: Manages client configurations and instances with lifecycle control
- **ClientFactory**: Creates client instances based on type and configuration
- **SmokeWorld Integration**: Provides typed access to all registered clients through the World object

## Client Lifecycle

All service clients follow a standardized lifecycle that ensures proper resource management and consistent behavior across different client types.

### Lifecycle States

1. **Created**: Client instance is created but not yet initialized
2. **Initialized**: Client is ready for use after successful initialization
3. **Reset**: Client state is cleared but remains initialized and ready for reuse
4. **Destroyed**: Client resources are cleaned up and client is no longer usable

### Lifecycle Methods

```typescript
interface ServiceClient<TConfig extends ClientConfig = ClientConfig> {
  // Initialize client with configuration
  initialize(config: TConfig): Promise<void>;

  // Reset client state while keeping it initialized
  reset(): Promise<void>;

  // Clean up resources and destroy client
  destroy(): Promise<void>;

  // Check if client is properly initialized
  isInitialized(): boolean;
}
```

**Lifecycle Example:**

```typescript
// Create client instance
const restClient = new RestClient();

// Initialize with configuration
await restClient.initialize({
  baseUrl: "https://api.example.com",
  timeout: 5000,
  headers: { "Content-Type": "application/json" },
});

// Use client for operations
const response = await restClient.get("/users");

// Reset state between tests
await restClient.reset();

// Clean up when done
await restClient.destroy();
```

## Available Clients

### HTTP Clients

#### REST Client

The REST client provides comprehensive HTTP API interaction capabilities with full support for all HTTP methods, authentication, and response handling.

**Configuration Interface:**

```typescript
interface RestClientConfig extends ClientConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  auth?: {
    type: "basic" | "bearer" | "api-key";
    credentials: string | { username: string; password: string };
  };
}
```

**Available Methods:**

```typescript
class RestClient extends BaseServiceClient<RestClientConfig> {
  // HTTP Methods
  async get<T>(path: string, options?: RequestOptions): Promise<ServiceResponse<T>>;
  async post<T>(path: string, data?: any, options?: RequestOptions): Promise<ServiceResponse<T>>;
  async put<T>(path: string, data?: any, options?: RequestOptions): Promise<ServiceResponse<T>>;
  async patch<T>(path: string, data?: any, options?: RequestOptions): Promise<ServiceResponse<T>>;
  async delete<T>(path: string, options?: RequestOptions): Promise<ServiceResponse<T>>;
  async head(path: string, options?: RequestOptions): Promise<ServiceResponse<void>>;
  async options(path: string, options?: RequestOptions): Promise<ServiceResponse<any>>;

  // Utility Methods
  setDefaultHeaders(headers: Record<string, string>): void;
  setAuthToken(token: string): void;
  getLastResponse(): ServiceResponse | null;
}
```

**Configuration Example:**

```json
{
  "rest": {
    "default": {
      "baseUrl": "https://api.example.com",
      "timeout": 10000,
      "retries": 3,
      "headers": {
        "Content-Type": "application/json",
        "User-Agent": "Smoker/1.0"
      },
      "auth": {
        "type": "bearer",
        "credentials": "ssm:/api/auth-token"
      }
    }
  }
}
```

### Messaging Clients

#### MQTT Client

The MQTT client enables publish/subscribe messaging for IoT and real-time communication scenarios.

**Configuration Interface:**

```typescript
interface MqttClientConfig extends ClientConfig {
  brokerUrl: string;
  clientId?: string;
  username?: string;
  password?: string;
  keepAlive?: number;
  connectTimeout?: number;
  reconnectPeriod?: number;
  qos?: 0 | 1 | 2;
}
```

**Available Methods:**

```typescript
class MqttClient extends BaseServiceClient<MqttClientConfig> {
  // Connection Management
  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  isConnected(): boolean;

  // Publishing
  async publish(topic: string, message: string | Buffer, options?: PublishOptions): Promise<void>;

  // Subscribing
  async subscribe(topic: string | string[], options?: SubscribeOptions): Promise<void>;
  async unsubscribe(topic: string | string[]): Promise<void>;

  // Message Handling
  onMessage(callback: (topic: string, message: Buffer) => void): void;
  getLastMessage(topic?: string): MqttMessage | null;
  waitForMessage(topic: string, timeout?: number): Promise<MqttMessage>;
}
```

#### Kafka Client

The Kafka client provides high-throughput message streaming capabilities for distributed systems.

**Configuration Interface:**

```typescript
interface KafkaClientConfig extends ClientConfig {
  brokers: string[];
  clientId?: string;
  groupId?: string;
  sasl?: {
    mechanism: "plain" | "scram-sha-256" | "scram-sha-512";
    username: string;
    password: string;
  };
  ssl?: boolean | object;
}
```

**Available Methods:**

```typescript
class KafkaClient extends BaseServiceClient<KafkaClientConfig> {
  // Producer Methods
  async produce(topic: string, messages: KafkaMessage[]): Promise<void>;
  async produceMessage(topic: string, key: string, value: string): Promise<void>;

  // Consumer Methods
  async subscribe(topics: string[]): Promise<void>;
  async consume(timeout?: number): Promise<KafkaMessage[]>;
  async commitOffsets(): Promise<void>;

  // Admin Methods
  async createTopics(topics: TopicConfig[]): Promise<void>;
  async deleteTopics(topics: string[]): Promise<void>;
  async listTopics(): Promise<string[]>;
}
```

### AWS Service Clients

#### S3 Client

The S3 client provides comprehensive Amazon S3 object storage operations.

**Configuration Interface:**

```typescript
interface S3ClientConfig extends ClientConfig {
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  endpoint?: string;
}
```

**Available Methods:**

```typescript
class S3Client extends BaseServiceClient<S3ClientConfig> {
  // Object Operations
  async getObject(key: string, bucket?: string): Promise<S3Object>;
  async putObject(key: string, content: string | Buffer, bucket?: string): Promise<void>;
  async deleteObject(key: string, bucket?: string): Promise<void>;
  async copyObject(sourceKey: string, destinationKey: string, bucket?: string): Promise<void>;
  async headObject(key: string, bucket?: string): Promise<S3ObjectMetadata>;

  // Bucket Operations
  async listObjects(prefix?: string, bucket?: string): Promise<S3Object[]>;
  async createBucket(bucket: string): Promise<void>;
  async deleteBucket(bucket: string): Promise<void>;
  async bucketExists(bucket: string): Promise<boolean>;

  // Utility Methods
  async generatePresignedUrl(
    key: string,
    operation: "get" | "put",
    expiresIn?: number,
  ): Promise<string>;
  getLastResponse(): S3Response | null;
}
```

#### SSM Client

The SSM client provides AWS Systems Manager Parameter Store operations for secure configuration management.

**Configuration Interface:**

```typescript
interface SSMClientConfig extends ClientConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}
```

**Available Methods:**

```typescript
class SSMClient extends BaseServiceClient<SSMClientConfig> {
  // Parameter Operations
  async getParameter(name: string, withDecryption?: boolean): Promise<SSMParameter>;
  async getParameters(names: string[], withDecryption?: boolean): Promise<SSMParameter[]>;
  async getParametersByPath(path: string, recursive?: boolean): Promise<SSMParameter[]>;
  async putParameter(name: string, value: string, type?: ParameterType): Promise<void>;
  async deleteParameter(name: string): Promise<void>;

  // Batch Operations
  async getParameterHistory(name: string): Promise<SSMParameterHistory[]>;
  async describeParameters(filters?: ParameterFilter[]): Promise<SSMParameterMetadata[]>;

  // Utility Methods
  async parameterExists(name: string): Promise<boolean>;
  getLastResponse(): SSMResponse | null;
}
```

#### SQS Client

The SQS client provides Amazon Simple Queue Service operations for reliable message queuing.

**Configuration Interface:**

```typescript
interface SQSClientConfig extends ClientConfig {
  region?: string;
  queueUrl?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}
```

**Available Methods:**

```typescript
class SQSClient extends BaseServiceClient<SQSClientConfig> {
  // Message Operations
  async sendMessage(messageBody: string, queueUrl?: string): Promise<SQSMessageResult>;
  async receiveMessages(maxMessages?: number, queueUrl?: string): Promise<SQSMessage[]>;
  async deleteMessage(receiptHandle: string, queueUrl?: string): Promise<void>;
  async changeMessageVisibility(receiptHandle: string, visibilityTimeout: number): Promise<void>;

  // Batch Operations
  async sendMessageBatch(messages: SQSBatchMessage[], queueUrl?: string): Promise<SQSBatchResult>;
  async deleteMessageBatch(receiptHandles: string[], queueUrl?: string): Promise<void>;

  // Queue Management
  async createQueue(queueName: string, attributes?: QueueAttributes): Promise<string>;
  async deleteQueue(queueUrl: string): Promise<void>;
  async getQueueAttributes(queueUrl?: string): Promise<QueueAttributes>;
  async purgeQueue(queueUrl?: string): Promise<void>;
}
```

#### CloudWatch Client

The CloudWatch client provides AWS CloudWatch metrics and logging operations for monitoring and observability.

**Configuration Interface:**

```typescript
interface CloudWatchClientConfig extends ClientConfig {
  region?: string;
  namespace?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}
```

**Available Methods:**

```typescript
class CloudWatchClient extends BaseServiceClient<CloudWatchClientConfig> {
  // Metrics Operations
  async publishMetric(metric: CloudWatchMetric): Promise<void>;
  async publishMetrics(metrics: CloudWatchMetric[]): Promise<void>;
  async getMetricStatistics(params: GetMetricStatisticsParams): Promise<MetricStatistics>;
  async listMetrics(namespace?: string): Promise<MetricInfo[]>;

  // Alarms Operations
  async createAlarm(alarm: AlarmConfig): Promise<void>;
  async deleteAlarm(alarmName: string): Promise<void>;
  async describeAlarms(alarmNames?: string[]): Promise<AlarmInfo[]>;
  async setAlarmState(alarmName: string, state: AlarmState, reason: string): Promise<void>;

  // Logs Operations
  async createLogGroup(logGroupName: string): Promise<void>;
  async deleteLogGroup(logGroupName: string): Promise<void>;
  async putLogEvents(
    logGroupName: string,
    logStreamName: string,
    events: LogEvent[],
  ): Promise<void>;
  async getLogEvents(logGroupName: string, logStreamName: string): Promise<LogEvent[]>;
}
```

#### Kinesis Client

The Kinesis client provides Amazon Kinesis data streaming operations for real-time data processing.

**Configuration Interface:**

```typescript
interface KinesisClientConfig extends ClientConfig {
  region?: string;
  streamName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}
```

**Available Methods:**

```typescript
class KinesisClient extends BaseServiceClient<KinesisClientConfig> {
  // Stream Operations
  async putRecord(
    data: string | Buffer,
    partitionKey: string,
    streamName?: string,
  ): Promise<PutRecordResult>;
  async putRecords(records: KinesisRecord[], streamName?: string): Promise<PutRecordsResult>;
  async getRecords(shardIterator: string): Promise<GetRecordsResult>;
  async getShardIterator(shardId: string, shardIteratorType: ShardIteratorType): Promise<string>;

  // Stream Management
  async createStream(streamName: string, shardCount: number): Promise<void>;
  async deleteStream(streamName: string): Promise<void>;
  async describeStream(streamName?: string): Promise<StreamDescription>;
  async listStreams(): Promise<string[]>;

  // Shard Operations
  async listShards(streamName?: string): Promise<ShardInfo[]>;
  async mergeShards(
    streamName: string,
    shardToMerge: string,
    adjacentShardToMerge: string,
  ): Promise<void>;
  async splitShard(
    streamName: string,
    shardToSplit: string,
    newStartingHashKey: string,
  ): Promise<void>;
}
```

## Default Clients

The framework automatically configures default clients based on the configuration provided. Default clients are accessible without specifying an ID and are created using the `default` configuration key.

### Default Client Configuration

```json
{
  "clients": {
    "rest": {
      "default": {
        "baseUrl": "https://api.example.com",
        "timeout": 10000
      }
    },
    "s3": {
      "default": {
        "region": "us-east-1",
        "bucket": "my-default-bucket"
      }
    },
    "ssm": {
      "default": {
        "region": "us-east-1"
      }
    }
  }
}
```

### Accessing Default Clients

```typescript
// In step definitions
When("I call the API", async function (this: SmokeWorld) {
  // Gets the default REST client
  const restClient = this.getRest();
  const response = await restClient.get("/users");
});

When("I store data in S3", async function (this: SmokeWorld) {
  // Gets the default S3 client
  const s3Client = this.getS3();
  await s3Client.putObject("test-key", "test-data");
});
```

## Custom Clients via Configuration

You can configure multiple instances of the same client type with different configurations using custom IDs.

### Multiple Client Configuration

```json
{
  "clients": {
    "rest": {
      "default": {
        "baseUrl": "https://api.example.com"
      },
      "auth-service": {
        "baseUrl": "https://auth.example.com",
        "timeout": 5000,
        "headers": {
          "Content-Type": "application/json"
        }
      },
      "payment-service": {
        "baseUrl": "https://payments.example.com",
        "timeout": 15000,
        "auth": {
          "type": "api-key",
          "credentials": "ssm:/payments/api-key"
        }
      }
    },
    "s3": {
      "default": {
        "region": "us-east-1",
        "bucket": "default-bucket"
      },
      "reports": {
        "region": "us-west-2",
        "bucket": "reports-bucket"
      }
    }
  }
}
```

### Accessing Custom Clients

```typescript
// Access clients by ID
When("I authenticate with the auth service", async function (this: SmokeWorld) {
  const authClient = this.getRest("auth-service");
  const response = await authClient.post("/login", { username, password });
});

When("I process payment", async function (this: SmokeWorld) {
  const paymentClient = this.getRest("payment-service");
  const response = await paymentClient.post("/charge", paymentData);
});

When("I upload report to S3", async function (this: SmokeWorld) {
  const reportsS3 = this.getS3("reports");
  await reportsS3.putObject("monthly-report.pdf", reportData);
});
```

## Clients Programmatically

### Creating Clients

You can create and configure clients programmatically for dynamic scenarios:

```typescript
// Create client instances programmatically
When("I create a custom REST client", async function (this: SmokeWorld) {
  const customConfig = {
    baseUrl: await this.resolveStepParameter("config:dynamicApi.baseUrl"),
    timeout: 8000,
    headers: {
      Authorization: `Bearer ${await this.resolveStepParameter("property:authToken")}`,
    },
  };

  const restClient = new RestClient();
  await restClient.initialize(customConfig);

  // Register the client for later use
  this.registerClient("rest", "custom-api", restClient);
});
```

### Getting Clients by Type or Name

```typescript
// Get clients by type and optional ID
When("I interact with various services", async function (this: SmokeWorld) {
  // Get default clients
  const defaultRest = this.getServiceClient<RestClient>("rest");
  const defaultS3 = this.getServiceClient<S3Client>("s3");

  // Get named clients
  const authService = this.getServiceClient<RestClient>("rest", "auth-service");
  const reportsS3 = this.getServiceClient<S3Client>("s3", "reports");

  // Use type-safe getters (preferred)
  const mqttClient = this.getMqtt();
  const ssmClient = this.getSSM("production");
});
```

### Registering Clients

```typescript
// Register clients for reuse across steps
Given("I have configured all necessary clients", async function (this: SmokeWorld) {
  // Create and register multiple clients
  const clients = [
    { type: "rest", id: "api-v1", config: apiV1Config },
    { type: "rest", id: "api-v2", config: apiV2Config },
    { type: "s3", id: "data-lake", config: dataLakeConfig },
  ];

  for (const { type, id, config } of clients) {
    const client = ClientFactory.createClient(type, config);
    await client.initialize(config);
    this.registerClient(type, id, client);
  }
});

// Access registered clients in subsequent steps
When("I migrate data from v1 to v2", async function (this: SmokeWorld) {
  const apiV1 = this.getRest("api-v1");
  const apiV2 = this.getRest("api-v2");
  const dataLake = this.getS3("data-lake");

  // Perform migration logic
  const data = await apiV1.get("/data");
  await dataLake.putObject("migration-backup.json", JSON.stringify(data));
  await apiV2.post("/data", data);
});
```

## Integration Examples

### Complete API Testing Workflow

```typescript
// Feature: Complete API workflow testing
Given("I have configured the API clients", async function (this: SmokeWorld) {
  // Configuration is loaded from external sources
  const apiConfig = {
    baseUrl: await this.resolveStepParameter("config:api.baseUrl"),
    authToken: await this.resolveStepParameter("ssm:/api/auth-token"),
    timeout: 10000,
  };

  const restClient = this.getRest();
  await restClient.initialize(apiConfig);
  restClient.setAuthToken(apiConfig.authToken);
});

When("I create a new user", async function (this: SmokeWorld) {
  const restClient = this.getRest();
  const userData = {
    name: await this.resolveStepParameter("config:testData.userName"),
    email: await this.resolveStepParameter("property:userEmail"),
  };

  const response = await restClient.post("/users", userData);
  this.setProperty("userId", response.data.id);
  this.setProperty("createUserResponse", response);
});

Then("the user should be created successfully", async function (this: SmokeWorld) {
  const response = this.getProperty("createUserResponse");
  expect(response.status).toBe(201);
  expect(response.data).toHaveProperty("id");
  expect(response.data.name).toBe(await this.resolveStepParameter("config:testData.userName"));
});
```

### Multi-Service Integration

```typescript
// Feature: Multi-service data flow
When("I process the complete data pipeline", async function (this: SmokeWorld) {
  const restClient = this.getRest();
  const s3Client = this.getS3();
  const sqsClient = this.getSQS();
  const cloudWatchClient = this.getCloudWatch();

  try {
    // Step 1: Fetch data from API
    const apiResponse = await restClient.get("/data/export");

    // Step 2: Store data in S3
    const s3Key = `exports/${Date.now()}-data.json`;
    await s3Client.putObject(s3Key, JSON.stringify(apiResponse.data));

    // Step 3: Send processing message to SQS
    await sqsClient.sendMessage(
      JSON.stringify({
        action: "process",
        s3Key: s3Key,
        timestamp: new Date().toISOString(),
      }),
    );

    // Step 4: Publish success metric
    await cloudWatchClient.publishMetric({
      MetricName: "DataPipelineSuccess",
      Value: 1,
      Unit: "Count",
      Dimensions: [{ Name: "Pipeline", Value: "DataExport" }],
    });

    // Store results for verification
    this.setProperty("pipelineS3Key", s3Key);
    this.setProperty("pipelineSuccess", true);
  } catch (error) {
    // Publish failure metric
    await cloudWatchClient.publishMetric({
      MetricName: "DataPipelineFailure",
      Value: 1,
      Unit: "Count",
    });
    throw error;
  }
});
```

### Dynamic Client Configuration

```typescript
// Feature: Environment-specific client configuration
Given(
  "I configure clients for {string} environment",
  async function (this: SmokeWorld, environment: string) {
    // Load environment-specific configuration
    const envConfig = await this.getConfig(`environments.${environment}`);

    // Configure REST client for the environment
    const restConfig = {
      baseUrl: envConfig.api.baseUrl,
      timeout: envConfig.api.timeout,
      headers: {
        Environment: environment,
        Authorization: `Bearer ${await this.resolveStepParameter(envConfig.api.authToken)}`,
      },
    };

    const restClient = this.getRest();
    await restClient.initialize(restConfig);

    // Configure AWS clients with environment-specific settings
    const awsConfig = {
      region: envConfig.aws.region,
      accessKeyId: await this.resolveStepParameter(envConfig.aws.accessKeyId),
      secretAccessKey: await this.resolveStepParameter(envConfig.aws.secretAccessKey),
    };

    const s3Client = this.getS3();
    await s3Client.initialize({ ...awsConfig, bucket: envConfig.s3.bucket });

    const ssmClient = this.getSSM();
    await ssmClient.initialize(awsConfig);

    this.setProperty("currentEnvironment", environment);
  },
);
```

## Best Practices

### Client Configuration

1. **Use External References**: Store sensitive data in SSM parameters or S3

   ```json
   {
     "api": {
       "authToken": "ssm:/production/api/auth-token",
       "privateKey": "s3://secrets-bucket/api-private-key.pem"
     }
   }
   ```

2. **Environment-Specific Configuration**: Organize configuration by environment

   ```json
   {
     "environments": {
       "development": {
         "api": { "baseUrl": "http://localhost:3000" }
       },
       "production": {
         "api": { "baseUrl": "https://api.production.com" }
       }
     }
   }
   ```

3. **Default Values**: Provide sensible defaults for optional configuration
   ```typescript
   const config = {
     timeout: clientConfig.timeout ?? 10000,
     retries: clientConfig.retries ?? 3,
     headers: { ...defaultHeaders, ...clientConfig.headers },
   };
   ```

### Error Handling

1. **Graceful Degradation**: Handle client failures gracefully

   ```typescript
   try {
     const response = await restClient.get("/health");
     this.setProperty("serviceHealthy", true);
   } catch (error) {
     this.setProperty("serviceHealthy", false);
     this.setProperty("healthCheckError", error.message);
   }
   ```

2. **Retry Logic**: Implement appropriate retry strategies

   ```typescript
   const maxRetries = 3;
   let attempt = 0;

   while (attempt < maxRetries) {
     try {
       const response = await restClient.get("/data");
       return response;
     } catch (error) {
       attempt++;
       if (attempt >= maxRetries) throw error;
       await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
     }
   }
   ```

### Performance Optimization

1. **Connection Reuse**: Reuse client connections when possible

   ```typescript
   // Initialize once, use multiple times
   beforeEach(async function (this: SmokeWorld) {
     if (!this.getRest().isInitialized()) {
       await this.getRest().initialize(restConfig);
     }
   });
   ```

2. **Parallel Operations**: Use parallel operations for independent tasks
   ```typescript
   const [userResponse, orderResponse, productResponse] = await Promise.all([
     restClient.get("/users/1"),
     restClient.get("/orders/1"),
     restClient.get("/products/1"),
   ]);
   ```

### Security

1. **Secure Credential Storage**: Never hardcode credentials

   ```typescript
   // Good: Use external references
   const authToken = await this.resolveStepParameter("ssm:/api/auth-token");

   // Bad: Hardcoded credentials
   const authToken = "hardcoded-token-123";
   ```

2. **Minimal Permissions**: Use least-privilege access for AWS clients
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject"],
         "Resource": "arn:aws:s3:::test-bucket/*"
       }
     ]
   }
   ```

### Testing

1. **Client Isolation**: Reset clients between tests

   ```typescript
   afterEach(async function (this: SmokeWorld) {
     await this.getRest().reset();
     await this.getS3().reset();
   });
   ```

2. **Mock External Dependencies**: Use mocks for unit testing
   ```typescript
   // In framework unit tests
   const mockRestClient = vi.mocked(restClient);
   mockRestClient.get.mockResolvedValue({ status: 200, data: mockData });
   ```

---

For more information on specific topics, see:

- [Test Development Guide](TEST_DEVELOPMENT.md) for using clients in tests
- [Operations Guide](OPERATIONS_GUIDE.md) for deployment and configuration
- [Development Guide](DEVELOPMENT_GUIDE.md) for extending the framework
