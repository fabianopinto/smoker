/**
 * random-utils.test.ts
 *
 * Coverage:
 * - randomInt invalid bounds throws SmokerError with ERR_RANDOM_INVALID_BOUNDS/domain 'random'
 * - pickOne([]) throws SmokerError with ERR_RANDOM_EMPTY_ARRAY/domain 'random'
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ERR_RANDOM_EMPTY_ARRAY, ERR_RANDOM_INVALID_BOUNDS, SmokerError } from "../../src/errors";
import { RandomUtils } from "../../src/lib/random-utils";

describe("RandomUtils", () => {
  describe("uuid", () => {
    afterEach(() => {
      // restore globals and any spies
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("should use crypto.randomUUID when available and not call Math.random", () => {
      const mockUUID = "00000000-0000-4000-8000-000000000000";
      const randomUUID = vi.fn().mockReturnValue(mockUUID);
      vi.stubGlobal("crypto", { randomUUID });
      const mathSpy = vi.spyOn(Math, "random");

      const id = RandomUtils.uuid();

      expect(id).toBe(mockUUID);
      expect(randomUUID).toHaveBeenCalledOnce();
      expect(mathSpy).not.toHaveBeenCalled();
    });

    it("should generate RFC4122 v4-like UUID when crypto is unavailable", () => {
      vi.stubGlobal("crypto", undefined as unknown);
      const id = RandomUtils.uuid();
      // Validate v4 format and variant (y in [8,9,a,b])
      const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(id).toHaveLength(36);
      expect(re.test(id)).toBe(true);
    });

    it("should return element at index provided by randomInt and use correct bounds", () => {
      const arr = ["a", "b", "c", "d"] as const;
      const spy = vi.spyOn(RandomUtils, "randomInt").mockReturnValue(2);
      const picked = RandomUtils.pickOne([...arr]);
      expect(spy).toHaveBeenCalledWith(0, arr.length - 1);
      expect(picked).toBe("c");
      spy.mockRestore();
    });

    it("should handle single-element arrays and call randomInt with (0, 0)", () => {
      const spy = vi.spyOn(RandomUtils, "randomInt").mockReturnValue(0);
      const picked = RandomUtils.pickOne([42]);
      expect(spy).toHaveBeenCalledWith(0, 0);
      expect(picked).toBe(42);
      spy.mockRestore();
    });
  });
  describe("randomInt", () => {
    it("should throw with ERR_RANDOM_INVALID_BOUNDS when bounds are not finite", () => {
      expect(() => RandomUtils.randomInt(Number.NaN, 10)).toThrowError();
      try {
        RandomUtils.randomInt(Number.NaN, 10);
      } catch (e) {
        expect(SmokerError.isSmokerError(e)).toBe(true);
        const err = e as SmokerError;
        expect(err.code).toBe(ERR_RANDOM_INVALID_BOUNDS);
        expect(err.domain).toBe("random");
      }
    });

    it("should return an integer within inclusive range and handle swapped bounds", () => {
      for (let i = 0; i < 50; i += 1) {
        const v1 = RandomUtils.randomInt(1, 3);
        expect(Number.isInteger(v1)).toBe(true);
        expect(v1).toBeGreaterThanOrEqual(1);
        expect(v1).toBeLessThanOrEqual(3);

        const v2 = RandomUtils.randomInt(3, 1); // swapped
        expect(v2).toBeGreaterThanOrEqual(1);
        expect(v2).toBeLessThanOrEqual(3);
      }
    });
  });

  describe("pickOne", () => {
    it("should throw with ERR_RANDOM_EMPTY_ARRAY when array is empty", () => {
      try {
        RandomUtils.pickOne([]);
        throw new Error("Expected to throw");
      } catch (e) {
        expect(SmokerError.isSmokerError(e)).toBe(true);
        const err = e as SmokerError;
        expect(err.code).toBe(ERR_RANDOM_EMPTY_ARRAY);
        expect(err.domain).toBe("random");
      }
    });

    it("should throw with ERR_RANDOM_EMPTY_ARRAY when input is not an array", () => {
      try {
        RandomUtils.pickOne(123 as unknown as unknown[]);
        throw new Error("Expected to throw");
      } catch (e) {
        expect(SmokerError.isSmokerError(e)).toBe(true);
        const err = e as SmokerError;
        expect(err.code).toBe(ERR_RANDOM_EMPTY_ARRAY);
        expect(err.domain).toBe("random");
      }
    });
  });

  describe("randomString", () => {
    it("should return string of requested length from the given charset", () => {
      const charset = "ABC";
      const out = RandomUtils.randomString(10, charset);
      expect(out).toHaveLength(10);
      expect([...out].every((c) => charset.includes(c))).toBe(true);
    });
    it("should return empty string for non-positive length", () => {
      expect(RandomUtils.randomString(0)).toBe("");
      expect(RandomUtils.randomString(-5)).toBe("");
    });
  });

  describe("shuffle", () => {
    it("should return a permutation preserving multiset of elements", () => {
      const arr = [1, 2, 3, 4, 5];
      const out = RandomUtils.shuffle(arr);
      // Same elements (order-agnostic)
      expect(out.sort()).toEqual(arr.slice().sort());
      // Original not mutated
      expect(arr).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
