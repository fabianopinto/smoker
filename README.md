# Smoker

A smoke testing framework with BDD support, unit testing with Vitest, and modern TypeScript best practices.

## Project Structure

```
smoker/
├── src/                # Source code
│   ├── lib/            # Library code (utility functions)
│   └── index.ts        # Main entry point
├── test/               # Unit tests
│   └── lib/            # Unit tests for library code
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
- `npm run test:coverage`: Run tests with coverage reporting

### Building

- `npm run build`: Build the TypeScript code with tsup

### Running

- `npm start`: Run the application
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
8. **Testing**: Unit tests with Vitest

## Development Workflow

1. Write code in the `src` directory
2. Write unit tests in `test` directory with Vitest
3. Run `npm run lint` to check for code quality issues
4. Run `npm run format` to format code with Prettier
5. Run `npm test` to run unit tests
6. Run `npm run build` to build the project
7. Run `npm start` to run the application

## Project Configuration

- **ESM Modules**: Uses ES modules for modern module system
- **TypeScript**: Configured with strict mode and modern settings (NodeNext module resolution)
- **ESLint**: Using ESLint v9 with comprehensive TypeScript-ESLint integration and stylistic rules
- **Prettier**: Consistent code formatting with modern defaults
- **tsup**: Modern TypeScript bundling with ESM support
- **Vitest**: Unit testing with fast execution and built-in coverage reporting
- **GitHub Repository**: [github.com/fabianopinto/smoker](https://github.com/fabianopinto/smoker)

## Known Issues and Troubleshooting

### Common Issues

- **Exit Code 130**: Commands like `npm run test`, `npm run build` and `npm start` may terminate with exit code 130. This is related to signal termination (SIGINT) in the interaction between ESM modules and Node.js.

### Workarounds

- Use the correct Node.js version specified in `.nvmrc` (v22.14.0)
- For direct execution: `node --loader=ts-node/esm src/index.ts`

### Debugging Tips

- Run build with verbose logging: `npm run build -- --verbose`
- Check the output directory structure to ensure files are being copied correctly
- Review module configuration in `tsconfig.json` and bundling options in `tsup.config.ts`

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Fabiano Pinto <fabianopinto@gmail.com>
