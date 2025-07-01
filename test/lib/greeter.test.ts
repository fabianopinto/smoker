import { describe, it, expect } from "vitest";
import { greet } from "../../src/lib/greeter";

describe("Greeter", () => {
  it("should generate a greeting message with the provided name", () => {
    const result = greet("Bob");
    expect(result).toBe("Hello, Bob!");
  });

  it("should handle empty string", () => {
    const result = greet("");
    expect(result).toBe("Hello, !");
  });
});
