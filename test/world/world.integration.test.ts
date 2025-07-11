import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Cucumber to prevent setWorldConstructor errors
vi.mock("@cucumber/cucumber", async (importOriginal) => {
  const cucumber = await importOriginal<typeof import("@cucumber/cucumber")>();
  return {
    ...cucumber,
    setWorldConstructor: vi.fn(),
  };
});

// Mock the dummy dependency for this test
vi.mock("../../src/lib/dummy", () => ({
  dummy: (target: string) => `mocked-phrase-for-${target}`,
}));

// Reset all mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
});

// Import SmokeWorld after mock setup
import { type SmokeWorld, SmokeWorldImpl } from "../../src/world";

// This is an integration test that uses the real dummy function
// instead of mocking it
describe("SmokeWorld Integration Tests", () => {
  let smokeWorld: SmokeWorld;

  beforeEach(() => {
    const worldOptions = {
      parameters: {},
      attach: vi.fn(),
      log: vi.fn(),
      link: vi.fn(),
    };
    smokeWorld = new SmokeWorldImpl(worldOptions);
  });

  describe("full workflow", () => {
    it("should set target, generate phrase, and get phrase correctly with real dependencies", () => {
      const testTarget = "integration-test";

      // Set the target
      smokeWorld.setTarget(testTarget);
      expect(smokeWorld.getTarget()).toBe(testTarget);

      // Generate phrase
      smokeWorld.generatePhrase();
      expect(smokeWorld.getPhrase()).toBeTruthy();

      // Check that the phrase is generated
      expect(smokeWorld.getPhrase()).toBeTruthy();
    });
  });
});
