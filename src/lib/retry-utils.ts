/**
 * @fileoverview Retry Utilities
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

import { AppError } from "@fabianopinto/errors";
import { logger } from "@fabianopinto/logger";
import { ERR_RETRY_EXHAUSTED } from "../errors";

export type BackoffStrategy = "fixed" | "exponential" | "exponential-jitter";

/**
 * Options for retrying async operations
 *
 * @property {number} [retries] - Optional number of retries after the first attempt (total attempts = retries + 1).
 * @property {number} [delayMs] - Optional base delay in milliseconds used by backoff calculation.
 * @property {number} [maxDelayMs] - Optional maximum cap for per-attempt delays.
 * @property {BackoffStrategy} [backoff] - Optional backoff strategy to use for computing successive delays.
 * @property {number} [jitterRatio] - Optional jitter ratio (0..1) used when backoff = "exponential-jitter".
 * @property {((error: unknown, attempt: number) => void | Promise<void>)} [onAttemptError] - Optional callback invoked on each attempt error before delaying.
 */
export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  maxDelayMs?: number;
  backoff?: BackoffStrategy;
  jitterRatio?: number;
  onAttemptError?: (error: unknown, attempt: number) => void | Promise<void>;
}

const DEFAULTS: Required<Omit<RetryOptions, "onAttemptError" | "maxDelayMs">> & {
  maxDelayMs?: number;
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
 * @template T - The return type of the operation
 * @param {() => Promise<T>} operation - Async function to execute
 * @param {RetryOptions} options - Retry options controlling attempts and backoff
 * @returns {Promise<T>} Resolves with the operation result or rejects after exhausting attempts
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
  while (true) {
    attempt += 1;
    if (logger.isLevelEnabled("trace")) {
      logger.trace({ attempt, totalAttempts, opts }, "retry-utils: starting attempt");
    }
    try {
      const result = await operation();
      if (logger.isLevelEnabled("debug")) {
        logger.debug({ attempt }, "retry-utils: attempt succeeded");
      }
      return result;
    } catch (err) {
      if (logger.isLevelEnabled("debug")) {
        logger.debug({ attempt, totalAttempts, err }, "retry-utils: attempt failed");
      }
      if (opts.onAttemptError) await opts.onAttemptError(err, attempt);
      if (attempt >= totalAttempts)
        throw new AppError("Retry attempts exhausted", {
          code: ERR_RETRY_EXHAUSTED,
          context: {
            component: "retry-utils",
            retries: opts.retries,
            delayMs: opts.delayMs,
            backoff: opts.backoff,
            maxDelayMs: opts.maxDelayMs,
            lastAttempt: attempt,
          },
          isOperational: true,
          cause: err,
        });
      let delay = nextDelay(opts.delayMs, attempt, opts);
      const capped = opts.maxDelayMs != null && delay > opts.maxDelayMs;
      if (opts.maxDelayMs != null) delay = Math.min(delay, opts.maxDelayMs);
      if (logger.isLevelEnabled("debug")) {
        logger.debug(
          { attempt, nextDelayMs: delay, wasCapped: capped },
          "retry-utils: sleeping before next attempt",
        );
      }
      await sleep(delay);
    }
  }
}
