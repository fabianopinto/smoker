/**
 * @fileoverview String Utilities
 *
 * Common string helpers for formatting, casing, validation, and safe parsing.
 *
 * Usage examples:
 * ```ts
 * import { StringUtils } from "../lib/string-utils";
 * StringUtils.toCamelCase("hello-world"); // "helloWorld"
 * StringUtils.toKebabCase("HelloWorld");  // "hello-world"
 * StringUtils.truncate("abcdef", 4);      // "a…"
 * ```
 */

export const StringUtils = {
  /**
   * Returns true if the string is null/undefined/empty after trimming.
   *
   * @param {string | null | undefined} value - String to check
   * @returns {boolean} True when value is empty after trim or not provided
   */
  isEmpty(value: string | null | undefined): boolean {
    return value == null || value.trim().length === 0;
  },

  /**
   * Collapses all whitespace (including newlines) to single spaces and trims ends.
   *
   * @param {string} value - Input string
   * @returns {string} Normalized string with collapsed whitespace
   */
  normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  },

  /**
   * Capitalizes the first character of the string.
   *
   * @param {string} value - Input string
   * @returns {string} String with first character uppercased
   */
  capitalize(value: string): string {
    if (!value) return value as unknown as string;
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

  /**
   * Converts a string to camelCase.
   *
   * @param {string} value - Input string
   * @returns {string} camelCased string
   */
  toCamelCase(value: string): string {
    return value
      .replace(/[-_\s]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ""))
      .replace(/^(.)/, (m) => m.toLowerCase());
  },

  /**
   * Converts a string to kebab-case.
   *
   * @param {string} value - Input string
   * @returns {string} kebab-cased string
   */
  toKebabCase(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  },

  /**
   * Converts a string to snake_case.
   *
   * @param {string} value - Input string
   * @returns {string} snake_cased string
   */
  toSnakeCase(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[\s-]+/g, "_")
      .toLowerCase();
  },

  /**
   * Truncates a string and appends an ellipsis if it exceeds the length.
   *
   * @param {string} value - Input string
   * @param {number} maxLength - Max output length
   * @param {string} [ellipsis] - Ellipsis string (default: …)
   * @returns {string} Truncated string
   */
  truncate(value: string, maxLength: number, ellipsis = "…"): string {
    if (maxLength <= 0) return "";
    if (value.length <= maxLength) return value;
    if (maxLength <= ellipsis.length) return ellipsis.slice(0, maxLength);
    return value.slice(0, maxLength - ellipsis.length) + ellipsis;
  },

  /**
   * Safely parses JSON, returning undefined on error.
   *
   * @template T - Type of the parsed value
   * @param {string} value - JSON string to parse
   * @returns {T | undefined} Parsed value or undefined on error
   */
  tryParseJson<T = unknown>(value: string): T | undefined {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  },
} as const;
