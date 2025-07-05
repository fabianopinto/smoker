# Smoker

[![CI](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml/badge.svg)](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml)

A smoke testing framework designed to test external systems with BDD support through Cucumber.js. Built with modern TypeScript best practices and deployable as an AWS Lambda function, this framework allows you to run smoke tests against any target system either locally or in the cloud.

This project implements the Cucumber.js World pattern for state management between test steps and provides a flexible configuration system for test parameters. **The BDD feature files are intended to test external target systems**, not the framework itself, which is fully tested with its own unit and integration tests.

## Project Structure

```
smoker/
├── src/                # Source code
│   ├── lib/            # Library code (utility functions - includes dummy sample code)
│   ├── support/        # Configuration system
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

Smoker includes a powerful configuration system that supports various data types and multiple configuration sources:

#### Configuration Data Types

The configuration system supports:

- Strings, numbers, and boolean values
- Arrays of values
- Nested objects with any level of hierarchy
- Any combination of the above

#### Configuration Methods

You can provide configuration values in several ways:

1. **JSON Configuration Files**

   Create JSON files to store configuration values:

   ```json
   // config/test-env.json
   {
     "apiUrl": "https://test-api.example.com",
     "credentials": {
       "username": "test-user",
       "password": "test-password"
     },
     "timeouts": {
       "request": 3000,
       "browser": 10000
     },
     "features": ["api", "auth", "reporting"]
   }
   ```

   Load configuration from files:

   ```typescript
   import { addConfigurationFile, loadConfigurations } from "./support/config";

   // Load from local file
   addConfigurationFile("./config/test-env.json");

   // Load from S3
   addConfigurationFile("s3://my-bucket/config/test-env.json");

   // Load multiple files
   loadConfigurationFiles(["./config/base.json", "./config/test-env.json"]);

   // Load and merge all configurations
   await loadConfigurations();
   ```

   Configuration files can also contain parameter references that will be automatically resolved (see Parameter References below).

2. **In-code Configuration Objects**

   Provide configuration values directly in code:

   ```typescript
   import { addConfigurationObject, loadConfigurations } from "./support/config";

   // Create configuration from object
   addConfigurationObject({
     apiUrl: process.env.API_URL || "https://default-api.example.com",
     debug: process.env.DEBUG === "true",
     retries: 3,
   });

   // Load and merge configurations
   await loadConfigurations();
   ```

3. **Object Configuration**

   Provide configuration values programmatically in JavaScript/TypeScript code:

   ```typescript
   // Create configuration from object
   addConfigurationObject({
     apiUrl: process.env.API_URL || "https://default-api.example.com",
     debug: process.env.DEBUG === "true",
     retries: 3,
   });

   // Load and merge configurations
   await loadConfigurations();
   ```

4. **Parameter References**

   The configuration system supports several types of parameter references that are automatically resolved:
   - **AWS SSM Parameter References**: Use the `ssm://` prefix to retrieve values from AWS SSM Parameter Store
   - **S3 JSON References**: Use the `s3://` prefix with a `.json` extension to load and parse JSON content from S3
   - **S3 JSON Content References**: Reference an S3 JSON file that will be fetched and parsed
   - **Nested References**: Parameters can reference other parameters

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

5. **Lambda Event Configuration**

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

### Testing Infrastructure

#### Test Framework

This project uses Vitest as the testing framework with the following features:

- **Fast execution**: Vitest offers modern, fast testing with native ESM support
- **Watch mode**: Real-time test execution when files change
- **Coverage reporting**: Generate detailed coverage reports in multiple formats (text, lcov, html)
- **TypeScript integration**: First-class TypeScript support with no additional configuration

#### AWS SDK Mock Integration

The tests utilize `aws-sdk-client-mock` and `aws-sdk-client-mock-vitest` for robust AWS service mocking:

- **Service Mocking**: Mock AWS SDK v3 client interactions without making actual AWS calls
- **Command Assertions**: Verify command calls, parameters, and frequency
- **Stream Handling**: Proper mocking of AWS response streams
- **Type Safety**: Full TypeScript support for mocked responses and assertions

#### Best Practices for Testing AWS Services

1. **Mock AWS clients** instead of making real AWS calls in tests
2. **Assert AWS calls** using the appropriate matchers and assertions
3. **Handle edge cases** like error conditions and service failures
4. **Test non-JSON file handling** for S3 references appropriately
5. **Clear caches** between tests to ensure isolation

#### Writing Effective Tests

- **Test file organization**: Place test files alongside their implementation in the same directory structure
- **Naming conventions**: Use `.test.ts` suffix for unit tests, `.integration.test.ts` for integration tests
- **Test isolation**: Ensure each test properly resets mocks and shared state
- **Edge case coverage**: Test error conditions, invalid inputs, and boundary conditions
- **Mock realism**: Ensure mocked AWS responses match real AWS behavior including error patterns

#### Development

- `npm run check`: Run TypeScript type checking
- `npm run lint`: Run ESLint to check code quality
- `npm run format`: Format code with Prettier

#### Building and Running

- `npm run build`: Build the TypeScript code with tsup and copy feature files
- `npm start`: Run smoke tests against target systems
- `npm run clean`: Clean up build artifacts

## Framework Architecture

### Core Concepts

This project implements a BDD-based smoke testing framework with these key components:

1. **AWS Lambda Execution**: Run smoke tests in the cloud or locally
2. **Cucumber.js Integration**: BDD approach to testing external systems
3. **World Pattern**: Custom World object maintaining state between test steps
4. **Configuration System**: Flexible configuration for test parameters

### Cucumber.js Implementation

The framework uses advanced Cucumber.js patterns:

1. **World Pattern**: SmokeWorld object maintains state between steps
2. **Interface-based Design**: TypeScript interfaces for proper typing
3. **Step Definition Structure**: Well-organized, reusable step definitions
4. **Configuration System**: Dynamic configuration management

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
