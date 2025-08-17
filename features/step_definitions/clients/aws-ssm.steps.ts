/**
 * AWS SSM BDD Step Definitions
 *
 * Purpose: Minimal, reusable steps to configure an SSM client and perform
 * Parameter Store operations (write/read/delete) with assertions.
 *
 * Coverage:
 * - Given: create/configure SSM client via DataTable
 * - When: write parameter (type/overwrite), read (with decryption), delete
 * - Then: assert last read value
 *
 * Notes:
 * - All step parameters resolved via SmokeWorld param resolution.
 * - Last value stored in world properties.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import { type SsmServiceClient } from "../../../src/clients/aws";
import { ClientType } from "../../../src/clients/core";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";
import { resolveDeepWithWorld, tableToRecord } from "../../../src/lib";
import { clientKey, type SmokeWorld } from "../../../src/world/world";

// Configure an SSM client from a DataTable (region/credentials/endpoint)
Given(
  "an SSM client {string} configured as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const cfg = (await resolveDeepWithWorld(this, tableToRecord(table))) as Record<string, unknown>;
    const client = this.registerClientWithConfig(ClientType.SSM, cfg, id) as SsmServiceClient;
    await client.init();
  },
);

// Write a parameter with optional type and overwrite flag
When(
  "I write SSM parameter with client {string} name {string} value {string} type {string} overwrite {string}",
  async function (
    this: SmokeWorld,
    id: string,
    name: string,
    value: string,
    type: string,
    overwrite: string,
  ) {
    const client = this.getClient<SsmServiceClient>(clientKey(ClientType.SSM, id));
    const n = (await resolveDeepWithWorld(this, name)) as string;
    const v = (await resolveDeepWithWorld(this, value)) as string;
    const t = (await resolveDeepWithWorld(this, type)) as string;
    const ow = String(await resolveDeepWithWorld(this, overwrite)).toLowerCase() === "true";
    await client.write(n, v, t, ow);
  },
);

// Read a parameter (optionally decrypt) and stash the value
When(
  "I read SSM parameter with client {string} name {string} with decryption {string}",
  async function (this: SmokeWorld, id: string, name: string, withDecryption: string) {
    const client = this.getClient<SsmServiceClient>(clientKey(ClientType.SSM, id));
    const n = (await resolveDeepWithWorld(this, name)) as string;
    const dec = String(await resolveDeepWithWorld(this, withDecryption)).toLowerCase() === "true";
    const val = await client.read(n, dec);
    this.setProperty("ssm:lastValue", val);
  },
);

// Delete a parameter by name
When(
  "I delete SSM parameter with client {string} name {string}",
  async function (this: SmokeWorld, id: string, name: string) {
    const client = this.getClient<SsmServiceClient>(clientKey(ClientType.SSM, id));
    const n = (await resolveDeepWithWorld(this, name)) as string;
    await client.delete(n);
  },
);

// Assert the last read SSM value equals the expected value
Then("the last SSM value should be {string}", async function (this: SmokeWorld, expected: string) {
  const val = this.getProperty<string>("ssm:lastValue");
  const exp = (await resolveDeepWithWorld(this, expected)) as string;
  if (val !== exp)
    throw new SmokerError("SSM value mismatch", {
      code: ERR_VALIDATION,
      domain: "steps",
      details: { component: "aws-ssm.steps", expected: exp, actual: val },
      retryable: false,
    });
});
