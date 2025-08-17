/**
 * Step Utilities
 *
 * A collection of helpers tailored for Cucumber step definitions. These utilities:
 * - Parse key/value tables and CSVs commonly used in steps
 * - Safely parse JSON doc strings and coerce primitive types
 * - Resolve complex structures using the World (without merely wrapping single methods)
 * - Build URLs from parts and query parameters
 * - Normalize headers for case-insensitive matching
 * - Parse human-friendly durations and perform polling/wait patterns
 *
 * Notes:
 * - No direct dependency on Cucumber types; pass any object with rows(): string[][] for table parsing.
 * - Functions that accept a `world` use it to enhance behavior (e.g., deep resolution + normalization).
 */

import { ERR_INVALID_DURATION, SmokerError } from "../errors";
import { UrlUtils } from "./url-utils";

/**
 * Minimal contract for objects that can resolve parameters like SmokeWorld does.
 * Declared locally to avoid importing world.ts (which registers Cucumber World on load).
 */
export interface WorldParamResolver {
  resolveParam(param: unknown): Promise<unknown>;
}

/** Minimal shape to accept Cucumber DataTable without importing it here. */
export interface TabularRows {
  rows(): string[][];
}

/**
 * Convert a key/value 2-column table to a plain object of strings.
 *
 * @param table - Any object that exposes `rows(): string[][]` (e.g., Cucumber DataTable)
 * @returns A map of key/value pairs as strings
 *
 * @example
 * const rec = tableToRecord(table); // { baseUrl: "https://api", timeout: "5000" }
 */
export function tableToRecord(table: TabularRows): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of table.rows()) {
    out[k] = v;
  }
  return out;
}

/**
 * Parse a doc string as JSON if possible.
 * Falls back to the raw string when parsing fails and returns undefined for empty input.
 *
 * @param doc - The doc string provided by a step (may be undefined)
 * @returns Parsed JSON value, the raw string, or undefined when empty
 *
 * @example
 * parseJsonDoc('{"a":1}') // => { a: 1 }
 * parseJsonDoc('hello')     // => 'hello'
 * parseJsonDoc(undefined)   // => undefined
 */
export function parseJsonDoc(doc?: string): unknown {
  if (!doc) return undefined;
  const trimmed = doc.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Coerce common string primitives used in steps to appropriate JS types.
 * e.g., "true" -> true, "42" -> 42, "null" -> null. Leaves objects/arrays untouched.
 *
 * @param value - The value to coerce (only strings are coerced)
 * @returns Coerced value or the original when not a coercible string
 */
export function coercePrimitive(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const v = value.trim();
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === "true";
  if (/^(null)$/i.test(v)) return null;
  if (/^(undefined)$/i.test(v)) return undefined;
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
  return value;
}

/**
 * Deeply resolve any structure using the World's `resolveParam`, applying primitive coercion.
 * Adds value over a single call by recursing arrays/objects and normalizing results for client usage.
 *
 * @template T
 * @param world - An object exposing `resolveParam` (e.g., SmokeWorld)
 * @param input - Any value (string/object/array) potentially containing references
 * @returns The same structure with all values resolved and normalized
 *
 * @example
 * const cfg = await resolveDeepWithWorld(world, { url: 'config:api.base', retry: '3' });
 */
export async function resolveDeepWithWorld<T = unknown>(
  world: WorldParamResolver,
  input: T,
): Promise<T> {
  // Short-circuit nullish
  if (input === null || input === undefined) return input as T;

  // Strings: resolve references then coerce
  if (typeof input === "string") {
    const resolved = (await world.resolveParam(input)) as string;
    return coercePrimitive(resolved) as T;
  }

  // Arrays: resolve each item
  if (Array.isArray(input)) {
    const out: unknown[] = [];
    for (const item of input as unknown[]) {
      out.push(await resolveDeepWithWorld(world, item));
    }
    return out as T;
  }

  // Objects: resolve each value
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = await resolveDeepWithWorld(world, v);
    }
    return out as T;
  }

  // Other primitives (number/boolean/etc.) stay as-is
  return input as T;
}

/**
 * Normalize headers to a case-insensitive map with string values.
 * Arrays are joined with commas, nullish values are skipped.
 *
 * @param headers - Header object (possibly case-varied, array values)
 * @returns Normalized headers with lowercase keys and string values
 */
export function normalizeHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) {
    const k = key.toLowerCase();
    if (Array.isArray(value)) {
      out[k] = value.map((v) => String(v)).join(",");
    } else if (value === undefined || value === null) {
      // skip undefined/null
    } else {
      out[k] = String(value);
    }
  }
  return out;
}

/**
 * Parse human-friendly durations like "500ms", "2s", "1m", "3h" into milliseconds.
 * Defaults to milliseconds when no suffix is provided.
 *
 * @param input - Duration string (e.g., "2s", "500ms", "1m")
 * @returns Milliseconds value as a number
 *
 * @example
 * parseDurationMs('2s')   // 2000
 * parseDurationMs('500')  // 500
 */
export function parseDurationMs(input: string): number {
  const s = input.trim().toLowerCase();
  // Accept any alphabetic unit, validate in switch below
  const match = /^(-?\d+(?:\.\d+)?)([a-z]+)?$/i.exec(s);
  if (!match)
    throw new SmokerError("Invalid duration format", {
      code: ERR_INVALID_DURATION,
      domain: "date",
      details: { component: "step-utils", input },
      retryable: false,
    });
  const value = Number(match[1]);
  const unit = match[2] ? match[2].toLowerCase() : "ms";
  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60_000;
    case "h":
      return value * 3_600_000;
    default:
      throw new SmokerError("Unsupported duration unit", {
        code: ERR_INVALID_DURATION,
        domain: "date",
        details: { component: "step-utils", unit },
        retryable: false,
      });
  }
}

/**
 * Generic polling helper that resolves when `predicate` returns truthy or timeout is reached.
 *
 * @param predicate - Function returning a boolean or Promise<boolean>
 * @param options - Polling options: timeoutMs (required), intervalMs (default 250ms)
 * @returns True if predicate became truthy before timeout; false otherwise
 */
export async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  options: { timeoutMs: number; intervalMs?: number } = { timeoutMs: 10_000 },
): Promise<boolean> {
  const { timeoutMs, intervalMs = 250 } = options;
  const start = Date.now();
  while (true) {
    // Evaluate predicate
    const ok = await Promise.resolve(predicate());
    if (ok) return true;
    // Check timeout
    if (Date.now() - start >= timeoutMs) return false;
    // Sleep
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Build a URL from base + path + query, resolving all parts with the world first.
 *
 * @param world - Object exposing `resolveParam`
 * @param base - Base URL or path (may contain references)
 * @param path - Path segment (may contain references)
 * @param query - Optional query object (values resolved and stringified when needed)
 * @returns Fully built URL with query string appended when provided
 *
 * @example
 * const url = await resolveAndBuildUrl(world, 'config:api.base', '/users', { page: '2' });
 */
export async function resolveAndBuildUrl(
  world: WorldParamResolver,
  base: string,
  path: string,
  query?: Record<string, unknown>,
): Promise<string> {
  const [rb, rp] = (await Promise.all([world.resolveParam(base), world.resolveParam(path)])) as [
    string,
    string,
  ];
  const joined = UrlUtils.join(String(rb), String(rp));
  if (!query) return joined;
  const resolvedQuery = (await resolveDeepWithWorld(world, query)) as Record<string, unknown>;
  const stringQuery: Record<string, string | number | boolean | undefined> = {};
  for (const [k, v] of Object.entries(resolvedQuery)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object") {
      stringQuery[k] = JSON.stringify(v);
    } else {
      stringQuery[k] = v as string | number | boolean;
    }
  }
  return UrlUtils.withQuery(joined, stringQuery);
}

/**
 * Convert comma-separated values into an array of trimmed strings.
 *
 * @param input - CSV string
 * @returns Array of trimmed segments; empty array for empty/whitespace input
 *
 * @example
 * csvToArray('a, b ,c') // => ['a', 'b', 'c']
 */
export function csvToArray(input: string): string[] {
  if (input.trim() === "") return [];
  return input.split(/\s*,\s*/g).map((s) => s.trim());
}
