<img src="docs/images/smoker.png" alt="Smoker Logo" style="float: right; margin: 10px; width: 200px;" />

# Smoker

[![CI](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml/badge.svg)](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml)

A smoke testing framework designed to test external systems with BDD support through Cucumber.js. Built with modern TypeScript best practices and deployable as an AWS Lambda function, this framework allows you to run smoke tests against any target system either locally or in the cloud.

## Documentation

- [Test Development Guide](docs/TEST_DEVELOPMENT.md) - Guide for creating smoke tests with this framework
- [Operations Guide](docs/OPERATIONS_GUIDE.md) - Guide for deploying and running the framework
- [Development Guide](docs/DEVELOPMENT_GUIDE.md) - Guide for framework developers and contributors

## Overview

Smoker is a specialized framework for conducting smoke tests against external target systems using Behavior-Driven Development (BDD) principles. It implements the Cucumber.js World pattern for state management between test steps and provides a flexible configuration system for test parameters.

## Main Features

- **BDD Testing**: Write tests in Gherkin syntax with Cucumber.js
- **Service Client Architecture**: Pre-built clients for REST, MQTT, AWS services, and more
- **Flexible Configuration**: Load from JSON files, S3 buckets, environment variables, and AWS SSM
- **AWS Integration**: Deploy as Lambda function with comprehensive AWS service support
- **TypeScript Support**: Full type safety throughout the framework
- **Extensible Design**: Easy to add new service clients and test capabilities

## Project Structure

```
smoker/
├── src/                   # Source code
│   ├── clients/           # Service client implementations
│   ├── lib/               # Library code (utility functions)
│   ├── support/           # Support modules (configuration, AWS integration)
│   ├── world/             # Cucumber.js World implementation
│   └── index.ts           # Main entry point with Lambda handler
├── test/                  # Unit tests for framework components
├── features/              # Cucumber BDD features for target systems
│   └── step_definitions/  # Step definitions for target systems
└── cdk/                   # AWS CDK infrastructure as code
```

## Quick Start

### Prerequisites

- Node.js (v22.14.0 or compatible version)
- npm (v10 or higher)
- AWS CLI (for Lambda deployment)

### Installation

1. Ensure you're using the correct Node.js version:

   ```bash
   nvm use
   ```

2. Install dependencies:

   ```bash
   npm install
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

See the [Test Development Guide](docs/TEST_DEVELOPMENT.md) for detailed instructions on creating and running smoke tests.

## Available Scripts

- `npm test`: Run Vitest tests for the framework itself
- `npm run test:watch`: Run Vitest tests in watch mode
- `npm run test:coverage`: Run tests with coverage reporting
- `npm run build`: Build the project
- `npm start`: Run smoke tests

## Troubleshooting

### Common Issues

- **AWS Credentials**: Ensure AWS credentials are properly configured if using AWS services
- **Node.js Version**: Use the version specified in `.nvmrc` for compatibility
- **Build Errors**: Run `npm run clean` followed by `npm run build` to resolve build issues

### Workarounds

- **Lambda Timeouts**: Adjust the timeout in CDK stack for long-running tests
- **Region Configuration**: Set AWS_REGION environment variable if region detection fails

## License

[MIT License](LICENSE)
