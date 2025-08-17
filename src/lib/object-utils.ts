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
   * Parse a dot/bracket path (e.g., a.b[0].c or a['x']) into tokens.
   * Supports numeric indices and quoted keys inside brackets.
   */
  _parsePath(path: string): (string | number)[] {
    const tokens: (string | number)[] = [];
    let i = 0;
    let buf = "";
    const pushBuf = () => {
      if (buf.length > 0) {
        tokens.push(buf);
        buf = "";
      }
    };
    while (i < path.length) {
      const ch = path[i] as string;
      if (ch === "\\") {
        // escape next char
        if (i + 1 < path.length) {
          buf += path[i + 1];
          i += 2;
          continue;
        }
      }
      if (ch === ".") {
        pushBuf();
        i += 1;
        continue;
      }
      if (ch === "[") {
        pushBuf();
        // parse bracket content until ]
        i += 1;
        // skip whitespace
        while (i < path.length && /\s/.test(path[i] as string)) i += 1;
        if (i >= path.length) break;
        const start = path[i] as string;
        if (start === '"' || start === "'") {
          // quoted key
          const quote = start;
          i += 1;
          let key = "";
          while (i < path.length) {
            const c = path[i] as string;
            if (c === "\\") {
              if (i + 1 < path.length) {
                key += path[i + 1];
                i += 2;
                continue;
              }
            }
            if (c === quote) {
              i += 1; // skip closing quote
              break;
            }
            key += c;
            i += 1;
          }
          // skip whitespace
          while (i < path.length && /\s/.test(path[i] as string)) i += 1;
          if (path[i] === "]") i += 1;
          tokens.push(key);
        } else {
          // numeric or bare key until ]
          let raw = "";
          while (i < path.length && path[i] !== "]") {
            raw += path[i];
            i += 1;
          }
          if (path[i] === "]") i += 1;
          const trimmed = raw.trim();
          const num = Number(trimmed);
          if (trimmed !== "" && !Number.isNaN(num) && /^-?\d+$/.test(trimmed)) tokens.push(num);
          else if (trimmed !== "") tokens.push(trimmed);
        }
        continue;
      }
      buf += ch;
      i += 1;
    }
    pushBuf();
    return tokens.filter((t) => t !== "");
  },

  /**
   * Returns value at path (dot-notation).
   *
   * @param obj - Source object (may be unknown)
   * @param path - Dot-separated path (e.g., "a.b.c")
   * @returns Value at the path or undefined when not found
   */
  deepGet<T = unknown>(obj: unknown, path: string): T | undefined {
    if (obj == null) return undefined;
    const parts = ObjectUtils._parsePath(path);
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      if (typeof p === "number") {
        if (!Array.isArray(cur)) return undefined;
        cur = cur[p as number];
        continue;
      }
      if (typeof cur !== "object") return undefined;
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
    const parts = ObjectUtils._parsePath(path);
    if (parts.length === 0) return obj;
    let cur: unknown = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i] as string | number;
      const nextKey = parts[i + 1] as string | number | undefined;
      // ensure current is object/array to assign
      if (typeof cur !== "object" || cur == null) return obj;
      const rec = cur as Record<string, unknown>;
      let container = rec[key as string];
      if (container == null || typeof container !== "object") {
        // create array if next token is numeric, else object
        container =
          typeof nextKey === "number" ? ([] as unknown[]) : ({} as Record<string, unknown>);
        rec[key as string] = container;
      }
      cur = container;
    }
    const last = parts[parts.length - 1] as string | number | undefined;
    if (last !== undefined) {
      if (typeof cur === "object" && cur != null) {
        if (typeof last === "number") {
          const arr = Array.isArray(cur)
            ? (cur as unknown[])
            : (cur as Record<string, unknown>)[String(last)];
          if (Array.isArray(arr)) {
            (arr as unknown[])[last] = value as unknown;
          } else {
            (cur as Record<string, unknown>)[String(last)] = value as unknown;
          }
        } else {
          (cur as Record<string, unknown>)[last] = value as unknown;
        }
      }
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
