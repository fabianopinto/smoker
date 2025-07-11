/**
 * Unit tests for CloudWatch client implementation
 * Tests the CloudWatchClient functionality using aws-sdk-client-mock
 */
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudWatchClient } from "../../../src/clients/aws/cloudwatch";

// Create the mock client
const cloudWatchMock = mockClient(CloudWatchLogsClient);

describe("CloudWatchClient", () => {
  // With module augmentation, TypeScript should recognize the inheritance
  let client: CloudWatchClient;

  beforeEach(() => {
    // Reset all mocks before each test
    cloudWatchMock.reset();
    vi.clearAllMocks();

    // Setup fake timers for consistent timer control
    vi.useFakeTimers();

    // Create client without configuration initially
    client = new CloudWatchClient();
  });

  afterEach(async () => {
    try {
      await client.destroy();
    } catch {
      // Ignore errors during cleanup
    }
    vi.useRealTimers();
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("CloudWatchClient");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should not affect other instances", async () => {
      // Create two clients with different configurations
      const client1 = new CloudWatchClient("CloudWatchClient1", { logGroupName: "test-log-group" });
      await client1.init();
      const client2 = new CloudWatchClient("CloudWatchClient2", { logGroupName: "test-log-group" });
      await client2.init();

      expect(client1.isInitialized()).toBe(true);
      expect(client2.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      // Create client with configuration in constructor
      client = new CloudWatchClient("CloudWatchClient", { logGroupName: "test-log-group" });
      await client.init();
      expect(client.isInitialized()).toBe(true);

      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should throw an error if logGroupName is not provided", async () => {
      // Client without logGroupName should throw during init
      await expect(client.init()).rejects.toThrow("CloudWatch log group name is required");
    });

    it("should use default region when none provided", async () => {
      // Create client with minimal configuration
      client = new CloudWatchClient("CloudWatchClient", { logGroupName: "test-log-group" });
      await client.init();

      expect(client.isInitialized()).toBe(true);

      cloudWatchMock.on(DescribeLogGroupsCommand).resolves({
        logGroups: [{ logGroupName: "test-log-group" }],
      });

      const result = await client.listLogStreams();
      expect(result).toEqual(["test-log-group"]);
    });

    it("should use provided configuration", async () => {
      const config = {
        logGroupName: "test-log-group",
        region: "eu-west-1",
        accessKeyId: "test-key-id",
        secretAccessKey: "test-secret",
        endpoint: "http://localhost:4566",
      };

      // Create client with complete configuration in constructor
      client = new CloudWatchClient("CloudWatchClient", config);
      await client.init();

      expect(client.isInitialized()).toBe(true);

      cloudWatchMock.on(FilterLogEventsCommand).resolves({
        events: [{ message: "test message" }],
      });

      const result = await client.searchLogStream("test-stream", "pattern");
      expect(result).toEqual(["test message"]);

      expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: "test-log-group",
        logStreamNames: ["test-stream"],
        filterPattern: "pattern",
        startTime: undefined,
        endTime: undefined,
      });
    });
  });

  describe("CloudWatch operations", () => {
    beforeEach(async () => {
      // Create client with configuration in constructor
      client = new CloudWatchClient("CloudWatchClient", { logGroupName: "test-log-group" });
      await client.init();
    });

    describe("searchLogStream", () => {
      it("should call FilterLogEventsCommand with correct parameters", async () => {
        const logStreamName = "test-stream";
        const pattern = "error";
        const startTime = 1625097600000;
        const endTime = 1625097900000;

        cloudWatchMock.on(FilterLogEventsCommand).resolves({
          events: [{ message: "Error: Connection failed" }, { message: "Error: Database error" }],
        });

        const result = await client.searchLogStream(logStreamName, pattern, startTime, endTime);

        expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
          logGroupName: "test-log-group",
          logStreamNames: [logStreamName],
          filterPattern: pattern,
          startTime,
          endTime,
        });

        expect(result).toEqual(["Error: Connection failed", "Error: Database error"]);
      });

      it("should handle missing logStreamName parameter", async () => {
        cloudWatchMock.on(FilterLogEventsCommand).resolves({
          events: [{ message: "test message" }],
        });

        const result = await client.searchLogStream("", "test");

        expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
          logGroupName: "test-log-group",
          logStreamNames: undefined,
          filterPattern: "test",
          startTime: undefined,
          endTime: undefined,
        });

        expect(result).toEqual(["test message"]);
      });

      it("should return empty array when no events found", async () => {
        cloudWatchMock.on(FilterLogEventsCommand).resolves({
          events: [],
        });

        const result = await client.searchLogStream("test-stream", "test");

        expect(result).toEqual([]);
      });

      it("should return empty array when events is undefined", async () => {
        cloudWatchMock.on(FilterLogEventsCommand).resolves({
          // events field is missing
        });

        const result = await client.searchLogStream("test-stream", "test");

        expect(result).toEqual([]);
      });

      it("should handle null message values", async () => {
        cloudWatchMock.on(FilterLogEventsCommand).resolves({
          events: [{ message: undefined }, { message: "valid message" }],
        });

        const result = await client.searchLogStream("test-stream", "test");

        expect(result).toEqual(["", "valid message"]);
      });
    });

    describe("getLogEvents", () => {
      it("should call GetLogEventsCommand with correct parameters", async () => {
        const logStreamName = "test-stream";
        const startTime = 1625097600000;
        const endTime = 1625097900000;
        const limit = 100;

        cloudWatchMock.on(GetLogEventsCommand).resolves({
          events: [{ timestamp: 1625097620000, message: "test message" }],
        });

        const result = await client.getLogEvents(logStreamName, startTime, endTime, limit);

        expect(cloudWatchMock).toHaveReceivedCommandWith(GetLogEventsCommand, {
          logGroupName: "test-log-group",
          logStreamName,
          startTime,
          endTime,
          limit,
        });

        expect(result).toEqual([
          { timestamp: 1625097620000, message: "test message", logStreamName },
        ]);
      });

      it("should return empty array when no events found", async () => {
        cloudWatchMock.on(GetLogEventsCommand).resolves({
          events: [],
        });

        const result = await client.getLogEvents("test-stream");

        expect(result).toEqual([]);
      });

      it("should return empty array when events is undefined", async () => {
        cloudWatchMock.on(GetLogEventsCommand).resolves({
          // events field is missing
        });

        const result = await client.getLogEvents("test-stream");

        expect(result).toEqual([]);
      });

      it("should handle null timestamp and message values", async () => {
        cloudWatchMock.on(GetLogEventsCommand).resolves({
          events: [
            { timestamp: undefined, message: undefined },
            { timestamp: 1625097620000, message: "valid message" },
          ],
        });

        const result = await client.getLogEvents("test-stream");

        expect(result).toEqual([
          { timestamp: 0, message: "", logStreamName: "test-stream" },
          { timestamp: 1625097620000, message: "valid message", logStreamName: "test-stream" },
        ]);
      });
    });

    describe("listLogStreams", () => {
      beforeEach(() => {
        // Reset mock for each test in this block
        cloudWatchMock.reset();
      });

      it("should call DescribeLogGroupsCommand with correct parameters", async () => {
        cloudWatchMock.on(DescribeLogGroupsCommand).resolves({
          logGroups: [{ logGroupName: "test-log-group" }, { logGroupName: "another-log-group" }],
        });

        const result = await client.listLogStreams();

        expect(cloudWatchMock).toHaveReceivedCommandWith(DescribeLogGroupsCommand, {
          logGroupNamePrefix: "test-log-group",
        });

        expect(result).toEqual(["test-log-group", "another-log-group"]);
      });

      it("should return empty array when no log groups found", async () => {
        cloudWatchMock.on(DescribeLogGroupsCommand).resolves({
          logGroups: [],
        });

        const result = await client.listLogStreams();

        expect(result).toEqual([]);
      });

      it("should return empty array when logGroups is undefined", async () => {
        cloudWatchMock.on(DescribeLogGroupsCommand).resolves({
          // logGroups field is missing
        });

        const result = await client.listLogStreams();

        expect(result).toEqual([]);
      });

      it("should filter out log groups with null names", async () => {
        cloudWatchMock.on(DescribeLogGroupsCommand).resolves({
          logGroups: [
            { logGroupName: undefined },
            { logGroupName: "test-log-group" },
            { logGroupName: undefined },
          ],
        });

        const result = await client.listLogStreams();

        expect(result).toEqual(["test-log-group"]);
      });
    });
  });

  describe("Error handling", () => {
    beforeEach(async () => {
      cloudWatchMock.reset();
      cloudWatchMock.resolves({});
      client = new CloudWatchClient("CloudWatchClient", { logGroupName: "test-log-group" });
      await client.init();
    });

    it("should propagate AWS errors in searchLogStream", async () => {
      const error = new Error("AWS service error");

      cloudWatchMock.on(FilterLogEventsCommand).rejects(error);

      await expect(client.searchLogStream("test-stream", "pattern")).rejects.toThrow(
        "AWS service error",
      );
    });

    it("should propagate AWS errors in getLogEvents", async () => {
      const error = new Error("AWS service error");

      cloudWatchMock.on(GetLogEventsCommand).rejects(error);

      await expect(client.getLogEvents("test-stream")).rejects.toThrow("AWS service error");
    });

    it("should propagate AWS errors in listLogStreams", async () => {
      const error = new Error("AWS service error");

      cloudWatchMock.on(DescribeLogGroupsCommand).rejects(error);

      await expect(client.listLogStreams()).rejects.toThrow("AWS service error");
    });

    it("should throw if operations are called before initialization", async () => {
      const newClient = new CloudWatchClient();

      await expect(newClient.searchLogStream("test-stream", "pattern")).rejects.toThrow(
        "not initialized",
      );
      await expect(newClient.getLogEvents("test-stream")).rejects.toThrow("not initialized");
      await expect(newClient.listLogStreams()).rejects.toThrow("not initialized");
    });
  });

  describe("Edge cases", () => {
    it("should handle multiple client instances with different configurations", async () => {
      cloudWatchMock.reset();
      cloudWatchMock.resolves({});

      // Create first client with first log group
      const firstClient = new CloudWatchClient("CloudWatchClient1", {
        logGroupName: "first-group",
      });
      await firstClient.init();
      expect(firstClient.isInitialized()).toBe(true);

      cloudWatchMock.on(FilterLogEventsCommand).resolves({
        events: [{ message: "first message" }],
      });

      await firstClient.searchLogStream("", "pattern");
      expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: "first-group",
      });

      cloudWatchMock.reset();
      cloudWatchMock.on(FilterLogEventsCommand).resolves({
        events: [{ message: "second message" }],
      });

      // Create second client with second log group
      const secondClient = new CloudWatchClient("CloudWatchClient2", {
        logGroupName: "second-group",
      });
      await secondClient.init();
      expect(secondClient.isInitialized()).toBe(true);

      await secondClient.searchLogStream("test-stream", "pattern");
      expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: "second-group",
        logStreamNames: ["test-stream"],
        filterPattern: "pattern",
        startTime: undefined,
        endTime: undefined,
      });

      // Clean up
      await firstClient.destroy();
      await secondClient.destroy();
    });

    it("should handle empty pattern in searchLogStream", async () => {
      cloudWatchMock.reset();

      // Initialize client with configuration in constructor
      client = new CloudWatchClient("CloudWatchClient", { logGroupName: "test-log-group" });
      await client.init();

      // Mock the searchLogStream response
      cloudWatchMock.on(FilterLogEventsCommand).resolves({ events: [] });

      // Call searchLogStream with empty pattern
      await client.searchLogStream("test-stream", "");

      // Verify correct parameters were used
      expect(cloudWatchMock).toHaveReceivedCommandWith(FilterLogEventsCommand, {
        logGroupName: "test-log-group",
        logStreamNames: ["test-stream"],
        filterPattern: "",
        startTime: undefined,
        endTime: undefined,
      });
    });
  });
});
