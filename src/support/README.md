# Support Modules Documentation

## Overview

This directory contains support modules used by the Smoker application. These modules provide foundational services like configuration management and AWS integration.

## Configuration System (`/config`)

The configuration system provides a flexible way to load and manage application configuration from multiple sources.

### Key Features

- Singleton pattern for centralized configuration management
- Support for multiple configuration sources:
  - Local JSON files
  - S3-hosted JSON files
  - Environment variables via SSM Parameter Store
  - In-memory objects
- Parameter resolution with support for references between configuration values
- Type validation for required configuration properties

### Usage Examples

**Basic Configuration Loading**

```typescript
import { Configuration, addConfigurationFile, loadConfigurations } from "./support/config";

// Add configuration files
addConfigurationFile("/path/to/config.json");
addConfigurationFile("s3://my-bucket/config.json");

// Load all configurations (resolves values and merges them)
await loadConfigurations();

// Access configuration values
const value = Configuration.getInstance().getValue("some.nested.property");
// or using the helper function:
const value = getValue("some.nested.property", "default value");
```

**Working with Configuration Objects**

```typescript
import { addConfigurationObject, updateConfig } from "./support/config";

// Add a configuration object
addConfigurationObject({
  serviceUrl: "https://api.example.com",
  timeout: 30000,
});

// Update configuration values
updateConfig({
  timeout: 60000,
});
```

**Using SSM Parameter References**

```typescript
import { addConfigurationObject, loadConfigurations } from "./support/config";

// Configuration with SSM parameter references
addConfigurationObject({
  apiKey: "ssm://my-app/api-key",
  secretValue: "ssm://my-app/secrets/value",
});

// Load and resolve all configurations
await loadConfigurations();
```

### Configuration Classes

- **Configuration**: Singleton class managing all configuration sources and providing access to configuration values
- **ConfigurationSource**: Interface implemented by all configuration sources
- **FileConfigurationSource**: Loads configuration from local JSON files
- **S3ConfigurationSource**: Loads configuration from JSON files stored in S3
- **ObjectConfigurationSource**: Uses in-memory objects as configuration sources
- **SSMParameterSource**: Resolves SSM parameter references in configuration values

## AWS Integration (`/aws`)

The AWS module provides wrapper clients and utilities for interacting with AWS services.

### Key Features

- Simplified wrappers around AWS SDK v3 clients
- Cached parameter resolution for improved performance
- Utilities for handling S3 URLs and AWS response streams
- Region configuration with fallback to default region

### Available AWS Clients

- **S3ClientWrapper**: Wrapper for S3 operations with utility methods for:
  - Loading JSON from S3
  - Converting S3 response streams to strings
  - Parsing S3 URLs

- **SSMClientWrapper**: Wrapper for SSM Parameter Store operations with methods for:
  - Retrieving parameters with caching
  - Parsing SSM parameter URLs

### Usage Examples

**Working with S3**

```typescript
import { S3ClientWrapper } from "./support/aws";

// Create a client (optionally with custom region)
const s3Client = new S3ClientWrapper("us-west-2");

// Get JSON from an S3 URL
const data = await s3Client.getJsonFromUrl("s3://my-bucket/data.json");

// Get object content as string
const content = await s3Client.getObjectAsString("my-bucket", "path/to/file.txt");
```

**Working with SSM Parameter Store**

```typescript
import { SSMClientWrapper } from "./support/aws";

// Create a client
const ssmClient = new SSMClientWrapper();

// Get a parameter
const value = await ssmClient.getParameter("/my-app/config/api-key");

// Parse an SSM parameter URL
const paramName = ssmClient.parseSSMUrl("ssm://my-app/config/api-key");
// Returns: '/my-app/config/api-key'
```

## Utility Functions

- **parseS3Url**: Parses S3 URLs into bucket and key components
- **streamToString**: Converts various types of AWS response streams to strings
