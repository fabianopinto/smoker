/**
 * ClientError (abstract)
 *
 * Base class for errors originating from components under src/clients/.
 * Provides shared defaults and conventions for client-related failures.
 */

import { SmokerError, type SmokerErrorOptions, type SmokerSeverity } from "./smoker-error";

export interface ClientErrorDetails extends Record<string, unknown> {
  component?: string; // e.g., "kafka", "mqtt", "http", etc.
  operation?: string; // e.g., "connect", "subscribe", "send"
}

export interface ClientErrorOptions<Details extends ClientErrorDetails = ClientErrorDetails>
  extends Omit<SmokerErrorOptions<Details>, "domain"> {
  domain?: string; // allow override; default is "client"
}

export abstract class ClientError<
  Details extends ClientErrorDetails = ClientErrorDetails,
> extends SmokerError<Details> {
  constructor(message: string, opts: ClientErrorOptions<Details>) {
    super(message, {
      ...opts,
      domain: opts.domain ?? "client",
      severity: (opts.severity ??
        (opts.retryable ? ("warn" as SmokerSeverity) : "error")) as SmokerSeverity,
    });
  }
}
