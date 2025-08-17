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
  describe("_parsePath", () => {
    it("should parse dot paths", () => {
      expect(ObjectUtils._parsePath("a.b.c")).toEqual(["a", "b", "c"]);
    });

    it("should parse numeric indices in brackets", () => {
      expect(ObjectUtils._parsePath("a[0].b")).toEqual(["a", 0, "b"]);
      expect(ObjectUtils._parsePath("a[  12  ]")).toEqual(["a", 12]);
    });

    it("should parse quoted keys with dots inside", () => {
      expect(ObjectUtils._parsePath("a['x.y']")).toEqual(["a", "x.y"]);
      expect(ObjectUtils._parsePath('a["x.y"]').toString()).toEqual(["a", "x.y"].toString());
    });

    it("should parse bare keys inside brackets", () => {
      expect(ObjectUtils._parsePath("a[foo]")).toEqual(["a", "foo"]);
    });

    it("should support escaping dot in segments", () => {
      expect(ObjectUtils._parsePath("a\\.b.c")).toEqual(["a.b", "c"]);
    });

    it("should support escaping quote inside quoted key", () => {
      expect(ObjectUtils._parsePath("a['x\\'y']")).toEqual(["a", "x'y"]);
    });

    it("should skip whitespace after quoted key before closing bracket", () => {
      expect(ObjectUtils._parsePath("a['key'   ]")).toEqual(["a", "key"]);
      expect(ObjectUtils._parsePath('a["key"   ]')).toEqual(["a", "key"]);
    });

    it("should ignore empty segments from consecutive dots", () => {
      expect(ObjectUtils._parsePath("a..b")).toEqual(["a", "b"]);
    });

    it("should return empty array for empty path", () => {
      expect(ObjectUtils._parsePath("")).toEqual([]);
    });

    it("should ignore incomplete bracket at end (early break)", () => {
      expect(ObjectUtils._parsePath("a[")).toEqual(["a"]);
      expect(ObjectUtils._parsePath("a[   ")).toEqual(["a"]);
    });
  });
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
    expect(ObjectUtils.deepGet(o, "a[0].v")).toBe(1);
    expect(ObjectUtils.deepGet(o, "a[1].v")).toBe(2);
    expect(ObjectUtils.deepGet(o, "a.2.v")).toBeUndefined();
  });

  it("deepGet should return undefined when intermediate becomes null", () => {
    const o = { a: null as unknown } as { a: unknown };
    expect(ObjectUtils.deepGet(o, "a.b")).toBeUndefined();
  });

  it("deepGet should return undefined when numeric segment is used on a non-array value", () => {
    const o = { a: "hello" } as const;
    expect(ObjectUtils.deepGet(o, "a[0]")).toBeUndefined();
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

  it("deepSet should early-return when root is not an object (guard coverage)", () => {
    const root = null as unknown as Record<string, unknown>;
    const ret = ObjectUtils.deepSet(root, "a.b", 1);
    expect(ret).toBe(root);
  });

  it("deepSet should create arrays when numeric next token encountered", () => {
    const o: Record<string, unknown> = {};
    ObjectUtils.deepSet(o, "items[0].name", "first");
    ObjectUtils.deepSet(o, "items[1].name", "second");
    expect(o).toEqual({ items: [{ name: "first" }, { name: "second" }] });
  });

  it("deepSet should set values at quoted bracket keys", () => {
    const o: Record<string, unknown> = {};
    ObjectUtils.deepSet(o, "meta['x.y'].z", 10);
    expect(o).toEqual({ meta: { "x.y": { z: 10 } } });
  });

  it("deepSet last-number: when current is object and existing key is array, assigns into that array", () => {
    const o: { x: { arr: Record<string, unknown> } } = { x: { arr: { "2": [] as unknown[] } } };
    ObjectUtils.deepSet(o, "x.arr[2]", "v");
    expect(Array.isArray(o.x.arr["2"] as unknown[])).toBe(true);
    expect((o.x.arr["2"] as unknown[])[2]).toBe("v");
  });

  it("deepSet last-number: when current is object and existing key is not array, sets property string(index)", () => {
    const o: { x: { arr: Record<string, unknown> } } = { x: { arr: {} } };
    ObjectUtils.deepSet(o, "x.arr[2]", "v");
    expect(o.x.arr["2"]).toBe("v");
  });

  it("deepSet last-number: when current container is array, assigns directly by index", () => {
    const o: { items?: unknown[] } = {};
    ObjectUtils.deepSet(o as Record<string, unknown>, "items[2]", "v");
    expect(Array.isArray(o.items)).toBe(true);
    expect(o.items?.[2]).toBe("v");
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
