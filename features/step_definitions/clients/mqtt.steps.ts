/**
 * MQTT BDD Step Definitions
 *
 * Purpose: Minimal, reusable steps to configure an MQTT client, publish to topics,
 * subscribe/unsubscribe, and wait for inbound messages.
 *
 * Coverage:
 * - Given: create/configure MQTT client via DataTable
 * - When: subscribe, unsubscribe, publish message, wait for message with timeout
 * - Then: assert last received message content
 *
 * Notes:
 * - All parameters and doc strings are resolved via SmokeWorld to support config/property refs.
 * - Last received message is stored in world properties for assertions.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import { ClientType } from "../../../src/clients/core";
import { type MqttServiceClient } from "../../../src/clients/messaging/mqtt";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";
import { parseDurationMs, parseJsonDoc, resolveDeepWithWorld, tableToRecord } from "../../../src/lib";
import { clientKey, type SmokeWorld } from "../../../src/world/world";

// Configure an MQTT client from a DataTable (broker/auth/clientId)
Given(
  "an MQTT client {string} configured as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const cfg = (await resolveDeepWithWorld(this, tableToRecord(table))) as Record<string, unknown>;
    const client = this.registerClientWithConfig(ClientType.MQTT, cfg, id) as MqttServiceClient;
    await client.init();
  },
);

// Subscribe a client to a topic
When(
  "I subscribe MQTT client {string} to topic {string}",
  async function (this: SmokeWorld, id: string, topic: string) {
    const key = clientKey(ClientType.MQTT, id);
    const client = this.getClient<MqttServiceClient>(key);
    const t = (await resolveDeepWithWorld(this, topic)) as string;
    await client.subscribe(t);
  },
);

// Unsubscribe a client from a topic
When(
  "I unsubscribe MQTT client {string} from topic {string}",
  async function (this: SmokeWorld, id: string, topic: string) {
    const key = clientKey(ClientType.MQTT, id);
    const client = this.getClient<MqttServiceClient>(key);
    const t = (await resolveDeepWithWorld(this, topic)) as string;
    await client.unsubscribe(t);
  },
);

// Publish a message (string/Buffer) to a topic
When(
  "I publish with MQTT client {string} to topic {string} the message:",
  async function (this: SmokeWorld, id: string, topic: string, body: string) {
    const key = clientKey(ClientType.MQTT, id);
    const client = this.getClient<MqttServiceClient>(key);
    const t = (await resolveDeepWithWorld(this, topic)) as string;
    const msg = (await resolveDeepWithWorld(this, parseJsonDoc(body))) as string | Buffer;
    await client.publish(t, msg);
  },
);

// Wait up to timeout (ms) for a message on a topic
When(
  "I wait up to {int} ms for MQTT client {string} to receive a message on {string}",
  async function (this: SmokeWorld, timeoutMs: number, id: string, topic: string) {
    const key = clientKey(ClientType.MQTT, id);
    const client = this.getClient<MqttServiceClient>(key);
    const t = (await resolveDeepWithWorld(this, topic)) as string;
    const message = await client.waitForMessage(t, timeoutMs);
    this.setProperty("mqtt:lastMessage", message ?? "");
  },
);

// Wait using a duration string for a message on a topic
When(
  "I wait up to {string} for MQTT client {string} to receive a message on {string}",
  async function (this: SmokeWorld, duration: string, id: string, topic: string) {
    const key = clientKey(ClientType.MQTT, id);
    const client = this.getClient<MqttServiceClient>(key);
    const t = (await resolveDeepWithWorld(this, topic)) as string;
    const resolved = (await resolveDeepWithWorld(this, duration)) as string;
    const timeoutMs = parseDurationMs(resolved);
    const message = await client.waitForMessage(t, timeoutMs);
    this.setProperty("mqtt:lastMessage", message ?? "");
  },
);

// Assert last received MQTT message contains a fragment
Then(
  "the last MQTT message should contain {string}",
  async function (this: SmokeWorld, fragment: string) {
    const msg = (this.getProperty<string>("mqtt:lastMessage") || "").toString();
    const frag = (await resolveDeepWithWorld(this, fragment)) as string;
    if (!msg.includes(frag))
      throw new SmokerError("MQTT message does not contain fragment", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "mqtt.steps", fragment: frag },
        retryable: false,
      });
  },
);
