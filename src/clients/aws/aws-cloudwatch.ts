/**
 * CloudWatch Client Module
 *
 * This module provides interfaces and implementations for AWS CloudWatch Logs service clients.
 * It defines the contract for CloudWatch operations such as searching logs, retrieving log events,
 * and listing log streams. The implementation uses the AWS SDK to interact with CloudWatch Logs.
 *
 * The module includes functionality to search and retrieve logs from CloudWatch Logs
 * and wait for specific patterns to appear in log streams, which is particularly useful
 * for monitoring and verifying log output during tests.
 */

import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { ERR_VALIDATION, SmokerError } from "../../errors";
import { BaseServiceClient, type ServiceClient } from "../core";

/**
 * Interface for CloudWatch log event
 *
 * Represents a log event retrieved from CloudWatch Logs. Contains the timestamp,
 * message content, and the name of the log stream that contains the event.
 *
 * This interface is used to provide a consistent structure for log events
 * returned by CloudWatch Logs API calls, making it easier to process and
 * display log data in applications.
 *
 * @property timestamp - Timestamp of the log event in milliseconds since epoch
 * @property message - The log message content
 * @property logStreamName - The name of the log stream containing this event
 */
export interface CloudWatchLogEvent {
  timestamp: number;
  message: string;
  logStreamName: string;
}

/**
 * Interface for CloudWatch service client
 *
 * Defines the contract for CloudWatch Logs clients with methods to search logs,
 * retrieve log events, list log streams, and wait for specific patterns to appear.
 * Extends the base ServiceClient interface to ensure consistent lifecycle management.
 *
 * This interface provides a comprehensive API for interacting with AWS CloudWatch
 * Logs, including pattern-based log searching with time range filtering, event
 * retrieval with pagination, and utilities for monitoring logs for specific patterns.
 * Implementations handle the details of AWS SDK interactions while providing a
 * simplified and consistent API.
 *
 * @extends {ServiceClient}
 * @see {ServiceClient} The base service client interface
 */
export interface CloudWatchServiceClient extends ServiceClient {
  /**
   * Search logs for a specific pattern
   *
   * Searches a specific log stream for log messages matching the given pattern.
   * Optionally filters results by time range if start and end times are provided.
   *
   * @param logStreamName - The specific log stream to search within
   * @param pattern - The search pattern/term to find
   * @param startTime - Optional start time in milliseconds since epoch
   * @param endTime - Optional end time in milliseconds since epoch
   * @return Promise resolving to an array of matching log messages
   * @throws {SmokerError} if the log stream doesn't exist or search fails
   *
   * @example
   * // Search for error messages in the last hour
   * const now = Date.now();
   * const oneHourAgo = now - (60 * 60 * 1000);
   * const errorLogs = await cloudWatchClient.searchLogStream(
   *   "application-logs",
   *   "ERROR",
   *   oneHourAgo,
   *   now
   * );
   */
  searchLogStream(
    logStreamName: string,
    pattern: string,
    startTime?: number,
    endTime?: number,
  ): Promise<string[]>;

  /**
   * Retrieve log events from a specific log stream
   *
   * Gets log events from the specified log stream, optionally filtered by time range
   * and limited to a maximum number of events. Each event includes a timestamp,
   * message content, and the name of the log stream.
   *
   * @param logStreamName - The name of the log stream to query
   * @param startTime - Optional start time in milliseconds since epoch
   * @param endTime - Optional end time in milliseconds since epoch
   * @param limit - Optional maximum number of events to return
   * @return Promise resolving to an array of log events
   * @throws {SmokerError} if the log stream doesn't exist or retrieval fails
   *
   * @example
   * // Get the most recent 10 log events
   * const events = await cloudWatchClient.getLogEvents(
   *   "application-logs",
   *   undefined,
   *   undefined,
   *   10
   * );
   *
   * // Process each log event
   * events.forEach(event => {
   *   console.log(`[${new Date(event.timestamp)}] ${event.message}`);
   * });
   */
  getLogEvents(
    logStreamName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Promise<CloudWatchLogEvent[]>;

  /**
   * List all log streams in the configured log group
   *
   * @return Array of log stream names
   */
  listLogStreams(): Promise<string[]>;

  /**
   * Wait for a specific pattern to appear in logs
   *
   * @param logStreamName - Optional specific log stream to monitor
   * @param pattern - The pattern to search for
   * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
   * @return True if pattern was found within timeout, false otherwise
   */
  waitForPattern(logStreamName: string, pattern: string, timeoutMs?: number): Promise<boolean>;
}

/**
 * CloudWatch client implementation for AWS CloudWatch Logs operations
 *
 * This class provides methods to interact with AWS CloudWatch Logs services,
 * including searching logs, retrieving log events, and monitoring log streams.
 * It implements the CloudWatchServiceClient interface and extends BaseServiceClient
 * for consistent lifecycle management.
 *
 * The client handles AWS SDK initialization, authentication, and provides a simplified
 * API for common CloudWatch Logs operations. It supports features like pattern-based
 * log searching, log stream listing, and waiting for specific log patterns with
 * configurable timeouts.
 *
 * @implements {CloudWatchServiceClient}
 * @extends {BaseServiceClient}
 */
export class CloudWatchClient extends BaseServiceClient implements CloudWatchServiceClient {
  private client: CloudWatchLogsClient | null = null;
  private logGroupName = "";

  /**
   * Create a new CloudWatch client
   *
   * @param clientId - Client identifier (defaults to "CloudWatchClient")
   * @param config - Optional client configuration with properties:
   *   - logGroupName: (required) Name of the CloudWatch log group to use
   *   - region: AWS region (default: "us-east-1")
   *   - accessKeyId: AWS access key ID
   *   - secretAccessKey: AWS secret access key
   *   - endpoint: Optional custom endpoint for local development
   */
  constructor(clientId = "CloudWatchClient", config?: Record<string, unknown>) {
    super(clientId, config);
  }

  /**
   * Client-specific cleanup logic
   * Releases the AWS CloudWatch client resources
   */
  async cleanupClient(): Promise<void> {
    this.client = null;
  }

  /**
   * Initialize the client with AWS CloudWatch Logs SDK
   *
   * @throws {SmokerError} if logGroupName is not provided in configuration
   */
  protected async initializeClient(): Promise<void> {
    const region = this.getConfig<string>("region", "us-east-1");
    this.logGroupName = this.getConfig<string>("logGroupName", "");

    if (!this.logGroupName) {
      throw new SmokerError("CloudWatch log group name is required", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: { component: "cloudwatch" },
        retryable: false,
      });
    }

    try {
      this.client = new CloudWatchLogsClient({
        region,
        credentials: {
          accessKeyId: this.getConfig<string>("accessKeyId", ""),
          secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
        },
        endpoint: this.getConfig<string>("endpoint", "") || undefined,
      });
    } catch (error) {
      throw new SmokerError("Failed to initialize CloudWatch client", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: {
          component: "cloudwatch",
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Search logs for a specific pattern
   *
   * @param logStreamName - Optional specific log stream to search within
   * @param pattern - The search pattern/term to find
   * @param startTime - Optional start time in milliseconds since epoch
   * @param endTime - Optional end time in milliseconds since epoch
   * @return Array of matching log messages
   * @throws {SmokerError} if client is not initialized or if AWS API call fails
   */
  async searchLogStream(
    logStreamName: string,
    pattern: string,
    startTime?: number,
    endTime?: number,
  ): Promise<string[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    try {
      const command = new FilterLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamNames: logStreamName ? [logStreamName] : undefined,
        filterPattern: pattern,
        startTime,
        endTime,
      });

      const response = await this.client.send(command);

      if (!response.events || response.events.length === 0) {
        return [];
      }

      return response.events.map((event) => event.message || "");
    } catch (error) {
      throw new SmokerError("Failed to search CloudWatch log stream", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: {
          component: "cloudwatch",
          logGroupName: this.logGroupName,
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Retrieve log events from a specific log stream
   *
   * @param logStreamName - The name of the log stream to query
   * @param startTime - Optional start time in milliseconds since epoch
   * @param endTime - Optional end time in milliseconds since epoch
   * @param limit - Optional maximum number of events to return
   * @return Array of log events with timestamp, message, and stream name
   * @throws {SmokerError} if client is not initialized or if AWS API call fails
   */
  async getLogEvents(
    logStreamName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Promise<CloudWatchLogEvent[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    try {
      const command = new GetLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamName,
        startTime,
        endTime,
        limit,
      });

      const response = await this.client.send(command);

      if (!response.events || response.events.length === 0) {
        return [];
      }

      return response.events.map((event) => ({
        timestamp: event.timestamp || 0,
        message: event.message || "",
        logStreamName,
      }));
    } catch (error) {
      throw new SmokerError("Failed to get CloudWatch log events", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: {
          component: "cloudwatch",
          logGroupName: this.logGroupName,
          logStreamName,
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * List log streams in the configured log group
   *
   * @return Array of log stream names
   * @throws {SmokerError} if client is not initialized or if AWS API call fails
   */
  async listLogStreams(): Promise<string[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    try {
      const command = new DescribeLogGroupsCommand({
        logGroupNamePrefix: this.logGroupName,
      });

      const response = await this.client.send(command);

      if (!response.logGroups || response.logGroups.length === 0) {
        return [];
      }

      // Return the log group names that match our log group
      return response.logGroups
        .filter((group) => group.logGroupName)
        .map((group) => group.logGroupName || "");
    } catch (error) {
      throw new SmokerError("Failed to list CloudWatch log streams", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: {
          component: "cloudwatch",
          logGroupName: this.logGroupName,
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Wait for a specific pattern to appear in logs
   * Polls the logs periodically until the pattern is found or timeout is reached
   *
   * @param logStreamName - Optional specific log stream to monitor
   * @param pattern - The pattern to search for
   * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
   * @return True if pattern was found within timeout, false otherwise
   * @throws {SmokerError} if client is not initialized or if search fails
   */
  async waitForPattern(
    logStreamName: string,
    pattern: string,
    timeoutMs = 30000,
  ): Promise<boolean> {
    this.ensureInitialized();

    const startTime = Date.now();
    const endTime = startTime + timeoutMs;
    const pollInterval = 2000; // 2 seconds between polls

    try {
      // Poll for pattern until timeout
      while (Date.now() < endTime) {
        const results = await this.searchLogStream(logStreamName, pattern, startTime, Date.now());

        if (results.length > 0) {
          return true;
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      // Pattern not found within timeout
      return false;
    } catch (error) {
      throw new SmokerError("Failed while waiting for pattern in CloudWatch logs", {
        code: ERR_VALIDATION,
        domain: "aws",
        details: {
          component: "cloudwatch",
          logGroupName: this.logGroupName,
          reason: error instanceof Error ? error.message : String(error),
        },
        retryable: true,
        cause: error,
      });
    }
  }
}
