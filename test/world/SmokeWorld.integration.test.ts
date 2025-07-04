import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IWorldOptions } from "@cucumber/cucumber";

// Mock Cucumber's setWorldConstructor function before importing SmokeWorld
vi.mock("@cucumber/cucumber", async () => {
  const actual = (await vi.importActual("@cucumber/cucumber")) as object;
  return {
    ...actual,
    setWorldConstructor: vi.fn(),
  };
});

// Import SmokeWorld after mock setup
import { SmokeWorld } from "../../src/world/SmokeWorld";

// This is an integration test that uses the real dummy function
// instead of mocking it
describe("SmokeWorld Integration", () => {
  let smokeWorld: SmokeWorld;

  beforeEach(() => {
    // Create SmokeWorld with required WorldOptions
    const worldOptions: IWorldOptions = {
      parameters: {},
      attach: vi.fn(),
      log: vi.fn(),
      link: vi.fn(),
    };
    smokeWorld = new SmokeWorld(worldOptions);
  });

  describe("full workflow", () => {
    it("should set target, generate phrase, and get phrase correctly with real dependencies", () => {
      const testTarget = "integration-test";

      // Set the target
      smokeWorld.setTarget(testTarget);
      expect(smokeWorld.getTarget()).toBe(testTarget);

      // Generate and retrieve the phrase
      smokeWorld.generatePhrase();
      const phrase = smokeWorld.getPhrase();

      // We can't assert exact phrase since it depends on the real config
      // but we can check that the target is included
      expect(phrase).toContain(testTarget);
      expect(phrase.length).toBeGreaterThan(0);
    });
  });
});
