/**
 * number-utils.test.ts
 *
 * Coverage:
 * - clamp respects bounds
 * - inRange handles inclusive range and swapped bounds
 * - safeParseInt respects radix and default fallback
 * - safeParseFloat parses floats with default fallback
 */

import { describe, expect, it } from "vitest";
import { NumberUtils } from "../../src/lib/number-utils";

describe("NumberUtils", () => {
  it("clamp should bound value", () => {
    expect(NumberUtils.clamp(15, 0, 10)).toBe(10);
    expect(NumberUtils.clamp(-5, 0, 10)).toBe(0);
    expect(NumberUtils.clamp(5, 0, 10)).toBe(5);
  });

  it("clamp should handle swapped bounds (min > max)", () => {
    expect(NumberUtils.clamp(7, 10, 0)).toBe(7); // inside after swap
    expect(NumberUtils.clamp(15, 10, 0)).toBe(10); // above after swap
    expect(NumberUtils.clamp(-1, 10, 0)).toBe(0); // below after swap
  });

  it("inRange should include bounds and handle swapped min/max", () => {
    expect(NumberUtils.inRange(5, 5, 10)).toBe(true);
    expect(NumberUtils.inRange(10, 5, 10)).toBe(true);
    expect(NumberUtils.inRange(3, 5, 10)).toBe(false);
    // swapped
    expect(NumberUtils.inRange(7, 10, 5)).toBe(true);
  });

  it("inRange should validate bounds inclusively by default", () => {
    expect(NumberUtils.inRange(5, 0, 10)).toBe(true);
    expect(NumberUtils.inRange(0, 0, 10)).toBe(true);
    expect(NumberUtils.inRange(10, 0, 10)).toBe(true);
    expect(NumberUtils.inRange(-1, 0, 10)).toBe(false);
  });

  it("inRange should work with swapped bounds", () => {
    // If implementation normalizes min/max, this should be true
    expect(NumberUtils.inRange(5, 10, 0)).toBe(true);
  });

  it("safeParseInt should honor radix and fallback on invalid", () => {
    expect(NumberUtils.safeParseInt("42")).toBe(42);
    expect(NumberUtils.safeParseInt("2A", 0, 16)).toBe(42);
    expect(NumberUtils.safeParseInt("abc", 7)).toBe(7);
    expect(NumberUtils.safeParseInt(undefined as unknown as string, 9)).toBe(9);
  });

  it("safeParseInt should parse with radix and fallback", () => {
    expect(NumberUtils.safeParseInt("10", 0)).toBe(10);
    expect(NumberUtils.safeParseInt("10", 0, 16)).toBe(16);
    expect(NumberUtils.safeParseInt("x", 7)).toBe(7);
  });

  it("safeParseFloat should parse float or fallback", () => {
    expect(NumberUtils.safeParseFloat("3.14")).toBeCloseTo(3.14);
    expect(NumberUtils.safeParseFloat("abc", 1.5)).toBe(1.5);
  });

  it("safeParseFloat should handle non-string inputs and Infinity/NaN", () => {
    expect(NumberUtils.safeParseFloat(1.23, 0)).toBe(1.23);
    expect(NumberUtils.safeParseFloat(Infinity, 9.9)).toBe(9.9);
    expect(NumberUtils.safeParseFloat(NaN, 8.8)).toBe(8.8);
  });

  it("safeParseFloat should parse or fallback", () => {
    expect(NumberUtils.safeParseFloat("1.23", 0)).toBe(1.23);
    expect(NumberUtils.safeParseFloat("abc", 0.5)).toBe(0.5);
  });

  it("clamp should bound values within min/max", () => {
    expect(NumberUtils.clamp(5, 0, 10)).toBe(5);
    expect(NumberUtils.clamp(-1, 0, 10)).toBe(0);
    expect(NumberUtils.clamp(11, 0, 10)).toBe(10);
  });
});
