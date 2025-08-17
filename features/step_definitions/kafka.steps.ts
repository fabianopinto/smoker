/**
 * Kafka BDD Step Definitions
 *
 * Purpose: Minimal, reusable steps to configure a Kafka client, produce messages,
 * subscribe to topics with a group, and wait for messages that match criteria.
 *
 * Coverage:
 * - Given: create/configure Kafka client via DataTable
 * - When: send message, subscribe to topics, wait for message by topic/content
 * - Then: assert send metadata and received message content
 *
 * Notes:
 * - All parameters/doc strings resolved through SmokeWorld param resolution.
 * - Last metadata and message stored in world properties.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import { ClientType } from "../../src/clients/core";
import {
  type KafkaMessage,
  type KafkaRecordMetadata,
  type KafkaServiceClient,
} from "../../src/clients/messaging/kafka";
import { ERR_VALIDATION, SmokerError } from "../../src/errors";
import {
  csvToArray,
  parseDurationMs,
  parseJsonDoc,
  resolveDeepWithWorld,
  tableToRecord,
} from "../../src/lib";
import { clientKey, type SmokeWorld } from "../../src/world/world";

// Configure a Kafka client from a DataTable (brokers/auth/clientId)
Given(
  "a Kafka client {string} configured as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const cfg = (await resolveDeepWithWorld(this, tableToRecord(table))) as Record<string, unknown>;
    const client = this.registerClientWithConfig(ClientType.KAFKA, cfg, id) as KafkaServiceClient;
    await client.init();
  },
);

// Subscribe a Kafka client to topics with a group id
When(
  "I subscribe Kafka client {string} to topics {string} with group {string}",
  async function (this: SmokeWorld, id: string, topicsCsv: string, groupId: string) {
    const key = clientKey(ClientType.KAFKA, id);
    const client = this.getClient<KafkaServiceClient>(key);
    const topics = (await resolveDeepWithWorld(this, topicsCsv)) as string;
    const group = (await resolveDeepWithWorld(this, groupId)) as string;
    await client.subscribe(csvToArray(topics), group);
  },
);

// Send a message to a topic and store send metadata
When(
  "I send a Kafka message with client {string} to topic {string} with body {string}",
  async function (this: SmokeWorld, id: string, topic: string, body: string) {
    const key = clientKey(ClientType.KAFKA, id);
    const client = this.getClient<KafkaServiceClient>(key);
    const t = (await resolveDeepWithWorld(this, topic)) as string;
    const resolved = await resolveDeepWithWorld(this, parseJsonDoc(body));
    const msg = typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    const meta = await client.sendMessage(t, msg);
    this.setProperty("kafka:lastMetadata", meta);
  },
);

// Wait up to timeout (ms) for a message on topic containing a fragment
When(
  "I wait up to {int} ms for Kafka client {string} to receive a message on topic {string} containing {string}",
  async function (
    this: SmokeWorld,
    timeoutMs: number,
    id: string,
    topic: string,
    fragment: string,
  ) {
    const key = clientKey(ClientType.KAFKA, id);
    const client = this.getClient<KafkaServiceClient>(key);
    const t = (await resolveDeepWithWorld(this, topic)) as string;
    const frag = (await resolveDeepWithWorld(this, fragment)) as string;
    const message = await client.waitForMessage(
      (m) => m.topic === t && m.value.includes(frag),
      timeoutMs,
    );
    this.setProperty("kafka:lastMessage", message);
  },
);

// Wait using duration string for a message on topic containing a fragment
When(
  "I wait up to {string} for Kafka client {string} to receive a message on topic {string} containing {string}",
  async function (this: SmokeWorld, duration: string, id: string, topic: string, fragment: string) {
    const key = clientKey(ClientType.KAFKA, id);
    const client = this.getClient<KafkaServiceClient>(key);
    const t = (await resolveDeepWithWorld(this, topic)) as string;
    const frag = (await resolveDeepWithWorld(this, fragment)) as string;
    const resolved = (await resolveDeepWithWorld(this, duration)) as string;
    const timeoutMs = parseDurationMs(resolved);
    const message = await client.waitForMessage(
      (m) => m.topic === t && m.value.includes(frag),
      timeoutMs,
    );
    this.setProperty("kafka:lastMessage", message);
  },
);

// Assert the last send returned partition metadata
Then("the last Kafka send should return a partition number", function (this: SmokeWorld) {
  const meta = this.getProperty<KafkaRecordMetadata>("kafka:lastMetadata");
  if (!meta || typeof meta.partition !== "number")
    throw new SmokerError("Missing Kafka send metadata", {
      code: ERR_VALIDATION,
      domain: "steps",
      details: { component: "kafka.steps" },
      retryable: false,
    });
});

// Assert the last received message exists and contains expected fragment
Then(
  "the last Kafka message should exist and contain {string}",
  async function (this: SmokeWorld, fragment: string) {
    const msg = this.getProperty<KafkaMessage | null>("kafka:lastMessage");
    const frag = (await resolveDeepWithWorld(this, fragment)) as string;
    if (!msg || !msg.value.includes(frag))
      throw new SmokerError("Kafka message not found or content mismatch", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "kafka.steps", fragment: frag },
        retryable: false,
      });
  },
);
