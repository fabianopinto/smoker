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

// Mock the client registry and factory
vi.mock("../../src/clients/registry/config", () => ({
  ClientRegistry: vi.fn().mockImplementation(() => ({})),
  createClientRegistry: vi.fn(),
}));

vi.mock("../../src/clients/registry/factory", () => ({
  ClientFactory: vi.fn().mockImplementation(() => ({})),
  createClientFactory: vi.fn(),
}));

// Import after mocks are set up
import { type SmokeWorld, SmokeWorldImpl } from "../../src/world";

describe("SmokeWorld Helper Methods", () => {
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

  describe("Response Management", () => {
    it("should attach and get response correctly", () => {
      const testResponse = { status: 200, data: { test: true } };
      smokeWorld.attachResponse(testResponse);
      expect(smokeWorld.getLastResponse()).toEqual(testResponse);
    });

    it("should throw error when getting response without attaching", () => {
      expect(() => smokeWorld.getLastResponse()).toThrow("No response has been attached");
    });

    it("should throw error when attaching null response", () => {
      smokeWorld.attachResponse(null);
      expect(() => smokeWorld.getLastResponse()).toThrow("No response has been attached");
    });

    it("should override previous response when attaching a new one", () => {
      const firstResponse = { status: 200, data: "first" };
      const secondResponse = { status: 201, data: "second" };

      smokeWorld.attachResponse(firstResponse);
      smokeWorld.attachResponse(secondResponse);

      expect(smokeWorld.getLastResponse()).toEqual(secondResponse);
    });
  });

  describe("Content Management", () => {
    it("should attach and get content correctly", () => {
      const testContent = "Test content";
      smokeWorld.attachContent(testContent);
      expect(smokeWorld.getLastContent()).toBe(testContent);
    });

    it("should throw error when getting content without attaching", () => {
      expect(() => smokeWorld.getLastContent()).toThrow("No content has been attached");
    });

    it("should handle empty string content", () => {
      smokeWorld.attachContent("");
      expect(() => smokeWorld.getLastContent()).toThrow("No content has been attached");
    });

    it("should override previous content when attaching new content", () => {
      smokeWorld.attachContent("first");
      smokeWorld.attachContent("second");

      expect(smokeWorld.getLastContent()).toBe("second");
    });
  });

  describe("Error Management", () => {
    it("should attach and get error correctly", () => {
      const testError = new Error("Test error");
      smokeWorld.attachError(testError);
      expect(smokeWorld.getLastError()).toBe(testError);
    });

    it("should throw error when getting error without attaching", () => {
      expect(() => smokeWorld.getLastError()).toThrow("No error has been attached");
    });

    it("should override previous error when attaching a new one", () => {
      const firstError = new Error("First error");
      const secondError = new Error("Second error");

      smokeWorld.attachError(firstError);
      smokeWorld.attachError(secondError);

      expect(smokeWorld.getLastError()).toBe(secondError);
    });
  });
});
