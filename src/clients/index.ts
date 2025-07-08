/**
 * Service client exports
 * This file exports all client implementations for easy consumption in other parts of the application
 */

// Base client interface and class
export { BaseServiceClient, type ServiceClient } from "./clients";

// Service-specific clients
export { CloudWatchClient, type CloudWatchServiceClient } from "./cloudwatch";
export { KafkaClient, type KafkaMessage, type KafkaServiceClient } from "./kafka";
export { KinesisClient, type KinesisRecord, type KinesisServiceClient } from "./kinesis";
export { MqttClient, type MqttServiceClient } from "./mqtt";
export { RestClient, type RestServiceClient } from "./rest";
export { S3Client, type S3ServiceClient } from "./s3";
export { SqsClient, type SqsMessage, type SqsServiceClient } from "./sqs";
export { SsmClient, type SsmServiceClient } from "./ssm";
