/**
 * date-utils.test.ts
 *
 * Coverage:
 * - parseDuration invalid format throws SmokerError with standardized code/domain
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERR_INVALID_DURATION, SmokerError } from "../../src/errors";
import { DateUtils } from "../../src/lib/date-utils";

describe("DateUtils", () => {
  describe("isExpired", () => {
    it("should return true when date is before reference", () => {
      const ref = new Date("2025-01-02T00:00:00.000Z");
      const d = new Date("2025-01-01T23:59:59.000Z");
      expect(DateUtils.isExpired(d, ref)).toBe(true);
    });
    it("should return false when date is equal or after reference", () => {
      const ref = new Date("2025-01-02T00:00:00.000Z");
      expect(DateUtils.isExpired(new Date("2025-01-02T00:00:00.000Z"), ref)).toBe(false);
      expect(DateUtils.isExpired(new Date("2025-01-02T00:00:01.000Z"), ref)).toBe(false);
    });
  });

  describe("addDays", () => {
    it("should add and subtract days without mutating input", () => {
      const base = new Date("2025-01-10T00:00:00.000Z");
      const out1 = DateUtils.addDays(base, 5);
      const out2 = DateUtils.addDays(base, -3);
      expect(out1.toISOString()).toBe("2025-01-15T00:00:00.000Z");
      expect(out2.toISOString()).toBe("2025-01-07T00:00:00.000Z");
      expect(base.toISOString()).toBe("2025-01-10T00:00:00.000Z");
    });
  });

  describe("getCurrentTimestamp", () => {
    it("should return ISO 8601 string", () => {
      const ts = DateUtils.getCurrentTimestamp();
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\..+Z$/);
    });
  });

  describe("parseDuration", () => {
    it("should throw SmokerError with ERR_INVALID_DURATION and domain 'date' for invalid input", () => {
      try {
        DateUtils.parseDuration("abc");
        throw new Error("Expected to throw");
      } catch (e) {
        expect(SmokerError.isSmokerError(e)).toBe(true);
        const err = e as SmokerError;
        expect(err.code).toBe(ERR_INVALID_DURATION);
        expect(err.domain).toBe("date");
      }
    });

    it("should default to milliseconds when unit is omitted", () => {
      expect(DateUtils.parseDuration("150")).toBe(150);
    });

    it("should trim whitespace before parsing", () => {
      expect(DateUtils.parseDuration("  2s \n")).toBe(2000);
    });

    it("should support uppercase units", () => {
      expect(DateUtils.parseDuration("2H")).toBe(2 * 3_600_000);
      expect(DateUtils.parseDuration("3D")).toBe(3 * 86_400_000);
    });

    it("should support decimal and negative values", () => {
      expect(DateUtils.parseDuration("1.5s")).toBe(1500);
      expect(DateUtils.parseDuration("-2m")).toBe(-120_000);
    });
  });

  describe("wait", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    it("should resolve after given delay", async () => {
      const p = DateUtils.wait(200);
      vi.advanceTimersByTime(200);
      await expect(p).resolves.toBeUndefined();
    });
  });
});
