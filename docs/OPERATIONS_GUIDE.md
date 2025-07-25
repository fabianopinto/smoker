# Operations Guide

[← Back to README](../README.md) | [Test Development Guide](TEST_DEVELOPMENT.md) | [Development Guide](DEVELOPMENT_GUIDE.md) | [Service Client Guide](SERVICE_CLIENT_GUIDE.md)

This comprehensive guide covers all operational aspects of the Smoker framework, including local execution, configuration management, AWS deployment, monitoring, and CI/CD integration.

## Table of Contents

- [Operating the Framework Locally](#operating-the-framework-locally)
- [Cucumber Options and Test Execution](#cucumber-options-and-test-execution)
- [Configuration Management](#configuration-management)
- [External References in Configuration](#external-references-in-configuration)
- [Running Smoke Tests Locally](#running-smoke-tests-locally)
- [Running Smoke Tests in AWS](#running-smoke-tests-in-aws)
- [Monitoring Smoke Tests in AWS](#monitoring-smoke-tests-in-aws)
- [Scaling Smoke Tests in AWS](#scaling-smoke-tests-in-aws)

## Operating the Framework Locally

### Prerequisites

Before running the Smoker framework locally, ensure you have:

- **Node.js 18+** and npm installed
- **AWS CLI configured** (for AWS features)
- **Appropriate permissions** for AWS services (if using AWS features)
- **TypeScript knowledge** (recommended for custom development)

### Basic Local Operation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build the project:**

   ```bash
   npm run build
   ```

3. **Run smoke tests:**
   ```bash
   npm start
   ```

### Environment Setup

Configure your local environment with necessary variables:

```bash
# Set log level
export SMOKER_LOG_LEVEL=info

# Set AWS region (if using AWS services)
export AWS_DEFAULT_REGION=us-east-1

# Set custom configuration
export SMOKER_CONFIG='{"api":{"baseUrl":"https://localhost:3000"}}'
```

## Cucumber Options and Test Execution

### Command Line Options

The framework supports comprehensive Cucumber.js options for flexible test execution:

| Option       | Description                     | Example                                    |
| ------------ | ------------------------------- | ------------------------------------------ |
| `--paths`    | Glob patterns for feature files | `--paths "dist/features/api/**/*.feature"` |
| `--tags`     | Cucumber tag expressions        | `--tags "@smoke and not @wip"`             |
| `--config`   | Configuration file path         | `--config config/staging.json`             |
| `--logLevel` | Logging verbosity               | `--logLevel debug`                         |
| `--timeout`  | Global step timeout (ms)        | `--timeout 30000`                          |
| `--parallel` | Number of parallel workers      | `--parallel 4`                             |
| `--format`   | Output format                   | `--format json:reports/results.json`       |

### Setting Cucumber Options

**Via Command Line:**

```bash
# Run specific features with tags
npm start -- --paths "dist/features/api/**/*.feature" --tags "@smoke"

# Run with custom configuration and debug logging
npm start -- --config config/production.json --logLevel debug

# Run in parallel with custom timeout
npm start -- --parallel 2 --timeout 60000
```

**Via Environment Variables:**

```bash
export CUCUMBER_PATHS="dist/features/api/**/*.feature"
export CUCUMBER_TAGS="@smoke and not @wip"
export CUCUMBER_PARALLEL=2
```

**Via Configuration File:**

```json
{
  "cucumber": {
    "paths": ["dist/features/api/**/*.feature"],
    "tags": "@smoke and not @wip",
    "parallel": 2,
    "timeout": 30000,
    "format": ["json:reports/results.json", "html:reports/results.html"]
  }
}
```

## Configuration Management

The Smoker framework provides a sophisticated configuration system that supports multiple sources with intelligent merging capabilities.

### Configuration Sources

#### 1. Programmatic Configuration Using Objects

Create configuration objects directly in your code:

```typescript
import { SmokeWorld } from "../src/world";

// In step definitions or setup
const config = {
  api: {
    baseUrl: "https://api.example.com",
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
    },
  },
  database: {
    connectionString: "postgresql://localhost:5432/testdb",
  },
};

// Apply configuration
this.setConfiguration(config);
```

#### 2. JSON Configuration Files

**Local Configuration Files:**

```json
// config/local.json
{
  "api": {
    "baseUrl": "http://localhost:3000",
    "timeout": 10000,
    "retries": 3
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "smoker_test"
  },
  "logging": {
    "level": "debug",
    "format": "json"
  }
}
```

**Environment-Specific Configuration:**

```json
// config/production.json
{
  "api": {
    "baseUrl": "https://api.production.com",
    "timeout": 5000,
    "authToken": "ssm:/production/api/token"
  },
  "database": {
    "connectionString": "ssm:/production/db/connection"
  }
}
```

#### 3. S3 JSON Objects

Store configuration in AWS S3 for centralized management:

```json
// s3://my-config-bucket/smoker/production.json
{
  "api": {
    "baseUrl": "https://api.production.com",
    "timeout": 5000,
    "headers": {
      "Authorization": "ssm:/production/api/auth-header"
    }
  },
  "monitoring": {
    "cloudwatchNamespace": "SmokerTests/Production",
    "reportsBucket": "smoker-reports-production"
  }
}
```

### The Merging Process

#### Deep Merging Process

The framework uses intelligent deep merging to combine configuration from multiple sources:

```typescript
// Base configuration
const base = {
  api: {
    baseUrl: "https://api.example.com",
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Smoker/1.0",
    },
  },
};

// Override configuration
const override = {
  api: {
    timeout: 10000,
    headers: {
      Authorization: "Bearer token123",
    },
  },
};

// Merged result preserves all properties
const merged = {
  api: {
    baseUrl: "https://api.example.com", // from base
    timeout: 10000, // from override
    headers: {
      "Content-Type": "application/json", // from base
      "User-Agent": "Smoker/1.0", // from base
      Authorization: "Bearer token123", // from override
    },
  },
};
```

#### Priority Order for Multiple Sources

Configuration sources are merged in the following priority order (highest to lowest):

1. **Command Line Arguments** (highest priority)
2. **Environment Variables**
3. **Programmatic Configuration**
4. **Local Configuration Files**
5. **S3 Configuration Files**
6. **Default Values** (lowest priority)

#### Deletion of Values/Branches

Use special syntax to delete configuration values or entire branches:

```json
{
  "api": {
    "timeout": null, // Deletes the timeout property
    "headers": null // Deletes the entire headers object
  },
  "database": null // Deletes the entire database configuration
}
```

## External References in Configuration

### Using SSM Parameters

#### Basics of AWS SSM CLI

AWS Systems Manager Parameter Store provides secure, hierarchical storage for configuration data:

**Create Parameters:**

```bash
# String parameter
aws ssm put-parameter \
  --name "/smoker/api/baseUrl" \
  --value "https://api.production.com" \
  --type "String"

# Secure string parameter
aws ssm put-parameter \
  --name "/smoker/api/authToken" \
  --value "secret-auth-token-12345" \
  --type "SecureString"
```

**Retrieve Parameters:**

```bash
# Get single parameter
aws ssm get-parameter --name "/smoker/api/baseUrl"

# Get parameter with decryption
aws ssm get-parameter --name "/smoker/api/authToken" --with-decryption

# Get parameters by path
aws ssm get-parameters-by-path --path "/smoker/api" --recursive
```

#### Using SSM Parameters in Configuration

Reference SSM parameters using the `ssm:` prefix:

```json
{
  "api": {
    "baseUrl": "ssm:/smoker/api/baseUrl",
    "authToken": "ssm:/smoker/api/authToken",
    "timeout": "ssm:/smoker/api/timeout"
  }
}
```

### Using S3 Content

#### Raw Content

Reference raw content from S3 objects:

```json
{
  "api": {
    "certificate": "s3://my-certs-bucket/api-cert.pem",
    "privateKey": "s3://my-certs-bucket/api-key.pem"
  }
}
```

#### Parsed JSON Content

Reference and parse JSON content from S3:

```json
{
  "api": {
    "endpoints": "s3+json://my-config-bucket/api-endpoints.json"
  }
}
```

#### Basics of AWS S3 CLI

**Upload Configuration Files:**

```bash
# Upload single file
aws s3 cp config/production.json s3://my-config-bucket/smoker/production.json

# Upload directory
aws s3 cp config/ s3://my-config-bucket/smoker/ --recursive
```

**Download Configuration Files:**

```bash
# Download single file
aws s3 cp s3://my-config-bucket/smoker/production.json config/production.json
```

### Notes

#### Runtime Resolution of SSM and S3 References

- **Lazy Resolution**: External references are resolved at runtime when first accessed
- **Caching**: Resolved values are cached for the duration of the test run
- **Error Handling**: Failed resolutions are retried with exponential backoff

#### Caching of Resolved References

```typescript
// First access: Fetches from SSM and caches
const token1 = await this.getConfig("api.authToken");

// Subsequent access: Returns cached value
const token2 = await this.getConfig("api.authToken");
```

#### Requirement About Permissions

**Required AWS Permissions for SSM:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      "Resource": ["arn:aws:ssm:*:*:parameter/smoker/*"]
    }
  ]
}
```

**Required AWS Permissions for S3:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::my-config-bucket/*"]
    }
  ]
}
```

## Running Smoke Tests Locally

### Basic Local Execution

```bash
# Run all tests
npm start

# Run with specific configuration
npm start -- --config config/local.json

# Run with debug logging
npm start -- --logLevel debug
```

### Generating Cucumber Reports

The framework supports multiple report formats:

```bash
# Generate HTML report
npm start -- --format html:reports/cucumber-report.html

# Generate multiple formats
npm start -- \
  --format json:reports/results.json \
  --format html:reports/results.html \
  --format junit:reports/junit.xml
```

### Advanced Local Testing

**Parallel Execution:**

```bash
# Run tests in parallel
npm start -- --parallel 4
```

**Environment-Specific Testing:**

```bash
# Test against staging environment
npm start -- --config config/staging.json --tags "@staging"
```

## Running Smoke Tests in AWS

### The Lambda Event Structure

The AWS Lambda handler accepts events in the following structure:

```typescript
interface LambdaEvent {
  // Cucumber configuration
  paths?: string[]; // Feature file paths
  tags?: string; // Tag expressions
  timeout?: number; // Step timeout in milliseconds
  parallel?: number; // Number of parallel workers

  // Configuration sources
  config?: string | object; // Configuration file path or object
  configS3?: string; // S3 configuration path

  // Execution options
  logLevel?: "error" | "warn" | "info" | "debug";
  dryRun?: boolean; // Validate without executing

  // Reporting options
  reportS3Bucket?: string; // S3 bucket for reports
  reportS3Key?: string; // S3 key for reports
  publishMetrics?: boolean; // Publish CloudWatch metrics
}
```

**Example Lambda Events:**

```json
{
  "tags": "@smoke",
  "config": "s3://my-config-bucket/smoker/production.json",
  "logLevel": "info",
  "publishMetrics": true,
  "reportS3Bucket": "smoker-reports",
  "reportS3Key": "production/smoke-test-results.json"
}
```

### The Lambda Environment Variables

Configure the Lambda function with these environment variables:

| Variable                   | Description            | Example                   |
| -------------------------- | ---------------------- | ------------------------- |
| `SMOKER_LOG_LEVEL`         | Default logging level  | `info`                    |
| `SMOKER_CONFIG`            | Default configuration  | `s3://bucket/config.json` |
| `SMOKER_TIMEOUT`           | Default step timeout   | `30000`                   |
| `SMOKER_REPORTS_BUCKET`    | Default reports bucket | `smoker-reports`          |
| `SMOKER_METRICS_NAMESPACE` | CloudWatch namespace   | `SmokerTests`             |

### Basics of AWS Lambda CLI

**Deploy Lambda Function:**

```bash
# Create deployment package
npm run package

# Create Lambda function
aws lambda create-function \
  --function-name smoker-tests \
  --runtime nodejs18.x \
  --role arn:aws:iam::123456789012:role/lambda-execution-role \
  --handler handler.lambdaHandler \
  --zip-file fileb://smoker.zip
```

**Invoke Lambda Function:**

```bash
# Synchronous invocation
aws lambda invoke \
  --function-name smoker-tests \
  --payload '{"tags":"@smoke","logLevel":"info"}' \
  response.json
```

## Monitoring Smoke Tests in AWS

### Publishing Results as CloudWatch Metrics Using Existing Client

The framework includes a built-in CloudWatch client for publishing test results:

```typescript
// Automatic metrics publishing
const results = await runSmokeTests(event);

// Published metrics include:
// - TestsTotal: Total number of tests executed
// - TestsPassed: Number of passed tests
// - TestsFailed: Number of failed tests
// - TestDuration: Total execution time
```

**Custom Metrics Configuration:**

```json
{
  "monitoring": {
    "cloudwatch": {
      "namespace": "SmokerTests/Production",
      "dimensions": {
        "Environment": "production",
        "TestSuite": "api-tests"
      }
    }
  }
}
```

### Logs Producing CloudWatch Custom Metrics

Configure log-based metrics for automated monitoring:

```bash
# Create metric filter for test failures
aws logs put-metric-filter \
  --log-group-name /aws/lambda/smoker-tests \
  --filter-name TestFailures \
  --filter-pattern '[timestamp, requestId, level="ERROR", message="Test failed:*"]' \
  --metric-transformations \
    metricName=TestFailures,metricNamespace=SmokerTests,metricValue=1
```

### Publishing Reports to S3 Using Existing Client

The framework automatically publishes detailed test reports to S3:

```json
{
  "reporting": {
    "s3": {
      "bucket": "smoker-reports",
      "keyPrefix": "production/",
      "formats": ["json", "html", "junit"],
      "includeTimestamp": true
    }
  }
}
```

## Scaling Smoke Tests in AWS

### CI/CD Integration

#### GitHub Actions

Create a GitHub Actions workflow for automated smoke testing:

```yaml
# .github/workflows/smoke-tests.yml
name: Smoke Tests

on:
  push:
    branches: [main, develop]
  schedule:
    # Run smoke tests every hour
    - cron: "0 * * * *"

jobs:
  smoke-tests:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        environment: [staging, production]

    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Run smoke tests
        run: |
          aws lambda invoke \
            --function-name smoker-tests-${{ matrix.environment }} \
            --payload '{
              "tags": "@smoke",
              "config": "s3://smoker-config/${{ matrix.environment }}.json",
              "publishMetrics": true
            }' \
            response.json
```

#### AWS CodePipeline

Create a CodePipeline for comprehensive CI/CD with smoke testing:

```yaml
# buildspec.yml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - npm install

  build:
    commands:
      - npm run build
      - npm run package

  post_build:
    commands:
      # Deploy Lambda function
      - aws lambda update-function-code --function-name smoker-tests --zip-file fileb://smoker.zip

      # Run smoke tests
      - |
        aws lambda invoke \
          --function-name smoker-tests \
          --payload '{"tags":"@smoke","publishMetrics":true}' \
          response.json

      # Check results
      - |
        if grep -q '"success": false' response.json; then
          echo "Smoke tests failed"
          exit 1
        fi

artifacts:
  files:
    - smoker.zip
    - response.json
```

---

For more detailed information on specific topics, see:

- [Test Development Guide](TEST_DEVELOPMENT.md) for creating smoke tests
- [Development Guide](DEVELOPMENT_GUIDE.md) for framework development
- [Service Client Guide](SERVICE_CLIENT_GUIDE.md) for client documentation
