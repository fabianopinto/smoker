/**
 * AWS SQS BDD Step Definitions
 *
 * Purpose: Minimal, reusable steps to configure an SQS client and perform queue
 * operations: send, receive, delete, and purge; plus content assertions.
 *
 * Coverage:
 * - Given: create/configure SQS client via DataTable
 * - When: sendMessage, receiveMessages (with wait seconds), deleteMessage, purgeQueue
 * - Then: assert received message count and body content
 *
 * Notes:
 * - All step parameters and DataTables are resolved via SmokeWorld param resolution.
 * - Last results are stored in world properties for reuse across steps.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import { type SqsMessage, type SqsServiceClient } from "../../../src/clients/aws";
import { ClientType } from "../../../src/clients/core";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";
import { resolveDeepWithWorld, tableToRecord } from "../../../src/lib";
import { clientKey, type SmokeWorld } from "../../../src/world/world";

// Configure an SQS client from a DataTable (region/credentials/queue)
Given(
  "an SQS client {string} configured as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const configRaw = tableToRecord(table);
    const config = (await resolveDeepWithWorld(this, configRaw)) as Record<string, unknown>;
    const client = this.registerClientWithConfig(ClientType.SQS, config, id) as SqsServiceClient;
    await client.init();
  },
);

// Send a message body to the configured SQS queue
When(
  "I send to SQS with client {string} the body {string}",
  async function (this: SmokeWorld, id: string, body: string) {
    const key = clientKey(ClientType.SQS, id);
    const client = this.getClient<SqsServiceClient>(key);
    const content = (await resolveDeepWithWorld(this, body)) as string;
    const messageId = await client.sendMessage(content);
    this.setProperty("sqs:lastMessageId", messageId);
  },
);

// Receive up to N messages, optionally waiting a few seconds
When(
  "I receive up to {int} SQS messages with client {string} waiting {int} seconds",
  async function (this: SmokeWorld, max: number, id: string, waitSeconds: number) {
    const key = clientKey(ClientType.SQS, id);
    const client = this.getClient<SqsServiceClient>(key);
    const messages = await client.receiveMessages(max, waitSeconds);
    this.setProperty("sqs:lastMessages", messages);
    if (messages[0]) this.setProperty("sqs:lastReceiptHandle", messages[0].receiptHandle);
  },
);

// Delete the last received message using its receipt handle
When(
  "I delete the last received SQS message with client {string}",
  async function (this: SmokeWorld, id: string) {
    const key = clientKey(ClientType.SQS, id);
    const client = this.getClient<SqsServiceClient>(key);
    const receipt = this.getProperty<string>("sqs:lastReceiptHandle");
    if (!receipt)
      throw new SmokerError("No SQS receipt handle stored", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "aws-sqs.steps" },
        retryable: false,
      });
    await client.deleteMessage(receipt);
  },
);

// Purge the SQS queue
When("I purge the SQS queue with client {string}", async function (this: SmokeWorld, id: string) {
  const key = clientKey(ClientType.SQS, id);
  const client = this.getClient<SqsServiceClient>(key);
  await client.purgeQueue();
});

// Assert at least N messages were received
Then(
  "the last SQS receive should return at least {int} messages",
  function (this: SmokeWorld, n: number) {
    const msgs = (this.getProperty<SqsMessage[]>("sqs:lastMessages") || []) as SqsMessage[];
    if (msgs.length < n)
      throw new SmokerError("Insufficient SQS messages", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "aws-sqs.steps", expectedAtLeast: n, actual: msgs.length },
        retryable: false,
      });
  },
);

// Assert the last message body contains a fragment
Then(
  "the last SQS message body should contain {string}",
  async function (this: SmokeWorld, fragment: string) {
    const msgs = (this.getProperty<SqsMessage[]>("sqs:lastMessages") || []) as SqsMessage[];
    const body = msgs[0]?.body || "";
    const frag = (await this.resolveParam(fragment)) as string;
    if (!body.includes(frag))
      throw new SmokerError("SQS body does not contain fragment", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "aws-sqs.steps", fragment: frag },
        retryable: false,
      });
  },
);
