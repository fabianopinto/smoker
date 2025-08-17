/**
 * Property Manipulation and Assertions Steps
 *
 * Purpose:
 * - Provide generic steps to set/copy/transform values using World properties
 * - Enable extracting nested values from stored objects via dot-paths
 * - Offer common assertions over properties to drive test flows
 *
 * Coverage:
 * - Storing resolved values into properties
 * - Extracting a nested path from a source value and storing into another property
 * - Equality, comparison, containment, regex and existence assertions
 *
 * Notes:
 * - All step parameters are resolved via resolveDeepWithWorld() to support config:/property:/ssm:// etc.
 * - For nested path extraction, the source can be a resolved property or any resolved value.
 */

import { Then, When } from "@cucumber/cucumber";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";
import { resolveDeepWithWorld } from "../../../src/lib";
import { ObjectUtils } from "../../../src/lib/object-utils";
import { type SmokeWorld } from "../../../src/world/world";

// Store a resolved value into a world property
When(
  "I store value {string} into property {string}",
  async function (this: SmokeWorld, rawValue: string, propKey: string) {
    const value = await resolveDeepWithWorld(this, rawValue);
    const key = (await resolveDeepWithWorld(this, propKey)) as string;
    this.setProperty(key, value);
  },
);

// Extract a nested path from a resolved source value and store it into a property
When(
  "property {string} receives {string} from {string}",
  async function (this: SmokeWorld, targetKey: string, pathExpr: string, sourceRef: string) {
    const key = (await resolveDeepWithWorld(this, targetKey)) as string;
    const path = (await resolveDeepWithWorld(this, pathExpr)) as string;
    const source = await resolveDeepWithWorld(this, sourceRef);
    const extracted = ObjectUtils.deepGet(source, path);
    this.setProperty(key, extracted);
  },
);

// Equality assertion
Then(
  "property {string} should equal {string}",
  async function (this: SmokeWorld, propKey: string, expectedRaw: string) {
    const key = (await resolveDeepWithWorld(this, propKey)) as string;
    const actual = this.getProperty(key);
    const expected = await resolveDeepWithWorld(this, expectedRaw);
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok)
      throw new SmokerError("Property equality assertion failed", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "properties.steps", key, actual, expected },
        retryable: false,
      });
  },
);

// Greater-than assertion (numeric)
Then(
  "property {string} should be bigger than {string}",
  async function (this: SmokeWorld, propKey: string, expectedRaw: string) {
    const key = (await resolveDeepWithWorld(this, propKey)) as string;
    const actual = Number(this.getProperty(key));
    const expected = Number(await resolveDeepWithWorld(this, expectedRaw));
    if (!(Number.isFinite(actual) && Number.isFinite(expected) && actual > expected))
      throw new SmokerError("Property greater-than assertion failed", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "properties.steps", key, actual, expected },
        retryable: false,
      });
  },
);

// Less-than assertion (numeric)
Then(
  "property {string} should be less than {string}",
  async function (this: SmokeWorld, propKey: string, expectedRaw: string) {
    const key = (await resolveDeepWithWorld(this, propKey)) as string;
    const actual = Number(this.getProperty(key));
    const expected = Number(await resolveDeepWithWorld(this, expectedRaw));
    if (!(Number.isFinite(actual) && Number.isFinite(expected) && actual < expected))
      throw new SmokerError("Property less-than assertion failed", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "properties.steps", key, actual, expected },
        retryable: false,
      });
  },
);

// Contains assertion (string includes or array includes)
Then(
  "property {string} should contain {string}",
  async function (this: SmokeWorld, propKey: string, expectedRaw: string) {
    const key = (await resolveDeepWithWorld(this, propKey)) as string;
    const actual = this.getProperty(key) as unknown;
    const expected = await resolveDeepWithWorld(this, expectedRaw);
    let ok = false;
    if (typeof actual === "string") ok = actual.includes(String(expected));
    else if (Array.isArray(actual)) ok = actual.includes(expected);
    if (!ok)
      throw new SmokerError("Property containment assertion failed", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "properties.steps", key, actual, expected },
        retryable: false,
      });
  },
);

// Regex assertion
Then(
  "property {string} should match regex {string}",
  async function (this: SmokeWorld, propKey: string, regexRaw: string) {
    const key = (await resolveDeepWithWorld(this, propKey)) as string;
    const actual = this.getProperty(key);
    const pattern = (await resolveDeepWithWorld(this, regexRaw)) as string;
    const re = new RegExp(pattern);
    if (typeof actual !== "string" || !re.test(actual))
      throw new SmokerError("Property regex assertion failed", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "properties.steps", key, actual, pattern },
        retryable: false,
      });
  },
);

// Existence assertion
Then("property {string} should exist", async function (this: SmokeWorld, propKey: string) {
  const key = (await resolveDeepWithWorld(this, propKey)) as string;
  const val = this.getProperty(key);
  if (val === undefined)
    throw new SmokerError("Expected property to exist", {
      code: ERR_VALIDATION,
      domain: "steps",
      details: { component: "properties.steps", key },
      retryable: false,
    });
});

// Not-nullish assertion
Then("property {string} should be defined", async function (this: SmokeWorld, propKey: string) {
  const key = (await resolveDeepWithWorld(this, propKey)) as string;
  const val = this.getProperty(key);
  if (val === null || val === undefined)
    throw new SmokerError("Expected property to be defined (non-null)", {
      code: ERR_VALIDATION,
      domain: "steps",
      details: { component: "properties.steps", key },
      retryable: false,
    });
});
