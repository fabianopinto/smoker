/**
 * MqttClientError (abstract)
 *
 * Base class for MQTT client-related errors. Enforces `details.component = "mqtt"` and provides
 * a common diagnostics shape for MQTT-specific failures.
 */

import { type ClientErrorOptions } from "./client-error";
import { MessagingClientError, type MessagingClientErrorDetails } from "./messaging-client-error";

export interface MqttClientErrorDetails extends MessagingClientErrorDetails {
  component: "mqtt";
  url?: string;
}

export abstract class MqttClientError<
  Details extends MqttClientErrorDetails = MqttClientErrorDetails,
> extends MessagingClientError<Details> {
  constructor(message: string, opts: ClientErrorOptions<Details>) {
    super(message, {
      ...opts,
      // Spread first, then force component to avoid duplicate key warning and ensure override
      details: { ...(opts.details as Details), component: "mqtt" },
    });
  }
}
