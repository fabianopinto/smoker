/**
 * AWS Service Clients Module
 *
 * This barrel file exports all AWS service client implementations and interfaces
 * for easy consumption in other parts of the application. It provides a centralized
 * access point for all AWS client functionality, including CloudWatch, Kinesis, S3,
 * SQS, and SSM clients.
 */

export {
  CloudWatchClient,
  type CloudWatchLogEvent,
  type CloudWatchServiceClient,
} from "./aws-cloudwatch";
export { delay, KinesisClient, type KinesisRecord, type KinesisServiceClient } from "./aws-kinesis";
export { S3Client, type S3ServiceClient } from "./aws-s3";
export { SqsClient, type SqsMessage, type SqsServiceClient } from "./aws-sqs";
export { SsmClient, type SsmServiceClient } from "./aws-ssm";
