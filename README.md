# Smoker

[![CI](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml/badge.svg)](https://github.com/fabianopinto/smoker/actions/workflows/ci.yml)

A smoke testing framework designed to test external systems with BDD support through Cucumber.js. Built with modern TypeScript best practices and deployable as an AWS Lambda function, this framework allows you to run smoke tests against any target system either locally or in the cloud.

This project implements the Cucumber.js World pattern for state management between test steps and provides a flexible configuration system for test parameters. **The BDD feature files are intended to test external target systems**, not the framework itself, which is fully tested with its own unit and integration tests.

## Project Structure

```
smoker/
├── src/                # Source code
│   ├── lib/            # Library code (utility functions)
│   ├── support/         # Configuration system
│   ├── world/           # Cucumber.js World implementation
│   └── index.ts        # Main entry point
├── test/               # Unit tests
│   └── lib/            # Unit tests for library code
├── features/           # Cucumber BDD features
│   ├── *.feature       # Feature files in Gherkin syntax
│   └── step_definitions/ # Step definitions for Cucumber
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

## Prerequisites

- Node.js (v22.14.0 or compatible version)
- npm (v10 or higher)

## Installation and Setup

1. Ensure you're using the correct Node.js version:

   ```bash
   nvm use
   ```

   Or install Node.js v22.14.0 if you don't have it.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Verify the installation:
   ```bash
   npm run check
   ```

## Available Scripts

### Development

- `npm run check`: Run TypeScript type checking
- `npm run lint`: Run ESLint to check code quality
- `npm run format`: Format code with Prettier

### Testing

- `npm test`: Run Vitest tests
- `npm run test:watch`: Run Vitest tests in watch mode
- `npm run test:coverage`: Run tests with coverage reporting (100% coverage)

#### Test Structure

- **Unit tests**: Located in `/test` directory, mirroring the source structure
  - Tests for World objects in `/test/world`
  - Tests for libraries in `/test/lib`
- **Integration tests**: Named with `.integration.test.ts` suffix
- **BDD tests**: Located in `/features` directory (Cucumber.js)

### Building

- `npm run build`: Build the TypeScript code with tsup and copy feature files

### Running

- `npm start`: Run the application (executes Cucumber tests)
- `npm run clean`: Clean up build artifacts (dist, build, coverage directories)

## Modern TypeScript Features

This project follows these TypeScript best practices and uses modern features:

1. **Strong typing**: Always define explicit types and avoid using `any`
2. **Immutability**: Use `const` by default and `readonly` for properties that shouldn't change
3. **Functional programming**: Favor pure functions and immutable data structures
4. **Interface usage**: Define interfaces for object shapes
5. **Error handling**: Use proper error handling with typed errors
6. **Module structure**: Organize code into modules with clear responsibilities
7. **Code formatting**: Consistent code style with ESLint and Prettier
8. **Testing**: Comprehensive unit tests with Vitest (100% coverage) and BDD with Cucumber

## Cucumber.js Implementation

This project implements advanced Cucumber.js concepts:

1. **World Pattern**: Custom World object for maintaining state between steps
2. **Configuration System**: Flexible configuration system for test parameters
3. **Interface-based Design**: TypeScript interfaces for World objects
4. **Step Definition Structure**: Well-organized step definitions with proper typing
5. **Testing Strategy**: Complete test coverage with both unit and integration tests

## Development Workflow

1. Write code in the `src` directory
2. Write unit tests in `test` directory with Vitest to test the framework components
3. Write BDD specifications in `features` with Cucumber to test your target systems
4. Write step definitions in `features/step_definitions` that interact with your target systems
5. Run `npm run lint` to check for code quality issues
6. Run `npm run format` to format code with Prettier
7. Run `npm test` to run unit tests for the framework itself
8. Run `npm run build` to build the project
9. Run `npm start` to run the application and execute smoke tests against target systems

## Project Configuration

- **ESM Modules**: Uses ES modules for modern module system
- **TypeScript**: Configured with strict mode and modern settings (NodeNext module resolution)
- **ESLint**: Using ESLint v9 with comprehensive TypeScript-ESLint integration and stylistic rules
- **Prettier**: Consistent code formatting with modern defaults
- **tsup**: Modern TypeScript bundling with ESM support
- **Vitest**: Unit testing with fast execution and built-in coverage reporting
- **Cucumber**: BDD testing with feature files and step definitions
- **GitHub Repository**: [github.com/fabianopinto/smoker](https://github.com/fabianopinto/smoker)

## Known Issues and Troubleshooting

### Common Issues

- **Exit Code 130**: Commands like `npm run test`, `npm run build` and `npm start` may terminate with exit code 130. This is related to signal termination (SIGINT) in the interaction between ESM modules and Node.js.

- **Module Resolution Errors**: When encountering `ERR_MODULE_NOT_FOUND` errors with Cucumber or Vitest, this is typically due to ESM module resolution issues.

- **Path Resolution**: Cucumber may have trouble resolving paths to feature files or step definitions when running from different directories.

### Workarounds

- Use the correct Node.js version specified in `.nvmrc` (v22.14.0)
- For direct execution: `node --loader=ts-node/esm src/index.ts`
- For Cucumber tests: `npx cucumber-js` with appropriate parameters
- Ensure all import paths use proper ESM syntax (with file extensions where needed)

### Debugging Tips

- Run build with verbose logging: `npm run build -- --verbose`
- Add console.log statements to debug path resolution issues
- Check the output directory structure to ensure files are being copied correctly
- Review module configuration in `tsconfig.json` and bundling options in `tsup.config.ts`
- For step definition issues, check that the glob patterns in `src/index.ts` are correctly pointing to your step files

## AWS Lambda Deployment

This project can be deployed as an AWS Lambda function to run smoke tests in the cloud. The project includes AWS CDK integration for infrastructure as code deployment.

### Deployment Options

The project uses AWS CDK for deployment with GitHub Actions CI/CD integration:

1. **Local Deployment**: Use npm scripts to deploy directly from your machine
2. **CI/CD Pipeline**: Automatic deployment via GitHub Actions when pushing to main branch

### Environment Configurations

The CDK infrastructure supports different environments:

- **dev**: 1GB memory, 5 minute timeout, one week log retention, no alarms
- **test**: 1.5GB memory, 10 minute timeout, two weeks log retention, with alarms
- **prod**: 2GB memory, 15 minute timeout, one month log retention, with alarms

### Deployment Process

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
   npm run deploy:prod
   ```

4. **View Deployment Status**:
   ```bash
   npm run cdk:diff
   ```

For more details on AWS Lambda deployment and configuration, see [src/README.md](src/README.md).

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Fabiano Pinto <fabianopinto@gmail.com>
