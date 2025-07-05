/**
 * Type declarations for Vitest with AWS SDK client mock custom matchers
 * This file extends the Vitest types to include AWS SDK client mock matchers
 */
import "vitest";
import { CustomMatcher } from "aws-sdk-client-mock-vitest";
import { AwsStub } from "aws-sdk-client-mock";
import { ServiceInputTypes, ServiceOutputTypes } from "@aws-sdk/smithy-client";

// Permit using AWS command classes in custom matchers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AwsCommandClass = any; // Using 'any' here is necessary for compatibility with all AWS command types

/**
 * Extend the Vitest module to include AWS SDK client mock custom matchers
 */
declare module "vitest" {
  /**
   * Extend the Assertion type to include AWS SDK client mock custom matchers
   */
  interface Assertion<T = unknown> extends CustomMatcher<T> {
    // Add specific AWS SDK client mock custom matchers when T is an AwsStub
    toHaveReceivedCommand(
      command: AwsCommandClass
    ): T extends AwsStub<ServiceInputTypes, ServiceOutputTypes, unknown> ? Assertion<T> : never;
    toHaveReceivedCommandTimes(
      command: AwsCommandClass,
      times: number
    ): T extends AwsStub<ServiceInputTypes, ServiceOutputTypes, unknown> ? Assertion<T> : never;
    toHaveReceivedCommandWith(
      command: AwsCommandClass,
      params?: Record<string, unknown>
    ): T extends AwsStub<ServiceInputTypes, ServiceOutputTypes, unknown> ? Assertion<T> : never;
    toHaveReceivedNthCommandWith(
      n: number,
      command: AwsCommandClass,
      params?: Record<string, unknown>
    ): T extends AwsStub<ServiceInputTypes, ServiceOutputTypes, unknown> ? Assertion<T> : never;
  }

  /**
   * Extend the AsymmetricMatchersContaining type to include AWS SDK client mock custom matchers
   * Adding additional properties to satisfy no-empty-interface rule
   */
  interface AsymmetricMatchersContaining extends CustomMatcher {
    // Custom matchers for asymmetric assertions
    toHaveReceivedCommand: CustomMatcher["toHaveReceivedCommand"];
  }
}
