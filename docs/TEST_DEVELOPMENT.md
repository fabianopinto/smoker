# Test Development Guide

[← Back to README](../README.md)

This guide explains how to create smoke test suites targeting specific systems using the Smoker framework.

## Table of Contents

- [BDD Testing Approach](#bdd-testing-approach)
- [Feature Files](#feature-files)
- [Step Definitions](#step-definitions)
- [Cucumber Tags](#cucumber-tags)
- [Library Components](#library-components)
- [Unit Testing](#unit-testing)
- [Best Practices](#best-practices-1)

## BDD Testing Approach

Smoker uses Behavior-Driven Development (BDD) with Cucumber.js to create human-readable tests:

1. **Feature Files**: Define test scenarios in Gherkin syntax
2. **Step Definitions**: Implement the steps in TypeScript
3. **World Object**: Maintain state between steps
4. **Service Clients**: Interact with external systems

## Feature Files

Feature files use Gherkin syntax to describe test scenarios in plain language.

### Structure

```gherkin
Feature: API Health Check
  As a system operator
  I want to verify the API is responding correctly
  So that I know the system is operational

  Scenario: Check API health endpoint
    Given I have a REST client configured for "https://api.example.com"
    When I send a GET request to "/health"
    Then I should receive a 200 status code
    And the response should contain "status: UP"
```

### Organization

- Place feature files in the `features/` directory
- Organize by target system or functionality
- Use subdirectories for better organization (e.g., `features/api/`, `features/messaging/`)

### Best Practices

- Write scenarios from the user's perspective
- Keep scenarios focused on a single behavior
- Use descriptive feature and scenario names
- Include background context when needed

## Step Definitions

Step definitions implement the steps described in feature files using TypeScript.

### Structure

```typescript
import { Given, When, Then } from "@cucumber/cucumber";
import type { SmokeWorld } from "../../src/world";

Given("I have a REST client configured for {string}", async function (this: SmokeWorld, baseUrl: string) {
  const restClient = this.getRest();
  await restClient.init({ baseURL: baseUrl });
});

When("I send a GET request to {string}", async function (this: SmokeWorld, path: string) {
  try {
    const restClient = this.getRest();
    const response = await restClient.get(path);
    this.attachResponse(response);
  } catch (error) {
    this.attachError(error instanceof Error ? error : new Error(String(error)));
  }
});

Then("I should receive a {int} status code", function (this: SmokeWorld, statusCode: number) {
  const response = this.getResponse();
  expect(response.status).to.equal(statusCode);
});
```

### Organization

- Place step definitions in the `features/step_definitions/` directory
- Group by functionality or target system
- Use descriptive filenames (e.g., `api-steps.ts`, `messaging-steps.ts`)

### World Pattern

The `SmokeWorld` class provides state management between steps:

```typescript
// Access the world object in step definitions
Given("a target named {string}", function (this: SmokeWorld, userTarget: string) {
  this.setTarget(userTarget);
});

// Get values from the world in later steps
Then("the target should be {string}", function (this: SmokeWorld, expectedTarget: string) {
  expect(this.getTarget()).to.equal(expectedTarget);
});
```

## Cucumber Tags

Tags help organize and filter test scenarios:

```gherkin
@api @health
Feature: API Health Check

  @smoke
  Scenario: Basic health check
    Given I have a REST client
    When I check the health endpoint
    Then it should return OK

  @regression @slow
  Scenario: Detailed system status
    Given I have a REST client
    When I check the detailed status
    Then all subsystems should be operational
```

### Common Tags

- `@smoke`: Quick smoke tests
- `@regression`: More comprehensive tests
- `@wip`: Work in progress (typically skipped in CI)
- `@slow`: Tests that take longer to run
- `@api`, `@messaging`, etc.: Tags for specific subsystems

### Running Tagged Tests

```bash
# Run only smoke tests
npm start -- --tags "@smoke"

# Run API tests but exclude slow ones
npm start -- --tags "@api and not @slow"
```

## Library Components

Create reusable components in the `src/lib/` folder:

### Structure

```
src/lib/
├── api-helpers.ts      # Helper functions for API testing
├── data-generators.ts  # Test data generation utilities
├── assertions.ts       # Custom assertion helpers
└── utils.ts            # General utilities
```

### Example Library Component

```typescript
// src/lib/api-helpers.ts
import type { RestServiceClient } from "../clients/rest";
import { getValue } from "../support/config";

export async function checkEndpointHealth(
  client: RestServiceClient,
  endpoint: string = "/health"
): Promise<boolean> {
  try {
    const response = await client.get(endpoint);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

export function getApiBaseUrl(): string {
  return getValue("api.baseUrl", "https://default-api.example.com");
}
```

### Using Library Components

```typescript
// In step definitions
import { checkEndpointHealth, getApiBaseUrl } from "../../src/lib/api-helpers";

Given("I have a configured API client", async function (this: SmokeWorld) {
  const baseUrl = getApiBaseUrl();
  const client = this.getRest();
  await client.init({ baseURL: baseUrl });
});

When("I check the API health", async function (this: SmokeWorld) {
  const client = this.getRest();
  const isHealthy = await checkEndpointHealth(client);
  this.setState("isHealthy", isHealthy);
});
```

## Unit Testing

Unit test your library components and custom step definitions:

### Testing Library Components

```typescript
// test/lib/api-helpers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkEndpointHealth } from "../../src/lib/api-helpers";

describe("API Helpers", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    };
  });

  it("should return true when endpoint returns 200", async () => {
    mockClient.get.mockResolvedValue({ status: 200 });
    const result = await checkEndpointHealth(mockClient, "/health");
    expect(result).toBe(true);
    expect(mockClient.get).toHaveBeenCalledWith("/health");
  });

  it("should return false when endpoint returns non-200", async () => {
    mockClient.get.mockResolvedValue({ status: 500 });
    const result = await checkEndpointHealth(mockClient, "/health");
    expect(result).toBe(false);
  });

  it("should return false when endpoint throws error", async () => {
    mockClient.get.mockRejectedValue(new Error("Connection refused"));
    const result = await checkEndpointHealth(mockClient, "/health");
    expect(result).toBe(false);
  });
});
```

## Best Practices

### Feature File Best Practices

- Write scenarios from the user's perspective
- Keep scenarios focused on a single behavior
- Use descriptive feature and scenario names
- Include background context when needed
- Use scenario outlines for data-driven tests

### Step Definition Best Practices

- Keep step definitions small and focused
- Reuse steps across scenarios
- Handle errors properly with try/catch
- Store state in the world object
- Use regex patterns for flexible matching

### Testing Best Practices

- Test happy paths and error cases
- Mock external dependencies
- Use descriptive test names
- Organize tests to mirror source code
- Reset state between tests
