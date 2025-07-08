# Testing Guide for Smoker Framework

This guide outlines the testing approach for the Smoker framework, covering strategies, best practices, and test organization principles.

## Test Structure

The test directory is organized to mirror the source code structure:

```
test/
├── clients/            # Tests for service clients
│   ├── aws/            # AWS-specific client tests
│   ├── kafka.test.ts
│   ├── mqtt.test.ts
│   └── rest.test.ts
├── lib/                # Tests for utility and core library functions
├── support/            # Tests for support modules
│   ├── aws/
│   ├── config/
│   └── interfaces/
└── world/              # Tests for Cucumber world implementation
```

## Testing Frameworks

- **Vitest**: Primary test runner and assertion library
- **Cucumber**: Used for behavior-driven development tests
- **aws-sdk-client-mock**: Mocking AWS SDK clients
- **aws-sdk-client-mock-vitest**: Vitest matchers for AWS SDK mocks

## Testing Best Practices

### General Guidelines

1. **Test Organization**:
   - Group tests logically using `describe` blocks
   - Use descriptive test names that explain what is being tested
   - Follow the "Arrange, Act, Assert" pattern

2. **Test Isolation**:
   - Reset mocks before each test with `beforeEach`
   - Clean up resources after tests with `afterEach`
   - Use `vi.useFakeTimers()` and `vi.useRealTimers()` for time-dependent tests

3. **Assertion Best Practices**:
   - Make specific assertions that verify exactly what you expect
   - Use appropriate matchers for different data types
   - Test both success and error conditions

### AWS SDK Testing

1. **Mock Setup**:

   ```typescript
   import { mockClient } from "aws-sdk-client-mock";
   import { S3Client } from "@aws-sdk/client-s3";

   const s3Mock = mockClient(S3Client);
   ```

2. **Command Verification**:

   ```typescript
   // Using aws-sdk-client-mock-vitest matchers
   expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
     Bucket: "test-bucket",
     Key: "test-key",
     Body: "test-content",
   });
   ```

3. **Response Mocking**:

   ```typescript
   s3Mock.on(GetObjectCommand).resolves({
     Body: createMockStream("test-content"),
   });
   ```

4. **Stream Handling**:
   - Use helper functions to create mock streams for response testing
   - Implement both success and error streams to test error handling

### Non-AWS SDK Testing

1. **Manual Mocking**:

   ```typescript
   vi.mock("kafkajs", () => {
     // Mock implementation here
   });
   ```

2. **Mock Implementation**:
   - Create realistic mock implementations that mimic the actual behavior
   - Add appropriate mock functions for success and error scenarios

3. **Verification**:
   - Verify that mock functions were called with expected parameters
   - Check both successful operation and error handling

## Using Fake Timers

```typescript
// Setup fake timers
vi.useFakeTimers();
vi.setSystemTime(new Date(1625097600000)); // Fixed timestamp for consistent results

// Run your test with time dependencies
const result = await someTimeFunction();

// Advance time if needed
vi.advanceTimersByTime(1000); // Move forward 1 second

// Clean up
vi.useRealTimers();
```

## Testing Asynchronous Operations

1. **Promise-based Testing**:

   ```typescript
   it("should handle asynchronous operations", async () => {
     await expect(asyncFunction()).resolves.toBe(expectedValue);
     await expect(errorFunction()).rejects.toThrow("Expected error");
   });
   ```

2. **Timeout Handling**:
   - Use explicit timeouts for tests that might run longer
   - Control time with `vi.advanceTimersByTime()` when using fake timers

## Test Doubles Guide

1. **Mocks**: Used to verify interactions and provide predetermined responses
2. **Stubs**: Provide canned answers to calls made during the test
3. **Spies**: Record information about calls without affecting behavior

## Debugging Tests

- Use `console.log()` statements to debug test issues (remove before commit)
- Run individual tests with `npx vitest run path/to/test.ts`
- Use the `--update` flag to update snapshots if needed

## Continuous Integration

All tests are run as part of the CI pipeline. Ensure tests are:

- Fast and reliable
- Do not depend on external resources
- Do not leave side effects

For more specific testing guidelines for different client types, see [Client Testing Guide](./clients/README.md).
