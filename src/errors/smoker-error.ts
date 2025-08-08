/**
 * SmokerError
 *
 * Root application error for the Smoker project. Provides a consistent, structured
 * error surface with stable codes and domains, safe serialization, and error causes.
 */

export type SmokerSeverity = "info" | "warn" | "error" | "fatal";

export interface SmokerErrorOptions<
  Details extends Record<string, unknown> = Record<string, unknown>,
> {
  code: string; // stable, machine-readable error code
  domain: string; // logical area: e.g. "config", "messaging", "aws", "io", "validation"
  message?: string; // optional override for message
  details?: Details; // serializable, safe diagnostic details (no secrets)
  severity?: SmokerSeverity;
  retryable?: boolean;
  cause?: unknown; // original error or reason
}

/**
 * Root error class. All domain errors should extend this.
 */
export class SmokerError<
  Details extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  public readonly code: string;
  public readonly domain: string;
  public readonly details: Details;
  public readonly severity: SmokerSeverity;
  public readonly retryable: boolean;
  public readonly cause?: unknown;
  public readonly timestamp: string;

  /**
   * Create a new SmokerError
   *
   * @param message - Human-readable message (used if opts.message is not provided)
   * @param opts - Options including code, domain, details, severity, retryable, and cause
   */
  constructor(message: string, opts: SmokerErrorOptions<Details>) {
    // Use simple super call for broad TS compatibility, manually assign cause below
    super(opts.message ?? message);
    this.name = new.target.name;
    this.code = opts.code;
    this.domain = opts.domain;
    this.details = (opts.details ?? {}) as Details;
    this.severity = opts.severity ?? "error";
    this.retryable = opts.retryable ?? false;
    this.cause = opts.cause;
    this.timestamp = new Date().toISOString();

    // Manually attach native cause for runtimes that surface it
    if (opts.cause !== undefined) {
      try {
        (this as unknown as { cause?: unknown }).cause = opts.cause;
      } catch {
        /* no-op */
      }
    }

    // Maintains proper prototype chain (for transpiled output)
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Safe JSON representation (no stack). Useful for logs and external responses.
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      domain: this.domain,
      message: this.message,
      severity: this.severity,
      retryable: this.retryable,
      details: this.details,
      // Only expose a safe representation of cause by default
      cause:
        this.cause instanceof Error
          ? { name: this.cause.name, message: this.cause.message }
          : this.cause,
      timestamp: this.timestamp,
    };
  }

  /** Type guard for SmokerError */
  static isSmokerError(value: unknown): value is SmokerError<Record<string, unknown>> {
    return value instanceof SmokerError;
  }

  static fromUnknown(message: string, opts: SmokerErrorOptions): SmokerError {
    return new SmokerError(message, opts);
  }
}
