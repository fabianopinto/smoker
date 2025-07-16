/**
 * CloudWatch client for AWS CloudWatch Logs operations
 *
 * Provides functionality to search and retrieve logs from CloudWatch Logs
 * and wait for specific patterns to appear in log streams.
 */
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { BaseServiceClient, type ServiceClient } from "../core";

/**
 * Interface for CloudWatch log event
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
 * Defines the contract for CloudWatch Logs clients with methods
 * to search logs, retrieve log events, and list log streams.
 */
export interface CloudWatchServiceClient extends ServiceClient {
  /**
   * Search logs for a specific pattern
   *
   * @param logStreamName - Optional specific log stream to search within
   * @param pattern - The search pattern/term to find
   * @param startTime - Optional start time in milliseconds since epoch
   * @param endTime - Optional end time in milliseconds since epoch
   * @returns Array of matching log messages
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
   * @param logStreamName - The name of the log stream to query
   * @param startTime - Optional start time in milliseconds since epoch
   * @param endTime - Optional end time in milliseconds since epoch
   * @param limit - Optional maximum number of events to return
   * @returns Array of log events with timestamp, message, and stream name
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
   * @returns Array of log stream names
   */
  listLogStreams(): Promise<string[]>;

  /**
   * Wait for a specific pattern to appear in logs
   *
   * @param logStreamName - Optional specific log stream to monitor
   * @param pattern - The pattern to search for
   * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
   * @returns True if pattern was found within timeout, false otherwise
   */
  waitForPattern(logStreamName: string, pattern: string, timeoutMs?: number): Promise<boolean>;
}

/**
 * CloudWatch client implementation for AWS CloudWatch operations
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
   * @throws Error if logGroupName is not provided in configuration
   */
  protected async initializeClient(): Promise<void> {
    const region = this.getConfig<string>("region", "us-east-1");
    this.logGroupName = this.getConfig<string>("logGroupName", "");

    if (!this.logGroupName) {
      throw new Error(`CloudWatch log group name is required`);
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
      throw new Error(
        `Failed to initialize CloudWatch client: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Search logs for a specific pattern
   *
   * @param logStreamName - Optional specific log stream to search within
   * @param pattern - The search pattern/term to find
   * @param startTime - Optional start time in milliseconds since epoch
   * @param endTime - Optional end time in milliseconds since epoch
   * @returns Array of matching log messages
   * @throws Error if client is not initialized or if AWS API call fails
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
      throw new Error(
        `Failed to search log stream: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retrieve log events from a specific log stream
   *
   * @param logStreamName - The name of the log stream to query
   * @param startTime - Optional start time in milliseconds since epoch
   * @param endTime - Optional end time in milliseconds since epoch
   * @param limit - Optional maximum number of events to return
   * @returns Array of log events with timestamp, message, and stream name
   * @throws Error if client is not initialized or if AWS API call fails
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
      throw new Error(
        `Failed to get log events from ${logStreamName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List log streams in the configured log group
   *
   * @returns Array of log stream names
   * @throws Error if client is not initialized or if AWS API call fails
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
      throw new Error(
        `Failed to list log streams in group ${this.logGroupName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Wait for a specific pattern to appear in logs
   * Polls the logs periodically until the pattern is found or timeout is reached
   *
   * @param logStreamName - Optional specific log stream to monitor
   * @param pattern - The pattern to search for
   * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
   * @returns True if pattern was found within timeout, false otherwise
   * @throws Error if client is not initialized or if search fails
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
      throw new Error(
        `Error while waiting for pattern in logs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
