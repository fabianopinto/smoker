<p align="center">
   <img src="docs/images/smoker.png" alt="Smoker Logo" width="120" />
</p>

# Smoker

[![CI](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml/badge.svg)](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml)

A modern smoke testing framework designed to test external systems with BDD support through Cucumber.js. Built with TypeScript best practices and deployable as an AWS Lambda function, this framework enables comprehensive smoke testing against any target system either locally or in the cloud.

## Documentation

- [📚 Test Development Guide](docs/TEST_DEVELOPMENT.md) - Complete guide for creating smoke tests with this framework
- [⚙️ Operations Guide](docs/OPERATIONS_GUIDE.md) - Deployment, configuration, and operational procedures
- [🔧 Development Guide](docs/DEVELOPMENT_GUIDE.md) - Framework architecture and contribution guidelines
- [🔌 Service Client Guide](docs/SERVICE_CLIENT_GUIDE.md) - Complete reference for all service clients

## Table of Contents

- [Overview](#overview)
- [Main Features](#main-features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Available Scripts](#available-scripts)
- [Troubleshooting](#troubleshooting)
- [Copyright & License](#copyright--license)

## Overview

Smoker is a specialized framework for conducting smoke tests against external target systems using Behavior-Driven Development (BDD) principles. It implements the Cucumber.js World pattern for state management between test steps and provides a flexible configuration system that supports multiple sources including JSON files, AWS S3, SSM parameters, and environment variables.

The framework is designed to validate that external systems are functioning correctly by running automated tests that check critical functionality without deep integration testing. It's particularly useful for:

- **API Health Checks**: Validating REST endpoints and service availability
- **System Integration Validation**: Ensuring connected systems communicate properly
- **Deployment Verification**: Confirming successful deployments in various environments
- **Continuous Monitoring**: Running periodic health checks in production environments

## Main Features

### 🧪 **BDD Testing with Cucumber.js**

Write tests in human-readable Gherkin syntax with full Cucumber.js support. Create comprehensive test scenarios that are easy to understand and maintain. Learn more in the [Test Development Guide](docs/TEST_DEVELOPMENT.md).

### 🔌 **Comprehensive Service Client Architecture**

Pre-built clients for REST APIs, MQTT messaging, Kafka, and comprehensive AWS services (S3, SSM, SQS, CloudWatch, Kinesis). Extensible architecture allows easy addition of custom clients. Complete documentation available in the [Service Client Guide](docs/SERVICE_CLIENT_GUIDE.md).

### ⚙️ **Flexible Multi-Source Configuration**

- **JSON Configuration Files**: Local and remote configuration files
- **AWS S3 Integration**: Load configurations from S3 buckets
- **AWS SSM Parameters**: Secure parameter management with automatic resolution
- **Environment Variables**: Runtime configuration override capabilities
- **Deep Merging**: Intelligent configuration merging with priority ordering

### ☁️ **AWS Integration & Lambda Deployment**

Deploy as AWS Lambda function with comprehensive AWS service support. Includes CloudWatch metrics publishing, S3 report storage, and seamless integration with AWS infrastructure.

### 🔒 **TypeScript Support**

Full type safety throughout the framework with comprehensive interfaces, generics, and compile-time validation.

### 🎯 **Extensible Design**

Easy to extend with new service clients, custom step definitions, and additional functionality through well-defined interfaces and patterns.

## Project Structure

```
smoker/
├── src/
│   ├── clients/                   # Service client implementations
│   │   ├── aws/                   # AWS service clients (S3, SSM, SQS, etc.)
│   │   ├── core/                  # Core client interfaces and base classes
│   │   ├── http/                  # HTTP clients (REST)
│   │   ├── messaging/             # Messaging clients (MQTT, Kafka)
│   │   └── registry/              # Client registry and factory
│   ├── lib/                       # Library code (utility functions)
│   ├── support/                   # Support modules
│   │   ├── aws/                   # AWS integration utilities
│   │   └── config/                # Configuration system
│   ├── world/                     # Cucumber.js SmokeWorld implementation
│   └── index.ts                   # Main entry point & AWS Lambda handler
├── features/                      # Cucumber.js feature files
│   └── step_definitions/          # Step definition implementations
├── docs/                          # Documentation
│   ├── DEVELOPMENT_GUIDE.md       # Framework development guide
│   ├── OPERATIONS_GUIDE.md        # Operations and deployment guide
│   ├── SERVICE_CLIENT_GUIDE.md    # Service clients documentation
│   └── TEST_DEVELOPMENT.md        # Test development guide
├── test/                          # Framework unit tests
├── package.json                   # Node.js dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # This file
```

## Quick Start

### Prerequisites

- Node.js 22+ and npm
- AWS CLI configured (for AWS features)
- TypeScript knowledge recommended

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/fabianopinto/smoker.git
   cd smoker
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

4. **Run example tests:**
   ```bash
   npm start
   ```

### Creating Your First Test

1. **Create a feature file** in `features/`:

   ```gherkin
   Feature: API Health Check
     Scenario: Verify API is responding
       Given I have a REST client configured for "https://api.example.com"
       When I send a GET request to "/health"
       Then the response status should be 200
   ```

2. **Run your test:**
   ```bash
   npm start -- --paths "features/your-test.feature"
   ```

## Usage

For comprehensive usage instructions including configuration management, AWS deployment, and advanced features, see the [Operations Guide](docs/OPERATIONS_GUIDE.md).

### Basic Local Execution

```bash
# Run all tests
npm start

# Run specific feature files
npm start -- --paths "dist/features/api/**/*.feature"

# Run tests with specific tags
npm start -- --tags "@smoke and not @wip"

# Run with custom configuration
npm start -- --config config/production.json
```

### Configuration Examples

**JSON Configuration:**

```json
{
  "api": {
    "baseUrl": "https://api.example.com",
    "timeout": 5000,
    "authToken": "ssm:/app/api-token"
  },
  "cert": {
    "pem_file": "s3://my-test-bucket/api-cert.pem"
  }
}
```

**Environment Variables:**

```bash
export SMOKER_CONFIG='{"api":{"baseUrl":"https://staging.api.com"}}'
export SMOKER_LOG_LEVEL=debug
```

## Available Scripts

| Script          | Description                      | Usage                   |
| --------------- | -------------------------------- | ----------------------- |
| `build`         | Compile TypeScript to JavaScript | `npm run build`         |
| `start`         | Run smoke tests                  | `npm start`             |
| `test`          | Run framework unit tests         | `npm test`              |
| `test:watch`    | Run unit tests in watch mode     | `npm run test:watch`    |
| `test:coverage` | Run tests with coverage report   | `npm run test:coverage` |
| `lint`          | Run ESLint code analysis         | `npm run lint`          |
| `lint:fix`      | Fix auto-fixable lint issues     | `npm run lint:fix`      |
| `format`        | Format code with Prettier        | `npm run format`        |
| `format:check`  | Check code formatting            | `npm run format:check`  |
| `clean`         | Remove build artifacts           | `npm run clean`         |
| `package`       | Create deployment package        | `npm run package`       |

### Development Scripts

```bash
# Watch mode for development
npm run build:watch

# Run specific test suites
npm test -- --testNamePattern="ConfigFactory"

# Generate coverage report
npm run test:coverage

# Lint and format code
npm run lint:fix && npm run format
```

## Troubleshooting

### Common Issues

**Build Errors:**

```bash
# Clear build cache and rebuild
npm run clean && npm run build
```

**Test Failures:**

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific failing test
npm test -- --testNamePattern="failing test name"
```

**Configuration Issues:**

```bash
# Validate configuration with debug logging
npm start -- --logLevel debug
```

**AWS Permission Issues:**

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Test SSM parameter access
aws ssm get-parameter --name "/your/parameter/name"
```

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Environment variable
export SMOKER_LOG_LEVEL=debug

# Command line option
npm start -- --logLevel debug

# Configuration file
{
  "logLevel": "debug"
}
```

### Getting Help

1. **Check the documentation:**
   - [Test Development Guide](docs/TEST_DEVELOPMENT.md) for test creation issues
   - [Operations Guide](docs/OPERATIONS_GUIDE.md) for deployment and configuration
   - [Service Client Guide](docs/SERVICE_CLIENT_GUIDE.md) for client-specific problems

2. **Review example tests** in the `features/` directory

3. **Check the issue tracker** on GitHub for known issues

4. **Enable debug logging** to get detailed error information

## Copyright & License

Copyright (c) 2025 Fabiano Pinto

This project is licensed under the [MIT License](LICENSE). See the LICENSE file for details.

### Third-Party Licenses

This project uses several open-source libraries. See individual package licenses for details:

- **Cucumber.js**: MIT License
- **AWS SDK**: Apache License 2.0
- **TypeScript**: Apache License 2.0
- **Other dependencies**: See `package.json` for complete list

---

**Ready to start testing?** Check out the [Test Development Guide](docs/TEST_DEVELOPMENT.md) to create your first smoke test suite!
