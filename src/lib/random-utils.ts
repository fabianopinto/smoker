/**
 * @fileoverview Random/Data Generation Utilities
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

import { ValidationError } from "@fabianopinto/errors";
import { logger } from "@fabianopinto/logger";
import { ERR_RANDOM_EMPTY_ARRAY, ERR_RANDOM_INVALID_BOUNDS } from "../errors";

export const RandomUtils = {
  /**
   * Returns a cryptographically strong UUID (v4) when available.
   *
   * @returns {string} UUID v4 string
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
   * @param {number} min - Lower bound (inclusive)
   * @param {number} max - Upper bound (inclusive)
   * @returns {number} Random integer ∈ [min, max]
   * @throws {ValidationError} Error when bounds are invalid
   */
  randomInt(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      logger.warn({ min, max }, "random-utils: invalid bounds");
      throw new ValidationError("Invalid randomInt bounds", {
        code: ERR_RANDOM_INVALID_BOUNDS,
        context: { min, max },
        isOperational: false,
      });
    }
    if (max < min) [min, max] = [max, min];
    const r = Math.random();
    return Math.floor(r * (max - min + 1)) + min;
  },

  /**
   * Random alphanumeric string of given length.
   *
   * @param {number} length - Number of characters to generate
   * @param {string} charset - Characters to sample from (default: A-Za-z0-9)
   * @returns {string} Random string
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
   * @template T - The array element type
   * @param {T[]} arr - Non-empty array
   * @returns {T} A randomly selected element
   * @throws {ValidationError} Error when array is empty
   */
  pickOne<T>(arr: T[]): T {
    if (!Array.isArray(arr) || arr.length === 0) {
      logger.warn(
        { length: Array.isArray(arr) ? arr.length : undefined },
        "random-utils: pickOne on empty array",
      );
      throw new ValidationError("pickOne requires a non-empty array", {
        code: ERR_RANDOM_EMPTY_ARRAY,
        context: { length: Array.isArray(arr) ? arr.length : undefined },
        isOperational: false,
      });
    }
    return arr[this.randomInt(0, arr.length - 1)];
  },

  /**
   * Returns a new array with elements shuffled (Fisher–Yates).
   *
   * @template T - The array element type
   * @param {T[]} arr - Input array
   * @returns {T[]} New shuffled array
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
