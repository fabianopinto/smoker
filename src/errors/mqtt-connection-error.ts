/**
 * MqttConnectionError / MqttDisconnectError
 */

import { ERR_MQTT_CONNECT, ERR_MQTT_DISCONNECT } from "./codes";
import { MqttClientError, type MqttClientErrorDetails } from "./mqtt-client-error";

export interface MqttConnectionDetails extends MqttClientErrorDetails {
  clientId: string;
  url?: string;
}

export class MqttConnectionError extends MqttClientError<MqttConnectionDetails> {
  constructor(
    message: string,
    details: MqttConnectionDetails,
    opts?: Partial<{ retryable: boolean }>,
  ) {
    super(message, {
      code: ERR_MQTT_CONNECT,
      details,
      retryable: opts?.retryable ?? true,
    });
  }

  static connecting(clientId: string, url?: string) {
    return new MqttConnectionError(
      "MQTT connection failed",
      { component: "mqtt", clientId, url },
      {
        retryable: true,
      },
    );
  }
}

export class MqttDisconnectError extends MqttClientError<MqttConnectionDetails> {
  constructor(
    message: string,
    details: MqttConnectionDetails,
    opts?: Partial<{ retryable: boolean }>,
  ) {
    super(message, {
      code: ERR_MQTT_DISCONNECT,
      details,
      retryable: opts?.retryable ?? false,
    });
  }

  static disconnecting(clientId: string, url?: string) {
    return new MqttDisconnectError("MQTT disconnect failed", { component: "mqtt", clientId, url });
  }
}
