# Smoker Implementation Guide

## Framework Purpose

Smoker is a specialized framework for conducting smoke tests against **external target systems**. The framework itself is thoroughly tested, while the BDD features you create are meant to test other systems. Think of Smoker as a tool that helps you verify the basic functionality of your production systems.

## Sample Code

This framework includes sample/dummy code to demonstrate usage patterns:

- **Dummy Feature File**: The `features/*.feature` file is a sample demonstrating Gherkin syntax and can be replaced with your actual test scenarios
- **Sample Step Definitions**: The `features/step_definitions/*.steps.ts` files contain example step implementations that should be replaced with your actual test code
- **Dummy Library Code**: The `src/lib/dummy.ts` file is a placeholder demonstrating the use of configuration and can be removed or replaced

All these sample components are provided for demonstration purposes and should be replaced or removed when implementing real smoke tests. They are fully tested to show proper testing patterns but are not intended for production use.

### Replacing Sample Code with Real Implementations

1. **Feature Files**:
   - Remove the sample feature file in the `features` directory
   - Create your own `.feature` files with scenarios specific to your target systems
   - Organize features into subdirectories by target system or functionality

2. **Step Definitions**:
   - Remove the sample step definitions in `features/step_definitions`
   - Create your own step definition files with implementation logic
   - Use the `SmokeWorld` pattern demonstrated in the examples
   - Leverage the configuration system for target-specific settings

3. **Library Code**:
   - Remove `src/lib/dummy.ts` and its associated tests
   - Create your own utility modules under `src/lib` as needed
   - Organize code based on functionality or target systems

## Project Structure

```
src/
├── support/              # Configuration management
│   ├── config.ts         # Configuration system implementation
│   ├── parameter-resolver.ts # Parameter reference resolution implementation
│   └── aws-clients.ts    # AWS client wrappers for S3 and SSM
├── lib/                  # Core business logic
│   └── dummy.ts          # Dummy functionality using configuration
└── world/                # Cucumber.js World implementation
    └── SmokeWorld.ts     # Custom World with interface for maintaining state between steps
```

## World Pattern

The World object in Cucumber.js is a container for state that's shared between steps in a scenario. In our implementation:

- `SmokeWorld` extends Cucumber's `World` class
- It maintains the target and phrase state between steps
- It provides methods to access and manipulate that state
- Step definitions use `this` to access the World object
- TypeScript interface declaration ensures proper typing

### Usage in Step Definitions

```typescript
Given("a target named {string}", function (this: SmokeWorld, userTarget: string) {
  this.setTarget(userTarget);
});
```

## Configuration Pattern

The configuration system provides a robust way to manage settings used across the application:

- Singleton pattern ensures consistent configuration throughout the test run
- Support for multiple configuration sources (files, objects, Lambda event)
- Deep merging of configuration values from multiple sources
- Nested configuration properties with dot notation access
- Type-safe configuration access with TypeScript
- Configuration values can be modified during test execution
- Graceful error handling with fallbacks to default values
- **Parameter resolution** from AWS SSM Parameter Store and S3 JSON files
- **Nested parameter references** for complex configuration scenarios
- **Circular reference detection** to prevent infinite loops

### Configuration Value Types

The configuration system supports various types of data:

```typescript
// Supported configuration value types
export type ConfigValue = string | number | boolean | ConfigObject | ConfigValue[] | null;

// Example configuration with multiple data types
const config = {
  // Core BDD settings
  defaultPhrase: "Smoking", // String
  phraseTemplate: "{phrase} {target}!", // String

  // Custom settings
  apiUrl: "https://api.example.com", // String
  timeout: 5000, // Number
  debug: true, // Boolean
  flags: ["feature1", "feature2"], // Array
  credentials: {
    // Nested object
    username: "testuser",
    password: "password123",
  },
};
```

### Configuration Sources

The system supports multiple configuration sources that can be loaded and merged:

1. **File-based Configuration**:
   Load settings from local JSON files

   ```typescript
   // Load from a single file
   addConfigurationFile("/path/to/config.json");

   // Load from multiple files
   loadConfigurationFiles(["./config/base.json", "./config/environment.json"]);
   ```

2. **S3-based Configuration**:
   Load settings from Amazon S3 using s3:// URL format

   ```typescript
   // Load from S3 with default region
   addConfigurationFile("s3://my-bucket/path/to/config.json");

   // Load from S3 with specific region
   addS3ConfigurationFile("s3://my-bucket/path/to/config.json", "us-west-2");

   // Load multiple files including S3 URLs
   loadConfigurationFiles(["./config/base.json", "s3://my-bucket/environments/prod-config.json"]);
   ```

3. **Object-based Configuration**:
   Load settings from a JavaScript object

   ```typescript
   // Add configuration from an object
   addConfigurationObject({
     apiUrl: "https://api.example.com",
     credentials: {
       username: "apiuser",
       password: "secret",
     },
   });
   ```

4. **AWS SSM Parameter Store**:
   Load sensitive or environment-specific settings from AWS SSM Parameter Store

   ```typescript
   // Create configuration object with SSM parameter references
   const config = {
     apiUrl: "https://api.example.com",
     apiKey: "ssm://my-app/api-key", // Will be fetched from SSM
     database: {
       username: "ssm://my-app/db/username",
       password: "ssm://my-app/db/password", // SecureString parameters are automatically decrypted
     },
   };

   // Add the configuration with SSM parameter resolution
   addSSMParameterSource(config);
   await loadConfigurations();

   // Access the resolved values (SSM parameters are now replaced with actual values)
   const apiKey = getValue("apiKey"); // Value retrieved from SSM
   ```

5. **Lambda Event Configuration**:
   Load settings from Lambda event parameters

   ```json
   {
     "paths": ["dist/features/api/**/*.feature"],
     "tags": "@api and not @wip",
     "config": {
       "apiUrl": "https://api.example.com",
       "timeout": 5000
     },
     "configFiles": ["./config/test-env.json", "s3://my-bucket/configs/prod.json"]
   }
   ```

### Accessing Configuration

#### Basic Configuration Access

```typescript
// Get the entire configuration
const config = getConfig();
console.log(config.apiUrl); // "https://api.example.com"

// Update configuration
updateConfig({
  apiUrl: "https://updated-api.example.com",
});
```

#### Accessing Nested Configuration

```typescript
// Access nested configuration with dot notation
const username = getValue("credentials.username", "default");
console.log(username); // "testuser"

// Access with default value if path doesn't exist
const missing = getValue("non.existent.path", "default value");
console.log(missing); // "default value"

// Access array values
const firstEndpoint = getValue("endpoints.0");
console.log(firstEndpoint); // First item in the endpoints array

// Handle null values safely
const valueOrDefault = getValue("possibly.null.value", "default for null");
```

### Usage in BDD Features

```gherkin
Scenario: API smoke test with configuration
  Given the API URL is "https://api.example.com"
  And the request timeout is 3000
  When I send a GET request to the endpoint "/health"
  Then I should receive a 200 status code
```

### Error Handling

The configuration system is designed with robust error handling capabilities:

- **Invalid JSON**: When loading from files with invalid JSON, the system logs errors and falls back to empty objects
- **Missing Files**: When configuration files don't exist, the system handles this gracefully
- **Validation**: Missing required properties are reported but the system continues with default values
- **Type Safety**: Incorrect property types are handled with appropriate type coercion when possible
- **Invalid S3 URLs**: Malformed S3 URLs are detected and logged without disrupting execution
- **Parameter Resolution**: AWS SSM Parameter references and S3 JSON file references are automatically detected and resolved
- **Cached Parameters**: Resolved parameters are cached to avoid redundant API calls
- **Recursive Resolution**: Supports nested parameter references with configurable maximum depth protection
- **Null/Undefined Sources**: The system properly handles null or undefined configuration sources
- **Parameter Reference Resolution**: Automatically resolves references to AWS SSM parameters and S3 JSON files
- **Parameter Caching**: Caches resolved parameter values to avoid redundant API calls
- **Circular Reference Detection**: Identifies and prevents infinite loops in parameter references

### Usage in Step Definitions

```typescript
Given("the API URL is {string}", function (url: string) {
  updateConfig({ apiUrl: url });
});

Given("the request timeout is {int}", function (timeout: number) {
  updateConfig({ timeout });
});

When("I send a GET request to the endpoint {string}", async function (endpoint: string) {
  const config = getConfig();
  const response = await axios.get(`${config.apiUrl}${endpoint}`, {
    timeout: config.timeout,
  });
  this.response = response;
});
```

### Usage in Business Logic

```typescript
export function dummy(target: string): string {
  const config = getConfig();
  return config.phraseTemplate
    .replace("{phrase}", config.defaultPhrase)
    .replace("{target}", target);
}

// Using getValue for nested properties with default values
export async function makeApiRequest(endpoint: string): Promise<any> {
  const baseUrl = getValue("api.baseUrl", "https://default-api.com");
  const timeout = getValue("api.timeout", 5000);
  const headers = getValue("api.headers", {});

  return axios.get(`${baseUrl}${endpoint}`, { timeout, headers });
}
```

### Removing Configuration Properties

You can remove specific properties or entire branches of the configuration tree by setting them to `null` in a later configuration source:

```typescript
// Initial configuration
updateConfig({
  apiUrl: "https://api.example.com",
  debug: true,
  logging: {
    level: "info",
    format: "json",
    target: "console",
  },
});

// Remove properties by setting them to null
addConfigurationObject({
  debug: null, // Removes the debug property entirely
  logging: {
    format: null, // Removes only the format property
    target: null, // Removes only the target property
  },
});

// After merging, the configuration will be:
// {
//   apiUrl: "https://api.example.com",
//   logging: {
//     level: "info"     // Only this property remains
//   }
// }
```

## Benefits

- **Separation of concerns**: Business logic in src/lib, World in src/world, Configuration in src/support
- **State management**: World object maintains state between steps
- **Multiple sources**: Configuration from files, S3, objects and Lambda events
- **Environment-aware**: Easy to switch between dev, test, and prod configurations
- **Property removal**: Ability to remove unwanted properties with null values
- **Type safety**: TypeScript interfaces ensure proper typing
- **Flexible access**: Dot notation for nested property access with default values
- **Reusability**: World and configuration patterns can be reused across features

## Testing Strategy

### Unit Testing

Unit tests focus on testing individual components in isolation:

- **SmokeWorld Unit Tests**: Test all methods independently
  - Mock external dependencies (dummy function)
  - Test edge cases including non-string inputs
  - Verify state management between method calls
  - Mock Cucumber's setWorldConstructor for isolated testing

### Integration Testing

Integration tests verify that components work together correctly:

- **SmokeWorld Integration Tests**: Test the complete workflow
  - Use real dependencies instead of mocks
  - Verify end-to-end behavior
  - Test with actual configuration system

### Test Coverage

The codebase has high test coverage across components:

- ~95% Statement coverage
- ~94% Branch coverage
- 100% Function coverage
- ~95% Line coverage

### Parameter Resolution Architecture

The parameter resolution system uses a modular architecture for flexibility and testability:

1. **ParameterResolver Class**: Central component responsible for resolving parameter references
   - Supports both AWS SSM parameters and S3 JSON file references
   - Handles nested references with circular reference detection
   - Implements parameter caching for improved performance

2. **AWS Client Wrappers**: Abstraction layer for AWS SDK operations
   - S3ClientWrapper for S3 operations
   - SSMClientWrapper for Parameter Store operations
   - Supports client injection for testability

3. **ConfigurationSource Interface**: Common interface for all configuration sources
   - FileConfigurationSource for local files
   - S3ConfigurationSource for S3 JSON files
   - ObjectConfigurationSource for in-memory objects
   - SSMParameterSource for AWS SSM parameters

4. **Cache Implementation**: In-memory cache for resolved parameters
   - Avoids redundant API calls to AWS services
   - Improves test execution performance
   - Cache is cleared between test runs

This comprehensive testing approach ensures robustness while allowing for pragmatic trade-offs in edge cases. The test suite includes dedicated validation tests that verify:

- Proper handling of missing configuration properties
- Correct type coercion for non-string values
- Graceful handling of null/undefined configurations
- Proper error reporting for configuration issues

## AWS Lambda Implementation

### Lambda Handler Architecture

The Smoker framework has been adapted to run in AWS Lambda with a flexible event-driven architecture:

```
src/
├── index.ts           # Main entry point with Lambda handler
│                      # Supports both direct execution and Lambda invocation
└── ... (other files)
```

### Lambda Handler Functions

The entry point (`index.ts`) provides two key functions:

1. **`main(event: LambdaEvent)`**: Core function that runs Cucumber tests
   - Can be used directly or invoked by the Lambda handler
   - Accepts event parameters to customize test execution

2. **`handler(event: LambdaEvent, context: LambdaContext)`**: AWS Lambda handler
   - Entry point for Lambda invocations
   - Processes the Lambda event and context
   - Calls main() with parameters from the event

### Lambda Event Structure

The Lambda handler accepts an event with optional parameters to customize test execution:

```typescript
export interface LambdaEvent {
  // Optional parameters that can be passed to customize test execution
  paths?: string[]; // Custom feature paths to run (e.g., target specific systems)
  formats?: string[]; // Custom output formats (e.g., json, html, junit)
  tags?: string; // Cucumber tags to filter tests (e.g., @critical or @api)
  environment?: Record<string, string>; // Additional environment variables (e.g., API URLs, credentials)
  config?: ConfigObject; // Configuration object with possible parameter references
  configFiles?: string[]; // Configuration files to load (including S3 URLs)
}
```

### Usage Examples

#### Basic Lambda Invocation

```json
{
  "paths": ["dist/features/smoke/**/*.feature"],
  "formats": ["json"],
  "tags": "@smoke and not @wip"
}
```

#### Setting Environment Variables

```json
{
  "environment": {
    "API_URL": "https://api.example.com",
    "DEBUG": "true",
    "TIMEOUT": "5000"
  }
}
```

### Environment Configuration

The Lambda function supports different environments (dev, test, prod) with appropriate settings:

| Environment | Memory | Timeout | Log Retention | Alarms |
| ----------- | ------ | ------- | ------------- | ------ |
| dev         | 1GB    | 5 min   | 1 week        | No     |
| test        | 1.5GB  | 10 min  | 2 weeks       | Yes    |
| prod        | 2GB    | 15 min  | 1 month       | Yes    |

### Best Practices for Lambda Execution

1. **Optimize Test Selection**: Use tags to run only necessary tests for specific target systems
2. **Memory Consideration**: Tests with browser automation may need more memory (consider 2GB+)
3. **Timeout Management**: Ensure tests complete within the Lambda timeout (maximum 15 minutes)
4. **Environment Variables**: Pass target system URLs and credentials via the event's environment property
5. **Output Format**: Use JSON format for better parsing and integration with monitoring systems
6. **Log Level**: Set appropriate log levels for different environments (DEBUG for dev, INFO for prod)
7. **Scheduling**: Use EventBridge rules to schedule regular smoke test runs
8. **Alerting**: Configure SNS topics for test failure notifications
9. **Cross-Region**: Deploy in multiple AWS regions to test global availability

### Monitoring and Troubleshooting

1. **CloudWatch Logs**: All test output is available in CloudWatch Logs
2. **X-Ray Tracing**: Lambda function includes X-Ray tracing for performance analysis
3. **CloudWatch Alarms**: Configured for test failures in test/prod environments
4. **Error Reporting**: Structured error responses for easy diagnosis
