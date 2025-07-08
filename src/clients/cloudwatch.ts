/**
 * CloudWatch client for AWS CloudWatch operations
 */
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { BaseServiceClient, type ServiceClient } from "./clients";

/**
 * Interface for CloudWatch log event
 */
export interface CloudWatchLogEvent {
  timestamp: number;
  message: string;
  logStreamName: string;
}

/**
 * Interface for CloudWatch service client
 */
export interface CloudWatchServiceClient extends ServiceClient {
  searchLogStream(
    logStreamName: string,
    pattern: string,
    startTime?: number,
    endTime?: number,
  ): Promise<string[]>;
  getLogEvents(
    logStreamName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Promise<CloudWatchLogEvent[]>;
  listLogStreams(): Promise<string[]>;
}

/**
 * CloudWatch client implementation for AWS CloudWatch operations
 */
export class CloudWatchClient extends BaseServiceClient implements CloudWatchServiceClient {
  private client: CloudWatchLogsClient | null = null;
  private logGroupName = "";

  /**
   * Create a new CloudWatch client
   */
  constructor() {
    super("CloudWatchClient");
  }

  /**
   * Client-specific destroy logic
   */
  protected async destroyClient(): Promise<void> {
    this.client = null;
  }

  /**
   * Initialize the client
   */
  protected async initializeClient(): Promise<void> {
    const region = this.getConfig<string>("region", "us-east-1");
    this.logGroupName = this.getConfig<string>("logGroupName", "");

    if (!this.logGroupName) {
      throw new Error("CloudWatch log group name is required");
    }

    this.client = new CloudWatchLogsClient({
      region,
      credentials: {
        accessKeyId: this.getConfig<string>("accessKeyId", ""),
        secretAccessKey: this.getConfig<string>("secretAccessKey", ""),
      },
      endpoint: this.getConfig<string>("endpoint", "") || undefined,
    });
  }

  /**
   * Search logs for a specific string
   * @param logStreamName The log stream name
   * @param pattern The search term
   * @param startTime Start time in milliseconds since epoch
   * @param endTime End time in milliseconds since epoch
   * @returns Array of log events
   */
  async searchLogStream(
    logStreamName: string,
    pattern: string,
    startTime?: number,
    endTime?: number,
  ): Promise<string[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

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
  }

  /**
   * Get log events from a specific log stream
   * @param logStreamName The log stream name
   * @param startTime Start time in milliseconds since epoch
   * @param endTime End time in milliseconds since epoch
   * @param limit Maximum number of events to return
   * @returns Array of log events
   */
  async getLogEvents(
    logStreamName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Promise<CloudWatchLogEvent[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

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
  }

  /**
   * List log streams in the log group
   * @returns Array of log stream names
   */
  async listLogStreams(): Promise<string[]> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

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
  }

  /**
   * Wait for a pattern to appear in the logs
   * @param logGroupName The name of the log group
   * @param pattern The pattern to search for
   * @param timeoutMs Timeout in milliseconds (default: 30000)
   * @returns True if pattern was found within timeout, false otherwise
   */
  async waitForPattern(logGroupName: string, pattern: string, timeoutMs = 30000): Promise<boolean> {
    this.ensureInitialized();

    const startTime = Date.now();
    const endTime = startTime + timeoutMs;

    // Poll for pattern until timeout
    while (Date.now() < endTime) {
      const results = await this.searchLogStream(logGroupName, pattern, startTime, Date.now());

      if (results.length > 0) {
        return true;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return false;
  }
}
