/**
 * KafkaConnectionError
 *
 * Concrete error representing failures to establish a Kafka connection.
 * Defaults to retryable, as connection issues may be transient.
 */

import { ERR_KAFKA_CONNECT } from "./codes";
import { KafkaClientError, type KafkaClientErrorDetails } from "./kafka-client-error";

export interface KafkaConnectionDetails extends KafkaClientErrorDetails {
  brokers: string[];
}

/**
 * Concrete error representing failures to establish a Kafka connection.
 * Defaults to retryable, as connection issues may be transient.
 */
export class KafkaConnectionError extends KafkaClientError<KafkaConnectionDetails> {
  constructor(
    message: string,
    details: KafkaConnectionDetails,
    opts?: Partial<{
      retryable: boolean;
    }>,
  ) {
    super(message, {
      code: ERR_KAFKA_CONNECT,
      details,
      retryable: opts?.retryable ?? true,
    });
  }

  /**
   * Factory for a retryable connection failure.
   *
   * @param brokers - List of broker addresses the client attempted to connect to
   */
  static connecting(brokers: string[]) {
    return new KafkaConnectionError(
      "Kafka connection failed",
      { brokers, component: "kafka" },
      {
        retryable: true,
      },
    );
  }
}
