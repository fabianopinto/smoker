/**
 * Service client exports
 * This file exports all client implementations for easy consumption in other parts of the application
 */

// Base client interface and class
export { BaseServiceClient, type ServiceClient } from "./core";

// Service-specific clients
export { CloudWatchClient, type CloudWatchServiceClient } from "./aws/cloudwatch";
export { KinesisClient, type KinesisRecord, type KinesisServiceClient } from "./aws/kinesis";
export { S3Client, type S3ServiceClient } from "./aws/s3";
export { SqsClient, type SqsMessage, type SqsServiceClient } from "./aws/sqs";
export { SsmClient, type SsmServiceClient } from "./aws/ssm";
export { RestClient, type RestServiceClient } from "./http/rest";
export { KafkaClient, type KafkaMessage, type KafkaServiceClient } from "./messaging/kafka";
export { MqttClient, type MqttServiceClient } from "./messaging/mqtt";
