/**
 * AWS Kinesis BDD Step Definitions
 *
 * Purpose: Minimal, reusable steps to configure a Kinesis client and perform
 * basic stream operations (putRecord, listShards, getShardIterator, getRecords,
 * waitForRecords) with assertions on returned data.
 *
 * Coverage:
 * - Given: create/configure Kinesis client via DataTable
 * - When: put record, list shards, get iterator, get records, wait for records
 * - Then: assert record count and content
 *
 * Notes:
 * - All parameters/doc strings are resolved via SmokeWorld param resolution.
 * - Last artifacts are stored in world properties for assertions.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import { type KinesisRecord, type KinesisServiceClient } from "../../src/clients/aws";
import { ClientType } from "../../src/clients/core";
import { ERR_VALIDATION, SmokerError } from "../../src/errors";
import { parseDurationMs, parseJsonDoc, resolveDeepWithWorld, tableToRecord } from "../../src/lib";
import { clientKey, type SmokeWorld } from "../../src/world/world";

// Configure a Kinesis client from a DataTable (region/credentials/stream)
Given(
  "a Kinesis client {string} configured as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const cfg = (await resolveDeepWithWorld(this, tableToRecord(table))) as Record<string, unknown>;
    const client = this.registerClientWithConfig(
      ClientType.KINESIS,
      cfg,
      id,
    ) as KinesisServiceClient;
    await client.init();
  },
);

// Put a record with partition key; save sequence number
When(
  "I put a Kinesis record with client {string} partition key {string} and data:",
  async function (this: SmokeWorld, id: string, partitionKey: string, body: string) {
    const client = this.getClient<KinesisServiceClient>(clientKey(ClientType.KINESIS, id));
    const pk = (await resolveDeepWithWorld(this, partitionKey)) as string;
    const dataResolved = await resolveDeepWithWorld(this, parseJsonDoc(body));
    const data = typeof dataResolved === "string" ? dataResolved : JSON.stringify(dataResolved);
    const seq = await client.putRecord(data, pk);
    this.setProperty("kinesis:lastSequence", seq);
  },
);

// List shards and store for later use
When("I list Kinesis shards with client {string}", async function (this: SmokeWorld, id: string) {
  const client = this.getClient<KinesisServiceClient>(clientKey(ClientType.KINESIS, id));
  const shards = await client.listShards();
  this.setProperty("kinesis:lastShards", shards);
});

// Get a shard iterator for a shard using iterator type and optional sequence
When(
  "I get Kinesis shard iterator with client {string} for shard {string} type {string} sequence {string}",
  async function (
    this: SmokeWorld,
    id: string,
    shardId: string,
    iteratorType: string,
    sequence: string,
  ) {
    const client = this.getClient<KinesisServiceClient>(clientKey(ClientType.KINESIS, id));
    const sid = (await resolveDeepWithWorld(this, shardId)) as string;
    const it = (await resolveDeepWithWorld(this, iteratorType)) as string;
    const seq = (await resolveDeepWithWorld(this, sequence)) as string;
    const iter = await client.getShardIterator(sid, it, seq);
    this.setProperty("kinesis:lastIterator", iter);
  },
);

// Get up to N records using the last iterator
When(
  "I get up to {int} Kinesis records with client {string} using the last iterator",
  async function (this: SmokeWorld, limit: number, id: string) {
    const client = this.getClient<KinesisServiceClient>(clientKey(ClientType.KINESIS, id));
    const iter = this.getProperty<string>("kinesis:lastIterator");
    if (!iter)
      throw new SmokerError("No Kinesis iterator stored", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "aws-kinesis.steps", step: "getRecords" },
        retryable: false,
      });
    const records = await client.getRecords(iter, limit);
    this.setProperty("kinesis:lastRecords", records);
  },
);

// Wait for records matching partition key up to timeout (ms)
When(
  "I wait up to {int} ms for Kinesis client {string} to get records with partition key {string}",
  async function (this: SmokeWorld, timeoutMs: number, id: string, partitionKey: string) {
    const client = this.getClient<KinesisServiceClient>(clientKey(ClientType.KINESIS, id));
    const pk = (await resolveDeepWithWorld(this, partitionKey)) as string;
    const records = await client.waitForRecords(pk, timeoutMs);
    this.setProperty("kinesis:lastRecords", records);
  },
);

// Wait using duration string for records by partition key
When(
  "I wait up to {string} for Kinesis client {string} to get records with partition key {string}",
  async function (this: SmokeWorld, duration: string, id: string, partitionKey: string) {
    const client = this.getClient<KinesisServiceClient>(clientKey(ClientType.KINESIS, id));
    const pk = (await resolveDeepWithWorld(this, partitionKey)) as string;
    const resolved = (await resolveDeepWithWorld(this, duration)) as string;
    const timeoutMs = parseDurationMs(resolved);
    const records = await client.waitForRecords(pk, timeoutMs);
    this.setProperty("kinesis:lastRecords", records);
  },
);

// Assert at least N records were retrieved
Then("the last Kinesis records should be at least {int}", function (this: SmokeWorld, n: number) {
  const recs = (this.getProperty<KinesisRecord[]>("kinesis:lastRecords") || []) as KinesisRecord[];
  if (recs.length < n)
    throw new SmokerError("Insufficient Kinesis records", {
      code: ERR_VALIDATION,
      domain: "steps",
      details: { component: "aws-kinesis.steps", expectedAtLeast: n, actual: recs.length },
      retryable: false,
    });
});

// Assert one of the last records contains a fragment
Then(
  "one of the last Kinesis records should contain {string}",
  async function (this: SmokeWorld, fragment: string) {
    const recs = (this.getProperty<KinesisRecord[]>("kinesis:lastRecords") ||
      []) as KinesisRecord[];
    const frag = (await resolveDeepWithWorld(this, fragment)) as string;
    if (!recs.some((r) => r.data.includes(frag)))
      throw new SmokerError("No Kinesis record contains fragment", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "aws-kinesis.steps", fragment: frag },
        retryable: false,
      });
  },
);
