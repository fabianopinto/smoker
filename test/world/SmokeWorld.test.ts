import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IWorldOptions } from "@cucumber/cucumber";

// Mock Cucumber's setWorldConstructor function before importing SmokeWorld
vi.mock("@cucumber/cucumber", async () => {
  const actual = (await vi.importActual("@cucumber/cucumber")) as object;
  return {
    ...actual,
    setWorldConstructor: vi.fn(),
  };
});

// Mock the dummy function
vi.mock("../../src/lib/dummy", () => ({
  dummy: vi.fn((target: string) => `Mocked phrase for ${target}`),
}));

// Now we can safely import SmokeWorld
import { SmokeWorld } from "../../src/world/SmokeWorld";

describe("SmokeWorld", () => {
  let smokeWorld: SmokeWorld;

  beforeEach(() => {
    // Create a fresh instance of SmokeWorld for each test with required WorldOptions
    const worldOptions: IWorldOptions = {
      parameters: {},
      attach: vi.fn(),
      log: vi.fn(),
      link: vi.fn(),
    };
    smokeWorld = new SmokeWorld(worldOptions);
  });

  describe("constructor", () => {
    it("should initialize with empty target and phrase", () => {
      expect(smokeWorld.getTarget()).toBe("");
      expect(smokeWorld.getPhrase()).toBe("");
    });
  });

  describe("setTarget and getTarget", () => {
    it("should set and get the target correctly", () => {
      smokeWorld.setTarget("test-target");
      expect(smokeWorld.getTarget()).toBe("test-target");
    });

    it("should handle empty string target", () => {
      smokeWorld.setTarget("");
      expect(smokeWorld.getTarget()).toBe("");
    });

    it("should update the target when called multiple times", () => {
      smokeWorld.setTarget("first");
      expect(smokeWorld.getTarget()).toBe("first");

      smokeWorld.setTarget("second");
      expect(smokeWorld.getTarget()).toBe("second");
    });
  });

  describe("generatePhrase and getPhrase", () => {
    it("should generate phrase based on the target", () => {
      smokeWorld.setTarget("test-target");
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for test-target");
    });

    it("should handle empty target when generating phrase", () => {
      smokeWorld.setTarget("");
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for ");
    });

    it("should update phrase when target changes and generatePhrase is called again", () => {
      smokeWorld.setTarget("first");
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for first");

      smokeWorld.setTarget("second");
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for second");
    });

    it("should not update phrase when only target changes without calling generatePhrase", () => {
      smokeWorld.setTarget("first");
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for first");

      smokeWorld.setTarget("second");
      // Not calling generatePhrase
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for first");
    });
  });

  describe("edge cases", () => {
    it("should handle non-string inputs that might be coerced to strings", () => {
      // @ts-expect-error - Testing runtime behavior with incorrect types
      smokeWorld.setTarget(123);
      expect(smokeWorld.getTarget()).toBe("123");

      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for 123");
    });

    it("should handle undefined target gracefully", () => {
      // @ts-expect-error - Testing runtime behavior with incorrect types
      smokeWorld.setTarget(undefined);
      expect(smokeWorld.getTarget()).toBe("undefined");

      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for undefined");
    });

    it("should handle null target gracefully", () => {
      // @ts-expect-error - Testing runtime behavior with incorrect types
      smokeWorld.setTarget(null);
      expect(smokeWorld.getTarget()).toBe("null");

      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("Mocked phrase for null");
    });
  });
});
