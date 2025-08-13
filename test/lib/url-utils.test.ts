/**
 * url-utils.test.ts
 *
 * Coverage:
 * - join concatenates with single slashes
 * - withQuery appends or replaces query params
 * - toQueryString skips undefined values
 */

import { describe, expect, it } from "vitest";
import { UrlUtils } from "../../src/lib/url-utils";

describe("UrlUtils", () => {
  it("join + withQuery should produce expected URL", () => {
    const base = UrlUtils.join("https://api.example.com/", "/users");
    const out = UrlUtils.withQuery(base, { q: "john", p: 1 });
    expect(out).toBe("https://api.example.com/users?q=john&p=1");
  });

  it("join should normalize slashes", () => {
    const p = UrlUtils.join(UrlUtils.join("/api/", "/v1/"), "users");
    expect(p).toBe("/api/v1/users");
  });

  it("join should handle empty base or path", () => {
    expect(UrlUtils.join("", "/x")).toBe("/x");
    expect(UrlUtils.join("/api", "")).toBe("/api");
  });

  it("toQueryString should skip undefined values", () => {
    expect(UrlUtils.toQueryString({ a: 1, b: undefined, c: false })).toBe("a=1&c=false");
  });

  it("withQuery should work with relative paths and strip base", () => {
    const out = UrlUtils.withQuery("/path", { a: 1, b: true });
    expect(out).toBe("/path?a=1&b=true");
  });

  it("withQuery should replace existing params and skip undefined", () => {
    const url = "https://x.test/items?page=1&keep=ok";
    const out = UrlUtils.withQuery(url, { page: 2, q: undefined, flag: false });
    // page replaced to 2, keep preserved, q skipped, boolean serialized
    expect(out).toBe("https://x.test/items?page=2&keep=ok&flag=false");
  });
});
