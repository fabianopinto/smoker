# Test Development Guide

[← Back to README](../README.md) | [Operations Guide](OPERATIONS_GUIDE.md) | [Development Guide](DEVELOPMENT_GUIDE.md) | [Service Client Guide](SERVICE_CLIENT_GUIDE.md)

This comprehensive guide explains how to create smoke test suites targeting specific systems using the Smoker framework and covers framework testing for contributors.

## Table of Contents

- [Important Distinction](#important-distinction)
- [BDD Testing Approach](#bdd-testing-approach)
- [Feature Files](#feature-files)
- [Step Definitions](#step-definitions)
- [Using the World Object](#using-the-world-object)
- [Client Management](#client-management)
- [Use of Cucumber Tags](#use-of-cucumber-tags)
- [Library Components](#library-components)
- [Logging and Error Handling](#logging-and-error-handling)
- [Best Practices](#best-practices)

## Testing Guidelines

This section standardizes how to write unit and integration tests for the framework itself. It complements the development guidance and ensures consistency across the codebase.

### Test File Structure and Style

- File Header
  - Include a comprehensive file-level JSDoc describing purpose, scope, and coverage areas.
  - Keep headers and inline comments accurate and up to date.
- Imports
  - Single grouped block, alphabetically sorted, no empty lines or comments between imports.
  - Prefer absolute imports and inline type imports.
- Structure
  - Nest describes: `describe("Class", () => { describe("method", () => { ... }) })`.
  - Test names: `should [expected behavior] when [condition]`.
  - Use `TEST_FIXTURES` constant at top of the main describe for test data; keep fixtures flat when possible, include error messages.
- Setup/Cleanup
  - Use `beforeEach` for fresh instances and to reset mocks; `afterEach` for cleanup.
- Implementation
  - Follow Arrange-Act-Assert without inline comments for sections.
  - Keep cases focused and small; cover happy paths, errors, and edge cases.
- Assertions
  - Prefer specific assertions (e.g., vitest’s extended matchers if available) and assert both positive and negative cases.
  - Verify error messages/types and side effects/state changes.
  - For promises: `await expect(promise).resolves/rejects...`.
- Mocks and Spies
  - Use `vi.spyOn()` and `vi.fn()`; clear and reset between tests.

### Mocking Standards

- AWS SDK v3 Clients
  - Use `aws-sdk-client-mock` (and `aws-sdk-client-mock-vitest` matchers) for clients like `S3Client`, `SSMClient`, etc.
  - Mock at command level (e.g., `GetObjectCommand`, `GetParameterCommand`).
  - Create mocks at module scope; reset in `beforeEach`.
- Import Path Consistency
  - Mock the exact path used by production code. If production uses barrel files, mock the barrel (e.g., `../aws`) not deep paths.
- Best Practices
  - Reset, not just clear, mocks in `beforeEach` when using client mocks.
  - Avoid duplicate mock implementations and brittle type casts.
  - Use realistic fixture values, not placeholder error functions.

### Running Tests

- Use Vitest in run mode to avoid watch mode by default:

  ```bash
  npx vitest run
  ```

- Prefer running individual tests to avoid timeouts and speed up feedback:

  ```bash
  # Single file
  npx vitest run test/clients/aws/aws-cloudwatch-metrics.test.ts

  # By name pattern
  npx vitest run --testNamePattern="RestClient"
  ```

These practices are mandatory for contributors to ensure consistency, reliability, and maintainability of the test suite.

## Important Distinction

**This guide covers TWO different types of testing:**

### 1. Testing the Framework (For Collaborators)

Unit and integration tests for the framework itself, ensuring the Smoker framework components work correctly. This is only relevant for contributors developing the framework.

### 2. Using the Framework to Smoke Test a Target System

Creating tests for external target systems using this framework. **Most users will focus on this type of testing.**

---

## BDD Testing Approach

Smoker uses Behavior-Driven Development (BDD) with Cucumber.js to create human-readable tests that serve as both documentation and executable specifications. The framework provides a complete testing ecosystem with four main components:

### 1. Feature Files (Gherkin Syntax)

Define test scenarios in natural language that stakeholders can understand.

### 2. Step Definitions (TypeScript Implementation)

Implement the actual test logic that executes when Gherkin steps are run.

### 3. World Object (State Management)

Manage test state, configuration, and service clients between steps.

### 4. Configuration System (External Integration)

Load test parameters from multiple sources with external reference resolution.

## Feature Files

### Structure

Feature files use Gherkin syntax to define test scenarios in a structured, readable format:

```gherkin
Feature: API User Management
  As a system administrator
  I want to verify user management functionality
  So that I can ensure the API is working correctly

  Background:
    Given I have a REST client configured for "config:api.baseUrl"
    And I set the authentication to "property:accessToken"

  @smoke @api
  Scenario: Create a new user
    When I send a POST request to "/users" with:
      """
      {
        "name": "config:testData.userName",
        "email": "property:userEmail",
        "role": "user"
      }
      """
    Then the response status should be 201
    And the response should contain property "id"
    And I set "property:userId" to the response "id"

  @api @integration
  Scenario: Retrieve user details
    Given I have created a user with ID "property:userId"
    When I send a GET request to "/users"
    Then the response status should be 200
    And the response property "name" should equal "config:testData.userName"
```

### Organization

**Directory Structure:**

```
features/
├── api/
│   ├── users.feature
│   ├── orders.feature
│   └── products.feature
├── messaging/
│   ├── mqtt-notifications.feature
│   └── kafka-events.feature
├── aws/
│   ├── s3-operations.feature
│   └── sqs-processing.feature
└── integration/
    ├── end-to-end-workflow.feature
    └── cross-service-communication.feature
```

**Feature Organization Guidelines:**

- Group related scenarios in the same feature file
- Use descriptive feature and scenario names
- Include Background sections for common setup
- Add tags for categorization and selective execution

### Values with References

#### Configuration Values

Reference configuration values using the `config:` prefix:

```gherkin
Feature: API Configuration Testing
  Scenario: Test with configuration values
    Given I have a REST client configured for "config:api.baseUrl"
    When I send a GET request to "config:api.endpoints.health"
    Then the response timeout should be "config:api.timeout"
```

**Configuration Structure:**

```json
{
  "api": {
    "baseUrl": "https://api.example.com",
    "timeout": 10000,
    "endpoints": {
      "health": "/health",
      "users": "/api/v1/users"
    }
  }
}
```

#### World Properties

Reference dynamic values stored in the World object using the `property:` prefix:

```gherkin
Feature: Dynamic Property Usage
  Scenario: User workflow with properties
    When I create a user with name "John Doe"
    And I set "property:userId" to the response "id"
    Then I should be able to retrieve user "property:userId"
    And the user name should be "property:userName"
```

## Step Definitions

### Structure

Step definitions implement the actual test logic using TypeScript and the SmokeWorld interface:

```typescript
import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert";
import type { SmokeWorld } from "../../src/world";

// Given steps - Setup and preconditions
Given(
  "I have a REST client configured for {string}",
  async function (this: SmokeWorld, baseUrl: string) {
    const resolvedUrl = await this.resolveStepParameter(baseUrl);
    const restClient = this.getRest();
    await restClient.initialize({
      baseUrl: resolvedUrl,
      timeout: 10000,
    });
  },
);

// When steps - Actions and operations
When(
  "I send a {string} request to {string}",
  async function (this: SmokeWorld, method: string, endpoint: string) {
    const resolvedEndpoint = await this.resolveStepParameter(endpoint);
    const restClient = this.getRest();

    let response;
    switch (method.toUpperCase()) {
      case "GET":
        response = await restClient.get(resolvedEndpoint);
        break;
      case "POST":
        response = await restClient.post(resolvedEndpoint);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    this.setProperty("lastResponse", response);
  },
);

// Then steps - Assertions and verification
Then(
  "the response status should be {int}",
  async function (this: SmokeWorld, expectedStatus: number) {
    const response = this.getProperty("lastResponse");
    expect(response.status).toBe(expectedStatus);
  },
);
```

### Organization

**Directory Structure:**

```
features/
├── step_definitions/
│   ├── api-steps.ts
│   ├── messaging-steps.ts
│   ├── aws-steps.ts
│   ├── common-steps.ts
│   └── assertion-steps.ts
└── **/*.feature
```

**Step Definition Guidelines:**

- Group related steps in the same file
- Use descriptive step patterns with clear parameters
- Implement proper error handling and validation
- Follow consistent naming conventions

### Interaction with Configuration and World Properties

#### Configuration Access

```typescript
When(
  "I configure the service with environment {string}",
  async function (this: SmokeWorld, environment: string) {
    // Access nested configuration values
    const apiConfig = await this.getConfig(`environments.${environment}.api`);
    const dbConfig = await this.getConfig(`environments.${environment}.database`);

    // Use configuration with external references
    const authToken = await this.getConfig("api.authToken"); // Resolves SSM/S3 references
    const timeout = await this.getConfig("api.timeout", 5000); // With default value
  },
);
```

#### World Properties Management

```typescript
When("I process user data", async function (this: SmokeWorld) {
  // Set properties for later use
  this.setProperty("processStartTime", Date.now());
  this.setProperty("batchId", generateBatchId());

  // Get previously set properties
  const userId = this.getProperty("userId");
  const userEmail = this.getProperty("userEmail");

  // Process data and store results
  const result = await processUserData(userId, userEmail);
  this.setProperty("processResult", result);
});
```

### Processing of Step Parameters to Resolve SSM/S3 References

The framework automatically resolves external references in step parameters:

```typescript
When(
  "I authenticate with token {string} and endpoint {string}",
  async function (this: SmokeWorld, token: string, endpoint: string) {
    // Automatically resolves external references
    const resolvedToken = await this.resolveStepParameter(token);
    const resolvedEndpoint = await this.resolveStepParameter(endpoint);

    // Examples of what gets resolved:
    // "ssm:/api/auth-token" -> actual token value from SSM
    // "s3://config-bucket/endpoint.txt" -> content from S3
    // "config:api.baseUrl" -> value from configuration
    // "property:authToken" -> value from World properties
    // "literal-value" -> unchanged literal string
  },
);
```

**Supported Reference Types:**

- `ssm:/path/to/parameter` - AWS SSM Parameter Store
- `s3://bucket/key` - Raw S3 object content
- JSON from S3 is parsed automatically when the object has `.json` extension or `Content-Type: application/json`; otherwise content is treated as raw text
- `config:path.to.value` - Configuration values
- `property:propertyName` - World properties
- Literal strings (no prefix) - Used as-is

## Using the World Object

The SmokeWorld object is the central hub for test state management, providing access to configuration, properties, and service clients.

### Core World Methods

```typescript
interface SmokeWorld extends World {
  // Configuration Management
  getConfig<T>(path: string, defaultValue?: T): Promise<T>;
  setConfiguration(config: object);

  // Property Management
  getProperty<T>(name: string): T;
  setProperty<T>(name: string, value: T);
  hasProperty(name: string): boolean;
  clearProperty(name: string);

  // Parameter Resolution
  resolveStepParameter(parameter: string): Promise<string>;

  // Client Access (see Service Client Guide for details)
  getRest(id?: string): RestClient;
  getMqtt(id?: string): MqttClient;
  getKafka(id?: string): KafkaClient;
  getS3(id?: string): S3Client;
  getSSM(id?: string): SSMClient;
  getSQS(id?: string): SQSClient;
  getCloudWatch(id?: string): CloudWatchClient;
  getKinesis(id?: string): KinesisClient;

  // Generic Client Access
  getServiceClient<T>(type: string, id?: string): T;
  registerClient<T>(type: string, id: string, client: T);
}
```

### World Usage Examples

```typescript
// Complex workflow using World object
When("I execute the complete user onboarding workflow", async function (this: SmokeWorld) {
  try {
    // Get configuration values
    const apiEndpoint = await this.getConfig("api.endpoints.users");
    const welcomeTemplate = await this.getConfig("email.templates.welcome");

    // Create user via API
    const restClient = this.getRest();
    const userResponse = await restClient.post(apiEndpoint, {
      name: await this.resolveStepParameter("config:testData.userName"),
      email: await this.resolveStepParameter("property:userEmail"),
    });

    // Store user data
    this.setProperty("userId", userResponse.data.id);
    this.setProperty("userCreatedAt", new Date().toISOString());

    // Send welcome email via messaging
    const mqttClient = this.getMqtt();
    await mqttClient.publish(
      "user/welcome",
      JSON.stringify({
        userId: userResponse.data.id,
        template: welcomeTemplate,
        timestamp: this.getProperty("userCreatedAt"),
      }),
    );

    // Log activity to S3
    const s3Client = this.getS3();
    const logEntry = {
      action: "user_onboarding",
      userId: userResponse.data.id,
      timestamp: this.getProperty("userCreatedAt"),
      success: true,
    };

    await s3Client.putObject(
      `logs/onboarding/${userResponse.data.id}.json`,
      JSON.stringify(logEntry),
    );

    // Publish metrics
    const cloudWatchClient = this.getCloudWatch();
    await cloudWatchClient.publishMetric({
      MetricName: "UserOnboardingSuccess",
      Value: 1,
      Unit: "Count",
      Dimensions: [{ Name: "Environment", Value: await this.getConfig("environment") }],
    });

    this.setProperty("onboardingComplete", true);
  } catch (error) {
    this.setProperty("onboardingError", error.message);
    throw error;
  }
});
```

## Client Management

### Getting Clients by Type or Name

The World object provides typed access to all service clients. See the [Service Client Guide](SERVICE_CLIENT_GUIDE.md) for comprehensive client documentation.

```typescript
// Type-safe client access
When("I interact with various services", async function (this: SmokeWorld) {
  // Default clients
  const restClient = this.getRest();
  const s3Client = this.getS3();
  const mqttClient = this.getMqtt();

  // Named clients
  const authService = this.getRest("auth-service");
  const dataLakeS3 = this.getS3("data-lake");
  const notificationMqtt = this.getMqtt("notifications");

  // Generic client access
  const customClient = this.getServiceClient<CustomClient>("custom", "my-service");
});
```

### Creating and Registering Clients

```typescript
Given(
  "I have configured custom clients for the test environment",
  async function (this: SmokeWorld) {
    // Create REST client for external API
    const externalApiClient = new RestClient();
    await externalApiClient.initialize({
      baseUrl: await this.resolveStepParameter("config:external.api.baseUrl"),
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${await this.resolveStepParameter("ssm:/external/api/token")}`,
      },
    });

    // Register for later use
    this.registerClient("rest", "external-api", externalApiClient);

    // Create S3 client for test data
    const testDataS3 = new S3Client();
    await testDataS3.initialize({
      region: "us-east-1",
      bucket: "test-data-bucket",
    });

    this.registerClient("s3", "test-data", testDataS3);
  },
);
```

### Response, Content, Error Management

```typescript
When("I handle API responses and errors", async function (this: SmokeWorld) {
  const restClient = this.getRest();

  try {
    // Make API request
    const response = await restClient.get("/users/1");

    // Store response details
    this.setProperty("lastResponseStatus", response.status);
    this.setProperty("lastResponseData", response.data);
    this.setProperty("lastResponseHeaders", response.headers);
    this.setProperty("lastResponseTimestamp", response.timestamp);

    // Process response content
    if (response.data && typeof response.data === "object") {
      this.setProperty("userId", response.data.id);
      this.setProperty("userName", response.data.name);
    }
  } catch (error) {
    // Handle and store error information
    this.setProperty("lastError", {
      message: error.message,
      status: error.response?.status,
      timestamp: new Date().toISOString(),
    });

    // Re-throw for test failure if needed
    if (error.response?.status !== 404) {
      throw error;
    }
  }
});

Then("I should be able to verify the response content", async function (this: SmokeWorld) {
  const responseData = this.getProperty("lastResponseData");
  const responseStatus = this.getProperty("lastResponseStatus");

  expect(responseStatus).toBe(200);
  expect(responseData).toHaveProperty("id");
  expect(responseData).toHaveProperty("name");
  expect(responseData.name).toBeTruthy();
});
```

## Use of Cucumber Tags

Tags provide powerful filtering and organization capabilities for test execution:

### Common Tag Categories

```gherkin
@smoke          # Critical functionality tests
@api            # API-related tests
@messaging      # MQTT/Kafka messaging tests
@aws            # AWS service tests
@integration    # Cross-service integration tests
@e2e            # End-to-end workflow tests
@slow           # Tests that take longer to run
@wip            # Work-in-progress tests
@regression     # Regression testing
@security       # Security-focused tests
@performance    # Performance testing
@critical       # Business-critical functionality
```

### Tag Usage Examples

```gherkin
Feature: User Management API

  @smoke @api @critical
  Scenario: Health check endpoint
    When I send a GET request to "/health"
    Then the response status should be 200

  @api @integration
  Scenario: Create and retrieve user
    When I create a new user
    And I retrieve the user details
    Then the user data should be consistent

  @aws @s3 @integration
  Scenario: Store user data in S3
    Given I have created a user
    When I store the user data in S3
    Then the data should be retrievable from S3

  @messaging @mqtt @slow
  Scenario: User notification workflow
    Given I have created a user
    When I trigger user notifications
    Then the user should receive notifications via MQTT

  @wip
  Scenario: Advanced user permissions
    # Work in progress - not ready for execution
```

### Running Tagged Tests

```bash
# Run only smoke tests
npm start -- --tags "@smoke"

# Run API tests but exclude work-in-progress
npm start -- --tags "@api and not @wip"

# Run critical tests only
npm start -- --tags "@critical"

# Run integration tests excluding slow ones
npm start -- --tags "@integration and not @slow"

# Run AWS-related tests
npm start -- --tags "@aws"

# Complex tag expressions
npm start -- --tags "(@smoke or @critical) and not @wip"
```

## Library Components

The framework provides reusable utilities under `src/lib/` to simplify step and helper implementation. Below are concise examples for each module.

- ***DateUtils (`src/lib/date-utils.ts`)***
  ```ts
  import { DateUtils } from "../src/lib/date-utils";

  // current timestamp ISO string
  const ts = DateUtils.getCurrentTimestamp();

  // add/subtract
  const in3Days = DateUtils.addDays(new Date(), 3);
  const in5Min = DateUtils.addMinutes(new Date(), 5);

  // expiration checks
  const expired = DateUtils.isExpired(new Date("2000-01-01"));

  // parse duration strings (ms)
  const ms = DateUtils.parseDuration("2m"); // 120000
  ```
- ***StringUtils (`src/lib/string-utils.ts`)***
  ```ts
  import { StringUtils } from "../src/lib/string-utils";

  const sanitized = StringUtils.sanitize(" <Hello>  world \n "); // "Hello world"
  const slug = StringUtils.createSlug("Hello World!"); // "hello-world"
  const trimmed = StringUtils.normalizeWhitespace("a   b\n c"); // "a b c"
  ```
- ***NumberUtils (`src/lib/number-utils.ts`)***
  ```ts
  import { NumberUtils } from "../src/lib/number-utils";

  const clamped = NumberUtils.clamp(15, 0, 10); // 10
  const rounded = NumberUtils.roundTo(3.14159, 2); // 3.14
  const parsed = NumberUtils.parseNumber("42", 0); // 42
  ```
- ***UrlUtils (`src/lib/url-utils.ts`)***
  ```ts
  import { UrlUtils } from "../src/lib/url-utils";

  const url = UrlUtils.buildUrl("https://api.example.com", "/users", { q: "john" });
  // https://api.example.com/users?q=john
  const joined = UrlUtils.join("/api/", "/v1/", "users"); // "/api/v1/users"
  ```
- ***ObjectUtils (`src/lib/object-utils.ts`)***
  ```ts
  import { ObjectUtils } from "../src/lib/object-utils";

  const obj = { a: { b: { c: 1 } } };
  const v = ObjectUtils.get(obj, "a.b.c", 0); // 1
  ObjectUtils.set(obj, "a.b.d", 2); // { a: { b: { c:1, d:2 } } }
  const merged = ObjectUtils.deepMerge({ a: 1 }, { b: 2 }); // { a:1, b:2 }
  ```
- ***RetryUtils (`src/lib/retry-utils.ts`)***
  ```ts
  import { retryAsync } from "../src/lib/retry-utils";

  const result = await retryAsync(
    async () => {
      const ok = Math.random() > 0.7;
      if (!ok) throw new Error("transient");
      return "done";
    },
    { retries: 5, delayMs: 200, backoff: "exponential-jitter", maxDelayMs: 2000 },
  );
  ```
- ***RandomUtils (`src/lib/random-utils.ts`)***
  ```ts
  import { RandomUtils } from "../src/lib/random-utils";

  const uuid = RandomUtils.uuid();
  const n = RandomUtils.randomInt(1, 10);
  const s = RandomUtils.randomString(8);
  const one = RandomUtils.pickOne(["a", "b", "c"]);
  const shuffled = RandomUtils.shuffle([1, 2, 3, 4]);
  ```
- ***EnvUtils (`src/lib/env-utils.ts`)***
  ```ts
  import { EnvUtils } from "../src/lib/env-utils";

  const level = EnvUtils.getEnv("LOG_LEVEL", "info");
  const debug = EnvUtils.getBoolEnv("DEBUG", false);
  const timeoutMs = EnvUtils.getNumberEnv("HTTP_TIMEOUT_MS", 5000);
  const cfg = EnvUtils.getJsonEnv<Record<string, unknown>>("APP_CONFIG", {});

  // throws SmokerError if missing/empty
  const port = EnvUtils.requireEnv("PORT");
  ```
- ObfuscationUtils (`src/lib/obfuscation-utils.ts`)
  ```ts
  import { ObfuscationUtils } from "../src/lib/obfuscation-utils";

  // strings
  const masked = ObfuscationUtils.mask("my-secret-token", { showStart: 2, showEnd: 2 });

  // headers
  const safeHeaders = ObfuscationUtils.obfuscateHeaders({
    authorization: "Bearer abc123",
    "x-api-key": "key-xyz",
  });

  // objects by property name
  const safe = ObfuscationUtils.obfuscateObject(
    { password: "pwd", token: "tkn", data: { secret: "abc" } },
    { matchProps: [/pass/i, /token/i, /secret/i] },
  );
  ```

## Logging and Error Handling

Use the shared logger and SmokerError across steps and helpers for consistent diagnostics.

- **Logger (`src/lib/logger.ts`)**
  - Import and log structured data:
    ```ts
    import { logger } from "../src/lib/logger";
    logger.info({ feature: this.pickle.name }, "starting scenario");
    ```
  - Optionally create a named child logger for consistent filtering and context:
    ```ts
    import { logger } from "../src/lib/logger";
    const stepLogger = logger.child({ name: "Steps", feature: this.pickle.name });
    stepLogger.info("starting scenario");
    ```
  - Control verbosity with `LOG_LEVEL` (default `info`).

- **SmokerError (`src/errors/smoker-error.ts`)**
  - Prefer throwing `SmokerError` with a meaningful `code`, `domain`, and `details`:
    ```ts
    import { SmokerError } from "../src/errors/smoker-error";

    function parsePayload(json: string) {
      try {
        return JSON.parse(json);
      } catch (e) {
        throw new SmokerError("Invalid JSON payload", {
          code: "INVALID_JSON",
          domain: "steps",
          details: { sample: json.slice(0, 80) },
          cause: e as Error,
        });
      }
    }
    ```
  - When catching unknown errors, normalize with `SmokerError.fromUnknown(err, ctx)`.
  - Mask secrets before logging using `ObfuscationUtils` from `src/lib/obfuscation-utils.ts`.

## Best Practices

### Feature File Best Practices

1. **Use Descriptive Scenarios**: Write clear, business-focused scenario names

   ```gherkin
   # Good
   Scenario: User can successfully place an order with valid payment information

   # Bad
   Scenario: Test order creation
   ```

2. **Keep Scenarios Independent**: Each scenario should be able to run independently

   ```gherkin
   # Good - Self-contained scenario
   Scenario: Retrieve user details
     Given I have created a user with name "John Doe"
     When I retrieve the user details
     Then the user name should be "John Doe"

   # Bad - Depends on previous scenario
   Scenario: Retrieve user details
     When I retrieve the user details
     Then the user name should be "John Doe"
   ```

3. **Use Background for Common Setup**: Extract common setup to Background sections
   ```gherkin
   Background:
     Given I have a REST client configured for "config:api.baseUrl"
     And I am authenticated as "config:testUser.admin"
   ```

### Step Definition Best Practices

1. **Use Parameter Resolution**: Always resolve parameters for external references

   ```typescript
   // Good
   When("I send request to {string}", async function (this: SmokeWorld, endpoint: string) {
     const resolvedEndpoint = await this.resolveStepParameter(endpoint);
     // Use resolvedEndpoint
   });

   // Bad
   When("I send request to {string}", async function (this: SmokeWorld, endpoint: string) {
     // Use endpoint directly without resolution
   });
   ```

2. **Implement Proper Error Handling**: Handle errors gracefully with context

   ```typescript
   When("I perform operation", async function (this: SmokeWorld) {
     try {
       const result = await performOperation();
       this.setProperty("operationResult", result);
     } catch (error) {
       this.setProperty("operationError", {
         message: error.message,
         timestamp: new Date().toISOString(),
         context: "user_operation",
       });
       throw error;
     }
   });
   ```

3. **Use Meaningful Property Names**: Store data with descriptive property names

   ```typescript
   // Good
   this.setProperty("userCreationResponse", response);
   this.setProperty("lastApiCallTimestamp", Date.now());

   // Bad
   this.setProperty("response", response);
   this.setProperty("time", Date.now());
   ```

### Configuration Best Practices

1. **Organize by Environment**: Structure configuration hierarchically

   ```json
   {
     "environments": {
       "development": { "api": { "baseUrl": "http://localhost:3000" } },
       "staging": { "api": { "baseUrl": "https://staging.api.com" } },
       "production": { "api": { "baseUrl": "https://api.com" } }
     }
   }
   ```

2. **Use External References for Secrets**: Never hardcode sensitive data

   ```json
   {
     "api": {
       "authToken": "ssm:/api/auth-token",
       "privateKey": "s3://secrets-bucket/api-key.pem"
     }
   }
   ```

3. **Provide Sensible Defaults**: Include default values for optional settings
   ```json
   {
     "api": {
       "timeout": 10000,
       "retries": 3,
       "headers": {
         "Content-Type": "application/json"
       }
     }
   }
   ```

### Performance Best Practices

1. **Reuse Client Connections**: Initialize clients once and reuse

   ```typescript
   // In hooks.ts
   Before(async function (this: SmokeWorld) {
     if (!this.getRest().isInitialized()) {
       await this.getRest().initialize(restConfig);
     }
   });
   ```

2. **Use Parallel Operations**: Execute independent operations in parallel

   ```typescript
   const [userResponse, orderResponse, productResponse] = await Promise.all([
     this.getRest().get("/users/1"),
     this.getRest().get("/orders/1"),
     this.getRest().get("/products/1"),
   ]);
   ```

3. **Clean Up Resources**: Reset clients between tests
   ```typescript
   After(async function (this: SmokeWorld) {
     await this.getRest().reset();
     await this.getS3().reset();
   });
   ```

---

For more information on specific topics, see:

- [Service Client Guide](SERVICE_CLIENT_GUIDE.md) for detailed client documentation
- [Operations Guide](OPERATIONS_GUIDE.md) for deployment and configuration
- [Development Guide](DEVELOPMENT_GUIDE.md) for framework development
