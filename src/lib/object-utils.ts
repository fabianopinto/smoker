/**
 * Object and Collection Utilities
 *
 * Utilities for safe deep access/mutation and object shape manipulation
 * (pick/omit), plus collection helpers. Useful for handling structured
 * configuration data in smoke tests.
 *
 * Usage examples:
 * ```ts
 * import { ObjectUtils } from "../lib/object-utils";
 * ObjectUtils.deepGet(cfg, "service.timeoutMs");
 * ObjectUtils.deepSet(cfg, "service.retries", 3);
 * ObjectUtils.pick({ a:1, b:2 }, ["a"]); // { a:1 }
 * ObjectUtils.omit({ a:1, b:2 }, ["b"]); // { a:1 }
 * ObjectUtils.ensureArray("x"); // ["x"]
 * ```
 */

export const ObjectUtils = {
  /**
   * Returns value at path (dot-notation).
   *
   * @param obj - Source object (may be unknown)
   * @param path - Dot-separated path (e.g., "a.b.c")
   * @returns Value at the path or undefined when not found
   */
  deepGet<T = unknown>(obj: unknown, path: string): T | undefined {
    if (obj == null) return undefined;
    const parts = path.split(".").filter(Boolean);
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return undefined;
      const rec = cur as Record<string, unknown>;
      if (!(p in rec)) return undefined;
      cur = rec[p];
    }
    return cur as T | undefined;
  },

  /**
   * Sets value at path (dot-notation), returns mutated object.
   * Creates intermediate objects as needed.
   *
   * @param obj - Target object to mutate
   * @param path - Dot-separated path (e.g., "a.b.c")
   * @param value - Value to set
   * @returns The same object reference with the path set
   */
  deepSet<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return obj;
    let cur: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i] as string;
      const next = cur[key];
      if (next == null || typeof next !== "object") cur[key] = {} as Record<string, unknown>;
      cur = cur[key] as Record<string, unknown>;
    }
    const last = parts[parts.length - 1] as string | undefined;
    if (last) {
      cur[last] = value as unknown;
    }
    return obj;
  },

  /**
   * Returns a new object with only specified keys.
   *
   * @param obj - Source object
   * @param keys - Keys to retain
   * @returns A new object containing only the provided keys
   */
  pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const out = {} as Pick<T, K>;
    for (const k of keys) {
      if (k in obj) {
        (out as Pick<T, K> & Record<K, T[K]>)[k] = obj[k];
      }
    }
    return out;
  },

  /**
   * Returns a new object without specified keys.
   *
   * @param obj - Source object
   * @param keys - Keys to omit
   * @returns A new object without the specified keys
   */
  omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const set = new Set<keyof T>(keys as unknown as (keyof T)[]);
    const out = {} as Omit<T, K>;
    for (const k of Object.keys(obj) as (keyof T)[]) {
      if (!set.has(k as K)) {
        (out as Omit<T, K> & Record<keyof T, T[keyof T]>)[k] = obj[k];
      }
    }
    return out;
  },

  /**
   * Ensures a value is an array.
   *
   * @param value - Any value or array
   * @returns value as an array (wraps non-array values, returns [] for null/undefined)
   */
  ensureArray<T>(value: T | T[] | null | undefined): T[] {
    if (value == null) return [] as T[];
    return Array.isArray(value) ? value : [value];
  },
} as const;
