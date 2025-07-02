# Smoker Implementation Guide

## Framework Purpose

Smoker is a specialized framework for conducting smoke tests against **external target systems**. The framework itself is thoroughly tested, while the BDD features you create are meant to test other systems. Think of Smoker as a tool that helps you verify the basic functionality of your production systems.

## Project Structure

```
src/
├── support/           # Configuration management
│   └── config.ts      # Configuration system implementation
├── lib/               # Core business logic
│   └── dummy.ts       # Dummy functionality using configuration
└── world/             # Cucumber.js World implementation
    └── SmokeWorld.ts  # Custom World with interface for maintaining state between steps
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

The configuration system provides a way to manage settings used across the application:

- Singleton pattern ensures consistent configuration throughout the test run
- Configuration values can be modified during test execution
- Step definitions can change configuration values
- Business logic accesses configuration through helper functions

### Usage in Features

```gherkin
Scenario: Phrase with custom phrase text
  Given the phrase is set to "Testing"
  And a target named "System"
  When I generate a phrase
  Then I should get "Testing System!"
```

### Usage in Step Definitions

```typescript
Given("the phrase is set to {string}", function (phrase: string) {
  updateConfig({ defaultPhrase: phrase });
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
```

## Benefits

- **Separation of concerns**: Business logic in src/lib, World in src/world, Configuration in src/support
- **State management**: World object maintains state between steps
- **Configuration**: Settings can be changed during test execution
- **Type safety**: TypeScript interfaces ensure proper typing
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

All components have 100% test coverage for:

- Statements
- Branches
- Functions
- Lines

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
