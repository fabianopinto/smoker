# Configuration System

The Smoker framework includes a robust configuration system that supports loading and managing application configurations from multiple sources with parameter resolution capabilities.

## Architecture

The configuration system is built around several key components:

1. **Configuration Manager**: A singleton class that manages configuration sources and values
2. **Configuration Sources**: Implementations for different source types (files, S3, objects, SSM)
3. **Parameter Resolver**: Resolves parameter references within configuration values

## Configuration Manager

The `Configuration` class implements a singleton pattern to provide centralized access to application configuration:

```typescript
import { Configuration, getConfig, getValue } from "../support/config";

// Access singleton instance
const config = Configuration.getInstance();

// Get entire configuration
const fullConfig = config.getConfig();

// Get specific value with dot notation
const region = config.getValue("aws.region", "us-east-1");

// Or use helper functions
const region = getValue("aws.region", "us-east-1");
```

### Key Features

- **Dot Notation**: Access nested configuration values using dot notation paths
- **Type Safety**: Configuration values maintain their original types
- **Default Values**: Provide fallbacks when configuration values are missing
- **Deep Merging**: Intelligently merges configuration from multiple sources

## Configuration Sources

The framework supports multiple configuration sources that can be combined:

### 1. File Configuration Source

Loads configuration from local JSON files:

```typescript
import { addConfigurationFile, loadConfigurations } from "../support/config";

// Add file source (automatically detects local files vs S3 URLs)
addConfigurationFile("/path/to/config.json");
await loadConfigurations();
```

### 2. S3 Configuration Source

Loads configuration from JSON files stored in S3:

```typescript
import { addS3ConfigurationFile, loadConfigurations } from "../support/config";

// Add S3 source with specific region
addS3ConfigurationFile("s3://my-bucket/config.json", "us-west-2");
await loadConfigurations();
```

### 3. Object Configuration Source

Uses in-memory objects as configuration sources:

```typescript
import { addConfigurationObject, loadConfigurations } from "../support/config";

// Add object source
addConfigurationObject({
  aws: {
    region: "us-west-2",
    s3: {
      bucket: "my-app-bucket",
    },
  },
});
await loadConfigurations();
```

### 4. SSM Parameter Source

Resolves SSM parameter references in configuration values:

```typescript
import { addSSMParameterSource, loadConfigurations } from "../support/config";

// Add SSM parameter source to resolve references
addSSMParameterSource({
  apiKey: "ssm://my-app/api-key",
  database: {
    password: "ssm://my-app/db/password",
  },
});
await loadConfigurations();
```

## Parameter References

The configuration system supports parameter references, which are placeholders that get resolved to their actual values during configuration loading:

### SSM Parameter References

References to AWS SSM Parameter Store values:

```json
{
  "apiKey": "ssm://my-app/api-key",
  "database": {
    "password": "ssm://my-app/db/password"
  }
}
```

When this configuration is loaded, the SSM parameter references are automatically resolved to their actual values from AWS SSM Parameter Store.

## Configuration Loading Flow

1. Add configuration sources using the appropriate methods
2. Call `loadConfigurations()` to load and merge all sources
3. Configuration sources are loaded in the order they were added
4. Values from later sources override values from earlier sources
5. Parameter references are resolved during loading

```typescript
import {
  addConfigurationFile,
  addConfigurationObject,
  addSSMParameterSource,
  loadConfigurations,
} from "../support/config";

// Add multiple sources
addConfigurationFile("/path/to/defaults.json");
addConfigurationFile("s3://my-bucket/env-config.json");
addConfigurationObject({ environment: "production" });
addSSMParameterSource({ secretKey: "ssm://my-app/secret-key" });

// Load and merge all configurations
await loadConfigurations();
```

## Updating Configuration

You can update configuration values at runtime:

```typescript
import { updateConfig } from "../support/config";

// Update specific values
updateConfig({
  aws: {
    region: "eu-west-1",
  },
});
```

Updates are merged with the existing configuration, preserving values that aren't explicitly changed.

## Type Definitions

The configuration system includes TypeScript interfaces for type safety:

```typescript
// Base configuration interface that all configurations must implement
export interface SmokeConfig {
  defaultPhrase: string;
  phraseTemplate: string;
  [key: string]: ConfigValue;
}

// Configuration value types
export type ConfigValue = string | number | boolean | null | ConfigObject | ConfigValue[];

// Generic configuration object
export interface ConfigObject {
  [key: string]: ConfigValue;
}
```

## Best Practices

1. **Layered Configuration**:
   - Define defaults in code
   - Override with environment-specific files
   - Apply runtime overrides for dynamic values

2. **Configuration Organization**:
   - Group related settings together in nested objects
   - Use consistent naming conventions
   - Document configuration properties

3. **Security Considerations**:
   - Use SSM parameter references for sensitive values
   - Don't commit secrets to configuration files
   - Use environment-specific configurations

4. **Testing**:
   - Reset configuration between tests with `Configuration.resetInstance()`
   - Mock SSM parameters for testing
   - Use test-specific configuration objects

## Common Patterns

### Environment-Based Configuration

```typescript
const env = process.env.NODE_ENV || "development";
addConfigurationFile(`/path/to/config.${env}.json`);
```

### Feature Flags

```typescript
// Check if a feature is enabled
const isFeatureEnabled = getValue("features.newFeature", false);

if (isFeatureEnabled) {
  // Implement new feature
}
```

### Dynamic Configuration

```typescript
// Update configuration based on runtime conditions
function updateRegion(region: string) {
  updateConfig({
    aws: { region },
  });
}
```

## Error Handling

The configuration system includes error handling to prevent crashes when configuration loading fails:

- Invalid JSON files log errors but don't throw exceptions
- Missing SSM parameters are logged with warnings
- Required configuration properties have fallback values

For more detailed information about the configuration system implementation, see the TypeScript files in the `src/support/config` directory.
