/**
 * MessagingClientError (abstract)
 *
 * Base class for messaging client errors (Kafka, MQTT, etc.).
 */

import { ClientError, type ClientErrorDetails, type ClientErrorOptions } from "./client-error";

export interface MessagingClientErrorDetails extends ClientErrorDetails {
  component: "kafka" | "mqtt"; // required for messaging
  clientId?: string;
}

export abstract class MessagingClientError<
  Details extends MessagingClientErrorDetails = MessagingClientErrorDetails,
> extends ClientError<Details> {
  constructor(message: string, opts: ClientErrorOptions<Details>) {
    super(message, { ...opts, domain: opts.domain ?? "messaging" });
  }
}
