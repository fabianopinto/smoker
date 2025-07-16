/**
 * Tests for property handling in SmokeWorldImpl
 *
 * This file contains tests that focus on the property handling functionality
 * of SmokeWorldImpl, including setting, getting, and removing properties.
 */
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
vi.mock("../../src/clients", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/clients")>();
  return {
    ...original,
    ClientRegistry: vi.fn().mockReturnValue({
      registerConfigs: vi.fn(),
      registerConfigArray: vi.fn(),
      registerConfig: vi.fn(),
      getConfig: vi.fn(),
      getAllConfigs: vi.fn().mockReturnValue(new Map()),
    }),
    ClientFactory: vi.fn().mockImplementation(() => ({
      createClient: vi.fn().mockReturnValue({
        init: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  };
});

// Import after mocks are set up
import { type SmokeWorld, SmokeWorldImpl } from "../../src/world";

describe("SmokeWorld Property Handling", () => {
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

  describe("Basic Property Operations", () => {
    it("should store and retrieve properties correctly", () => {
      // Set simple properties
      smokeWorld.setProperty("user.name", "John");
      smokeWorld.setProperty("user.age", 30);

      // Check properties exist
      expect(smokeWorld.hasProperty("user.name")).toBe(true);
      expect(smokeWorld.hasProperty("user.age")).toBe(true);

      // Get properties
      expect(smokeWorld.getProperty("user.name")).toBe("John");
      expect(smokeWorld.getProperty("user.age")).toBe(30);
    });

    it("should handle nested properties", () => {
      // Set nested properties
      smokeWorld.setProperty("user.address", {
        street: "123 Main St",
        city: "Anytown",
      });

      // Get nested properties using dot notation
      expect(smokeWorld.getProperty("user.address.street")).toBe("123 Main St");
      expect(smokeWorld.getProperty("user.address.city")).toBe("Anytown");

      // Get nested properties using array notation
      expect(smokeWorld.getProperty(["user", "address", "street"])).toBe("123 Main St");
    });

    it("should remove properties correctly", () => {
      // Set properties
      smokeWorld.setProperty("test.prop1", "value1");
      smokeWorld.setProperty("test.prop2", "value2");

      // Remove one property
      smokeWorld.removeProperty("test.prop1");

      // Check property was removed
      expect(smokeWorld.hasProperty("test.prop1")).toBe(false);
      expect(smokeWorld.hasProperty("test.prop2")).toBe(true);

      // Should throw when accessing removed property
      expect(() => smokeWorld.getProperty("test.prop1")).toThrow();
    });

    it("should get the entire property map", () => {
      // Set properties
      smokeWorld.setProperty("a", 1);
      smokeWorld.setProperty("b.c", 2);

      // Get the entire map
      const map = smokeWorld.getPropertyMap();

      // Check map structure
      expect(map).toEqual({
        a: 1,
        b: {
          c: 2,
        },
      });
    });
  });

  describe("Property Path Handling", () => {
    it("should handle string and array paths", () => {
      // Set property using string path
      smokeWorld.setProperty("user.profile.name", "John");

      // Get property using string path
      expect(smokeWorld.getProperty("user.profile.name")).toBe("John");

      // Get property using array path
      expect(smokeWorld.getProperty(["user", "profile", "name"])).toBe("John");

      // Set property using array path
      smokeWorld.setProperty(["user", "profile", "age"], 30);

      // Get property using string path
      expect(smokeWorld.getProperty("user.profile.age")).toBe(30);
    });

    it("should handle empty paths gracefully", () => {
      // Empty string path should throw with specific error message
      expect(() => smokeWorld.setProperty("", "value")).toThrow("Property path cannot be empty");
      expect(() => smokeWorld.getProperty("")).toThrow("Property path cannot be empty");
      expect(() => smokeWorld.hasProperty("")).toThrow("Property path cannot be empty");
      expect(() => smokeWorld.removeProperty("")).toThrow("Property path cannot be empty");

      // Empty array path should throw with specific error message
      expect(() => smokeWorld.setProperty([], "value")).toThrow("Property path cannot be empty");
      expect(() => smokeWorld.getProperty([])).toThrow("Property path cannot be empty");
      expect(() => smokeWorld.hasProperty([])).toThrow("Property path cannot be empty");
      expect(() => smokeWorld.removeProperty([])).toThrow("Property path cannot be empty");
    });
  });

  describe("Property Value Types", () => {
    it("should handle various property value types", () => {
      // Set properties with different value types
      smokeWorld.setProperty("string", "string value");
      smokeWorld.setProperty("number", 42);
      smokeWorld.setProperty("boolean", true);
      smokeWorld.setProperty("null", null);
      smokeWorld.setProperty("object", { key: "value" });
      smokeWorld.setProperty("nested", { a: { b: { c: "nested value" } } });

      // Verify properties have correct types and values
      expect(smokeWorld.getProperty("string")).toBe("string value");
      expect(smokeWorld.getProperty("number")).toBe(42);
      expect(smokeWorld.getProperty("boolean")).toBe(true);
      expect(smokeWorld.getProperty("null")).toBe(null);
      expect(smokeWorld.getProperty("object")).toEqual({ key: "value" });
      expect(smokeWorld.getProperty("nested")).toEqual({ a: { b: { c: "nested value" } } });

      // Access nested property within an object value
      expect(smokeWorld.getProperty("nested.a.b.c")).toBe("nested value");
    });

    it("should handle overwriting properties with different types", () => {
      // Set a property as a string
      smokeWorld.setProperty("mutable", "string value");
      expect(smokeWorld.getProperty("mutable")).toBe("string value");

      // Overwrite with a number
      smokeWorld.setProperty("mutable", 42);
      expect(smokeWorld.getProperty("mutable")).toBe(42);

      // Overwrite with an object
      smokeWorld.setProperty("mutable", { key: "value" });
      expect(smokeWorld.getProperty("mutable")).toEqual({ key: "value" });

      // Overwrite with null
      smokeWorld.setProperty("mutable", null);
      expect(smokeWorld.getProperty("mutable")).toBe(null);
    });

    it("should handle converting a leaf node to an object", () => {
      // Set a leaf property
      smokeWorld.setProperty("leaf", "value");
      expect(smokeWorld.getProperty("leaf")).toBe("value");

      // Convert to an object by setting a nested property
      smokeWorld.setProperty("leaf.nested", "nested value");

      // Verify the leaf is now an object
      expect(smokeWorld.getProperty("leaf")).toEqual({ nested: "nested value" });
      expect(smokeWorld.getProperty("leaf.nested")).toBe("nested value");
    });
  });

  describe("Error Handling", () => {
    it("should throw error when getting non-existent property", () => {
      expect(() => smokeWorld.getProperty("nonexistent")).toThrow(
        "Property not found at path: nonexistent",
      );
    });

    it("should throw error when getting property from non-object", () => {
      // Set a string property
      smokeWorld.setProperty("string", "value");

      // Try to access it as if it were an object
      expect(() => smokeWorld.getProperty("string.nested")).toThrow(
        "Property not found at path: string.nested",
      );
    });

    it("should throw error when removing non-existent property", () => {
      expect(() => smokeWorld.removeProperty("nonexistent")).toThrow(
        "Property not found at path: nonexistent",
      );
    });

    it("should throw error when removing property from non-object", () => {
      // Set a string property
      smokeWorld.setProperty("string", "value");

      // Try to remove a nested property
      // The actual implementation throws when it can't find the parent path
      expect(() => smokeWorld.removeProperty("string.nested")).toThrow(
        "Property not found at path: string",
      );
    });
  });

  describe("Deep Property Paths", () => {
    it("should handle very deep property paths", () => {
      // Create a deep path
      const deepPath = "level1.level2.level3.level4.level5.level6.level7";
      smokeWorld.setProperty(deepPath, "deep value");

      // Verify the property can be retrieved
      expect(smokeWorld.getProperty(deepPath)).toBe("deep value");

      // Verify intermediate objects were created
      expect(smokeWorld.hasProperty("level1")).toBe(true);
      expect(smokeWorld.hasProperty("level1.level2")).toBe(true);
      expect(smokeWorld.hasProperty("level1.level2.level3")).toBe(true);
    });

    it("should handle deep property paths with array notation", () => {
      // Create a deep path with array notation
      const deepPathArray = [
        "arrayLevel1",
        "arrayLevel2",
        "arrayLevel3",
        "arrayLevel4",
        "arrayLevel5",
        "arrayLevel6",
        "arrayLevel7",
      ];
      smokeWorld.setProperty(deepPathArray, "deep array value");

      // Verify the property can be retrieved with both array and string notation
      expect(smokeWorld.getProperty(deepPathArray)).toBe("deep array value");
      expect(smokeWorld.getProperty(deepPathArray.join("."))).toBe("deep array value");

      // Remove using string notation
      smokeWorld.removeProperty(deepPathArray.join("."));

      // Verify the property was removed
      expect(smokeWorld.hasProperty(deepPathArray)).toBe(false);
    });
  });
});
