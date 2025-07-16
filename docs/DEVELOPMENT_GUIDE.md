# Development Guide

[← Back to README](../README.md)

This guide provides best practices and guidelines for developers working on the Smoker framework or extending it for specific testing needs.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Standards](#documentation-standards)
- [Extending the Framework](#extending-the-framework)
- [Contributing Guidelines](#contributing-guidelines)

## Architecture Overview

### Core Components

The Smoker framework consists of these key components:

1. **Service Clients**: Wrapper classes for interacting with external services
2. **Configuration System**: Flexible configuration loading and management
3. **World Implementation**: Cucumber.js World pattern for state management
4. **Support Modules**: Utilities for AWS integration and other functions
5. **Library Code**: Reusable business logic and utilities

### Design Principles

The framework follows these design principles:

- **Separation of Concerns**: Each module has a clear, focused responsibility
- **Interface-Based Design**: Components interact through well-defined interfaces
- **Dependency Injection**: Dependencies are provided rather than created internally
- **Testability**: Code is designed to be easily testable with mocks
- **Configuration Over Code**: Behavior is controlled through configuration
- **Progressive Enhancement**: Core functionality works without optional features

### Component Interactions

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
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  External   │
                    │  Systems    │
                    └─────────────┘
```

## Coding Standards

### TypeScript Best Practices

- **Type Safety**: Use proper TypeScript types and avoid `any`
- **Interfaces**: Define clear interfaces for components
- **Generics**: Use generics for reusable type-safe code
- **Type Guards**: Use type guards for runtime type checking
- **Readonly**: Use readonly properties for immutability
- **Optional Properties**: Use optional properties instead of nullable types

```typescript
// Good
interface Config {
  readonly apiUrl: string;
  timeout?: number;
  credentials: {
    readonly username: string;
    readonly password: string;
  };
}

// Avoid
interface Config {
  apiUrl: string | null;
  timeout: number | undefined;
  credentials: any;
}
```

### Naming Conventions

- **Files**: Use kebab-case for filenames (`rest-client.ts`)
- **Classes**: Use PascalCase for class names (`RestClient`)
- **Interfaces**: Use PascalCase for interfaces (`ServiceClient`)
- **Functions**: Use camelCase for functions (`getConfig()`)
- **Variables**: Use camelCase for variables (`apiClient`)
- **Constants**: Use UPPER_SNAKE_CASE for constants (`DEFAULT_TIMEOUT`)
- **Private Properties**: Prefix with underscore (`_client`)

### Code Organization

- **Module Structure**: One class/interface per file when possible
- **Directory Organization**: Group related files in directories
- **Barrel Files**: Use index.ts files for clean exports
- **Dependency Direction**: Higher-level modules depend on lower-level ones

```typescript
// Barrel file (index.ts)
export { CloudWatchClient } from "./cloudwatch";
export { KinesisClient } from "./kinesis";
export { S3Client } from "./s3";
export { SQSClient } from "./sqs";
export { SsmClient } from "./ssm";
```

### Using Barrel Files

Barrel files simplify imports by providing a single entry point for a module:

```typescript
// Without barrel files
import { CloudWatchClient } from "../clients/aws/cloudwatch";
import { S3Client } from "../clients/aws/s3";
import { SQSClient } from "../clients/aws/sqs";

// With barrel files
import { CloudWatchClient, S3Client, SQSClient } from "../clients/aws";
```

### Multi-level Barrel Files

For larger modules, use multi-level barrel files to organize exports:

```typescript
// src/clients/index.ts
export * from "./aws";
export * from "./core";
export * from "./http";
export * from "./messaging";
export * from "./registry";
```

### Error Handling

- **Typed Errors**: Use specific error types for different error cases
- **Async/Await**: Use try/catch blocks with async/await
- **Error Context**: Include context information in error messages
- **Error Propagation**: Don't swallow errors without handling

```typescript
// Good error handling
try {
  await client.connect();
} catch (error) {
  if (error instanceof ConnectionError) {
    logger.error(`Failed to connect: ${error.message}`);
    throw new ServiceUnavailableError("Service connection failed", { cause: error });
  }
  throw error; // Re-throw unknown errors
}
```

## Testing Guidelines

### Test Organization

- **Mirror Source Structure**: Test directory structure should mirror source code
- **Naming Convention**: Use `.test.ts` suffix for test files
- **Test Groups**: Use descriptive `describe` blocks to group related tests
- **Test Cases**: Use descriptive `it` blocks for individual test cases

```typescript
// Good test organization
describe("RestClient", () => {
  describe("initialization", () => {
    it("should initialize with default config", () => {
      // Test code
    });

    it("should throw error with invalid config", () => {
      // Test code
    });
  });

  describe("operations", () => {
    it("should send GET request successfully", () => {
      // Test code
    });

    it("should handle GET request errors", () => {
      // Test code
    });
  });
});
```

### Mocking Strategies

#### AWS SDK Mocking

Use `aws-sdk-client-mock` for AWS services:

```typescript
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import "aws-sdk-client-mock-vitest";

const s3Mock = mockClient(S3Client);

beforeEach(() => {
  s3Mock.reset();
  s3Mock.on(GetObjectCommand).resolves({
    Body: createMockStream("test content"),
  });
});

it("should read from S3", async () => {
  const result = await s3Client.getObject("test-key");
  expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
    Bucket: "test-bucket",
    Key: "test-key",
  });
});
```

#### HTTP Client Mocking

Use `nock` or `vitest` mocking for HTTP clients:

```typescript
import nock from "nock";

beforeEach(() => {
  nock("https://api.example.com")
    .get("/users")
    .reply(200, [{ id: 1, name: "Test User" }]);
});

afterEach(() => {
  nock.cleanAll();
});

it("should fetch users", async () => {
  const users = await apiClient.getUsers();
  expect(users).toHaveLength(1);
  expect(users[0].name).toBe("Test User");
});
```

#### Custom Mocks

Create mock implementations of interfaces:

```typescript
// Create mock implementation
const mockServiceClient: ServiceClient = {
  getName: vi.fn().mockReturnValue("MockClient"),
  init: vi.fn().mockResolvedValue(undefined),
  isInitialized: vi.fn().mockReturnValue(true),
  reset: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
};

// Use in tests
it("should register client", () => {
  world.registerClient("test", mockServiceClient);
  expect(world.hasClient("test")).toBe(true);
});
```

### Test Patterns

#### Arrange-Act-Assert

Structure tests using the AAA pattern:

```typescript
it("should process data correctly", () => {
  // Arrange
  const input = { name: "Test", value: 42 };
  const processor = new DataProcessor();

  // Act
  const result = processor.process(input);

  // Assert
  expect(result.processed).toBe(true);
  expect(result.output).toBe(84);
});
```

#### Test Fixtures

Use fixtures for complex test data:

```typescript
// fixtures/test-data.ts
export const testConfig = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
  credentials: {
    username: "testuser",
    password: "password123",
  },
};

// In tests
import { testConfig } from "../fixtures/test-data";

it("should initialize with config", () => {
  const client = new ApiClient();
  client.init(testConfig);
  expect(client.isInitialized()).toBe(true);
});
```

## Documentation Standards

### Code Documentation

- **JSDoc Comments**: Use JSDoc for classes, interfaces, and functions
- **Parameter Documentation**: Document all parameters and return types
- **Examples**: Include usage examples for complex functions
- **Implementation Notes**: Document non-obvious implementation details

````typescript
/**
 * Retrieves an object from S3 and parses it as JSON.
 *
 * @param bucket - The S3 bucket name
 * @param key - The object key within the bucket
 * @returns The parsed JSON object
 * @throws {S3Error} If the object cannot be retrieved
 * @throws {ParseError} If the object is not valid JSON
 *
 * @example
 * ```typescript
 * const config = await getJsonFromS3('my-bucket', 'config.json');
 * ```
 */
async function getJsonFromS3<T>(bucket: string, key: string): Promise<T> {
  // Implementation
}
````

### README Files

- **Component READMEs**: Include README.md files in key directories
- **Structure**: Use consistent structure (Purpose, Usage, API, Examples)
- **Links**: Include links to related documentation
- **Code Blocks**: Use syntax highlighting for code examples

### Architecture Documentation

- **Component Diagrams**: Include visual diagrams for complex systems
- **Sequence Diagrams**: Document interaction sequences
- **Decision Records**: Document important architectural decisions

## Extending the Framework

### Adding a New Service Client

1. **Create Interface**: Define the client interface

   ```typescript
   export interface NewServiceClient extends ServiceClient {
     doSomething(param: string): Promise<Result>;
   }
   ```

2. **Implement Client**: Create the client implementation

   ```typescript
   export class NewServiceClientImpl extends BaseServiceClient implements NewServiceClient {
     constructor() {
       super("new-service");
     }

     protected async initializeClient(): Promise<void> {
       // Initialization logic
     }

     async doSomething(param: string): Promise<Result> {
       this.ensureInitialized();
       // Implementation
     }
   }
   ```

3. **Update Exports**: Add to barrel file

   ```typescript
   export { NewServiceClientImpl } from "./new-service-client";
   export type { NewServiceClient } from "./new-service-client";
   ```

4. **Add to World**: Register in the World class

   ```typescript
   // In SmokeWorld constructor
   this.newServiceClient = new NewServiceClientImpl();
   this.registerClient('new-service', this.newServiceClient);

   // Add getter
   getNewService(): NewServiceClient {
     return this.getClient<NewServiceClient>('new-service');
   }
   ```

5. **Add Tests**: Create comprehensive tests
   ```typescript
   describe("NewServiceClient", () => {
     // Test initialization, operations, error handling
   });
   ```

### Creating Custom Step Definitions

1. **Identify Patterns**: Look for common testing patterns
2. **Create Step File**: Create a new step definition file

   ```typescript
   // features/step_definitions/new-service-steps.ts
   import { Given, When, Then } from "@cucumber/cucumber";
   import type { SmokeWorld } from "../../src/world";

   Given("I have a new service client", function (this: SmokeWorld) {
     const client = this.getNewService();
     expect(client).toBeDefined();
   });
   ```

3. **Add Helper Functions**: Create library functions for complex operations

   ```typescript
   // src/lib/new-service-helpers.ts
   import type { NewServiceClient } from "../clients/new-service-client";

   export async function performComplexOperation(
     client: NewServiceClient,
     param: string,
   ): Promise<Result> {
     // Complex operation logic
   }
   ```

4. **Use in Steps**: Import and use helper functions

   ```typescript
   import { performComplexOperation } from "../../src/lib/new-service-helpers";

   When(
     "I perform a complex operation with {string}",
     async function (this: SmokeWorld, param: string) {
       const client = this.getNewService();
       const result = await performComplexOperation(client, param);
       this.setState("result", result);
     },
   );
   ```

## Contributing Guidelines

### Development Workflow

1. **Fork Repository**: Create your own fork of the repository
2. **Create Branch**: Create a feature branch for your changes
3. **Implement Changes**: Make your changes following the coding standards
4. **Write Tests**: Add tests for your changes
5. **Update Documentation**: Update relevant documentation
6. **Submit PR**: Create a pull request with a clear description

### Commit Message Format

Use conventional commit messages:

```
feat: add new service client for GraphQL
fix: resolve SSM parameter resolution issue
docs: update client documentation
test: add tests for error handling
refactor: simplify configuration loading
```

### Pull Request Process

1. **Description**: Clearly describe the changes and their purpose
2. **Issue Reference**: Link to related issues
3. **Tests**: Ensure all tests pass
4. **Code Quality**: Maintain or improve code quality
5. **Documentation**: Update relevant documentation
6. **Review**: Address review comments

### Code Review Guidelines

- **Readability**: Is the code easy to understand?
- **Maintainability**: Is the code easy to maintain?
- **Testability**: Is the code well-tested?
- **Performance**: Are there any performance concerns?
- **Security**: Are there any security issues?
- **Documentation**: Is the code well-documented?
