/**
 * Errors Barrel
 *
 * Central export point for the Smoker error system. Re-exports the root error,
 * abstract families, concrete errors, and the stable error codes registry.
 */

export { ClientError, type ClientErrorDetails, type ClientErrorOptions } from "./client-error";
export {
  ERR_CONFIG_MISSING,
  ERR_CONFIG_PARSE,
  ERR_FILE_NOT_FOUND,
  ERR_FS_READ,
  ERR_INVALID_KEY_PATH,
  ERR_JSON_PARSE,
  ERR_KAFKA_CONNECT,
  ERR_KAFKA_CONSUMER,
  ERR_KAFKA_PRODUCER,
  ERR_MQTT_CONNECT,
  ERR_MQTT_DISCONNECT,
  ERR_MQTT_PUBLISH,
  ERR_MQTT_SUBSCRIBE,
  ERR_MQTT_UNSUBSCRIBE,
  ERR_S3_ACCESS_DENIED,
  ERR_S3_INVALID_URL,
  ERR_S3_READ,
  ERR_SSM_PARAMETER,
  ERR_VALIDATION,
} from "./codes";
export { KafkaClientError, type KafkaClientErrorDetails } from "./kafka-client-error";
export { type KafkaConnectionDetails, KafkaConnectionError } from "./kafka-connection-error";
export { MessagingClientError, type MessagingClientErrorDetails } from "./messaging-client-error";
export { MqttClientError, type MqttClientErrorDetails } from "./mqtt-client-error";
export {
  type MqttConnectionDetails,
  MqttConnectionError,
  MqttDisconnectError,
} from "./mqtt-connection-error";
export { SmokerError, type SmokerErrorOptions, type SmokerSeverity } from "./smoker-error";
