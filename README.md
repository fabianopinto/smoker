# Smoker

[![CI](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml/badge.svg)](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml)

A smoke testing framework designed to test external systems with BDD support through Cucumber.js. Built with modern TypeScript best practices and deployable as an AWS Lambda function, this framework allows you to run smoke tests against any target system either locally or in the cloud.

This project implements the Cucumber.js World pattern for state management between test steps and provides a flexible configuration system for test parameters. **The BDD feature files are intended to test external target systems**, not the framework itself, which is fully tested with its own unit and integration tests.

## Project Structure

```
smoker/
├── src/                # Source code
│   ├── lib/            # Library code (utility functions)
│   ├── support/        # Configuration system
│   ├── world/          # Cucumber.js World implementation
│   └── index.ts        # Main entry point with Lambda handler
├── test/               # Unit tests for framework components
│   ├── lib/            # Unit tests for library code
│   └── world/          # Unit tests for World implementation
├── features/           # Cucumber BDD features for target systems
│   ├── *.feature       # Feature files in Gherkin syntax
│   └── step_definitions/ # Step definitions for target systems
├── cdk/                # AWS CDK infrastructure as code
│   ├── bin/            # CDK app entry point
│   │   └── smoker-cdk.ts  # CDK application definition
│   ├── lib/            # CDK stack definitions
│   │   └── smoker-stack.ts # Lambda function stack
│   ├── cdk.json        # CDK configuration
│   └── package.json    # CDK dependencies and scripts
├── dist/               # Compiled JavaScript output
├── eslint.config.mjs   # ESLint configuration (using flat config)
├── .prettierrc         # Prettier configuration
├── tsup.config.ts      # Build configuration
├── vitest.config.mts   # Test configuration
├── package.json        # Project dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── .nvmrc              # Node version configuration
├── .gitignore          # Git ignore file
└── README.md           # Project documentation
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

   For CDK deployment, also install CDK dependencies:

   ```bash
   cd cdk && npm install
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
3. Configure the target system details in environment variables or configuration files

### Available Scripts

#### Testing Framework Components

- `npm test`: Run Vitest tests for the framework itself
- `npm run test:watch`: Run Vitest tests in watch mode
- `npm run test:coverage`: Run tests with coverage reporting (100% coverage)

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
   cd cdk && npm run bootstrap
   ```

3. **Deploy to AWS**:

   ```bash
   cd cdk && npm run deploy
   ```

   For production deployment without approval prompts:

   ```bash
   cd cdk && npm run deploy:prod
   ```

4. **View Deployment Status**:

   ```bash
   cd cdk && npm run diff
   ```

5. **Remove Deployment**:
   ```bash
   cd cdk && npm run destroy
   ```

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
