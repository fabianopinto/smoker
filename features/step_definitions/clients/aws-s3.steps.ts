/**
 * AWS S3 BDD Step Definitions
 *
 * Purpose: Minimal, reusable steps to configure an S3 client and perform basic
 * bucket object operations (write, write JSON, read, delete) with assertions.
 *
 * Coverage:
 * - Given: create/configure S3 client via DataTable
 * - When: write string, write JSON, read object, delete object
 * - Then: assert last read content contains expected fragment
 *
 * Notes:
 * - All step parameters and doc strings resolved through SmokeWorld.
 * - Last content stored in world properties.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import { type S3ServiceClient } from "../../../src/clients/aws";
import { ClientType } from "../../../src/clients/core";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";
import { parseJsonDoc, resolveDeepWithWorld, tableToRecord } from "../../../src/lib";
import { clientKey, type SmokeWorld } from "../../../src/world/world";

// Configure an S3 client from a DataTable (region/credentials/bucket)
Given(
  "an S3 client {string} configured as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const cfg = (await resolveDeepWithWorld(this, tableToRecord(table))) as Record<string, unknown>;
    const client = this.registerClientWithConfig(ClientType.S3, cfg, id) as S3ServiceClient;
    await client.init();
  },
);

// Write string or JSON content to a key
When(
  "I write to S3 with client {string} key {string} the content:",
  async function (this: SmokeWorld, id: string, key: string, body: string) {
    const client = this.getClient<S3ServiceClient>(clientKey(ClientType.S3, id));
    const k = (await resolveDeepWithWorld(this, key)) as string;
    const resolved = await resolveDeepWithWorld(this, parseJsonDoc(body));
    const content = typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    await client.write(k, content);
  },
);

// Write a JSON object directly to a key
When(
  "I write JSON to S3 with client {string} key {string} the object:",
  async function (this: SmokeWorld, id: string, key: string, body: string) {
    const client = this.getClient<S3ServiceClient>(clientKey(ClientType.S3, id));
    const k = (await resolveDeepWithWorld(this, key)) as string;
    const data = await resolveDeepWithWorld(this, parseJsonDoc(body));
    await client.writeJson(k, data);
  },
);

// Read object content and store for later assertions
When(
  "I read from S3 with client {string} key {string}",
  async function (this: SmokeWorld, id: string, key: string) {
    const client = this.getClient<S3ServiceClient>(clientKey(ClientType.S3, id));
    const k = (await resolveDeepWithWorld(this, key)) as string;
    const content = await client.read(k);
    this.setProperty("s3:lastContent", content);
  },
);

// Delete an object by key
When(
  "I delete from S3 with client {string} key {string}",
  async function (this: SmokeWorld, id: string, key: string) {
    const client = this.getClient<S3ServiceClient>(clientKey(ClientType.S3, id));
    const k = (await resolveDeepWithWorld(this, key)) as string;
    await client.delete(k);
  },
);

// Assert that the last read content contains a fragment
Then(
  "the last S3 content should contain {string}",
  async function (this: SmokeWorld, fragment: string) {
    const content = this.getProperty<string>("s3:lastContent") || "";
    const frag = (await resolveDeepWithWorld(this, fragment)) as string;
    if (!content.includes(frag))
      throw new SmokerError("S3 content does not contain fragment", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "aws-s3.steps", fragment: frag },
        retryable: false,
      });
  },
);
