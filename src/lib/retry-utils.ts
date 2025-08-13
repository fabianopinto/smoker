/**
 * Retry Utilities
 *
 * Provides retry helpers with configurable backoff strategies for wrapping async operations
 * that may fail transiently (e.g., network calls, eventual consistency checks).
 *
 * Usage example:
 * ```ts
 * const result = await retryAsync(() => fetchThing(), {
 *   retries: 4,
 *   delayMs: 200,
 *   backoff: "exponential-jitter",
 *   maxDelayMs: 5_000,
 *   onAttemptError: (err, attempt) => logger.warn({ attempt, err }, "retrying"),
 * });
 * ```
 */

import { ERR_RETRY_EXHAUSTED } from "../errors";
import { SmokerError } from "../errors/smoker-error";
import { logger } from "./logger";

export type BackoffStrategy = "fixed" | "exponential" | "exponential-jitter";

export interface RetryOptions {
  /** Number of retries after the first attempt (total attempts = retries + 1). */
  retries?: number;
  /** Base delay in milliseconds used by backoff calculation. */
  delayMs?: number;
  /** Optional maximum cap for per-attempt delays. */
  maxDelayMs?: number;
  /** Backoff strategy to use for computing successive delays. */
  backoff?: BackoffStrategy;
  /** Jitter ratio (0..1) used when backoff = "exponential-jitter". */
  jitterRatio?: number;
  /** Optional callback invoked on each attempt error before delaying. */
  onAttemptError?: (error: unknown, attempt: number) => void | Promise<void>;
}

const DEFAULTS: Required<Omit<RetryOptions, "onAttemptError" | "maxDelayMs">> & {
  maxDelayMs: number | undefined;
  onAttemptError?: RetryOptions["onAttemptError"];
} = {
  retries: 3,
  delayMs: 200,
  maxDelayMs: undefined,
  backoff: "exponential",
  jitterRatio: 0.25,
  onAttemptError: (error, attempt) => {
    logger.warn({ attempt, error }, "retry-utils: attempt failed");
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextDelay(base: number, attempt: number, opts: Required<RetryOptions>): number {
  const { backoff, jitterRatio } = opts;
  let delay = base;
  switch (backoff) {
    case "fixed":
      delay = base;
      break;
    case "exponential":
      delay = base * 2 ** (attempt - 1);
      break;
    case "exponential-jitter": {
      const raw = base * 2 ** (attempt - 1);
      const jitter = raw * jitterRatio;
      const min = Math.max(0, raw - jitter);
      const max = raw + jitter;
      delay = Math.floor(min + Math.random() * (max - min));
      break;
    }
  }
  return delay;
}

/**
 * Retries an async function according to the provided options.
 *
 * @param operation - Async function to execute
 * @param options - Retry options controlling attempts and backoff
 * @returns Resolves with the operation result or rejects after exhausting attempts
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULTS, ...options } as Required<RetryOptions>;
  let attempt = 0;
  // total attempts = retries + 1
  const totalAttempts = Math.max(1, (options.retries ?? DEFAULTS.retries) + 1);

  // first attempt without delay
  while (attempt < totalAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (err) {
      if (opts.onAttemptError) await opts.onAttemptError(err, attempt);
      if (attempt >= totalAttempts)
        throw new SmokerError("Retry attempts exhausted", {
          code: ERR_RETRY_EXHAUSTED,
          domain: "retry",
          details: {
            retries: opts.retries,
            delayMs: opts.delayMs,
            backoff: opts.backoff,
            maxDelayMs: opts.maxDelayMs,
            lastAttempt: attempt,
          },
          retryable: false,
          severity: "error",
          cause: err,
        });
      let delay = nextDelay(opts.delayMs, attempt, opts);
      if (opts.maxDelayMs != null) delay = Math.min(delay, opts.maxDelayMs);
      await sleep(delay);
    }
  }
  // Unreachable by design: loop always either returns on success or throws on exhaustion.
  // Present only to satisfy TypeScript's control-flow analysis.
  throw new SmokerError("Retry attempts exhausted", {
    code: ERR_RETRY_EXHAUSTED,
    domain: "retry",
    details: { reason: "loop-exit-guard" },
    retryable: false,
    severity: "error",
  });
}
