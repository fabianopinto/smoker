/**
 * Number Utilities
 *
 * Helper functions for clamping, range checks, and safe numeric parsing.
 *
 * Usage examples:
 * ```ts
 * import { NumberUtils } from "../lib/number-utils";
 * NumberUtils.clamp(10, 0, 5); // 5
 * NumberUtils.inRange(3, 1, 5); // true
 * NumberUtils.safeParseInt("42"); // 42
 * NumberUtils.safeParseFloat("3.14"); // 3.14
 * ```
 */

export const NumberUtils = {
  /**
   * Clamps a number within the inclusive [min, max] range.
   *
   * @param value - Input number
   * @param min - Lower bound (inclusive)
   * @param max - Upper bound (inclusive)
   * @returns The clamped value within [min, max]
   */
  clamp(value: number, min: number, max: number): number {
    if (min > max) [min, max] = [max, min];
    return Math.min(Math.max(value, min), max);
  },

  /**
   * Returns true if value is within inclusive [min, max].
   *
   * @param value - Input number
   * @param min - Lower bound (inclusive)
   * @param max - Upper bound (inclusive)
   * @returns True when value ∈ [min, max]
   */
  inRange(value: number, min: number, max: number): boolean {
    if (min > max) [min, max] = [max, min];
    return value >= min && value <= max;
  },

  /**
   * Parses integer safely with default fallback.
   *
   * @param input - Value to parse (string or number-like)
   * @param defaultValue - Fallback when parsing fails (default: 0)
   * @param radix - Integer radix (default: 10)
   * @returns Parsed integer or defaultValue
   */
  safeParseInt(input: unknown, defaultValue = 0, radix = 10): number {
    const n = typeof input === "string" ? parseInt(input, radix) : Number(input);
    return Number.isFinite(n) ? Math.trunc(n) : defaultValue;
  },

  /**
   * Parses float safely with default fallback.
   *
   * @param input - Value to parse (string or number-like)
   * @param defaultValue - Fallback when parsing fails (default: 0)
   * @returns Parsed float or defaultValue
   */
  safeParseFloat(input: unknown, defaultValue = 0): number {
    const n = typeof input === "string" ? parseFloat(input) : Number(input);
    return Number.isFinite(n) ? n : defaultValue;
  },
} as const;
