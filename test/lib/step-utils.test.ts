/**
 * step-utils.test.ts
 *
 * Coverage:
 * - tableToRecord: converts 2-col tables, handles empty and duplicate keys
 * - parseJsonDoc: parses JSON, returns string when invalid, undefined when empty
 * - coercePrimitive: booleans, null/undefined, numbers, passthrough objects
 * - resolveDeepWithWorld: resolves strings/arrays/objects recursively, preserves null/undefined
 * - normalizeHeaders: lowercases keys, joins arrays, skips nullish, stringifies values
 * - parseDurationMs: supports ms/s/m/h, trims input, throws on invalid
 * - waitFor: resolves true on predicate, false on timeout; uses fake timers
 * - resolveAndBuildUrl: resolves base/path/query via world, JSON-stringifies object query values, preserves simple scalars
 * - csvToArray: splits/trim, returns [] for empty
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldParamResolver } from "../../src/lib/step-utils";
import {
  coercePrimitive,
  csvToArray,
  normalizeHeaders,
  parseDurationMs,
  parseJsonDoc,
  resolveAndBuildUrl,
  resolveDeepWithWorld,
  tableToRecord,
  waitFor,
} from "../../src/lib/step-utils";

// Minimal DataTable-like helper
const makeTable = (rows: string[][]) => ({ rows: () => rows });

describe("step-utils", () => {
  describe("tableToRecord", () => {
    it("should build a record from 2-column rows", () => {
      const table = makeTable([
        ["baseUrl", "https://api"],
        ["timeout", "5000"],
      ]);
      expect(tableToRecord(table)).toEqual({ baseUrl: "https://api", timeout: "5000" });
    });

    it("should handle empty tables", () => {
      const table = makeTable([]);
      expect(tableToRecord(table)).toEqual({});
    });

    it("should overwrite duplicate keys with last occurrence", () => {
      const table = makeTable([
        ["k", "v1"],
        ["k", "v2"],
      ]);
      expect(tableToRecord(table)).toEqual({ k: "v2" });
    });
  });

  describe("parseJsonDoc", () => {
    it("should parse valid JSON", () => {
      expect(parseJsonDoc('{"a":1}')).toEqual({ a: 1 });
    });
    it("should return raw string when not JSON", () => {
      expect(parseJsonDoc("hello")).toBe("hello");
    });
    it("should return undefined for empty/whitespace", () => {
      expect(parseJsonDoc("   ")).toBeUndefined();
      expect(parseJsonDoc()).toBeUndefined();
    });
  });

  describe("coercePrimitive", () => {
    it("should coerce booleans, null/undefined, and numbers", () => {
      expect(coercePrimitive("true")).toBe(true);
      expect(coercePrimitive("FALSE")).toBe(false);
      expect(coercePrimitive("null")).toBeNull();
      expect(coercePrimitive("undefined")).toBeUndefined();
      expect(coercePrimitive("42")).toBe(42);
      expect(coercePrimitive("-3.14")).toBe(-3.14);
    });
    it("should pass through non-strings and non-coercible strings", () => {
      const obj = { a: 1 };
      expect(coercePrimitive(obj)).toBe(obj);
      expect(coercePrimitive("foo")).toBe("foo");
    });
  });

  describe("resolveDeepWithWorld", () => {
    const world: WorldParamResolver = {
      resolveParam: vi.fn(async (v: unknown) =>
        typeof v === "string" ? v.replace("config:base", "https://api").replace("${id}", "123") : v,
      ),
    };

    it("should resolve strings using world.resolveParam and coerce primitives", async () => {
      expect(await resolveDeepWithWorld(world, "config:base")).toBe("https://api");
      expect(await resolveDeepWithWorld(world, "42")).toBe(42);
    });

    it("should resolve arrays and objects deeply", async () => {
      const input = {
        url: "config:base",
        q: { page: "2", include: "true" },
        list: ["${id}", "null", 5],
      };
      const out = (await resolveDeepWithWorld(world, input)) as unknown as {
        url: string;
        q: { page: number; include: boolean };
        list: (string | number | null)[];
      };
      expect(out.url).toBe("https://api");
      expect(out.q).toEqual({ page: 2, include: true });
      // numeric coercion applies to "${id}" after resolution => 123
      expect(out.list).toEqual([123, null, 5]);
    });

    it("should preserve null and undefined (short-circuit)", async () => {
      expect(await resolveDeepWithWorld(world, null)).toBeNull();
      expect(await resolveDeepWithWorld(world, undefined)).toBeUndefined();
    });
  });

  describe("normalizeHeaders", () => {
    it("should lowercase keys and stringify values; join arrays; skip nullish", () => {
      const out = normalizeHeaders({
        "Content-Type": "application/json",
        Accept: ["a", "b"],
        X_Null: null,
        X_Undefined: undefined,
        Num: 5,
      });
      expect(out).toEqual({
        "content-type": "application/json",
        accept: "a,b",
        num: "5",
      });
      expect(out["x_null"]).toBeUndefined();
    });

    it("should return empty object when input is undefined", () => {
      expect(normalizeHeaders(undefined)).toEqual({});
    });
  });

  describe("parseDurationMs", () => {
    it("should parse ms/s/m/h and trim input", () => {
      expect(parseDurationMs("500ms")).toBe(500);
      expect(parseDurationMs(" 2s ")).toBe(2000);
      expect(parseDurationMs("1m")).toBe(60_000);
      expect(parseDurationMs("3h")).toBe(10_800_000);
    });
    it("should default to ms when unit omitted", () => {
      expect(parseDurationMs("150")).toBe(150);
    });
    it("should throw on invalid input", () => {
      expect(() => parseDurationMs("abc")).toThrowError(/Invalid duration/);
    });
    it("should throw on unsupported duration unit (default branch)", () => {
      expect(() => parseDurationMs("10d")).toThrowError(/Unsupported duration unit/);
    });
  });

  describe("waitFor", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("should return true when predicate becomes truthy before timeout", async () => {
      let flag = false;
      const p = waitFor(() => flag, { timeoutMs: 1000, intervalMs: 100 });
      await vi.advanceTimersByTimeAsync(250);
      flag = true; // predicate becomes true before timeout
      await vi.advanceTimersByTimeAsync(100);
      await expect(p).resolves.toBe(true);
    });

    it("should return false after timeout (shortcut path)", async () => {
      const p = waitFor(() => false, { timeoutMs: 300, intervalMs: 100 });
      vi.advanceTimersByTime(350);
      await expect(p).resolves.toBe(false);
    });
  });

  describe("resolveAndBuildUrl", () => {
    const world: WorldParamResolver = {
      resolveParam: vi.fn(async (v: unknown) =>
        typeof v === "string" ? v.replace("config:base", "https://api") : v,
      ),
    };

    it("should join base and path and append string/number/bool query", async () => {
      const url = await resolveAndBuildUrl(world, "config:base", "/users", {
        page: 2,
        q: "foo",
        ok: true,
      });
      expect(url).toBe("https://api/users?page=2&q=foo&ok=true");
    });

    it("should JSON-stringify object query values and skip nullish", async () => {
      const url = await resolveAndBuildUrl(world, "config:base", "/items", {
        f: { a: 1 },
        n: null,
        u: undefined,
      });
      expect(url).toBe("https://api/items?f=%7B%22a%22%3A1%7D");
    });

    it("should return joined without query when query is undefined (shortcut)", async () => {
      const url = await resolveAndBuildUrl(world, "config:base", "v1");
      expect(url).toBe("https://api/v1");
    });
  });

  describe("csvToArray", () => {
    it("should split and trim CSV", () => {
      expect(csvToArray("a, b ,c")).toEqual(["a", "b", "c"]);
    });
    it("should return empty array for empty or whitespace input (shortcut)", () => {
      expect(csvToArray("")).toEqual([]);
      expect(csvToArray("   ")).toEqual([]);
    });
  });
});
