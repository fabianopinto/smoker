#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import "source-map-support/register";
import { SmokerStack } from "../lib/smoker-stack";

/**
 * Main entry point for CDK application
 * Deploys Smoker testing framework to AWS Lambda
 */
const app = new cdk.App();

// Get environment from context or env vars
const environment = app.node.tryGetContext("environment") || process.env.ENVIRONMENT || "dev";

// Create different configurations based on environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const envConfigs: Record<string, any> = {
  dev: {
    memorySize: 1024,
    timeoutMinutes: 5,
    logRetentionDays: logs.RetentionDays.ONE_WEEK,
    createAlarms: false,
  },
  test: {
    memorySize: 1536,
    timeoutMinutes: 10,
    logRetentionDays: logs.RetentionDays.TWO_WEEKS,
    createAlarms: true,
  },
  prod: {
    memorySize: 2048,
    timeoutMinutes: 15,
    logRetentionDays: logs.RetentionDays.ONE_MONTH,
    createAlarms: true,
  },
};

// Get configuration for current environment
const envConfig = envConfigs[environment] || envConfigs.dev;

// Deploy the stack
new SmokerStack(app, `SmokerStack-${environment}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  description: `Smoker testing framework Lambda deployment (${environment})`,
  environment,
  ...envConfig,
});

// Tag all resources in this stack
cdk.Tags.of(app).add("project", "smoker");
cdk.Tags.of(app).add("environment", environment);
