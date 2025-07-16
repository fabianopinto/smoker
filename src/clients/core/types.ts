/**
 * Client type enumeration
 * Defines all available service client types in the system
 * This enum is used for type-safe client identification and instantiation
 */

export enum ClientType {
  /** REST client for HTTP API interactions */
  REST = "rest",
  /** MQTT client for message broker interactions */
  MQTT = "mqtt",
  /** AWS S3 client for object storage operations */
  S3 = "s3",
  /** AWS CloudWatch client for logging and metrics */
  CLOUDWATCH = "cloudwatch",
  /** AWS SSM client for parameter store operations */
  SSM = "ssm",
  /** AWS SQS client for queue operations */
  SQS = "sqs",
  /** AWS Kinesis client for data streaming */
  KINESIS = "kinesis",
  /** Kafka client for event streaming */
  KAFKA = "kafka",
}

/**
 * Utility functions for working with client types
 * Provides helper methods for type conversion and validation
 */
export const ClientTypeUtils = {
  /**
   * Get all available client types as an array
   * @returns Array of all defined ClientType enum values
   */
  getAllTypes(): ClientType[] {
    return Object.values(ClientType);
  },

  /**
   * Convert a string to the corresponding client type enum value
   * @param type String representation of client type (case-insensitive)
   * @returns ClientType enum value if valid, undefined if no match found
   */
  fromString(type: string): ClientType | undefined {
    return Object.values(ClientType).find((clientType) => clientType === type.toLowerCase());
  },

  /**
   * Check if a string represents a valid client type
   * @param type String to validate against ClientType enum
   * @returns True if the string matches a valid client type, false otherwise
   */
  isValidType(type: string): boolean {
    return !!ClientTypeUtils.fromString(type);
  },
};
