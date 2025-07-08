import type { IWorldOptions } from "@cucumber/cucumber";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the setWorldConstructor to prevent errors when importing world module
vi.mock("@cucumber/cucumber", async (importOriginal) => {
  const cucumber = await importOriginal<typeof import("@cucumber/cucumber")>();
  return {
    ...cucumber,
    setWorldConstructor: vi.fn(),
  };
});

// Mock the dummy function
const mockDummy = vi.fn();

// Mock the dummy module that contains the function
vi.mock("../../src/lib/dummy", () => ({
  dummy: (target: string) => mockDummy(target),
}));

// Import the SmokeWorld type and implementation
// Import types first to prevent issues with mocks
import type { SmokeWorld } from "../../src/world";
import { SmokeWorldImpl } from "../../src/world";

describe("SmokeWorld", () => {
  let smokeWorld: SmokeWorld;
  const worldOptions: IWorldOptions = {
    parameters: {},
    attach: vi.fn(),
    log: vi.fn(),
    link: vi.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    // Create a new instance for each test
    smokeWorld = new SmokeWorldImpl(worldOptions);
  });

  describe("Target Management", () => {
    it("should set and get target correctly", () => {
      const testTarget = "test-target";
      smokeWorld.setTarget(testTarget);
      expect(smokeWorld.getTarget()).toBe(testTarget);
    });

    it("should handle invalid target input", () => {
      // String(null) becomes 'null' string
      smokeWorld.setTarget(String(null));
      expect(smokeWorld.getTarget()).toBe("null");
    });
  });

  describe("Phrase Management", () => {
    it("should generate and get phrase correctly", () => {
      const mockPhrase = "mock-random-phrase";
      mockDummy.mockReturnValue(mockPhrase);

      // Set a target first
      const testTarget = "test-target";
      smokeWorld.setTarget(testTarget);

      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe(mockPhrase);
      expect(mockDummy).toHaveBeenCalledWith(testTarget);
    });

    it("should handle invalid phrase input", () => {
      // Use a null-like value that can be converted to string
      mockDummy.mockReturnValue("");

      // Set a target first
      smokeWorld.setTarget("test");
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("");
    });

    it("should regenerate phrase correctly", () => {
      const mockPhrase1 = "mock-phrase-1";
      const mockPhrase2 = "mock-phrase-2";

      // Set a target first
      smokeWorld.setTarget("test1");

      // First generation
      mockDummy.mockReturnValue(mockPhrase1);
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe(mockPhrase1);
      // Verify the phrase remains constant
      expect(smokeWorld.getPhrase()).toBe(mockPhrase1);

      // Second generation
      mockDummy.mockReturnValue(mockPhrase2);
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe(mockPhrase2);
    });

    it("should handle multiple phrase generations", () => {
      // Set a target first
      smokeWorld.setTarget("test-target");

      // First set a valid phrase
      mockDummy.mockReturnValue("valid-phrase");
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBe("valid-phrase");

      // Then generate a new phrase
      mockDummy.mockReturnValue("new-phrase");
      smokeWorld.generatePhrase();

      expect(smokeWorld.getPhrase()).toBe("new-phrase");
      expect(mockDummy).toHaveBeenCalledTimes(2);
    });
  });
});
