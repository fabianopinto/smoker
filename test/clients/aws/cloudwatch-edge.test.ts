/**
 * Edge case tests for CloudWatch client implementation
 * Tests the CloudWatchClient functionality with various edge cases
 */
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudWatchClient } from "../../../src/clients";

// Create the mock client
const cloudWatchMock = mockClient(CloudWatchLogsClient);

describe("CloudWatchClient Edge Cases", () => {
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

  describe("Time range handling", () => {
    it("should handle very large time ranges", async () => {
      // Set up a very large time range (multiple years)
      const startTime = 1577836800000; // 2020-01-01
      const endTime = 1735689600000; // 2025-01-01

      // Mock the response
      cloudWatchMock.on(FilterLogEventsCommand).resolves({
        events: [{ message: "test message" }],
      });

      // Call searchLogStream with the large time range
      await client.searchLogStream("test-stream", "pattern", startTime, endTime);

      // Verify correct parameters were used
      expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: "test-log-group",
        logStreamNames: ["test-stream"],
        filterPattern: "pattern",
        startTime: startTime,
        endTime: endTime,
      });
    });

    it("should handle time range where end is before start", async () => {
      // Set up an inverted time range
      const startTime = 1625097600000; // Later time
      const endTime = 1609459200000; // Earlier time

      // Mock the response
      cloudWatchMock.on(FilterLogEventsCommand).resolves({
        events: [{ message: "test message" }],
      });

      // Call searchLogStream with the inverted time range
      await client.searchLogStream("test-stream", "pattern", startTime, endTime);

      // Verify the parameters were passed through as-is (AWS API will handle the validation)
      expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: "test-log-group",
        logStreamNames: ["test-stream"],
        filterPattern: "pattern",
        startTime: startTime,
        endTime: endTime,
      });
    });
  });

  describe("Special characters handling", () => {
    it("should handle special characters in log stream names", async () => {
      // Set up a log stream name with special characters
      const specialStreamName = "test/stream-with_special.characters:123";

      // Mock the response
      cloudWatchMock.on(GetLogEventsCommand).resolves({
        events: [{ timestamp: 1625097600000, message: "test message" }],
      });

      // Call getLogEvents with the special stream name
      await client.getLogEvents(specialStreamName);

      // Verify correct parameters were used
      expect(cloudWatchMock).toHaveReceivedCommandWith(GetLogEventsCommand, {
        logGroupName: "test-log-group",
        logStreamName: specialStreamName,
        startTime: undefined,
        endTime: undefined,
        limit: undefined,
      });
    });

    it("should handle special characters in search patterns", async () => {
      // Set up a search pattern with special characters
      const specialPattern = "error: *\\n[exception]";

      // Mock the response
      cloudWatchMock.on(FilterLogEventsCommand).resolves({
        events: [{ message: "test message" }],
      });

      // Call searchLogStream with the special pattern
      await client.searchLogStream("test-stream", specialPattern);

      // Verify correct parameters were used
      expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: "test-log-group",
        logStreamNames: ["test-stream"],
        filterPattern: specialPattern,
        startTime: undefined,
        endTime: undefined,
      });
    });
  });

  describe("Error message formatting", () => {
    it("should format error messages with non-Error objects", async () => {
      // Mock the FilterLogEventsCommand to reject with a non-Error object
      cloudWatchMock.on(FilterLogEventsCommand).rejects("String error");

      // Call searchLogStream and expect it to reject with a formatted error message
      await expect(client.searchLogStream("test-stream", "pattern")).rejects.toThrow(
        "Failed to search log stream: String error",
      );
    });

    it("should format error messages with Error objects", async () => {
      // Mock the GetLogEventsCommand to reject with an Error object
      const error = new Error("AWS service error");
      cloudWatchMock.on(GetLogEventsCommand).rejects(error);

      // Call getLogEvents and expect it to reject with a formatted error message
      await expect(client.getLogEvents("test-stream")).rejects.toThrow(
        "Failed to get log events from test-stream: AWS service error",
      );
    });

    it("should format error messages with complex error objects", async () => {
      // Create a complex error object with additional properties
      const complexError = new Error("Complex error");
      interface ExtendedError extends Error {
        code?: string;
        requestId?: string;
      }
      (complexError as ExtendedError).code = "AccessDenied";
      (complexError as ExtendedError).requestId = "1234567890";

      // Mock the DescribeLogGroupsCommand to reject with the complex error
      cloudWatchMock.on(DescribeLogGroupsCommand).rejects(complexError);

      // Call listLogStreams and expect it to reject with a formatted error message
      await expect(client.listLogStreams()).rejects.toThrow(
        "Failed to list log streams in group test-log-group: Complex error",
      );
    });
  });

  describe("Limit handling", () => {
    it("should handle large limit values for getLogEvents", async () => {
      // Set up a very large limit
      const largeLimit = 10000;

      // Mock the response
      cloudWatchMock.on(GetLogEventsCommand).resolves({
        events: [{ timestamp: 1625097600000, message: "test message" }],
      });

      // Call getLogEvents with the large limit
      await client.getLogEvents("test-stream", undefined, undefined, largeLimit);

      // Verify correct parameters were used
      expect(cloudWatchMock).toHaveReceivedCommandWith(GetLogEventsCommand, {
        logGroupName: "test-log-group",
        logStreamName: "test-stream",
        startTime: undefined,
        endTime: undefined,
        limit: largeLimit,
      });
    });

    it("should handle zero limit value for getLogEvents", async () => {
      // Set up a zero limit
      const zeroLimit = 0;

      // Mock the response
      cloudWatchMock.on(GetLogEventsCommand).resolves({
        events: [],
      });

      // Call getLogEvents with the zero limit
      await client.getLogEvents("test-stream", undefined, undefined, zeroLimit);

      // Verify correct parameters were used
      expect(cloudWatchMock).toHaveReceivedCommandWith(GetLogEventsCommand, {
        logGroupName: "test-log-group",
        logStreamName: "test-stream",
        startTime: undefined,
        endTime: undefined,
        limit: zeroLimit,
      });
    });
  });
});
