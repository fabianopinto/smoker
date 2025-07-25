# Development Guide

[← Back to README](../README.md) | [Test Development Guide](TEST_DEVELOPMENT.md) | [Operations Guide](OPERATIONS_GUIDE.md) | [Service Client Guide](SERVICE_CLIENT_GUIDE.md)

This comprehensive guide provides information for developers working on the Smoker framework itself. It covers architecture, coding standards, testing practices, and contribution guidelines.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Extending the Framework](#extending-the-framework)
- [Contributing Guidelines](#contributing-guidelines)

## Architecture Overview

### Core Components

The Smoker framework consists of these key architectural components:

1. **Service Clients**: Wrapper classes for interacting with external services
2. **Configuration System**: Flexible configuration loading and management with external reference resolution
3. **World Implementation**: Cucumber.js World pattern for state management between test steps
4. **Support Modules**: Utilities for AWS integration, parameter resolution, and other functions
5. **Library Code**: Reusable business logic and utility functions

### Design Principles

The framework follows these fundamental design principles:

- **Separation of Concerns**: Each module has a clear, focused responsibility
- **Interface-Based Design**: Components interact through well-defined interfaces
- **Dependency Injection**: Dependencies are provided rather than created internally
- **Testability**: Code is designed to be easily testable with comprehensive mocking
- **Configuration Over Code**: Behavior is controlled through configuration rather than hardcoded values
- **Progressive Enhancement**: Core functionality works without optional features
- **Type Safety**: Full TypeScript support with comprehensive type definitions

### Components Interactions

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Feature   │     │    Step     │     │    World    │
│    Files    │────▶│ Definitions │────▶│   Object    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Library   │     │   Service   │     │Configuration│
│    Code     │◀───▶│   Clients   │◀───▶│   System    │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Client    │     │ Parameter   │
                    │  Registry   │     │  Resolver   │
                    └─────────────┘     └─────────────┘
```

**Component Responsibilities:**

- **Feature Files**: Define test scenarios in Gherkin syntax
- **Step Definitions**: Implement test steps with access to World object
- **World Object**: Manages test state, configuration, and service clients
- **Service Clients**: Provide typed interfaces to external services
- **Configuration System**: Loads and merges configuration from multiple sources
- **Parameter Resolver**: Resolves SSM and S3 references in configuration values
- **Client Registry**: Manages client instances and factory patterns
- **Library Code**: Provides reusable utilities and business logic

## Coding Standards

### TypeScript Best Practices

**Interface Definitions:**

```typescript
// Use comprehensive interface definitions
interface ServiceClientConfig {
  readonly timeout?: number;
  readonly retries?: number;
  readonly baseUrl?: string;
}

// Prefer readonly properties for configuration
interface ClientOptions {
  readonly config: ServiceClientConfig;
  readonly logger?: Logger;
}
```

**Generic Type Usage:**

```typescript
// Use generics for type safety
interface ServiceClient<TConfig extends ClientConfig = ClientConfig> {
  initialize(config: TConfig): Promise<void>;
  reset(): Promise<void>;
  destroy(): Promise<void>;
}

// Implement with specific types
class RestClient implements ServiceClient<RestClientConfig> {
  async initialize(config: RestClientConfig): Promise<void> {
    // Implementation
  }
}
```

**Error Handling:**

```typescript
// Use custom error types
class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ConfigurationError";
  }
}

// Implement comprehensive error handling
async function loadConfiguration(path: string): Promise<Configuration> {
  try {
    const content = await fs.readFile(path, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new ConfigurationError(`Failed to load configuration from ${path}`, path, error as Error);
  }
}
```

### Naming Conventions

**Files and Directories:**

- Use **kebab-case** for filenames: `rest-client.ts`, `config-factory.ts`
- Use **PascalCase** for class files: `RestClient.ts`, `ConfigFactory.ts`
- Use **camelCase** for utility files: `parameterResolver.ts`, `awsUtils.ts`

**Classes and Interfaces:**

```typescript
// Classes: PascalCase
class RestClient implements ServiceClient {}
class ConfigurationFactory {}

// Interfaces: PascalCase with descriptive names
interface ServiceClientConfig {}
interface LambdaEvent {}
interface SmokeWorldProperties {}

// Types: PascalCase
type ClientType = "rest" | "mqtt" | "s3" | "ssm";
type ConfigurationSource = "file" | "s3" | "environment";
```

**Methods and Properties:**

```typescript
// Methods: camelCase with descriptive verbs
async resolveParameter(reference: string): Promise<string>
async publishMetric(metric: CloudWatchMetric): Promise<void>
getServiceClient<T>(type: string, id?: string): T

// Properties: camelCase
private readonly configurationCache: Map<string, any>
public readonly clientRegistry: ClientRegistry
protected logger: Logger
```

### Code Organization

#### Barrel Files

Use barrel files (`index.ts`) to provide clean module exports:

```typescript
// src/clients/index.ts
export * from "./core";
export * from "./http";
export * from "./messaging";
export * from "./aws";
export * from "./registry";

// src/clients/aws/index.ts
export { S3Client } from "./s3-client";
export { SSMClient } from "./ssm-client";
export { SQSClient } from "./sqs-client";
export { CloudWatchClient } from "./cloudwatch-client";
export { KinesisClient } from "./kinesis-client";

// Usage with barrel files
import { RestClient, MqttClient, S3Client } from "../clients";

// Instead of individual imports
import { RestClient } from "../clients/http/rest-client";
import { MqttClient } from "../clients/messaging/mqtt-client";
import { S3Client } from "../clients/aws/s3-client";
```

**Directory Structure:**

```
src/
├── clients/
│   ├── aws/
│   │   ├── index.ts              # Barrel file
│   │   ├── s3-client.ts
│   │   ├── ssm-client.ts
│   │   └── cloudwatch-client.ts
│   ├── core/
│   │   ├── index.ts              # Barrel file
│   │   ├── base-service-client.ts
│   │   └── service-client.ts
│   └── index.ts                  # Main barrel file
```

### Error Handling

**Comprehensive Error Types:**

```typescript
// Base error class
abstract class SmokerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific error types
class ClientError extends SmokerError {
  constructor(message: string, clientType: string, cause?: Error) {
    super(message, "CLIENT_ERROR", cause);
  }
}

class ConfigurationError extends SmokerError {
  constructor(message: string, path?: string, cause?: Error) {
    super(message, "CONFIGURATION_ERROR", cause);
  }
}
```

**Error Handling Patterns:**

```typescript
// Async/await with proper error handling
async function initializeClient(config: ClientConfig): Promise<ServiceClient> {
  try {
    const client = createClient(config.type);
    await client.initialize(config);
    return client;
  } catch (error) {
    throw new ClientError(
      `Failed to initialize ${config.type} client`,
      config.type,
      error as Error,
    );
  }
}

// Error propagation with context
async function resolveSSMParameter(name: string): Promise<string> {
  try {
    const parameter = await ssmClient.getParameter({ Name: name });
    return parameter.Parameter?.Value ?? "";
  } catch (error) {
    if (error.name === "ParameterNotFound") {
      throw new ConfigurationError(`SSM parameter not found: ${name}`);
    }
    throw new ConfigurationError(`Failed to resolve SSM parameter: ${name}`, name, error as Error);
  }
}
```

## Testing Guidelines

### Test Structure

Follow the established test file structure and style guidelines as documented in the [Test File Structure and Style Guidelines memory](../README.md#testing-guidelines).

**File Header:**

```typescript
/**
 * @fileoverview Unit tests for RestClient class
 *
 * Tests cover:
 * - Client initialization and configuration
 * - HTTP request methods (GET, POST, PUT, DELETE)
 * - Error handling and retry logic
 * - Response processing and validation
 * - Timeout and connection management
 *
 * @author Smoker Framework Team
 * @since 1.0.0
 */
```

**Test Organization:**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RestClient } from "../rest-client";
import type { RestClientConfig } from "../types";

const TEST_FIXTURES = {
  validConfig: {
    baseUrl: "https://api.example.com",
    timeout: 5000,
    retries: 3,
  },
  invalidConfig: {
    baseUrl: "",
    timeout: -1,
  },
  mockResponse: {
    status: 200,
    data: { id: 1, name: "Test User" },
  },
  errorMessage: "Network request failed",
} as const;

describe("RestClient", () => {
  let restClient: RestClient;

  beforeEach(() => {
    restClient = new RestClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("initialize", () => {
    it("should initialize with valid configuration", async () => {
      await expect(restClient.initialize(TEST_FIXTURES.validConfig)).resolves.not.toThrow();
    });

    it("should throw error with invalid configuration", async () => {
      await expect(restClient.initialize(TEST_FIXTURES.invalidConfig)).rejects.toThrow(
        "Invalid base URL",
      );
    });
  });
});
```

### Testing Framework

#### NPM Scripts for Testing

The framework provides comprehensive npm scripts for testing:

```json
{
  "scripts": {
    "build": "tsc && tsc-alias",
    "build:watch": "tsc --watch",
    "check": "tsc --noEmit",
    "lint": "eslint src test --ext .ts",
    "lint:fix": "eslint src test --ext .ts --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Usage Examples:**

```bash
# Build and check types
npm run build
npm run check

# Lint and fix code
npm run lint
npm run lint:fix

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Run specific test files
npx vitest run src/clients/rest-client.test.ts

# Run tests with specific pattern
npx vitest run --testNamePattern="RestClient"
```

#### Test Coverage Requirements

Maintain high test coverage with these guidelines:

- **Minimum 80% overall coverage**
- **90% coverage for core components**
- **100% coverage for utility functions**
- **All public methods must be tested**
- **Error paths must be tested**

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html
```

## Extending the Framework

### Adding New Service Clients

#### Managing Responses, Content, Errors

**Response Management:**

```typescript
// Define response interfaces
interface ServiceResponse<T = any> {
  readonly status: number;
  readonly data: T;
  readonly headers: Record<string, string>;
  readonly timestamp: Date;
}

// Implement response handling
class CustomClient extends BaseServiceClient<CustomClientConfig> {
  async makeRequest<T>(endpoint: string): Promise<ServiceResponse<T>> {
    try {
      const response = await this.httpClient.get(endpoint);
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
        timestamp: new Date(),
      };
    } catch (error) {
      throw this.handleError(error, endpoint);
    }
  }

  private handleError(error: any, context: string): Error {
    if (error.response) {
      return new ClientError(`Request failed: ${error.response.status}`, this.clientType, error);
    }
    return new ClientError(`Network error in ${context}`, this.clientType, error);
  }
}
```

**Content Processing:**

```typescript
// Content type handling
interface ContentProcessor<T> {
  process(content: string): T;
  validate(content: T): boolean;
}

class JsonContentProcessor implements ContentProcessor<object> {
  process(content: string): object {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON content: ${error.message}`);
    }
  }

  validate(content: object): boolean {
    return content !== null && typeof content === "object";
  }
}
```

#### Registering a New Service Client

**Client Registration:**

```typescript
// Define client configuration
interface CustomClientConfig extends ClientConfig {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly version: string;
}

// Implement the client
class CustomClient extends BaseServiceClient<CustomClientConfig> {
  protected clientType = "custom" as const;

  async initialize(config: CustomClientConfig): Promise<void> {
    await super.initialize(config);
    // Custom initialization logic
  }

  async customMethod(data: any): Promise<ServiceResponse> {
    // Implementation
  }
}

// Register with the factory
ClientFactory.registerClient("custom", CustomClient);
```

#### Adding New Service Client to the Registry

**Registry Integration:**

```typescript
// Update client registry
class ClientRegistry {
  private static readonly CLIENT_TYPES = {
    rest: "rest",
    mqtt: "mqtt",
    s3: "s3",
    ssm: "ssm",
    custom: "custom", // Add new client type
  } as const;

  registerClient<T extends ServiceClient>(type: string, id: string, client: T): void {
    const key = this.getClientKey(type, id);
    this.clients.set(key, client);
  }
}

// Update World interface
interface SmokeWorld extends World {
  getCustom(id?: string): CustomClient;
}

// Implement in World class
class SmokeWorldImpl implements SmokeWorld {
  getCustom(id?: string): CustomClient {
    return this.getServiceClient<CustomClient>("custom", id);
  }
}
```

### Creating Custom Step Definitions

#### Purpose, Context, Arguments

**Step Definition Structure:**

```typescript
// Import required modules
import { Given, Then, When } from "@cucumber/cucumber";
import type { SmokeWorld } from "../../src/world";

// Define step with clear purpose
Given(
  "I have a custom service configured with {string} and {string}",
  async function (this: SmokeWorld, apiKey: string, endpoint: string) {
    // Purpose: Configure custom service client
    // Context: Test setup phase
    // Arguments: apiKey (string), endpoint (string)

    const resolvedApiKey = await this.resolveStepParameter(apiKey);
    const resolvedEndpoint = await this.resolveStepParameter(endpoint);

    const customClient = this.getCustom();
    await customClient.initialize({
      apiKey: resolvedApiKey,
      endpoint: resolvedEndpoint,
      version: "v1",
    });
  },
);
```

#### Interactions with World

**Via Configuration:**

```typescript
When("I send a request to the configured endpoint", async function (this: SmokeWorld) {
  // Access configuration through World
  const endpoint = await this.getConfig("custom.endpoint");
  const timeout = await this.getConfig("custom.timeout", 5000);

  const customClient = this.getCustom();
  const response = await customClient.makeRequest(endpoint, { timeout });

  // Store response in World properties
  this.setProperty("lastResponse", response);
});
```

**Via Properties:**

```typescript
Then(
  "the custom service response should contain {string}",
  async function (this: SmokeWorld, expectedField: string) {
    // Access stored properties
    const response = this.getProperty("lastResponse");
    const resolvedField = await this.resolveStepParameter(expectedField);

    expect(response.data).toHaveProperty(resolvedField);
  },
);
```

## Contributing Guidelines

### Development Workflow

1. **Fork and Clone:**

   ```bash
   git clone https://github.com/your-username/smoker.git
   cd smoker
   npm install
   ```

2. **Create Feature Branch:**

   ```bash
   git checkout -b feature/new-client-support
   ```

3. **Development:**

   ```bash
   # Build and test continuously
   npm run build:watch &
   npm run test:watch &

   # Lint and format
   npm run lint:fix
   npm run format
   ```

4. **Testing:**

   ```bash
   # Run all tests
   npm test

   # Check coverage
   npm run test:coverage

   # Type checking
   npm run check
   ```

5. **Commit and Push:**
   ```bash
   git add .
   git commit -m "feat: add support for new custom client"
   git push origin feature/new-client-support
   ```

### Code Review Guidelines

**Pull Request Requirements:**

- [ ] All tests pass
- [ ] Code coverage maintained above 80%
- [ ] TypeScript compilation successful
- [ ] ESLint rules followed
- [ ] Documentation updated
- [ ] Examples provided for new features

**Review Checklist:**

- [ ] Code follows established patterns
- [ ] Error handling is comprehensive
- [ ] Tests cover happy path and edge cases
- [ ] Documentation is clear and complete
- [ ] Breaking changes are documented
- [ ] Performance implications considered

### Documentation Standards

**Code Documentation:**

```typescript
/**
 * Resolves external references in configuration values.
 *
 * Supports SSM parameters (ssm:/path/to/parameter) and S3 content
 * (s3://bucket/key or s3+json://bucket/key for JSON parsing).
 *
 * @param reference - The reference string to resolve
 * @param defaultValue - Optional default value if resolution fails
 * @returns Promise resolving to the resolved value
 *
 * @throws {ConfigurationError} When reference format is invalid
 * @throws {AWSError} When AWS service calls fail
 *
 * @example
 * // Resolve SSM parameter
 * const token = await resolveParameter('ssm:/app/api-token');
 *
 * // Resolve S3 content with default
 * const config = await resolveParameter('s3://bucket/config.json', '{}');
 */
async function resolveParameter(reference: string, defaultValue?: string): Promise<string> {
  // Implementation
}
```

**README Updates:**

- Update feature lists for new capabilities
- Add configuration examples
- Include usage examples
- Update troubleshooting section

### Release Process

1. **Version Bump:**

   ```bash
   npm version patch|minor|major
   ```

2. **Update Changelog:**
   - Document new features
   - List bug fixes
   - Note breaking changes

3. **Build and Test:**

   ```bash
   npm run build
   npm test
   npm run test:coverage
   ```

4. **Tag and Release:**
   ```bash
   git push origin main --tags
   ```

---

For more information on specific topics, see:

- [Test Development Guide](TEST_DEVELOPMENT.md) for creating smoke tests
- [Operations Guide](OPERATIONS_GUIDE.md) for deployment and configuration
- [Service Client Guide](SERVICE_CLIENT_GUIDE.md) for client documentation
