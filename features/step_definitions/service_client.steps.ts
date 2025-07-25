/**
 * Step definitions for service clients
 *
 * These step definitions provide a way to interact with service clients
 * registered in the SmokeWorld instance.
 */
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { strictEqual } from "node:assert";
import type { SmokeWorld } from "../../src/world";

// Hooks for initializing and cleaning up clients
Before(async function (this: SmokeWorld) {
  // Initialize all clients with default configuration
  await this.initializeClients();
});

After(async function (this: SmokeWorld) {
  // Clean up resources used by clients
  await this.destroyClients();
});

// REST client steps
Given("a REST client with base URL {string}", async function (this: SmokeWorld, baseUrl: string) {
  // Register REST client with configuration in constructor
  const restClient = this.registerClientWithConfig("rest", { baseURL: baseUrl });
  await restClient.init();
});

When("I send a GET request to {string}", async function (this: SmokeWorld, path: string) {
  try {
    const response = await this.getRest().get(path);
    // Store the response data in the world object for later assertions
    this.attachResponse(response);
  } catch (error) {
    // Store the error for later assertions
    this.attachError(error instanceof Error ? error : new Error(String(error)));
  }
});

Then("I should receive a status code {int}", function (this: SmokeWorld, statusCode: number) {
  const response = this.getLastResponse() as { status: number };
  strictEqual(response.status, statusCode);
});

// S3 client steps
Given("an S3 client for bucket {string}", async function (this: SmokeWorld, bucket: string) {
  // Register S3 client with configuration in constructor
  const s3Client = this.registerClientWithConfig("s3", {
    bucket,
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
  await s3Client.init();
});

When(
  "I store {string} at key {string} in S3",
  async function (this: SmokeWorld, content: string, key: string) {
    try {
      await this.getS3().write(key, content);
    } catch (error) {
      this.attachError(error instanceof Error ? error : new Error(String(error)));
    }
  },
);

When("I read the content at key {string} from S3", async function (this: SmokeWorld, key: string) {
  try {
    const content = await this.getS3().read(key);
    this.attachContent(content);
  } catch (error) {
    this.attachError(error instanceof Error ? error : new Error(String(error)));
  }
});

Then("I should see the content {string}", function (this: SmokeWorld, expectedContent: string) {
  const content = this.getLastContent();
  strictEqual(content, expectedContent);
});

// SSM client steps
Given("an SSM client in region {string}", async function (this: SmokeWorld, region: string) {
  // Register SSM client with configuration in constructor
  const ssmClient = this.registerClientWithConfig("ssm", {
    region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
  await ssmClient.init();
});

When(
  "I store value {string} at parameter {string} in SSM",
  async function (this: SmokeWorld, value: string, parameter: string) {
    try {
      await this.getSsm().write(parameter, value);
    } catch (error) {
      this.attachError(error instanceof Error ? error : new Error(String(error)));
    }
  },
);

When(
  "I read the parameter {string} from SSM",
  async function (this: SmokeWorld, parameter: string) {
    try {
      const value = await this.getSsm().read(parameter);
      this.attachContent(value);
    } catch (error) {
      this.attachError(error instanceof Error ? error : new Error(String(error)));
    }
  },
);

// Generic error handling steps
Then("I should get an error containing {string}", function (this: SmokeWorld, errorText: string) {
  const error = this.getLastError() as Error;
  strictEqual(error instanceof Error, true);
  strictEqual(error.message.includes(errorText), true);
});

// Note: The helper methods are already added to the SmokeWorld interface in world.ts
// No need for declaration merging anymore

// Note: You would need to implement these methods in the SmokeWorld class
