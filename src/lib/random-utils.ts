/**
 * Random/Data Generation Utilities
 *
 * Utilities for generating UUIDs, random integers, random strings, picking
 * elements, and shuffling arrays — handy in smoke tests for temporary data.
 *
 * Usage examples:
 * ```ts
 * import { RandomUtils } from "../lib/random-utils";
 * RandomUtils.uuid();
 * RandomUtils.randomInt(1, 10);
 * RandomUtils.randomString(16);
 * RandomUtils.pickOne(["a", "b", "c"]);
 * RandomUtils.shuffle([1,2,3,4]);
 * ```
 */

import { ERR_RANDOM_EMPTY_ARRAY, ERR_RANDOM_INVALID_BOUNDS } from "../errors";
import { SmokerError } from "../errors/smoker-error";
import { logger } from "./logger";

export const RandomUtils = {
  /**
   * Returns a cryptographically strong UUID (v4) when available.
   *
   * @returns UUID v4 string
   */
  uuid(): string {
    // Node 22 has global crypto.randomUUID
    const maybeCrypto = (globalThis as unknown as { crypto?: { randomUUID?: () => string } })
      .crypto;
    if (maybeCrypto && typeof maybeCrypto.randomUUID === "function") {
      return maybeCrypto.randomUUID();
    }
    // Fallback (RFC4122-ish, not crypto-strong)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * Random integer in [min, max] inclusive.
   *
   * @param min - Lower bound (inclusive)
   * @param max - Upper bound (inclusive)
   * @returns Random integer ∈ [min, max]
   * @throws Error when bounds are invalid
   */
  randomInt(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      logger.warn({ min, max }, "random-utils: invalid bounds");
      throw new SmokerError("Invalid randomInt bounds", {
        code: ERR_RANDOM_INVALID_BOUNDS,
        domain: "random",
        details: { min, max },
        retryable: false,
        severity: "error",
      });
    }
    if (max < min) [min, max] = [max, min];
    const r = Math.random();
    return Math.floor(r * (max - min + 1)) + min;
  },

  /**
   * Random alphanumeric string of given length.
   *
   * @param length - Number of characters to generate
   * @param charset - Characters to sample from (default: A-Za-z0-9)
   * @returns Random string
   */
  randomString(
    length: number,
    charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  ): string {
    if (length <= 0) return "";
    let out = "";
    for (let i = 0; i < length; i += 1) {
      const idx = this.randomInt(0, charset.length - 1);
      out += charset[idx];
    }
    return out;
  },

  /**
   * Returns a random element from a non-empty array.
   *
   * @param arr - Non-empty array
   * @returns A randomly selected element
   * @throws Error when array is empty
   */
  pickOne<T>(arr: T[]): T {
    if (!Array.isArray(arr) || arr.length === 0) {
      logger.warn(
        { length: Array.isArray(arr) ? arr.length : undefined },
        "random-utils: pickOne on empty array",
      );
      throw new SmokerError("pickOne requires a non-empty array", {
        code: ERR_RANDOM_EMPTY_ARRAY,
        domain: "random",
        details: { length: Array.isArray(arr) ? arr.length : undefined },
        retryable: false,
        severity: "error",
      });
    }
    return arr[this.randomInt(0, arr.length - 1)];
  },

  /**
   * Returns a new array with elements shuffled (Fisher–Yates).
   *
   * @param arr - Input array
   * @returns New shuffled array
   */
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = this.randomInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
} as const;
