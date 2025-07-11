/**
 * AWS Test Utilities
 * Common helper functions for testing AWS-related functionality
 */
import { vi } from "vitest";

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
      callback: (arg?: Buffer) => void,
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
