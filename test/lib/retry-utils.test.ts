/**
 * retry-utils.test.ts
 *
 * Coverage:
 * - ensure exhausted retries throw SmokerError with standardized code/domain,
 *   and that logs are produced with appropriate levels
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERR_RETRY_EXHAUSTED, SmokerError } from "../../src/errors";
import { logger } from "../../src/lib/logger";
import { retryAsync } from "../../src/lib/retry-utils";

describe("RetryUtils", () => {
  let traceSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Enable trace/debug logging paths via logger level
    logger.setLevel("trace");
    traceSpy = vi
      .spyOn(logger as unknown as { trace: (...args: unknown[]) => void }, "trace")
      .mockImplementation(() => undefined);
    debugSpy = vi
      .spyOn(logger as unknown as { debug: (...args: unknown[]) => void }, "debug")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should throw SmokerError with ERR_RETRY_EXHAUSTED and domain 'retry' when attempts exhausted", async () => {
    vi.useFakeTimers();
    const op = async () => {
      throw new Error("boom");
    };
    const p = retryAsync(op, { retries: 1, delayMs: 1, backoff: "fixed" }).catch((e) => e);
    await vi.runAllTimersAsync();
    const e = await p;
    expect(SmokerError.isSmokerError(e)).toBe(true);
    const err = e as SmokerError;
    expect(err.code).toBe(ERR_RETRY_EXHAUSTED);
    expect(err.domain).toBe("retry");
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
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const op = async () => {
      throw new Error("boom");
    };
    // No timers should be scheduled; promise should reject immediately
    const e = await retryAsync(op, { retries: 0, delayMs: 10, backoff: "fixed" }).catch(
      (err) => err,
    );
    expect(SmokerError.isSmokerError(e)).toBe(true);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
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

  it("should log trace on attempt start and debug on failure/success/sleep", async () => {
    vi.useFakeTimers();

    // Operation fails once, then succeeds
    const op: () => Promise<string> = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");

    const p = retryAsync(op, { retries: 1, delayMs: 10, backoff: "fixed" });

    // First failure schedules one sleep
    await vi.advanceTimersByTimeAsync(10);
    const result = await p;
    expect(result).toBe("ok");

    // Trace called for each attempt start (2 attempts)
    expect(traceSpy).toHaveBeenCalled();
    const traceMessages = traceSpy.mock.calls.map((c: unknown[]) => c[1] as string);
    expect(traceMessages).toContain("retry-utils: starting attempt");

    // Debug called for failure, sleeping, and success
    const debugMessages = debugSpy.mock.calls.map((c: unknown[]) => c[1] as string);
    expect(debugMessages).toContain("retry-utils: attempt failed");
    expect(debugMessages).toContain("retry-utils: sleeping before next attempt");
    expect(debugMessages).toContain("retry-utils: attempt succeeded");

    // isLevelEnabled is stubbed to enable logs
  });
});
