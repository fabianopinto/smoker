/**
 * Edge case tests for parameter utilities
 *
 * These tests focus on edge cases and error handling for the parameter utilities.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Configuration } from "../../../src/support";
import {
  isConfigReference,
  isPropReference,
  resolveConfigReference,
  resolveStepParameter,
} from "../../../src/support/config";
import type { SmokeWorld } from "../../../src/world";

describe("Parameter Utilities - Edge Cases", () => {
  // Mock the Configuration singleton
  const mockGetValue = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();

    // Mock the Configuration.getInstance method
    vi.spyOn(Configuration, "getInstance").mockReturnValue({
      getValue: mockGetValue,
      // Add other required methods with mock implementations
      addConfigurationSource: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      loadConfigurations: vi.fn(),
    } as unknown as Configuration);
  });

  describe("Reference Pattern Edge Cases", () => {
    it("should handle malformed config references", () => {
      // These are not valid config references, so they should not be recognized
      expect(isConfigReference("config:")).toBe(false);
      expect(isConfigReference("config: path")).toBe(false);
      expect(isConfigReference("config:path@with#invalid$chars")).toBe(false);

      // When passed to resolveStepParameter, they should be returned as-is
      expect(resolveStepParameter("config:")).toBe("config:");
      expect(resolveStepParameter("config: path")).toBe("config: path");
      expect(resolveStepParameter("config:path@with#invalid$chars")).toBe(
        "config:path@with#invalid$chars",
      );
    });

    it("should handle malformed property references", () => {
      const mockGetProperty = vi.fn();
      const mockHasProperty = vi.fn().mockReturnValue(false);

      // These are not valid property references, so they should not be recognized
      expect(isPropReference("prop:")).toBe(false);
      expect(isPropReference("prop: path")).toBe(false);
      expect(isPropReference("prop:path@with#invalid$chars")).toBe(false);

      // When passed to resolveStepParameter, they should be returned as-is
      expect(
        resolveStepParameter("prop:", {
          getPropertyFn: mockGetProperty,
          hasPropertyFn: mockHasProperty,
        }),
      ).toBe("prop:");

      expect(
        resolveStepParameter("prop: path", {
          getPropertyFn: mockGetProperty,
          hasPropertyFn: mockHasProperty,
        }),
      ).toBe("prop: path");

      expect(
        resolveStepParameter("prop:path@with#invalid$chars", {
          getPropertyFn: mockGetProperty,
          hasPropertyFn: mockHasProperty,
        }),
      ).toBe("prop:path@with#invalid$chars");
    });

    it("should handle references as complete strings", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "start") return "BEGIN";
        if (path === "end") return "END";
        return undefined;
      });

      // Only complete references are valid
      expect(isConfigReference("config:start")).toBe(true);
      expect(isConfigReference("config:end")).toBe(true);

      // These are not valid config references
      expect(isConfigReference("config:start of string")).toBe(false);
      expect(isConfigReference("end of config:end")).toBe(false);

      // When resolving a complete reference
      expect(resolveConfigReference("config:start")).toBe("BEGIN");
      expect(resolveConfigReference("config:end")).toBe("END");

      // When using resolveStepParameter
      expect(resolveStepParameter("config:start")).toBe("BEGIN");
      expect(resolveStepParameter("config:end")).toBe("END");

      // Non-references should be returned as-is
      expect(resolveStepParameter("config:start of string")).toBe("config:start of string");
      expect(resolveStepParameter("end of config:end")).toBe("end of config:end");
    });
  });

  describe("Nested References and Recursion", () => {
    it("should handle config references without nesting", () => {
      // In the new implementation, nested references are not supported
      mockGetValue.mockImplementation((path) => {
        if (path === "level1") return "value1";
        if (path === "level2") return "value2";
        if (path === "level3") return "value3";
        return undefined;
      });

      // Each reference is resolved independently
      expect(resolveConfigReference("config:level1")).toBe("value1");
      expect(resolveConfigReference("config:level2")).toBe("value2");
      expect(resolveConfigReference("config:level3")).toBe("value3");

      // Verify the correct number of calls to getValue
      expect(mockGetValue).toHaveBeenCalledWith("level1");
      expect(mockGetValue).toHaveBeenCalledWith("level2");
      expect(mockGetValue).toHaveBeenCalledWith("level3");
    });

    it("should handle circular references gracefully", () => {
      // Setup a circular reference scenario
      let callCount = 0;

      mockGetValue.mockImplementation((path) => {
        callCount++;
        if (path === "circular1") return "config:circular2";
        if (path === "circular2") return "config:circular1";
        return undefined;
      });

      // In the new implementation, nested references are not processed,
      // so circular references are not a problem
      const result = resolveConfigReference("config:circular1");

      // Verify that the function completed and didn't throw
      expect(result).toBeDefined();
      expect(result).toBe("config:circular2");

      // Verify that the function only made one call (no recursive processing)
      expect(callCount).toBe(1);
    });

    it("should handle simple references without nesting", () => {
      // In the new implementation, each parameter is either a reference or not
      mockGetValue.mockImplementation((path) => {
        if (path === "greeting") return "Hello";
        if (path === "name") return "John";
        if (path === "id") return "12345";
        return undefined;
      });

      // Each reference is resolved independently
      expect(resolveConfigReference("config:greeting")).toBe("Hello");
      expect(resolveConfigReference("config:name")).toBe("John");
      expect(resolveConfigReference("config:id")).toBe("12345");

      // When using resolveStepParameter
      expect(resolveStepParameter("config:greeting")).toBe("Hello");
      expect(resolveStepParameter("config:name")).toBe("John");
      expect(resolveStepParameter("config:id")).toBe("12345");

      // Non-references are returned as-is
      expect(resolveStepParameter("Hello John! Your ID is 12345.")).toBe(
        "Hello John! Your ID is 12345.",
      );
    });

    it("should handle references with rootKey", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "dev.env") return "Development";
        if (path === "dev.url") return "https://dev.example.com";
        return undefined;
      });

      // References with rootKey are resolved correctly
      expect(resolveConfigReference("config:env", "dev")).toBe("Development");
      expect(resolveConfigReference("config:url", "dev")).toBe("https://dev.example.com");

      // When using resolveStepParameter
      expect(resolveStepParameter("config:env", { rootKey: "dev" })).toBe("Development");
      expect(resolveStepParameter("config:url", { rootKey: "dev" })).toBe(
        "https://dev.example.com",
      );
    });
  });

  describe("RootKey and Fallback Behavior", () => {
    it("should try all fallback paths in order", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "env1.env2.setting") return undefined; // First try with both prefixes
        if (path === "env1.setting") return undefined; // Then try with first prefix only
        if (path === "setting") return "found value"; // Finally try without prefix
        return undefined;
      });

      const result = resolveConfigReference("config:setting", "env1.env2");
      expect(result).toBe("found value");

      // Verify the correct calls to getValue
      expect(mockGetValue).toHaveBeenCalledWith("env1.env2.setting");
      expect(mockGetValue).toHaveBeenCalledWith("setting");
    });

    it("should handle complex rootKey paths", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "env.region.service.setting") return "complex value";
        return undefined;
      });

      const result = resolveConfigReference("config:setting", "env.region.service");
      expect(result).toBe("complex value");
    });

    it("should throw error when no fallback value is found", () => {
      mockGetValue.mockReturnValue(undefined);

      expect(() => resolveConfigReference("config:setting", "env")).toThrow(
        "Configuration value not found: env.setting",
      );
    });
  });

  describe("Special Value Handling", () => {
    it("should handle empty values correctly", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "empty") return "";
        return undefined;
      });

      // Test with just the empty value
      expect(resolveConfigReference("config:empty")).toBe("");

      // Non-references are returned as-is
      expect(resolveStepParameter("prefix-config:empty-suffix")).toBe("prefix-config:empty-suffix");
      expect(resolveStepParameter("prefix config:empty suffix")).toBe("prefix config:empty suffix");
    });

    it("should handle undefined values by throwing error", () => {
      mockGetValue.mockReturnValue(undefined);

      expect(() => resolveConfigReference("config:undefined")).toThrow(
        "Configuration value not found: undefined",
      );
    });

    it("should handle null values correctly", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "null") return null;
        return undefined;
      });

      expect(resolveConfigReference("config:null")).toBe("null");
    });

    it("should handle boolean values correctly", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "true") return true;
        if (path === "false") return false;
        return undefined;
      });

      expect(resolveConfigReference("config:true")).toBe("true");
      expect(resolveConfigReference("config:false")).toBe("false");
    });

    it("should handle numeric values correctly", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "zero") return 0;
        if (path === "integer") return 42;
        if (path === "float") return 3.14;
        if (path === "negative") return -10;
        return undefined;
      });

      expect(resolveConfigReference("config:zero")).toBe("0");
      expect(resolveConfigReference("config:integer")).toBe("42");
      expect(resolveConfigReference("config:float")).toBe("3.14");
      expect(resolveConfigReference("config:negative")).toBe("-10");
    });

    it("should handle object values by converting to string", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "object") return { key: "value" };
        if (path === "array") return [1, 2, 3];
        return undefined;
      });

      expect(resolveConfigReference("config:object")).toBe("[object Object]");
      expect(resolveConfigReference("config:array")).toBe("1,2,3");
    });
  });

  describe("resolveStepParameter Edge Cases", () => {
    it("should handle undefined options", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "setting") return "value";
        return undefined;
      });

      expect(resolveStepParameter("config:setting", undefined)).toBe("value");
    });

    it("should handle empty options object", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "setting") return "value";
        return undefined;
      });

      expect(resolveStepParameter("config:setting", {})).toBe("value");
    });

    it("should handle property references without property functions", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "setting") return "value";
        return undefined;
      });

      // Only config references are resolved, prop references are returned as-is
      expect(resolveStepParameter("config:setting", {})).toBe("value");
      expect(resolveStepParameter("prop:user.id", {})).toBe("prop:user.id");
    });

    it("should handle world object without required methods", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "setting") return "value";
        return undefined;
      });

      // Create a world object without the required methods
      const incompleteWorld = {} as unknown as SmokeWorld;

      // In the new implementation, we check for the existence of methods before using them
      // With an incomplete world object, the config reference should be returned as-is
      const result = resolveStepParameter("config:setting", { world: incompleteWorld });
      expect(result).toBe("value");

      // For a string that's not a complete reference, it should be returned as-is
      const mixedResult = resolveStepParameter("config:setting and prop:user.id", {
        world: incompleteWorld,
      });
      expect(mixedResult).toBe("config:setting and prop:user.id");
    });

    it("should handle partial world object", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "setting") return "value";
        return undefined;
      });

      // Create a world object with only hasProperty but no getProperty
      const partialWorld = {
        hasProperty: vi.fn().mockReturnValue(true),
      } as unknown as SmokeWorld;

      // In the new implementation, we check for the existence of both methods before using them
      // With a partial world object, the config reference should be returned as-is
      const result = resolveStepParameter("config:setting", { world: partialWorld });
      expect(result).toBe("value");

      // For a string that's not a complete reference, it should be returned as-is
      const mixedResult = resolveStepParameter("config:setting and prop:user.id", {
        world: partialWorld,
      });
      expect(mixedResult).toBe("config:setting and prop:user.id");
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle invalid references", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "valid") return "valid-value";
        return undefined;
      });

      // Should throw for invalid references
      expect(() => resolveConfigReference("config:invalid")).toThrow();

      // Valid references should be resolved
      expect(resolveConfigReference("config:valid")).toBe("valid-value");
    });

    it("should handle valid references", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "valid") return "valid-value";
        return undefined;
      });

      const mockGetProperty = vi.fn();
      const mockHasProperty = vi.fn((path) => path === "valid");
      mockGetProperty.mockImplementation((path) => {
        if (path === "valid") return "property-value";
        return undefined;
      });

      // Each reference is resolved independently
      expect(
        resolveStepParameter("config:valid", {
          getPropertyFn: mockGetProperty,
          hasPropertyFn: mockHasProperty,
        }),
      ).toBe("valid-value");

      expect(
        resolveStepParameter("prop:valid", {
          getPropertyFn: mockGetProperty,
          hasPropertyFn: mockHasProperty,
        }),
      ).toBe("property-value");

      // Non-references are returned as-is
      expect(
        resolveStepParameter("just a string", {
          getPropertyFn: mockGetProperty,
          hasPropertyFn: mockHasProperty,
        }),
      ).toBe("just a string");
    });
  });
});
