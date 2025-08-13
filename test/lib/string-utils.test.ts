/**
 * string-utils.test.ts
 *
 * Coverage:
 * - normalizeWhitespace collapses whitespace to single spaces
 * - toKebabCase lowercases and hyphenates
 * - truncate respects max length and ellipsis
 * - tryParseJson returns undefined on invalid JSON
 * - isEmpty handles null/undefined/whitespace
 * - capitalize uppercases first character
 */

import { describe, expect, it } from "vitest";
import { StringUtils } from "../../src/lib/string-utils";

describe("StringUtils", () => {
  it("normalizeWhitespace should collapse to single spaces", () => {
    expect(StringUtils.normalizeWhitespace("a   b\n c\t d")).toBe("a b c d");
  });

  it("toKebabCase should lowercase and hyphenate", () => {
    expect(StringUtils.toKebabCase("HelloWorld Test_Value")).toBe("hello-world-test-value");
  });

  it("toSnakeCase should lowercase and underscore mixed input", () => {
    expect(StringUtils.toSnakeCase("HelloWorld Test-Value")).toBe("hello_world_test_value");
  });

  it("toSnakeCase should insert underscore at camelCase boundaries", () => {
    expect(StringUtils.toSnakeCase("fooBarBaz")).toBe("foo_bar_baz");
  });

  it("toSnakeCase should collapse spaces/hyphens to single underscore and keep underscores", () => {
    expect(StringUtils.toSnakeCase("a--b  c_d")).toBe("a_b_c_d");
  });

  it("toSnakeCase should handle leading/trailing delimiters without stripping underscores", () => {
    expect(StringUtils.toSnakeCase("__foo--bar  baz__")).toBe("__foo_bar_baz__");
  });

  it("toSnakeCase should return single underscore when input has only spaces/hyphens", () => {
    expect(StringUtils.toSnakeCase(" -   -  ")).toBe("_");
  });

  it("toCamelCase should remove delimiters and upper-case following letter", () => {
    expect(StringUtils.toCamelCase("hello-world test_value")).toBe("helloWorldTestValue");
  });

  it("toCamelCase should lowercase the first character", () => {
    expect(StringUtils.toCamelCase("Hello-World")).toBe("helloWorld");
  });

  it("toCamelCase should handle leading/trailing/multiple delimiters", () => {
    expect(StringUtils.toCamelCase("__foo--bar  baz__")).toBe("fooBarBaz");
  });

  it("toCamelCase should return empty string when input has only delimiters/whitespace", () => {
    expect(StringUtils.toCamelCase(" -__  ")).toBe("");
  });

  it("truncate should respect max length and ellipsis", () => {
    expect(StringUtils.truncate("abcdef", 4)).toBe("abc…");
    expect(StringUtils.truncate("abc", 10)).toBe("abc");
    expect(StringUtils.truncate("abcdef", 2, "..")).toBe("..");
  });

  it("truncate should return empty string when maxLength <= 0", () => {
    expect(StringUtils.truncate("abc", 0)).toBe("");
    expect(StringUtils.truncate("abc", -5)).toBe("");
  });

  it("truncate should return original when length equals maxLength", () => {
    expect(StringUtils.truncate("abcd", 4)).toBe("abcd");
  });

  it("truncate should return ellipsis slice when maxLength <= ellipsis length", () => {
    expect(StringUtils.truncate("abcdef", 1)).toBe("…"); // default ellipsis is one char
    expect(StringUtils.truncate("abcdef", 2, "---")).toBe("--");
  });

  it("tryParseJson should return undefined on invalid JSON", () => {
    expect(StringUtils.tryParseJson("{ bad" as string)).toBeUndefined();
    expect(StringUtils.tryParseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("isEmpty should handle null/undefined/whitespace", () => {
    expect(StringUtils.isEmpty(undefined)).toBe(true);
    expect(StringUtils.isEmpty(null)).toBe(true);
    expect(StringUtils.isEmpty("   ")).toBe(true);
    expect(StringUtils.isEmpty(" x ")).toBe(false);
  });

  it("capitalize should uppercase first character", () => {
    expect(StringUtils.capitalize("abc")).toBe("Abc");
  });

  it("capitalize should return empty string unchanged", () => {
    expect(StringUtils.capitalize("")).toBe("");
  });

  it("capitalize should not alter already-capitalized string", () => {
    expect(StringUtils.capitalize("Abc")).toBe("Abc");
  });

  it("capitalize should leave non-letter first character as-is", () => {
    expect(StringUtils.capitalize("1abc")).toBe("1abc");
  });
});
