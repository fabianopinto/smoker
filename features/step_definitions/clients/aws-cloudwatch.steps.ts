/**
 * AWS CloudWatch BDD Step Definitions
 *
 * Purpose: Minimal, reusable steps to configure a CloudWatch client and perform
 * logs and metrics operations: list streams, get events, search log stream, wait
 * for a pattern, and publish metric(s).
 *
 * Coverage:
 * - Given: create/configure CloudWatch client via DataTable
 * - When: listLogStreams, getLogEvents, searchLogStream, waitForPattern, publishMetric(s)
 * - Then: assert counts and search results
 *
 * Notes:
 * - All parameters/doc strings resolved via SmokeWorld param resolution.
 * - Last artifacts stored in world properties for assertions.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import {
  type CloudWatchLogEvent,
  type CloudWatchMetric,
  type CloudWatchServiceClient,
} from "../../../src/clients/aws";
import { ClientType } from "../../../src/clients/core";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";
import { parseDurationMs, parseJsonDoc, resolveDeepWithWorld, tableToRecord } from "../../../src/lib";
import { clientKey, type SmokeWorld } from "../../../src/world/world";

// Configure a CloudWatch client from a data table (credentials/region/log group)
Given(
  "a CloudWatch client {string} configured as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const cfg = (await resolveDeepWithWorld(this, tableToRecord(table))) as Record<string, unknown>;
    const client = this.registerClientWithConfig(
      ClientType.CLOUDWATCH,
      cfg,
      id,
    ) as CloudWatchServiceClient;
    await client.init();
  },
);

// List log streams and stash them for later assertions
When(
  "I list CloudWatch log streams with client {string}",
  async function (this: SmokeWorld, id: string) {
    const client = this.getClient<CloudWatchServiceClient>(clientKey(ClientType.CLOUDWATCH, id));
    const streams = await client.listLogStreams();
    this.setProperty("cloudwatch:lastStreams", streams);
  },
);

// Get log events from a stream over a time range and store them
When(
  "I get CloudWatch log events with client {string} from stream {string} between {int} and {int} limiting {int}",
  async function (
    this: SmokeWorld,
    id: string,
    stream: string,
    start: number,
    end: number,
    limit: number,
  ) {
    const client = this.getClient<CloudWatchServiceClient>(clientKey(ClientType.CLOUDWATCH, id));
    const s = (await resolveDeepWithWorld(this, stream)) as string;
    const events = await client.getLogEvents(s, start, end, limit);
    this.setProperty("cloudwatch:lastEvents", events);
  },
);

// Search a log stream for a pattern over a time range and store matches
When(
  "I search CloudWatch with client {string} on stream {string} for pattern {string} between {int} and {int}",
  async function (
    this: SmokeWorld,
    id: string,
    stream: string,
    pattern: string,
    start: number,
    end: number,
  ) {
    const client = this.getClient<CloudWatchServiceClient>(clientKey(ClientType.CLOUDWATCH, id));
    const s = (await resolveDeepWithWorld(this, stream)) as string;
    const p = (await resolveDeepWithWorld(this, pattern)) as string;
    const matches = await client.searchLogStream(s, p, start, end);
    this.setProperty("cloudwatch:lastMatches", matches);
  },
);

// Wait up to a timeout (ms) for a pattern to appear in a stream
When(
  "I wait up to {int} ms with CloudWatch client {string} for pattern {string} in stream {string}",
  async function (
    this: SmokeWorld,
    timeoutMs: number,
    id: string,
    pattern: string,
    stream: string,
  ) {
    const client = this.getClient<CloudWatchServiceClient>(clientKey(ClientType.CLOUDWATCH, id));
    const p = (await resolveDeepWithWorld(this, pattern)) as string;
    const s = (await resolveDeepWithWorld(this, stream)) as string;
    const found = await client.waitForPattern(s, p, timeoutMs);
    this.setProperty("cloudwatch:lastFound", found);
  },
);

// Wait using duration string (e.g., 30s) for a pattern in a stream
When(
  "I wait up to {string} with CloudWatch client {string} for pattern {string} in stream {string}",
  async function (this: SmokeWorld, duration: string, id: string, pattern: string, stream: string) {
    const client = this.getClient<CloudWatchServiceClient>(clientKey(ClientType.CLOUDWATCH, id));
    const p = (await resolveDeepWithWorld(this, pattern)) as string;
    const s = (await resolveDeepWithWorld(this, stream)) as string;
    const resolved = (await resolveDeepWithWorld(this, duration)) as string;
    const timeoutMs = parseDurationMs(resolved);
    const found = await client.waitForPattern(s, p, timeoutMs);
    this.setProperty("cloudwatch:lastFound", found);
  },
);

// Publish a single CloudWatch metric described by a DataTable
When(
  "I publish a CloudWatch metric with client {string} as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const client = this.getClient<CloudWatchServiceClient>(clientKey(ClientType.CLOUDWATCH, id));
    const raw = tableToRecord(table);
    const resolved = (await resolveDeepWithWorld(this, raw)) as Record<string, unknown>;
    const metric: CloudWatchMetric = {
      MetricName: String(resolved.MetricName),
      Value: Number(resolved.Value),
      Unit: resolved.Unit ? String(resolved.Unit) : undefined,
      Dimensions: Array.isArray(resolved.Dimensions)
        ? (resolved.Dimensions as { Name: string; Value: string }[])
        : undefined,
    };
    await client.publishMetric(metric);
  },
);

// Publish multiple CloudWatch metrics provided as a JSON list
When(
  "I publish CloudWatch metrics with client {string} list:",
  async function (this: SmokeWorld, id: string, body: string) {
    const client = this.getClient<CloudWatchServiceClient>(clientKey(ClientType.CLOUDWATCH, id));
    const data = await resolveDeepWithWorld(this, parseJsonDoc(body));
    const metrics = (Array.isArray(data) ? data : []) as CloudWatchMetric[];
    await client.publishMetrics(metrics);
  },
);

// Assert the last search returned at least N matches
Then(
  "the last CloudWatch search should return at least {int} matches",
  function (this: SmokeWorld, n: number) {
    const matches = (this.getProperty<string[]>("cloudwatch:lastMatches") || []) as string[];
    if (matches.length < n)
      throw new SmokerError("Insufficient CloudWatch matches", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "aws-cloudwatch.steps", expectedAtLeast: n, actual: matches.length },
        retryable: false,
      });
  },
);

// Assert that the last wait operation found the pattern
Then("CloudWatch should have found the pattern", function (this: SmokeWorld) {
  const found = this.getProperty<boolean>("cloudwatch:lastFound");
  if (!found)
    throw new SmokerError("Expected CloudWatch pattern to be found", {
      code: ERR_VALIDATION,
      domain: "steps",
      details: { component: "aws-cloudwatch.steps" },
      retryable: false,
    });
});

// Assert the last fetched events length is at least N
Then("the last CloudWatch events should be at least {int}", function (this: SmokeWorld, n: number) {
  const events = (this.getProperty<CloudWatchLogEvent[]>("cloudwatch:lastEvents") ||
    []) as CloudWatchLogEvent[];
  if (events.length < n)
    throw new SmokerError("Insufficient CloudWatch events", {
      code: ERR_VALIDATION,
      domain: "steps",
      details: { component: "aws-cloudwatch.steps", expectedAtLeast: n, actual: events.length },
      retryable: false,
    });
});
