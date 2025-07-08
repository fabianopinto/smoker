# Library Utilities

This directory contains utility functions and core library code for the Smoker framework. These modules provide foundational capabilities used throughout the application.

## Overview

The `lib` directory houses standalone utility functions and business logic modules that are independent of specific service client implementations. These utilities are designed to be:

- **Reusable**: Used across different parts of the application
- **Pure**: Minimal side effects and dependencies
- **Focused**: Each module has a clear, single responsibility
- **Well-tested**: Comprehensive unit test coverage

## Available Utilities

### Dummy Module (`dummy.ts`)

A simple demonstration module that showcases configuration integration. It generates customized smoke phrase messages based on configuration values.

```typescript
import { dummy } from "../lib/dummy";

// Generate a custom smoke phrase
const message = dummy("world"); // Returns "Smoking world!" by default
```

#### Configuration Integration

The dummy module demonstrates how to properly use the configuration system:

```typescript
import { getConfig } from "../support";

export function dummy(target: string): string {
  const config = getConfig();
  return config.phraseTemplate
    .replace("{phrase}", config.defaultPhrase)
    .replace("{target}", target);
}
```

The function uses:

- `config.phraseTemplate`: Template string with placeholders (default: `"{phrase} {target}!"`)
- `config.defaultPhrase`: Default phrase to use (default: `"Smoking"`)

## Extending the Library

When adding new utility functions to the `lib` directory, follow these guidelines:

1. **Function Design**:
   - Focus on a single responsibility
   - Use clear, descriptive names
   - Include TypeScript type annotations
   - Use JSDoc comments for documentation
   - Handle errors gracefully

2. **Code Organization**:
   - Group related functions in a single file
   - Export all public functions
   - Add index.ts for easier imports

3. **Testing**:
   - Add comprehensive unit tests in the `/test/lib` directory
   - Test both success and error conditions
   - Mock external dependencies

## Example: Adding a New Utility

To add a new utility function, create a new file in the `lib` directory:

```typescript
// src/lib/formatters.ts

/**
 * Formats a date as an ISO string
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateISO(date: Date): string {
  return date.toISOString();
}

/**
 * Formats a number as currency
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}
```

Then update the index.ts file to export the new utilities:

```typescript
// src/lib/index.ts
export * from "./dummy";
export * from "./formatters";
```

## Dependencies

Utility functions in the `lib` directory should have minimal dependencies. When possible, prefer:

1. Built-in Node.js modules
2. Core JavaScript/TypeScript functionality
3. Internal project modules (with care to avoid circular dependencies)

## Best Practices

1. **Documentation**: Document all public functions with JSDoc comments
2. **Error Handling**: Use informative error messages and appropriate error types
3. **Pure Functions**: Minimize side effects when possible
4. **Performance**: Consider performance implications for frequently used utilities
5. **Testing**: Write comprehensive tests for all utility functions

For more information about how these utilities are used in the service client architecture, see the [main documentation](../README.md).
