# Operations Guide

[← Back to README](doc1.md)

This guide covers how to operate the Smoker framework, including local execution, configuration management, and AWS deployment.

## Table of Contents

- [Local Execution](#local-execution)
- [Configuration Management](#configuration-management)
- [AWS Deployment](#aws-deployment)
- [Lambda Integration](#lambda-integration)
- [Environment Options](#environment-options)
- [Monitoring and Logging](#monitoring-and-logging)
- [CI/CD Integration](#cicd-integration)

## Local Execution

### Running Smoke Tests Locally

1. Build the project:
   ```bash
   npm run build
   ```

2. Run all tests:
   ```bash
   npm start
   ```

3. Run specific features:
   ```bash
   npm start -- --paths "dist/features/api/**/*.feature"
   ```

4. Run tests with specific tags:
   ```bash
   npm start -- --tags "@smoke and not @wip"
   ```

### Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--paths` | Glob patterns for feature files | `--paths "dist/features/api/**/*.feature"` |
| `--tags` | Cucumber tag expression | `--tags "@api and not @wip"` |
| `--config` | Path to config file | `--config "./config/test.json"` |
| `--format` | Output format | `--format "json:results.json"` |

## Configuration Management

### Configuration Sources

The framework supports multiple configuration sources:

1. **JSON Files**: Local configuration files
2. **S3 Objects**: Configuration stored in S3 buckets
3. **Environment Variables**: System environment variables
4. **AWS SSM Parameters**: Secure parameter storage
5. **Lambda Event**: Configuration provided in Lambda event

### Local Configuration Files

Create JSON configuration files:

```json
{
  "apiUrl": "https://api.example.com",
  "timeout": 5000,
  "credentials": {
    "username": "testuser",
    "password": "password123"
  }
}
```

Load configuration files:

```typescript
import { addConfigurationFile, loadConfigurations } from "./support/config";

// Add configuration file
addConfigurationFile("./config/default.json");

// Load all configurations
await loadConfigurations();
```

### Using S3 for Configuration

Store configuration in S3 buckets:

```typescript
// Load configuration from S3
addConfigurationFile("s3://my-bucket/config.json");

// With specific region
addS3ConfigurationFile("s3://my-bucket/config.json", "us-west-2");
```

Required IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::my-bucket/config.json"
    }
  ]
}
```

### Using SSM Parameter Store

Store sensitive configuration in AWS SSM Parameter Store:

1. Create parameters in AWS SSM:
   - `/my-app/api-key` (SecureString)
   - `/my-app/db/password` (SecureString)

2. Reference parameters in configuration:

```json
{
  "apiKey": "ssm://my-app/api-key",
  "database": {
    "password": "ssm://my-app/db/password"
  }
}
```

Required IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/my-app/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": "arn:aws:kms:*:*:key/your-kms-key-id"
    }
  ]
}
```

## AWS Deployment

### Deploying with CDK

The framework includes AWS CDK infrastructure code for deploying as a Lambda function:

1. Install CDK dependencies:
   ```bash
   npm install --prefix cdk
   ```

2. Configure the CDK stack in `cdk/lib/smoker-stack.ts`:
   ```typescript
   // Customize Lambda function properties
   const smokerFunction = new lambda.Function(this, 'SmokerFunction', {
     runtime: lambda.Runtime.NODEJS_18_X,
     handler: 'dist/index.handler',
     code: lambda.Code.fromAsset('../'),
     timeout: Duration.minutes(5),
     memorySize: 512,
     environment: {
       NODE_ENV: 'production',
       LOG_LEVEL: 'info',
     },
   });
   
   // Add required permissions
   smokerFunction.addToRolePolicy(new iam.PolicyStatement({
     actions: ['s3:GetObject'],
     resources: ['arn:aws:s3:::my-bucket/*'],
   }));
   ```

3. Deploy the stack:
   ```bash
   cd cdk
   npm run cdk deploy
   ```

### Required IAM Permissions

The Lambda function requires permissions for:

1. **S3 Access**: Reading configuration files and test data
   ```json
   {
     "Effect": "Allow",
     "Action": ["s3:GetObject"],
     "Resource": "arn:aws:s3:::my-bucket/*"
   }
   ```

2. **SSM Parameter Store**: Accessing secure configuration
   ```json
   {
     "Effect": "Allow",
     "Action": ["ssm:GetParameter", "ssm:GetParameters"],
     "Resource": "arn:aws:ssm:*:*:parameter/my-app/*"
   }
   ```

3. **CloudWatch Logs**: Writing logs
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "logs:CreateLogGroup",
       "logs:CreateLogStream",
       "logs:PutLogEvents"
     ],
     "Resource": "*"
   }
   ```

4. **Service-Specific Permissions**: Based on which AWS services your tests interact with

## Lambda Integration

### Lambda Event Structure

When invoking the Lambda function, provide configuration in the event:

```json
{
  "paths": ["dist/features/api/**/*.feature"],
  "tags": "@api and not @wip",
  "config": {
    "apiUrl": "https://api.example.com",
    "timeout": 5000
  },
  "configFiles": [
    "./config/prod-env.json",
    "s3://my-bucket/configs/prod-settings.json"
  ]
}
```

### Lambda Environment Variables

Configure environment variables in the Lambda function:

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `LOG_LEVEL` | Logging level | `info` |
| `CONFIG_PATH` | Default config path | `./config/default.json` |
| `CUCUMBER_PUBLISH_TOKEN` | Cucumber reports token | `abcd-1234` |

### Invoking the Lambda Function

Invoke the Lambda function using the AWS CLI:

```bash
aws lambda invoke \
  --function-name SmokerFunction \
  --payload '{"paths":["dist/features/api/**/*.feature"],"tags":"@smoke"}' \
  response.json
```

Or using the AWS SDK:

```typescript
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient({ region: "us-east-1" });
const command = new InvokeCommand({
  FunctionName: "SmokerFunction",
  Payload: JSON.stringify({
    paths: ["dist/features/api/**/*.feature"],
    tags: "@smoke",
  }),
});

const response = await client.send(command);
```

## Environment Options

### Cucumber Options

Configure Cucumber.js behavior:

| Option | Description | Example |
|--------|-------------|---------|
| `paths` | Feature file paths | `["dist/features/api/**/*.feature"]` |
| `tags` | Tag expression | `"@smoke and not @wip"` |
| `format` | Output format | `"json:results.json"` |
| `parallel` | Run in parallel | `2` |
| `retry` | Retry count | `1` |

### Framework Options

Configure the Smoker framework:

| Option | Description | Example |
|--------|-------------|---------|
| `configFiles` | Configuration files | `["./config/default.json"]` |
| `config` | Inline configuration | `{"apiUrl":"https://api.example.com"}` |
| `logLevel` | Logging level | `"info"` |
| `timeout` | Global timeout (ms) | `10000` |

## Monitoring and Logging

### CloudWatch Logs

Lambda function logs are automatically sent to CloudWatch Logs:

1. View logs in the AWS Console:
   - Navigate to CloudWatch > Log groups > `/aws/lambda/SmokerFunction`

2. Filter logs by execution:
   - Use filter pattern: `"[INFO]"` or `"[ERROR]"`

### Custom Metrics

Publish custom metrics to CloudWatch:

```typescript
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const client = new CloudWatchClient({ region: "us-east-1" });
await client.send(new PutMetricDataCommand({
  Namespace: "Smoker",
  MetricData: [
    {
      MetricName: "TestsPassed",
      Value: passedCount,
      Unit: "Count",
      Dimensions: [
        { Name: "Environment", Value: "Production" },
        { Name: "TestSuite", Value: "API" },
      ],
    },
  ],
}));
```

### Cucumber Reports

Generate Cucumber reports for test results:

1. Configure report format:
   ```bash
   npm start -- --format "json:cucumber-report.json"
   ```

2. Generate HTML report:
   ```bash
   npx cucumber-html-reporter --json cucumber-report.json --output cucumber-report.html
   ```

3. Publish to Cucumber Reports service:
   ```bash
   export CUCUMBER_PUBLISH_TOKEN=your-token
   npm start -- --publish
   ```

## CI/CD Integration

### GitHub Actions

Example GitHub Actions workflow:

```yaml
name: Smoke Tests

on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
  workflow_dispatch:        # Manual trigger

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build project
        run: npm run build
        
      - name: Run smoke tests
        run: npm start -- --tags "@smoke"
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
          
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: cucumber-report
          path: cucumber-report.json
```

### AWS CodePipeline

Integrate with AWS CodePipeline:

1. Create a CodeBuild project:
   ```yaml
   version: 0.2
   
   phases:
     install:
       runtime-versions:
         nodejs: 18
       commands:
         - npm ci
     build:
       commands:
         - npm run build
         - npm start -- --tags "@smoke" --format "json:cucumber-report.json"
   
   artifacts:
     files:
       - cucumber-report.json
       - cucumber-report.html
   ```

2. Add the CodeBuild project to your CodePipeline
