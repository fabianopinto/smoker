# AWS Integration Module

The AWS Integration module provides wrapper classes and utilities for interacting with AWS services in the Smoker framework.

## Overview

This module centralizes AWS client interactions for better organization, efficiency, and testability. It includes:

1. **Wrapper Classes** for AWS SDK clients with simplified interfaces
2. **Utility Functions** for common AWS operations
3. **Caching Mechanisms** to improve performance by reducing redundant API calls

## Key Components

### 1. S3ClientWrapper

A wrapper around the AWS SDK v3 S3 client that provides simplified access to S3 operations.

```typescript
import { S3ClientWrapper } from "../support/aws";

// Create client with specific region (uses env.AWS_REGION or defaults to us-east-1)
const s3Client = new S3ClientWrapper("us-west-2");

// Get object content as string
const content = await s3Client.getObjectAsString("my-bucket", "path/to/file.txt");

// Get and parse JSON directly
const config = await s3Client.getObjectAsJson("my-bucket", "config.json");

// Load content directly from an S3 URL
const data = await s3Client.getContentFromUrl("s3://my-bucket/data.json");
```

#### Features

- Automatic handling of stream conversions
- JSON parsing for configuration files
- S3 URL parsing and content resolution
- Error handling with clear error messages

### 2. SSMClientWrapper

A wrapper around the AWS SDK v3 SSM client for Parameter Store operations.

```typescript
import { SSMClientWrapper } from "../support/aws";

// Create client with specific region
const ssmClient = new SSMClientWrapper("us-west-2");

// Get parameter with automatic caching
const apiKey = await ssmClient.getParameter("/my-app/api-key");

// Parse SSM parameter URLs
const paramName = ssmClient.parseSSMUrl("ssm://my-app/config/api-key");
// Returns: 'my-app/config/api-key'

// Check if a string is an SSM reference
const isSSM = ssmClient.isSSMReference("ssm://my-app/api-key"); // true
```

#### Features

- Automatic parameter caching to reduce API calls
- Support for SSM parameter URL format (`ssm://path/to/param`)
- SecureString parameter decryption
- Parameter reference resolution

### 3. Utility Functions

#### `parseS3Url`

Parses S3 URLs into bucket and key components.

```typescript
import { parseS3Url } from "../support/aws";

const parsed = parseS3Url("s3://my-bucket/path/to/file.json");
// Returns: { bucket: "my-bucket", key: "path/to/file.json" }
```

#### `streamToString`

Converts various AWS response stream types to strings.

```typescript
import { streamToString } from "../support/aws";

// Convert stream from S3 response to string
const content = await streamToString(s3Response.Body);
```

### 4. Constants

- `DEFAULT_AWS_REGION`: Default region used when no region is specified (from `AWS_REGION` env var or `us-east-1`)
- `ssmParameterCache`: Shared cache for SSM parameters to avoid repeated API calls

## Common Use Cases

### Loading Configuration from S3

```typescript
import { S3ClientWrapper } from "../support/aws";

async function loadConfig() {
  const s3Client = new S3ClientWrapper();

  // Load and parse configuration automatically
  const config = await s3Client.getContentFromUrl("s3://my-configs/app-config.json");

  return config;
}
```

### Working with SSM Parameters

```typescript
import { SSMClientWrapper } from "../support/aws";

async function getSecrets() {
  const ssmClient = new SSMClientWrapper();

  // Get multiple parameters
  const [apiKey, dbPassword] = await Promise.all([
    ssmClient.getParameter("/my-app/api-key"),
    ssmClient.getParameter("/my-app/db-password"),
  ]);

  return { apiKey, dbPassword };
}
```

### Resolving Parameter References

```typescript
import { SSMClientWrapper } from "../support/aws";

async function resolveConfigReferences(config: Record<string, string>) {
  const ssmClient = new SSMClientWrapper();
  const result = { ...config };

  for (const [key, value] of Object.entries(config)) {
    if (ssmClient.isSSMReference(value)) {
      const paramName = ssmClient.parseSSMUrl(value);
      if (paramName) {
        result[key] = await ssmClient.getParameter(paramName);
      }
    }
  }

  return result;
}
```

## Error Handling

The wrappers include comprehensive error handling that provides clear context when AWS operations fail:

```typescript
try {
  const content = await s3Client.getObjectAsString("bucket", "key");
} catch (error) {
  // Error message includes bucket and key information for easier debugging
  console.error(error); // "Error retrieving S3 object: bucket/key: <AWS Error>"
}
```

## Testing

When testing code that uses these AWS wrappers, you can:

1. Provide mock client overrides in the constructor:

```typescript
import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";

const mockS3 = mockClient(S3Client);
const s3Wrapper = new S3ClientWrapper("us-west-2", mockS3);
```

2. Use the `aws-sdk-client-mock-vitest` matchers in your tests:

```typescript
// Verify S3 commands
expect(mockS3).toHaveReceivedCommandWith(GetObjectCommand, {
  Bucket: "test-bucket",
  Key: "test-key",
});
```

See the [Client Testing Guide](../../../test/clients/README.md) for more detailed testing examples.
