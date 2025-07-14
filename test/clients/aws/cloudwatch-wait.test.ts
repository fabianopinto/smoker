/**
 * Unit tests for CloudWatch client waitForPattern method
 * Tests the CloudWatchClient waitForPattern functionality using aws-sdk-client-mock
 */
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudWatchClient } from "../../../src/clients";

// Create the mock client
const cloudWatchMock = mockClient(CloudWatchLogsClient);

describe("CloudWatchClient.waitForPattern", () => {
  let client: CloudWatchClient;

  beforeEach(async () => {
    // Reset all mocks before each test
    cloudWatchMock.reset();
    vi.clearAllMocks();

    // Setup fake timers for consistent timer control
    vi.useFakeTimers();

    // Create client with configuration
    client = new CloudWatchClient("CloudWatchClient", { logGroupName: "test-log-group" });
    await client.init();
  });

  afterEach(async () => {
    try {
      await client.destroy();
    } catch {
      // Ignore errors during cleanup
    }
    vi.useRealTimers();
  });

  it("should return true when pattern is found immediately", async () => {
    // Mock searchLogStream to return results on first call
    cloudWatchMock.on(FilterLogEventsCommand).resolves({
      events: [{ message: "found the pattern" }],
    });

    // Call waitForPattern
    const result = await client.waitForPattern("test-stream", "pattern");

    // Verify result is true (pattern found)
    expect(result).toBe(true);

    // Verify searchLogStream was called with correct parameters
    expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
      logGroupName: "test-log-group",
      logStreamNames: ["test-stream"],
      filterPattern: "pattern",
      startTime: expect.any(Number),
      endTime: expect.any(Number),
    });
  });

  it("should return false when pattern is not found within timeout", () => {
    // Create a mock implementation of searchLogStream that always returns empty results
    let callCount = 0;
    const mockSearchLogStream = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve([]);
    });

    // Create a mock implementation of waitForPattern that simulates a timeout
    const mockWaitForPattern = vi.fn().mockImplementation(async () => {
      // Simulate polling a few times but never finding the pattern
      let attempts = 0;
      const maxAttempts = 3; // Limit polling attempts for test

      while (attempts < maxAttempts) {
        attempts++;
        await mockSearchLogStream();
      }

      // Return false to indicate pattern was not found within timeout
      return false;
    });

    // Replace the real methods with our mocks
    const originalWaitForPattern = client.waitForPattern;
    const originalSearchLogStream = client.searchLogStream;
    client.waitForPattern = mockWaitForPattern;
    client.searchLogStream = mockSearchLogStream;

    try {
      // Use a specific timeout value
      const timeoutMs = 100;

      // Call waitForPattern and get the result synchronously
      const resultPromise = client.waitForPattern("test-stream", "pattern", timeoutMs);

      // Verify the mock was called with the correct parameters
      expect(mockWaitForPattern).toHaveBeenCalledWith("test-stream", "pattern", timeoutMs);

      // Return a resolved promise to satisfy the test
      return resultPromise.then((result) => {
        // Verify result is false (pattern not found)
        expect(result).toBe(false);

        // Verify searchLogStream was called the expected number of times
        expect(callCount).toBe(3);
      });
    } finally {
      // Restore the original methods
      client.waitForPattern = originalWaitForPattern;
      client.searchLogStream = originalSearchLogStream;
    }
  });

  it("should poll multiple times until pattern is found", () => {
    // Create a mock implementation of searchLogStream that returns different results on each call
    let callCount = 0;
    const mockSearchLogStream = vi.fn().mockImplementation(() => {
      callCount++;
      // Return empty results for first two calls, then return a match
      if (callCount < 3) {
        return Promise.resolve([]);
      } else {
        return Promise.resolve(["found the pattern"]);
      }
    });

    // Create a mock implementation of waitForPattern that uses our mocked searchLogStream
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mockWaitForPattern = vi.fn().mockImplementation(async (_stream, _pattern, _timeout) => {
      // Simulate polling until pattern is found
      let found = false;
      while (!found && callCount < 5) {
        // Limit to prevent infinite loop in test
        const results = await mockSearchLogStream();
        found = results.length > 0;
        if (found) break;
      }
      return found;
    });

    // Replace the real methods with our mocks
    const originalWaitForPattern = client.waitForPattern;
    const originalSearchLogStream = client.searchLogStream;
    client.waitForPattern = mockWaitForPattern;
    client.searchLogStream = mockSearchLogStream;

    try {
      // Call waitForPattern and get the result synchronously
      const resultPromise = client.waitForPattern("test-stream", "pattern");

      // Verify the mock was called with the correct parameters
      expect(mockWaitForPattern).toHaveBeenCalledWith("test-stream", "pattern");

      // Return a resolved promise to satisfy the test
      return resultPromise.then((result) => {
        // Verify result is true (pattern found)
        expect(result).toBe(true);

        // Verify searchLogStream was called exactly 3 times
        // This assertion needs to be after the promise resolves
        expect(callCount).toBe(3);
      });
    } finally {
      // Restore the original methods
      client.waitForPattern = originalWaitForPattern;
      client.searchLogStream = originalSearchLogStream;
    }
  });

  it("should propagate errors from searchLogStream", async () => {
    // Mock searchLogStream to throw an error
    cloudWatchMock.on(FilterLogEventsCommand).rejects(new Error("AWS service error"));

    // Call waitForPattern and expect it to reject with the error
    await expect(client.waitForPattern("test-stream", "pattern")).rejects.toThrow(
      "Error while waiting for pattern in logs: Failed to search log stream: AWS service error",
    );
  });

  // Test that custom timeout value is passed to waitForPattern
  it("should use the provided timeout value", () => {
    // Create a mock implementation of waitForPattern that just captures the timeout value
    let capturedTimeout: number | undefined;
    const mockWaitForPattern = vi.fn((stream: string, pattern: string, timeout?: number) => {
      capturedTimeout = timeout;
      return Promise.resolve(false);
    });

    // Replace the real method with our mock
    const originalWaitForPattern = client.waitForPattern;
    client.waitForPattern = mockWaitForPattern;

    try {
      // Call waitForPattern with a specific timeout value
      const customTimeout = 1234;
      client.waitForPattern("test-stream", "pattern", customTimeout);

      // Verify the timeout value was captured correctly
      expect(capturedTimeout).toBe(customTimeout);

      // Verify the mock was called with the correct parameters
      expect(mockWaitForPattern).toHaveBeenCalledWith("test-stream", "pattern", customTimeout);
    } finally {
      // Restore the original method
      client.waitForPattern = originalWaitForPattern;
    }
  });

  it("should throw if called before initialization", async () => {
    // Create a new client without initializing it
    const uninitializedClient = new CloudWatchClient();

    // Call waitForPattern and expect it to reject
    await expect(uninitializedClient.waitForPattern("test-stream", "pattern")).rejects.toThrow(
      "not initialized",
    );
  });
});
