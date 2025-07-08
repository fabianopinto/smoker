# Smoker

[![CI](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml/badge.svg)](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml)

A smoke testing framework designed to test external systems with BDD support through Cucumber.js. Built with modern TypeScript best practices and deployable as an AWS Lambda function, this framework allows you to run smoke tests against any target system either locally or in the cloud.

This project implements the Cucumber.js World pattern for state management between test steps and provides a flexible configuration system for test parameters. **The BDD feature files are intended to test external target systems**, not the framework itself, which is fully tested with its own unit and integration tests.

## Table of Contents

- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Smoke Tests](#running-smoke-tests)
- [Usage](#usage)
  - [Creating Smoke Tests](#creating-smoke-tests)
  - [Configuration System](#configuration-system)
  - [AWS Integration](#aws-integration)
- [Documentation Structure](#documentation-structure)
- [Available Scripts](#available-scripts)
  - [Development](#development)
  - [Testing](#testing)
  - [Building and Running](#building-and-running)
  - [CDK Deployment](#cdk-deployment)
- [Framework Architecture](#framework-architecture)
  - [Core Concepts](#core-concepts)
  - [Service Client Architecture](#service-client-architecture)
  - [Development Workflow](#development-workflow)
- [Cloud Deployment](#cloud-deployment)
  - [Lambda Function](#lambda-function)
  - [Required IAM Permissions](#required-iam-permissions)
  - [Environment Configurations](#environment-configurations)
  - [Lambda Event Configuration](#lambda-event-configuration)
- [Testing Practices](#testing-practices)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Workarounds](#workarounds)
  - [Debugging Tips](#debugging-tips)
- [License](#license)

## Project Structure

```
smoker/
├── src/                # Source code
│   ├── clients/        # Service client implementations (REST, MQTT, AWS services)
│   │   ├── clients.ts  # Base service client interfaces and implementations
│   │   ├── rest.ts     # REST API client
│   │   ├── mqtt.ts     # MQTT messaging client
│   │   ├── s3.ts       # AWS S3 client
│   │   ├── cloudwatch.ts # AWS CloudWatch client
│   │   ├── ssm.ts      # AWS SSM Parameter Store client
│   │   ├── sqs.ts      # AWS SQS client
│   │   ├── kinesis.ts  # AWS Kinesis client
│   │   └── kafka.ts    # Apache Kafka client
│   ├── lib/            # Library code (utility functions - includes dummy sample code)
│   ├── support/        # Support modules (configuration system, AWS integration)
│   │   ├── aws/        # AWS client wrappers and utilities
│   │   ├── config/     # Configuration system implementation
│   │   └── interfaces/ # TypeScript interfaces and types
│   ├── world/          # Cucumber.js World implementation
│   └── index.ts        # Main entry point with Lambda handler
├── test/               # Unit tests for framework components
│   ├── lib/            # Unit tests for library code
│   └── world/          # Unit tests for World implementation
├── features/           # Cucumber BDD features for target systems (includes dummy sample feature)
│   ├── *.feature       # Feature files in Gherkin syntax (sample file can be removed)
│   └── step_definitions/ # Step definitions for target systems (includes sample definitions)
├── cdk/                # AWS CDK infrastructure as code
│   ├── bin/            # CDK app entry point
│   │   └── smoker-cdk.ts  # CDK application definition
│   ├── lib/            # CDK stack definitions
│   │   └── smoker-stack.ts # Lambda function stack
│   ├── cdk.json        # CDK configuration
│   └── package.json    # CDK dependencies and scripts
├── dist/               # Compiled JavaScript output
├── package.json        # Project dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── tsup.config.ts      # Build configuration
├── eslint.config.mjs   # ESLint configuration (using flat config)
├── vitest.config.mts   # Test configuration
├── .prettierrc         # Prettier configuration
├── .nvmrc              # Node version configuration
├── .gitignore          # Git ignore file
└── README.md           # Project documentation
```

## Quick Start

### Prerequisites

- Node.js (v22.14.0 or compatible version)
- npm (v10 or higher)
- AWS CLI (for Lambda deployment)
- JSON configuration files (optional, for test configuration)

### Installation

1. Ensure you're using the correct Node.js version:

   ```bash
   nvm use
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

   For CDK deployment, also install CDK dependencies:

   ```bash
   npm install --prefix cdk
   ```

3. Verify the installation:
   ```bash
   npm run check
   ```

### Running Smoke Tests

1. Build the project:

   ```bash
   npm run build
   ```

2. Run smoke tests against target systems:
   ```bash
   npm start
   ```

## Usage

### Creating Smoke Tests

1. Write feature files in the `features` directory using Gherkin syntax
2. Implement step definitions in `features/step_definitions` that interact with your target systems
3. Configure the target system details using the flexible configuration system

### Configuration System

The Smoker framework includes a flexible configuration system that supports multiple sources and parameter resolution.

#### Key Features

- **Multiple Sources**: Load configuration from JSON files, S3 buckets, code objects, and environment variables
- **Parameter References**: Automatically resolve references to AWS SSM parameters and S3 files
- **Type Safety**: Full TypeScript typing for configuration values
- **Deep Merging**: Intelligent merging of configuration from multiple sources

#### Basic Usage

```typescript
import { 
  addConfigurationFile, 
  addConfigurationObject, 
  addSSMParameterSource,
  loadConfigurations,
  getValue 
} from "./support/config";

// Add configuration from multiple sources
addConfigurationFile("./config/default.json");
addConfigurationFile("s3://my-bucket/config.json");

// Add object with SSM parameter references
addConfigurationObject({
  apiKey: "ssm://my-app/api-key",
  debug: process.env.DEBUG === "true"
});

// Load and merge all configurations
await loadConfigurations();

// Access configuration values
const apiUrl = getValue("apiUrl", "https://default-api.example.com");
```

#### Documentation

For comprehensive documentation of the configuration system, including advanced features and usage patterns, see:

- [Configuration System Documentation](src/support/config/README.md)
- [AWS Integration Documentation](src/support/aws/README.md) for SSM and S3 integration

### AWS Integration

The framework includes comprehensive AWS integration capabilities:

1. **S3 Client Wrapper**
   - Load configuration files directly from S3 buckets
   - Parse and validate JSON content from S3
   - Efficient streaming and content handling

2. **SSM Parameter Store Integration**
   - Retrieve sensitive configuration values from AWS SSM Parameter Store
   - Automatic parameter resolution with caching for improved performance
   - Secure storage of credentials and sensitive information

3. **Region Configuration**
   - Configure specific AWS regions for different resources
   - Fall back to default region when specific region not provided
   - Support for custom client instances for testing

   Examples:

   ```typescript
   // Create configuration with parameter references

   const configObject = {
     // SSM Parameter Store references
     apiKey: "ssm://my-app/api-key", // Resolves to value stored in SSM
     credentials: {
       username: "ssm://my-app/username",
       password: "ssm://my-app/credentials/password", // Supports nested parameters
     },
     // S3 JSON file reference (loads and parses entire JSON file)
     environmentConfig: "s3://my-config-bucket/environments/dev.json",
     // You can mix reference types and regular values
     endpoint: "https://api.example.com",
     debug: true,
   };

   // Add the configuration object (references will be resolved automatically)
   addConfigurationObject(configObject);

   // Load and merge configurations
   await loadConfigurations();
   ```

4. **Lambda Event Configuration**

   When running as an AWS Lambda function, provide configuration in the event object:

   ```json
   {
     "paths": ["dist/features/api/**/*.feature"],
     "tags": "@api and not @wip",
     "config": {
       "apiUrl": "https://api.example.com",
       "timeout": 5000
     },
     "configFiles": ["./config/prod-env.json", "s3://my-bucket/configs/prod-settings.json"]
   }
   ```

   Note that configuration files can be loaded from S3 using the `s3://bucket-name/path/to/file.json` format.

#### Accessing Configuration

In your step definitions and test code, access configuration values:

```typescript
import { getConfig, getValue } from "../support/config";

Given("I connect to the API", function () {
  // Get the entire configuration
  const config = getConfig();
  this.apiClient = new ApiClient(config.apiUrl, config.timeout);
});

When("I access a protected resource", async function () {
  // Get nested configuration values with dot notation
  const username = getValue("credentials.username");
  const password = getValue("credentials.password");

  // Use default values for missing configuration
  const timeout = getValue("timeouts.request", 5000);

  await this.apiClient.login(username, password);
  this.response = await this.apiClient.getResource("/protected", { timeout });
});
```

For more detailed technical documentation about the configuration system, see [src/README.md](src/README.md).

### Available Scripts

#### Testing Framework Components

- `npm test`: Run Vitest tests for the framework itself
- `npm run test:watch`: Run Vitest tests in watch mode
- `npm run test:coverage`: Run tests with coverage reporting

### Test Structure and Mocking Strategy

The framework uses comprehensive testing to ensure reliability and maintainability:

#### Test Organization

- **Mirror Directory Structure**: Tests mirror the source code directory structure
- **Descriptive Test Names**: Test files and cases use descriptive naming for clarity
- **Consistent Test Groups**: Tests are organized into groups for basic functionality, initialization, operations, error handling, and edge cases

#### AWS SDK Testing

For AWS service clients (S3, CloudWatch, SSM, SQS, Kinesis):

```typescript
import { mockClient } from "aws-sdk-client-mock";
import { S3Client as AwsS3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import "aws-sdk-client-mock-vitest"; // Adds matchers for testing

const s3Mock = mockClient(AwsS3Client);

describe("S3Client", () => {
  beforeEach(() => {
    s3Mock.reset();
    vi.useFakeTimers();
  });

  it("should read data correctly", async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: mockResponseBody,
    });

    const result = await client.read("key");

    expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
      Bucket: "test-bucket",
      Key: "key",
    });
  });
});
```

#### Non-AWS Service Testing

For non-AWS clients (MQTT, Kafka, REST), use standard Vitest mocking:

```typescript
// Mock entire modules
vi.mock("mqtt", () => ({
  connect: vi.fn(() => mockMqttClient),
}));

// Create mock functions
const mockPublish = vi.fn();
const mockMqttClient = {
  publish: mockPublish,
  on: vi.fn(),
};

describe("MqttClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
});
```

#### Test Environment Setup

- **Fake Timers**: Use `vi.useFakeTimers()` for predictable time-based testing
- **Clean Mocks**: Reset mocks in `beforeEach` hooks to ensure test isolation
- **Environment Variables**: Use controlled environment variables for consistent tests

## Documentation Structure

The Smoker framework uses a modular documentation approach with detailed README files in each key directory:

### Core Documentation

- [Main README.md](README.md) - Project overview and getting started guide
- [Source Code Documentation](src/README.md) - Core framework structure and components

### Module Documentation

- [Service Clients](src/clients/README.md) - Available clients and usage patterns
- [Support Modules](src/support/README.md) - Support utilities and shared components
- [AWS Integration](src/support/aws/README.md) - AWS client wrappers and utilities
- [Configuration System](src/support/config/README.md) - Configuration management system
- [Library Utilities](src/lib/README.md) - Core utility functions

### Testing Documentation

- [Testing Guide](test/README.md) - Testing approach and best practices
- [Client Testing](test/clients/README.md) - Client-specific testing strategies

These documentation files provide comprehensive information about different aspects of the framework, from high-level architecture to detailed implementation guides.

### Available Scripts

#### Development

- `npm install`: Install dependencies
- `npm run check`: Run TypeScript checks and linting
- `npm run format`: Format code with Prettier

#### Testing

- `npm test`: Run framework tests with Vitest
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Generate test coverage report

#### Building and Running

- `npm run build`: Build the TypeScript code with tsup and copy feature files
- `npm start`: Run smoke tests against target systems
- `npm run clean`: Clean up build artifacts

#### CDK Deployment

- `npm run cdk:deploy`: Deploy the Lambda function stack
- `npm run cdk:diff`: Show changes between local and deployed stack
- `npm run cdk:destroy`: Remove the deployed stack

## Framework Architecture

The Smoker framework is built on a modular architecture with several key components:

1. **Service Clients**: Standardized interfaces for interacting with external services
2. **Configuration System**: Flexible parameter management across environments
3. **Support Modules**: Shared utilities and AWS integration
4. **World Implementation**: BDD state management between test steps

For detailed architecture documentation, see:
- [Source Code Documentation](src/README.md)
- [Service Client Documentation](src/clients/README.md)
- [Support Module Documentation](src/support/README.md)

### Core Concepts

This project implements a BDD-based smoke testing framework with these key components:

1. **AWS Lambda Execution**: Run smoke tests in the cloud or locally
2. **Cucumber.js Integration**: BDD approach to testing external systems
3. **World Pattern**: Custom World object maintaining state between test steps
4. **Configuration System**: Flexible configuration for test parameters

### Cucumber.js Implementation

The framework uses advanced Cucumber.js patterns:

1. **World Pattern**: SmokeWorld object maintains state between steps
2. **Service Client Architecture**: Hierarchical service client system for accessing external services
3. **Interface-based Design**: TypeScript interfaces for proper typing
4. **Step Definition Structure**: Well-organized, reusable step definitions

### Service Client Architecture

The framework implements a comprehensive service client hierarchy for interacting with various services:

1. **Common Interface**: All service clients implement a common `ServiceClient` interface
2. **Base Implementation**: Shared functionality in `BaseServiceClient` class
3. **Service-Specific Clients**:
   - REST API client (using Axios)
   - MQTT messaging client
   - AWS service clients (S3, CloudWatch, SSM, SQS, Kinesis)
   - Apache Kafka client
4. **World Integration**: Clients are registered and accessible via the SmokeWorld

See [src/clients/README.md](src/clients/README.md) for detailed documentation. 4. **Configuration System**: Dynamic configuration management

### Test Structure

- **Framework Tests**: Unit and integration tests for the framework itself
  - Unit tests in `/test` directory (100% coverage)
  - Integration tests with `.integration.test.ts` suffix
- **Smoke Tests**: BDD tests targeting external systems
  - Feature files in `/features` directory
  - Step definitions in `/features/step_definitions`

## Development Guidelines

### TypeScript Best Practices

1. **Strong typing**: Explicit types, avoid `any`
2. **Immutability**: `const` by default, `readonly` for properties
3. **Functional programming**: Pure functions and immutable data
4. **Interface usage**: Define interfaces for object shapes
5. **Error handling**: Proper error handling with typed errors

### Development Workflow

1. Write framework code in `src/`
2. Write unit tests in `test/` for framework components
3. Write BDD features in `features/` for target systems
4. Implement step definitions in `features/step_definitions/`
5. Run quality checks: `npm run lint`, `npm run format`
6. Test framework: `npm test`
7. Build and run: `npm run build && npm start`

### Configuration

- **ESM Modules**: Uses ES modules for modern module system
- **TypeScript**: Configured with strict mode and modern settings (NodeNext module resolution)
- **ESLint**: Using ESLint v9 with comprehensive TypeScript-ESLint integration and stylistic rules
- **Prettier**: Consistent code formatting with modern defaults
- **tsup**: Modern TypeScript bundling with ESM support
- **Vitest**: Unit testing with fast execution and built-in coverage reporting
- **Cucumber**: BDD testing with feature files and step definitions
- **GitHub Repository**: [github.com/fabianopinto/smoker](https://github.com/fabianopinto/smoker)

## AWS Lambda Deployment

The framework can be deployed as an AWS Lambda function to run smoke tests in the cloud:

### CDK Deployment

1. **Setup AWS Credentials**:

   ```bash
   aws configure
   ```

2. **Bootstrap AWS Environment** (first time only):

   ```bash
   npm run cdk:bootstrap
   ```

3. **Deploy to AWS**:

   ```bash
   npm run cdk:deploy
   ```

   For production deployment without approval prompts:

   ```bash
   npm run deploy:prod
   ```

4. **View Deployment Status**:

   ```bash
   npm run cdk:diff
   ```

5. **Remove Deployment**:
   ```bash
   npm run cdk:destroy
   ```

### IAM Permissions

When deploying as a Lambda function, ensure the Lambda execution role has the appropriate permissions:

#### Required Permissions for Parameter References

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:*:*:parameter/my-app/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::my-bucket/config/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "ssm.*.amazonaws.com"
        }
      }
    }
  ]
}
```

The KMS permission is required for accessing encrypted `SecureString` parameters in SSM Parameter Store.

#### Advanced Parameter Resolution Features

- **Nested References**: Parameters can contain references to other parameters
- **Circular Reference Detection**: Automatically detects and prevents infinite loops
- **Parameter Caching**: Improves performance by caching resolved parameters
- **Mixed Reference Types**: You can combine different reference types in the same configuration

### Environment Configurations

The CDK infrastructure supports different environments:

- **dev**: 1GB memory, 5 minute timeout, one week log retention, no alarms
- **test**: 1.5GB memory, 10 minute timeout, two weeks log retention, with alarms
- **prod**: 2GB memory, 15 minute timeout, one month log retention, with alarms

### Lambda Event Configuration

Customize test execution with Lambda event parameters:

```json
{
  "paths": ["dist/features/smoke/**/*.feature"],
  "formats": ["json"],
  "tags": "@smoke and not @wip",
  "environment": {
    "API_URL": "https://api.example.com",
    "DEBUG": "true"
  }
}
```

For more details, see [src/README.md](src/README.md).

### Lambda Event Structure

The Lambda handler accepts an event with optional parameters to customize test execution:

```json
{
  "paths": ["dist/features/smoke/**/*.feature"],
  "formats": ["json"],
  "tags": "@smoke and not @wip"
}
```

#### Setting Environment Variables

```json
{
  "environment": {
    "API_URL": "https://api.example.com",
    "DEBUG": "true",
    "TIMEOUT": "5000"
  }
}
```

#### Configuration Options

The Lambda event supports several configuration options:

```json
{
  "config": {
    "apiUrl": "https://api.example.com",
    "credentials": {
      "username": "lambda-user",
      "password": "lambda-password"
    },
    "timeouts": {
      "request": 3000,
      "browser": 10000
    }
  },
  "configFiles": ["./config/base.json", "s3://my-bucket/environments/prod.json"],
  "configObjects": [
    {
      "region": "us-west-2",
      "debug": true
    }
  ]
}
```

##### Using S3 Configuration Files

You can load configuration from S3 by providing URLs in the `configFiles` array using the format: `s3://bucket-name/path/to/file.json`. The Lambda function must have appropriate IAM permissions to access these S3 objects.

##### Removing Configuration Properties

You can remove configuration properties by setting them to `null` in a configuration object or file that is loaded later in the sequence:

```json
{
  "configObjects": [
    {
      "debug": true,
      "logging": { "level": "debug", "format": "json" }
    },
    {
      "logging": null, // This removes the entire logging object
      "debug": null // This removes the debug property
    }
  ]
}
```

## Troubleshooting

### Common Issues

- **Exit Code 130**: Commands may terminate with exit code 130 due to signal termination (SIGINT) between ESM modules and Node.js
- **Module Resolution Errors**: `ERR_MODULE_NOT_FOUND` errors typically come from ESM module resolution issues
- **Path Resolution**: Cucumber may have trouble resolving paths to feature files or step definitions

### Workarounds

- Use Node.js v22.14.0 specified in `.nvmrc`
- For direct execution: `node --loader=ts-node/esm src/index.ts`
- For Cucumber tests: `npx cucumber-js` with appropriate parameters
- Ensure all import paths use proper ESM syntax

### Debugging Tips

- Run build with verbose logging: `npm run build -- --verbose`
- Check the output directory structure to ensure files are properly copied
- Review module configuration in `tsconfig.json` and bundling options in `tsup.config.ts`

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Fabiano Pinto <fabianopinto@gmail.com>
