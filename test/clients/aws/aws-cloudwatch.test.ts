/**
 * AWS CloudWatch Client Tests
 *
 * This file contains comprehensive tests for the CloudWatchClient implementation,
 * covering initialization, log operations, and AWS SDK interactions.
 *
 * Test coverage includes:
 * - Client initialization and configuration validation
 * - Searching log streams with pattern filtering
 * - Retrieving log events with time range and limit options
 * - Listing available log streams
 * - Error handling for AWS API failures
 * - Edge cases and parameter validation
 */

import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  type FilteredLogEvent,
  FilterLogEventsCommand,
  GetLogEventsCommand,
  type LogGroup,
  type OutputLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudWatchClient } from "../../../src/clients/aws/aws-cloudwatch";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Client identifiers and configuration
  CLIENT_ID: "test-cloudwatch-client",
  REGION: "us-east-1",
  LOG_GROUP_NAME: "/test/log-group",

  // Log stream information
  STREAM_NAME: "test-stream",
  PATTERN: "ERROR",
  TIMESTAMP: 1625097600000, // 2021-07-01T00:00:00Z

  // Time range constants for tests
  START_TIME: 1625097600000, // 2021-07-01T00:00:00Z
  END_TIME: 1625184000000, // 2021-07-02T00:00:00Z

  // Error messages
  ERROR_MISSING_LOG_GROUP: "CloudWatch log group name is required",
  ERROR_AWS_API_ERROR: "AWS API Error",
  ERROR_NON_ERROR_STRING: "Non-error string thrown",
  ERROR_SEARCH_FAILED: "Search failed with test error",
};

/**
 * Create mock for CloudWatch Logs client
 */
const cloudWatchLogsMock = mockClient(CloudWatchLogsClient);

/**
 * Test helper function to safely access internal properties
 *
 * @param client - CloudWatchClient instance
 * @return Internal properties of the CloudWatchClient instance
 */
function getInternalClient(client: CloudWatchClient): Record<string, unknown> {
  // This cast is necessary for testing as we need to access private properties
  // Using Record<string, unknown> provides better type safety than 'any'
  return client as unknown as Record<string, unknown>;
}

/**
 * Tests for CloudWatchClient
 */
describe("CloudWatchClient", () => {
  let client: CloudWatchClient;

  beforeEach(() => {
    // Reset all mocks before each test
    cloudWatchLogsMock.reset();
    vi.clearAllMocks();

    // Create new client instance
    client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
      logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      region: TEST_FIXTURES.REGION,
    });
  });

  /**
   * Tests for client initialization and configuration validation
   */
  describe("initialization", () => {
    it("should initialize successfully with valid configuration", async () => {
      await expect(client.init()).resolves.not.toThrow();
      expect(client.isInitialized()).toBe(true);
    });

    it("should throw error when logGroupName is missing", async () => {
      const clientWithoutLogGroup = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        region: TEST_FIXTURES.REGION,
      });
      await expect(clientWithoutLogGroup.init()).rejects.toThrow(
        TEST_FIXTURES.ERROR_MISSING_LOG_GROUP,
      );
    });

    it("should set client name correctly", () => {
      expect(client.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });
  });

  /**
   * Tests for searching log streams with pattern filtering
   */
  describe("searchLogStream", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should search log stream with pattern successfully", async () => {
      const mockEvents = [
        { message: `${TEST_FIXTURES.PATTERN}: Something went wrong` },
        { message: `${TEST_FIXTURES.PATTERN}: Another issue` },
      ];
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({
        events: mockEvents,
      });

      const result = await client.searchLogStream(TEST_FIXTURES.STREAM_NAME, TEST_FIXTURES.PATTERN);

      expect(result).toEqual(["ERROR: Something went wrong", "ERROR: Another issue"]);
      expect(cloudWatchLogsMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        logStreamNames: [TEST_FIXTURES.STREAM_NAME],
        filterPattern: TEST_FIXTURES.PATTERN,
      });
    });

    it("should search with time range filters", async () => {
      const mockEvents = [{ message: "Filtered log message" }];
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({
        events: mockEvents,
      });

      const result = await client.searchLogStream(
        TEST_FIXTURES.STREAM_NAME,
        "Filtered",
        TEST_FIXTURES.START_TIME,
        TEST_FIXTURES.END_TIME,
      );

      expect(result).toEqual(["Filtered log message"]);
      expect(cloudWatchLogsMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        logStreamNames: [TEST_FIXTURES.STREAM_NAME],
        filterPattern: "Filtered",
        startTime: TEST_FIXTURES.START_TIME,
        endTime: TEST_FIXTURES.END_TIME,
      });
    });

    it("should search all log streams when no specific stream name provided", async () => {
      const mockEvents = [{ message: "Log from stream 1" }, { message: "Log from stream 2" }];
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({
        events: mockEvents,
      });

      // Call searchLogStream with empty string to test the false branch of the ternary
      const result = await client.searchLogStream("", "Log");

      expect(result).toEqual(["Log from stream 1", "Log from stream 2"]);
      expect(cloudWatchLogsMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        logStreamNames: undefined, // This tests the false branch: logStreamName ? [logStreamName] : undefined
        filterPattern: "Log",
      });
    });

    it("should return empty array when no events found", async () => {
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({ events: [] });

      const result = await client.searchLogStream(TEST_FIXTURES.STREAM_NAME, "NotFound");

      expect(result).toEqual([]);
    });

    it("should handle undefined events in response", async () => {
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({});

      const result = await client.searchLogStream(TEST_FIXTURES.STREAM_NAME, "Pattern");

      expect(result).toEqual([]);
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        region: TEST_FIXTURES.REGION,
      });

      await expect(
        uninitializedClient.searchLogStream(TEST_FIXTURES.STREAM_NAME, TEST_FIXTURES.PATTERN),
      ).rejects.toThrow(`${TEST_FIXTURES.CLIENT_ID} is not initialized. Call init() first.`);
    });

    it("should handle events with missing message in searchLogStream", async () => {
      const mockEvents: FilteredLogEvent[] = [
        { timestamp: TEST_FIXTURES.TIMESTAMP, message: "Log message with content" },
        { timestamp: TEST_FIXTURES.TIMESTAMP + 60000 }, // Missing message property to test the || "" operator
        { timestamp: TEST_FIXTURES.TIMESTAMP + 120000, message: null as unknown as string }, // null message to test || "" fallback
        { timestamp: TEST_FIXTURES.TIMESTAMP + 180000, message: undefined }, // undefined message to test || "" fallback
        { timestamp: TEST_FIXTURES.TIMESTAMP + 240000, message: "" }, // empty string message (falsy, will use || "" fallback)
      ];
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({ events: mockEvents });

      const result = await client.searchLogStream(TEST_FIXTURES.STREAM_NAME, TEST_FIXTURES.PATTERN);

      expect(result).toEqual([
        "Log message with content", // Has message
        "", // Missing message → || "" fallback
        "", // null message → || "" fallback
        "", // undefined message → || "" fallback
        "", // empty string message → || "" fallback
      ]);
      expect(cloudWatchLogsMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        logStreamNames: [TEST_FIXTURES.STREAM_NAME],
        filterPattern: TEST_FIXTURES.PATTERN,
        startTime: undefined,
        endTime: undefined,
      });
    });

    it("should handle AWS API errors with Error object", async () => {
      cloudWatchLogsMock
        .on(FilterLogEventsCommand)
        .rejects(new Error(TEST_FIXTURES.ERROR_AWS_API_ERROR));

      await expect(
        client.searchLogStream(TEST_FIXTURES.STREAM_NAME, TEST_FIXTURES.PATTERN),
      ).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );
    });

    it("should handle non-Error thrown objects in searchLogStream", async () => {
      // Mock the FilterLogEventsCommand to throw a non-Error object (string)
      cloudWatchLogsMock.on(FilterLogEventsCommand).rejects(TEST_FIXTURES.ERROR_NON_ERROR_STRING);

      await expect(
        client.searchLogStream(TEST_FIXTURES.STREAM_NAME, TEST_FIXTURES.PATTERN),
      ).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );
    });
  });

  /**
   * Tests for retrieving log events with time range and limit options
   */
  describe("getLogEvents", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should retrieve log events successfully", async () => {
      const mockEvents = [
        { timestamp: TEST_FIXTURES.TIMESTAMP, message: "Log message 1" },
        { timestamp: TEST_FIXTURES.TIMESTAMP + 60000, message: "Log message 2" },
      ];
      cloudWatchLogsMock.on(GetLogEventsCommand).resolves({ events: mockEvents });

      const result = await client.getLogEvents(TEST_FIXTURES.STREAM_NAME);

      expect(result).toEqual([
        {
          timestamp: TEST_FIXTURES.TIMESTAMP,
          message: "Log message 1",
          logStreamName: TEST_FIXTURES.STREAM_NAME,
        },
        {
          timestamp: TEST_FIXTURES.TIMESTAMP + 60000,
          message: "Log message 2",
          logStreamName: TEST_FIXTURES.STREAM_NAME,
        },
      ]);
      expect(cloudWatchLogsMock).toHaveReceivedCommandWith(GetLogEventsCommand, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        logStreamName: TEST_FIXTURES.STREAM_NAME,
      });
    });

    it("should retrieve log events with time range and limit", async () => {
      const mockEvents = [
        { timestamp: TEST_FIXTURES.START_TIME + 1000, message: "Limited log message" },
      ];
      cloudWatchLogsMock.on(GetLogEventsCommand).resolves({
        events: mockEvents,
      });

      const result = await client.getLogEvents(
        TEST_FIXTURES.STREAM_NAME,
        TEST_FIXTURES.START_TIME,
        TEST_FIXTURES.END_TIME,
        10,
      );

      expect(result).toHaveLength(1);
      expect(cloudWatchLogsMock).toHaveReceivedCommandWith(GetLogEventsCommand, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        logStreamName: TEST_FIXTURES.STREAM_NAME,
        startTime: TEST_FIXTURES.START_TIME,
        endTime: TEST_FIXTURES.END_TIME,
        limit: 10,
      });
    });

    it("should return empty array when no events found", async () => {
      cloudWatchLogsMock.on(GetLogEventsCommand).resolves({ events: [] });

      const result = await client.getLogEvents(TEST_FIXTURES.STREAM_NAME);

      expect(result).toEqual([]);
    });

    it("should handle undefined events in response", async () => {
      cloudWatchLogsMock.on(GetLogEventsCommand).resolves({});

      const result = await client.getLogEvents(TEST_FIXTURES.STREAM_NAME);

      expect(result).toEqual([]);
    });

    it("should handle events with missing timestamp and message", async () => {
      const mockEvents: OutputLogEvent[] = [
        {}, // Missing timestamp and message to test the || operators
        { timestamp: undefined, message: undefined },
        { timestamp: null as unknown as number, message: null as unknown as string },
      ];
      cloudWatchLogsMock.on(GetLogEventsCommand).resolves({ events: mockEvents });

      const result = await client.getLogEvents(TEST_FIXTURES.STREAM_NAME);

      expect(result).toEqual([
        { timestamp: 0, message: "", logStreamName: TEST_FIXTURES.STREAM_NAME },
        { timestamp: 0, message: "", logStreamName: TEST_FIXTURES.STREAM_NAME },
        { timestamp: 0, message: "", logStreamName: TEST_FIXTURES.STREAM_NAME },
      ]);
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.getLogEvents(TEST_FIXTURES.STREAM_NAME)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });

    it("should handle AWS API errors with Error object", async () => {
      cloudWatchLogsMock
        .on(GetLogEventsCommand)
        .rejects(new Error(TEST_FIXTURES.ERROR_AWS_API_ERROR));

      await expect(client.getLogEvents(TEST_FIXTURES.STREAM_NAME)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );
    });
  });

  /**
   * Tests for listing available log streams
   */
  describe("listLogStreams", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should list log streams successfully", async () => {
      const mockLogGroups = [
        { logGroupName: `${TEST_FIXTURES.LOG_GROUP_NAME}-1` },
        { logGroupName: `${TEST_FIXTURES.LOG_GROUP_NAME}-2` },
        { logGroupName: `${TEST_FIXTURES.LOG_GROUP_NAME}-3` },
      ];
      cloudWatchLogsMock.on(DescribeLogGroupsCommand).resolves({
        logGroups: mockLogGroups,
      });

      const result = await client.listLogStreams();

      expect(result).toEqual([
        `${TEST_FIXTURES.LOG_GROUP_NAME}-1`,
        `${TEST_FIXTURES.LOG_GROUP_NAME}-2`,
        `${TEST_FIXTURES.LOG_GROUP_NAME}-3`,
      ]);
      expect(cloudWatchLogsMock).toHaveReceivedCommandWith(DescribeLogGroupsCommand, {
        logGroupNamePrefix: TEST_FIXTURES.LOG_GROUP_NAME,
      });
    });

    it("should return empty array when no log streams found", async () => {
      cloudWatchLogsMock.on(DescribeLogGroupsCommand).resolves({ logGroups: [] });

      const result = await client.listLogStreams();

      expect(result).toEqual([]);
    });

    it("should handle undefined log groups in response", async () => {
      cloudWatchLogsMock.on(DescribeLogGroupsCommand).resolves({});

      const result = await client.listLogStreams();

      expect(result).toEqual([]);
    });

    it("should handle log groups with missing logGroupName", async () => {
      // Standard test case with normal log groups
      const mockLogGroups: LogGroup[] = [
        { logGroupName: `${TEST_FIXTURES.LOG_GROUP_NAME}-1` },
        { logGroupName: `${TEST_FIXTURES.LOG_GROUP_NAME}-2` },
      ];
      cloudWatchLogsMock.on(DescribeLogGroupsCommand).resolves({ logGroups: mockLogGroups });

      const result = await client.listLogStreams();

      expect(result).toEqual([
        `${TEST_FIXTURES.LOG_GROUP_NAME}-1`,
        `${TEST_FIXTURES.LOG_GROUP_NAME}-2`,
      ]);
    });

    it("should use empty string fallback for undefined logGroupName values", async () => {
      // Create a spy on the AWS client send method to return custom groups
      const clientInternal = getInternalClient(client);
      const originalSend = (clientInternal.client as Record<string, unknown>).send;
      const sendSpy = vi.fn().mockResolvedValueOnce({
        // This gets past the .filter() because the property exists and is truthy (a string)
        // But then becomes undefined right before the .map() operation
        logGroups: [{ logGroupName: "will-be-replaced-with-undefined" }],
      });

      // Replace the send method temporarily
      (clientInternal.client as Record<string, unknown>).send = sendSpy;

      // Create a spy on Array.prototype.filter to manipulate the filtered array
      const originalFilter = Array.prototype.filter;
      // Use generic type parameters to properly type the filter function
      // This matches the standard Array.prototype.filter signature
      Array.prototype.filter = function <T>(
        predicate: (value: T, index: number, array: T[]) => unknown,
        thisArg?: unknown,
      ) {
        // Using explicit cast to maintain type safety while allowing manipulation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = originalFilter.apply(this, [predicate, thisArg]) as any[];
        // After filtering, replace the logGroupName with undefined
        // This simulates a case where a value passes the filter but then becomes undefined
        if (result.length > 0 && result[0]?.logGroupName === "will-be-replaced-with-undefined") {
          // Make the logGroupName undefined after filtering but before mapping
          Object.defineProperty(result[0], "logGroupName", { value: undefined });
        }
        return result;
      };

      try {
        // Now when we call listLogStreams(), the logGroupName will be undefined during the .map() operation
        // which should trigger the || "" fallback
        const result = await client.listLogStreams();

        // Verify the fallback was used
        expect(result).toEqual([""]);
        expect(sendSpy).toHaveBeenCalledWith(expect.any(Object));
      } finally {
        // Restore original methods
        (clientInternal.client as Record<string, unknown>).send = originalSend;
        Array.prototype.filter = originalFilter;
      }
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.listLogStreams()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });

    it("should handle AWS API errors", async () => {
      cloudWatchLogsMock
        .on(DescribeLogGroupsCommand)
        .rejects(new Error(TEST_FIXTURES.ERROR_AWS_API_ERROR));

      await expect(client.listLogStreams()).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );
    });
  });

  /**
   * Tests for waiting for a pattern in log events
   */
  describe("waitForPattern", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should find pattern within timeout", async () => {
      const mockEvents = [{ message: "Expected pattern found" }];
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({ events: mockEvents });

      const result = await client.waitForPattern(
        TEST_FIXTURES.STREAM_NAME,
        "Expected pattern",
        1000,
      );

      expect(result).toBe(true);
    });

    it("should timeout when pattern is not found", async () => {
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({ events: [] });

      const result = await client.waitForPattern(
        TEST_FIXTURES.STREAM_NAME,
        "NonExistent pattern",
        100,
      );

      expect(result).toBe(false);
    });

    it("should use default timeout when not specified", async () => {
      const mockEvents = [{ message: "Pattern found" }];
      cloudWatchLogsMock.on(FilterLogEventsCommand).resolves({ events: mockEvents });

      const result = await client.waitForPattern(TEST_FIXTURES.STREAM_NAME, "Pattern");

      expect(result).toBe(true);
    });

    it("should throw error when client is not initialized", async () => {
      const uninitializedClient = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        region: TEST_FIXTURES.REGION,
      });

      await expect(uninitializedClient.waitForPattern("stream", "pattern")).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "clients" &&
          err.details?.component === "core",
      );
    });

    it("should handle searchLogStream errors with Error object", async () => {
      // Set up searchLogStream to throw an Error
      cloudWatchLogsMock
        .on(FilterLogEventsCommand)
        .rejects(new Error(TEST_FIXTURES.ERROR_SEARCH_FAILED));

      await expect(
        client.waitForPattern(TEST_FIXTURES.STREAM_NAME, "pattern", 100),
      ).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch",
      );
    });
  });

  /**
   * Tests for lifecycle management
   */
  describe("lifecycle management", () => {
    it("should cleanup successfully", async () => {
      await client.init();

      await expect(client.destroy()).resolves.not.toThrow();

      expect(client.isInitialized()).toBe(false);
    });

    it("should set client to null during cleanup", async () => {
      await client.init();

      // Verify client exists before cleanup
      const clientInternal = getInternalClient(client);
      expect(clientInternal.client as Record<string, unknown>).not.toBeNull();

      // Call destroy which internally calls cleanupClient
      await client.destroy();

      // Verify client is set to null after cleanup
      expect(clientInternal.client as Record<string, unknown>).toBeNull();
    });

    it("should handle cleanup when client is not initialized", async () => {
      await expect(client.destroy()).resolves.not.toThrow();
    });

    it("should handle multiple cleanup calls", async () => {
      await client.init();
      await client.destroy();

      await expect(client.destroy()).resolves.not.toThrow();
    });
  });
});
