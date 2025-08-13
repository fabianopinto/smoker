/**
 * object-utils.test.ts
 *
 * Coverage:
 * - deepGet returns nested value
 * - deepSet writes nested path creating parents
 * - pick/omit select and remove keys
 * - ensureArray wraps non-array values and handles null/undefined
 */

import { describe, expect, it } from "vitest";
import { ObjectUtils } from "../../src/lib/object-utils";

describe("ObjectUtils", () => {
  it("deepGet should return nested value or undefined", () => {
    const o = { a: { b: { c: 1 } } } as const;
    expect(ObjectUtils.deepGet(o, "a.b.c")).toBe(1);
    expect(ObjectUtils.deepGet(o, "a.x.c")).toBeUndefined();
  });

  it("deepGet should return undefined when obj is null or intermediate is non-object", () => {
    expect(ObjectUtils.deepGet(null as unknown as object, "a")).toBeUndefined();
    const o2 = { a: 1 } as const;
    expect(ObjectUtils.deepGet(o2, "a.b")).toBeUndefined();
  });

  it("deepGet should support array indices in path", () => {
    const o = { a: [{ v: 1 }, { v: 2 }] } as const;
    // Our implementation treats numeric parts as strings; emulate with dot paths
    expect(ObjectUtils.deepGet(o, "a.0.v")).toBe(1);
    expect(ObjectUtils.deepGet(o, "a.1.v")).toBe(2);
    expect(ObjectUtils.deepGet(o, "a.2.v")).toBeUndefined();
  });

  it("deepSet should write nested path", () => {
    const o: Record<string, unknown> = {};
    ObjectUtils.deepSet(o, "a.b.c", 2);
    expect(o).toEqual({ a: { b: { c: 2 } } });
  });

  it("deepSet should no-op and return same object when path is empty", () => {
    const o: Record<string, unknown> = { x: 1 };
    const ret = ObjectUtils.deepSet(o, "", 5);
    expect(ret).toBe(o);
    expect(o).toEqual({ x: 1 });
  });

  it("deepSet should overwrite non-object intermediates safely", () => {
    const o: Record<string, unknown> = { a: 1 };
    ObjectUtils.deepSet(o, "a.b", 3);
    expect(o).toEqual({ a: { b: 3 } });
  });

  it("pick should keep only provided keys", () => {
    const out = ObjectUtils.pick({ a: 1, b: 2, c: 3 }, ["a", "c"] as const);
    expect(out).toEqual({ a: 1, c: 3 });
  });

  it("omit should remove provided keys", () => {
    const out = ObjectUtils.omit({ a: 1, b: 2, c: 3 }, ["b"] as const);
    expect(out).toEqual({ a: 1, c: 3 });
  });

  it("ensureArray should wrap values and handle null/undefined", () => {
    expect(ObjectUtils.ensureArray("x")).toEqual(["x"]);
    expect(ObjectUtils.ensureArray([1, 2])).toEqual([1, 2]);
    expect(ObjectUtils.ensureArray(null)).toEqual([]);
    expect(ObjectUtils.ensureArray(undefined)).toEqual([]);
    expect(ObjectUtils.ensureArray("")).toEqual([""]);
  });
});
