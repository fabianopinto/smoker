/**
 * Error codes registry
 *
 * Stable, machine-readable error codes grouped by domain. These codes are used for
 * logging, metrics, alerting, and external mappings (e.g., HTTP responses).
 */

// Configuration domain
export const ERR_INVALID_KEY_PATH = "ERR_INVALID_KEY_PATH";
export const ERR_CONFIG_PARSE = "ERR_CONFIG_PARSE";
export const ERR_CONFIG_MISSING = "ERR_CONFIG_MISSING";

// IO domain
export const ERR_FILE_NOT_FOUND = "ERR_FILE_NOT_FOUND";
export const ERR_FS_READ = "ERR_FS_READ";
export const ERR_JSON_PARSE = "ERR_JSON_PARSE";

// AWS domain
export const ERR_S3_INVALID_URL = "ERR_S3_INVALID_URL";
export const ERR_S3_ACCESS_DENIED = "ERR_S3_ACCESS_DENIED";
export const ERR_S3_READ = "ERR_S3_READ";
export const ERR_SSM_PARAMETER = "ERR_SSM_PARAMETER";

// Messaging domain (Kafka/MQTT)
export const ERR_KAFKA_CONNECT = "ERR_KAFKA_CONNECT";
export const ERR_KAFKA_CONSUMER = "ERR_KAFKA_CONSUMER";
export const ERR_KAFKA_PRODUCER = "ERR_KAFKA_PRODUCER";

export const ERR_MQTT_CONNECT = "ERR_MQTT_CONNECT";
export const ERR_MQTT_SUBSCRIBE = "ERR_MQTT_SUBSCRIBE";
export const ERR_MQTT_DISCONNECT = "ERR_MQTT_DISCONNECT";
export const ERR_MQTT_PUBLISH = "ERR_MQTT_PUBLISH";
export const ERR_MQTT_UNSUBSCRIBE = "ERR_MQTT_UNSUBSCRIBE";

// Validation domain
export const ERR_VALIDATION = "ERR_VALIDATION";
