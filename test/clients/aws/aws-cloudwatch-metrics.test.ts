/**
 * @fileoverview CloudWatch Metrics Tests
 *
 * Tests cover:
 * - publishMetric: sends correct PutMetricData with default and custom namespace
 * - publishMetrics: batches into chunks of 20 and sends multiple commands
 * - toAwsMetric: converts Dimensions and Unit correctly
 * - Error handling for failed PutMetricData calls
 */

import {
  CloudWatchClient as AwsCloudWatchMetricsClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { CloudWatchClient } from "../../../src/clients/aws/aws-cloudwatch";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";

const METRICS_MOCK = mockClient(AwsCloudWatchMetricsClient);

const TEST_FIXTURES = {
  CLIENT_ID: "cloudwatch-metrics-client",
  REGION: "us-east-1",
  LOG_GROUP_NAME: "/dummy/log-group", // required for client init
  DEFAULT_NS: "Smoker/Generic",
  CUSTOM_NS: "Smoker/CustomNS",
} as const;

describe("CloudWatch metrics", () => {
  let client: CloudWatchClient;

  beforeEach(() => {
    METRICS_MOCK.reset();
    client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
      logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
      region: TEST_FIXTURES.REGION,
    });
  });

  describe("publishMetric", () => {
    it("should publish a single metric with default namespace", async () => {
      await client.init();

      METRICS_MOCK.on(PutMetricDataCommand).resolves({});

      await expect(
        client.publishMetric({
          MetricName: "UserLogin",
          Value: 1,
          Dimensions: [
            { Name: "Environment", Value: "test" },
            { Name: "Service", Value: "api" },
          ],
          Unit: "Count",
        }),
      ).resolves.not.toThrow();

      expect(METRICS_MOCK).toHaveReceivedCommandWith(PutMetricDataCommand, {
        Namespace: TEST_FIXTURES.DEFAULT_NS,
        MetricData: [
          {
            MetricName: "UserLogin",
            Value: 1,
            Unit: "Count",
            Dimensions: [
              { Name: "Environment", Value: "test" },
              { Name: "Service", Value: "api" },
            ],
          },
        ],
      });
    });

    it("should publish a single metric with custom namespace from config", async () => {
      client = new CloudWatchClient(TEST_FIXTURES.CLIENT_ID, {
        logGroupName: TEST_FIXTURES.LOG_GROUP_NAME,
        region: TEST_FIXTURES.REGION,
        namespace: TEST_FIXTURES.CUSTOM_NS,
      });
      await client.init();

      METRICS_MOCK.on(PutMetricDataCommand).resolves({});

      await client.publishMetric({ MetricName: "Latency", Value: 123.45, Unit: "Milliseconds" });

      expect(METRICS_MOCK).toHaveReceivedCommandWith(PutMetricDataCommand, {
        Namespace: TEST_FIXTURES.CUSTOM_NS,
        MetricData: [
          {
            MetricName: "Latency",
            Value: 123.45,
            Unit: "Milliseconds",
          },
        ],
      });
    });

    it("should wrap errors into SmokerError with context", async () => {
      await client.init();

      METRICS_MOCK.on(PutMetricDataCommand).rejects(new Error("PutMetricData failed"));

      await expect(client.publishMetric({ MetricName: "Errors", Value: 1 })).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) && err.code === ERR_VALIDATION && err.domain === "aws",
      );
    });
  });

  describe("publishMetrics (batching)", () => {
    it("should batch metrics into groups of 20", async () => {
      await client.init();

      METRICS_MOCK.on(PutMetricDataCommand).resolves({});

      const metrics = Array.from({ length: 25 }).map((_, i) => ({
        MetricName: `Metric_${i + 1}`,
        Value: i,
      }));

      await client.publishMetrics(metrics);

      // Expect two separate batch sends: 20 and 5
      const calls = METRICS_MOCK.commandCalls(PutMetricDataCommand);
      expect(calls.length).toBe(2);
      expect(calls[0].args[0].input.MetricData?.length).toBe(20);
      expect(calls[1].args[0].input.MetricData?.length).toBe(5);
    });

    it("should no-op when metrics array is empty", async () => {
      await client.init();
      METRICS_MOCK.on(PutMetricDataCommand).resolves({});

      await client.publishMetrics([]);
      expect(METRICS_MOCK.commandCalls(PutMetricDataCommand).length).toBe(0);
    });

    it("should wrap errors with context (Error object) including batchSize in catch block", async () => {
      await client.init();

      // Create 21 metrics to force 2 batches: 20 and 1
      const metrics = Array.from({ length: 21 }).map((_, i) => ({
        MetricName: `Metric_${i + 1}`,
        Value: i,
      }));

      // First batch succeeds, second fails
      METRICS_MOCK.on(PutMetricDataCommand).resolvesOnce({}).rejectsOnce(new Error("boom"));

      await expect(client.publishMetrics(metrics)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          err.details?.component === "cloudwatch" &&
          err.details?.batchSize === 1,
      );

      // Two attempts were made (one success, one failed)
      expect(METRICS_MOCK.commandCalls(PutMetricDataCommand).length).toBe(2);
    });

    it("should wrap non-Error thrown values with string reason and batchSize", async () => {
      await client.init();

      const metrics = Array.from({ length: 21 }).map((_, i) => ({
        MetricName: `M_${i + 1}`,
        Value: i,
      }));

      METRICS_MOCK.reset();
      METRICS_MOCK.on(PutMetricDataCommand).resolvesOnce({}).rejectsOnce("string failure");

      await expect(client.publishMetrics(metrics)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          typeof err.details?.reason === "string" &&
          err.details?.batchSize === 1,
      );

      expect(METRICS_MOCK.commandCalls(PutMetricDataCommand).length).toBe(2);
    });

    it("should use String(error) for non-Error, non-string thrown values", async () => {
      await client.init();

      const metrics = Array.from({ length: 21 }).map((_, i) => ({
        MetricName: `X_${i + 1}`,
        Value: i,
      }));

      METRICS_MOCK.reset();
      // First batch OK, second rejects with an object to exercise String(error)
      METRICS_MOCK.on(PutMetricDataCommand)
        .resolvesOnce({})
        .rejectsOnce({ foo: "bar" } as unknown as Error);

      await expect(client.publishMetrics(metrics)).rejects.toSatisfy(
        (err) =>
          SmokerError.isSmokerError(err) &&
          err.code === ERR_VALIDATION &&
          err.domain === "aws" &&
          typeof err.details?.reason === "string" &&
          err.details?.batchSize === 1,
      );

      expect(METRICS_MOCK.commandCalls(PutMetricDataCommand).length).toBe(2);
    });
  });
});
