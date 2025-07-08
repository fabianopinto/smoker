/**
 * Test setup configuration file
 * This extends vitest's expect with AWS SDK client mock matchers for improved test assertions
 */
import { allCustomMatcher } from "aws-sdk-client-mock-vitest";
import { expect } from "vitest";

// Extend vitest's expect with all AWS SDK client mock custom matchers
// This allows for better assertions when testing AWS service interactions
expect.extend(allCustomMatcher);
