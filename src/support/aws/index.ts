/**
 * AWS Module Index
 *
 * This barrel file exports all AWS client implementations and utilities from the aws directory,
 * providing a unified entry point for AWS-related functionality. This includes S3 and SSM
 * client wrappers, parameter cache, and utility functions.
 */

export {
  DEFAULT_AWS_REGION,
  type IS3Client,
  type ISSMClient,
  type ParsedS3Url,
  parseS3Url,
  S3ClientWrapper,
  SSMClientWrapper,
  ssmParameterCache,
  streamToString,
} from "./aws-clients";
