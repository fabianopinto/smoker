/**
 * Environment Variable Utilities
 *
 * Provides helpers to read and parse environment variables safely with sensible defaults.
 * These utilities avoid throwing for optional vars and provide typed coercion helpers for
 * boolean, number, and JSON values commonly used in configuration.
 *
 * Usage examples:
 *
 * ```ts
 * import { EnvUtils } from "../lib/env-utils";
 * const logLevel = EnvUtils.getEnv("LOG_LEVEL", "info");
 * const debug = EnvUtils.getBoolEnv("DEBUG", false);
 * const timeoutMs = EnvUtils.getNumberEnv("HTTP_TIMEOUT_MS", 5000);
 * const cfg = EnvUtils.getJsonEnv<Record<string, unknown>>("APP_CONFIG", {});
 * ```
 */

import { ERR_ENV_MISSING } from "../errors";
import { SmokerError } from "../errors/smoker-error";

export const EnvUtils = {
  /**
   * Gets an env var or returns a default. Trims whitespace.
   *
   * @param name - Environment variable name
   * @param defaultValue - Value to use when the variable is unset or empty
   * @returns The trimmed env var value, or defaultValue when missing/empty
   *
   * @example
   * // LOG_LEVEL or "info" if not set
   * const level = EnvUtils.getEnv("LOG_LEVEL", "info");
   */
  getEnv(name: string, defaultValue?: string): string | undefined {
    const v = process.env[name];
    if (v == null || v === "") return defaultValue;
    return String(v).trim();
  },

  /**
   * Gets a required env var or throws when missing/empty.
   *
   * Throws a SmokerError with code "ENV_MISSING" including the variable name
   * in details when the variable is not present or empty.
   *
   * @param name - Environment variable name (required)
   * @returns The trimmed env var value
   * @throws {SmokerError} When the variable is missing or empty
   *
   * @example
   * // Throws if PORT is not set
   * const port = EnvUtils.requireEnv("PORT");
   */
  requireEnv(name: string): string {
    const v = this.getEnv(name);
    if (v == null || v === "")
      throw new SmokerError("Missing required environment variable", {
        code: ERR_ENV_MISSING,
        domain: "env",
        details: { name },
        severity: "error",
        retryable: false,
      });
    return v;
  },

  /**
   * Parses boolean env var with sensible defaults.
   *
   * Accepts: true/false/1/0/yes/no/y/n (case-insensitive). Returns defaultValue when unset or unrecognized.
   *
   * @param name - Environment variable name
   * @param defaultValue - Fallback when variable is missing or unparsable (default: false)
   * @returns Parsed boolean value
   *
   * @example
   * const debug = EnvUtils.getBoolEnv("DEBUG", false);
   */
  getBoolEnv(name: string, defaultValue = false): boolean {
    const v = this.getEnv(name);
    if (v == null) return defaultValue;
    const s = v.toLowerCase();
    if (["true", "1", "yes", "y"].includes(s)) return true;
    if (["false", "0", "no", "n"].includes(s)) return false;
    return defaultValue;
  },

  /**
   * Parses numeric env var safely with default fallback.
   *
   * Returns defaultValue when unset or not a finite number.
   *
   * @param name - Environment variable name
   * @param defaultValue - Fallback when missing or invalid (default: 0)
   * @returns Parsed number or defaultValue
   *
   * @example
   * const timeoutMs = EnvUtils.getNumberEnv("HTTP_TIMEOUT_MS", 5000);
   */
  getNumberEnv(name: string, defaultValue = 0): number {
    const v = this.getEnv(name);
    if (v == null) return defaultValue;
    const n = Number(v);
    return Number.isFinite(n) ? n : defaultValue;
  },

  /**
   * Parses JSON env var safely; returns default when invalid or missing.
   *
   * @param name - Environment variable name
   * @param defaultValue - Fallback when missing or invalid
   * @returns Parsed JSON value typed as T, or defaultValue when parsing fails
   *
   * @example
   * type Cfg = { feature: boolean };
   * const cfg = EnvUtils.getJsonEnv<Cfg>("APP_CONFIG", { feature: false });
   */
  getJsonEnv<T = unknown>(name: string, defaultValue?: T): T | undefined {
    const v = this.getEnv(name);
    if (v == null) return defaultValue;
    try {
      return JSON.parse(v) as T;
    } catch {
      return defaultValue;
    }
  },
} as const;
