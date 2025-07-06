/**
 * AWS Test Utilities
 * Common helper functions for testing AWS-related functionality
 */
import { expect, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";

/**
 * Custom matcher function for testing AWS SDK commands
 * This provides more readable assertions for command calls with specific parameters
 *
 * @param mockedClient The mocked AWS client
 * @param commandClass The AWS command class to check
 * @param expectedParams The expected parameters that should have been passed to the command
 */
export function expectCommandToHaveBeenCalledWith<Input extends object>(
  mockedClient: ReturnType<typeof mockClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commandClass: any,
  expectedParams: Partial<Input>
): void {
  const calls = mockedClient.commandCalls(commandClass);
  expect(calls.length).toBeGreaterThan(0);

  const matchingCall = calls.some((call) => {
    const actualInput = call.args[0].input as Input;
    return Object.entries(expectedParams).every(
      ([key, value]) => key in actualInput && actualInput[key as keyof Input] === value
    );
  });

  expect(matchingCall).toBe(true);
}

/**
 * Helper function to create a mock S3 response with proper stream-like behavior
 * @param content Content to return in the mock stream
 * @returns Mock S3 response object compatible with AWS SDK types
 */
export function createS3Response(content: string) {
  // Using vi from imported namespace

  // Create a mock stream that simulates AWS SDK stream behavior
  const mockStream = {
    on: vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      event: string,
      callback: (arg?: Buffer) => void
    ) {
      if (event === "data") {
        callback(Buffer.from(content));
      }
      if (event === "end") {
        callback();
      }
      return this;
    }),
    pipe: vi.fn().mockReturnThis(),
    transformToString: vi.fn().mockResolvedValue(content),
    // Additional properties required for SDK compatibility
    aborted: false,
    httpVersion: "1.1",
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    complete: true,
    headers: {},
    rawHeaders: [],
    trailers: {},
    rawTrailers: [],
    setTimeout: vi.fn(),
    statusCode: 200,
    statusMessage: "OK",
    destroy: vi.fn(),
  };

  // Return response object with properly typed mock Body
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Body: mockStream as unknown as any, // Use any to bypass complex AWS SDK types
    $metadata: { httpStatusCode: 200 },
  };
}
