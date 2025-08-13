/**
 * URL and Query Utilities
 *
 * Lightweight helpers for URL path joining and query string manipulation.
 *
 * Usage examples:
 * ```ts
 * import { UrlUtils } from "../lib/url-utils";
 * UrlUtils.join("https://api", "/v1/users"); // https://api/v1/users
 * UrlUtils.withQuery("/items", { page: 2, search: "foo" }); // /items?page=2&search=foo
 * UrlUtils.toQueryString({ a: 1, b: true }); // a=1&b=true
 * ```
 */

export const UrlUtils = {
  /**
   * Joins base URL with path ensuring single slash.
   *
   * @param base - Base URL or path
   * @param path - Path to append
   * @returns Joined URL string with a single slash between parts
   */
  join(base: string, path: string): string {
    if (!base) return path;
    if (!path) return base;
    return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  },

  /**
   * Adds or replaces query parameters on a URL string.
   *
   * @param url - URL or path string
   * @param params - Key/value pairs to set as query parameters (undefined values are skipped)
   * @returns URL with updated query string
   */
  withQuery(url: string, params: Record<string, string | number | boolean | undefined>): string {
    const u = new URL(url, "resolve://");
    // In Node, URL requires a base for relative paths; we strip it later
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      u.searchParams.set(k, String(v));
    }
    let out = u.toString();
    out = out.replace(/^resolve:\/\//, "");
    return out;
  },

  /**
   * Converts an object to a query string without leading '?'.
   *
   * @param params - Key/value pairs (undefined values are skipped)
   * @returns Encoded query string (without leading '?')
   */
  toQueryString(params: Record<string, string | number | boolean | undefined>): string {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      usp.append(k, String(v));
    }
    return usp.toString();
  },
} as const;
