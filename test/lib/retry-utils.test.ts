/**
 * retry-utils.test.ts
 *
 * Coverage:
 * - ensure exhausted retries throw SmokerError with standardized code/domain
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ERR_RETRY_EXHAUSTED, SmokerError } from "../../src/errors";
import { retryAsync } from "../../src/lib/retry-utils";

describe("RetryUtils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("should throw SmokerError with ERR_RETRY_EXHAUSTED and domain 'retry' when attempts exhausted", async () => {
    const op = async () => {
      throw new Error("boom");
    };
    try {
      await retryAsync(op, { retries: 1, delayMs: 1, backoff: "fixed" });
      throw new Error("Expected to throw");
    } catch (e) {
      expect(SmokerError.isSmokerError(e)).toBe(true);
      const err = e as SmokerError;
      expect(err.code).toBe(ERR_RETRY_EXHAUSTED);
      expect(err.domain).toBe("retry");
    }
  });

  it("should use fixed backoff delays for each retry", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, { retries: 2, delayMs: 10, backoff: "fixed" }).catch((e) => e);
    await vi.runAllTimersAsync();
    await p;
    // Two sleeps (after attempt 1 and 2)
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1]);
    expect(delays).toEqual([10, 10]);
  });

  it("should use exponential backoff delays (base * 2^(attempt-1))", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, { retries: 2, delayMs: 10, backoff: "exponential" }).catch((e) => e);
    await vi.runAllTimersAsync();
    await p;
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1]);
    expect(delays).toEqual([10, 20]);
  });

  it("should compute exponential-jitter within [raw*(1-j), raw*(1+j)] and be deterministic with stubbed random", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    vi.spyOn(Math, "random").mockReturnValue(0); // pick min bound deterministically
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, {
      retries: 2,
      delayMs: 100,
      backoff: "exponential-jitter",
      jitterRatio: 0.5,
    }).catch((e) => e);
    await vi.runAllTimersAsync();
    await p;
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1] as number);
    // attempt 1: raw=100, min=50; attempt 2: raw=200, min=100
    expect(delays[0]).toBe(50);
    expect(delays[1]).toBe(100);
  });

  it("should cap delays at maxDelayMs when provided", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, {
      retries: 2,
      delayMs: 100,
      backoff: "exponential",
      maxDelayMs: 50,
    }).catch((e) => e);
    await vi.runAllTimersAsync();
    await p;
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1]);
    // computed [100, 200] -> capped to [50, 50]
    expect(delays).toEqual([50, 50]);
  });

  it("should invoke onAttemptError with attempt number for each failure", async () => {
    vi.useFakeTimers();
    const onAttemptError = vi.fn();
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, { retries: 2, delayMs: 1, backoff: "fixed", onAttemptError }).catch(
      (e) => e,
    );
    await vi.runAllTimersAsync();
    await p;
    expect(onAttemptError).toHaveBeenCalledTimes(3); // attempts 1..3 all failed
    expect(onAttemptError.mock.calls.map((c) => c[1])).toEqual([1, 2, 3]);
  });

  it("should use DEFAULTS.retries when retries is undefined (3 delays)", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, { delayMs: 5, backoff: "fixed" }).catch((e) => e);
    await vi.runAllTimersAsync();
    await p;
    // defaults.retries = 3 -> totalAttempts = 4; delays for attempts 1..3
    expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
  });

  it("should perform zero delays when retries = 0 (single attempt)", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, { retries: 0, delayMs: 10, backoff: "fixed" }).catch((e) => e);
    await vi.runAllTimersAsync();
    await p;
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("should clamp totalAttempts to at least 1 when retries is negative", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, {
      retries: -5 as unknown as number,
      delayMs: 10,
      backoff: "fixed",
    }).catch((e) => e);
    await vi.runAllTimersAsync();
    await p;
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
