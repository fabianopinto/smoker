/**
 * KafkaClientError (abstract)
 *
 * Base class for Kafka client-related errors. Enforces `details.component = "kafka"` and
 * provides a common shape for Kafka-specific diagnostics.
 */

import { type ClientErrorOptions } from "./client-error";
import { MessagingClientError, type MessagingClientErrorDetails } from "./messaging-client-error";

export interface KafkaClientErrorDetails extends MessagingClientErrorDetails {
  component: "kafka";
  brokers?: string[];
  topic?: string;
  partition?: number;
}

export abstract class KafkaClientError<
  Details extends KafkaClientErrorDetails = KafkaClientErrorDetails,
> extends MessagingClientError<Details> {
  constructor(message: string, opts: ClientErrorOptions<Details>) {
    super(message, {
      ...opts,
      // Spread first, then force component to avoid duplicate key warning and ensure override
      details: { ...(opts.details as Details), component: "kafka" },
    });
  }
}
