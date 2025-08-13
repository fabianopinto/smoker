/**
 * Date and Time Utilities
 *
 * Provides helper functions commonly needed in smoke tests for working with
 * timestamps, durations, and time calculations.
 *
 * Usage examples:
 *
 * ```ts
 * import { DateUtils } from "../lib/date-utils";
 * const now = DateUtils.getCurrentTimestamp();
 * const later = DateUtils.addDays(new Date(), 3);
 * const expired = DateUtils.isExpired(new Date("2000-01-01"));
 * const ms = DateUtils.parseDuration("2m");
 * await DateUtils.wait(250);
 * ```
 */

import { ERR_INVALID_DURATION } from "../errors";
import { SmokerError } from "../errors/smoker-error";
import { logger } from "./logger";

export const DateUtils = {
  /**
   * Returns the current timestamp in ISO 8601 format.
   *
   * @returns ISO 8601 timestamp (e.g., 2024-01-01T00:00:00.000Z)
   */
  getCurrentTimestamp(): string {
    return new Date().toISOString();
  },

  /**
   * Adds the specified number of days to a date and returns a new Date.
   *
   * @param date - Base date
   * @param days - Number of days to add (can be negative)
   * @returns A new Date adjusted by the specified number of days
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
  },

  /**
   * Determines if a given date is expired (strictly before now or reference date).
   *
   * @param date - Date to check
   * @param reference - Optional reference time (defaults to now)
   * @returns True if date < reference time, otherwise false
   */
  isExpired(date: Date, reference: Date = new Date()): boolean {
    return date.getTime() < reference.getTime();
  },

  /**
   * Parses human-friendly durations into milliseconds.
   * Supports: ms, s, m, h, d (e.g., "500ms", "30s", "15m", "2h", "7d").
   * If unit is omitted, assumes milliseconds.
   *
   * @param input - Duration string (e.g., "30s", "2m", or a number-like string)
   * @returns Number of milliseconds represented by the input
   * @throws Error if the input does not match the supported format
   */
  parseDuration(input: string): number {
    const trimmed = input.trim();
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(ms|s|m|h|d)?$/i);
    if (!match) {
      logger.warn({ input }, "date-utils: invalid duration format");
      throw new SmokerError("Invalid duration", {
        code: ERR_INVALID_DURATION,
        domain: "date",
        details: { input },
        retryable: false,
        severity: "error",
      });
    }
    const value = parseFloat(match[1]);
    const unit = (match[2] || "ms").toLowerCase();
    // Units are constrained by the regex to one of: ms, s, m, h, d.
    // When omitted, unit defaults to "ms"; no other cases are possible.
    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60_000;
      case "h":
        return value * 3_600_000;
      case "d":
        return value * 86_400_000;
      default:
        return value;
    }
  },

  /**
   * Resolves after the given time.
   *
   * @param ms - Milliseconds to wait
   * @returns Promise that resolves after the specified delay
   */
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
} as const;
