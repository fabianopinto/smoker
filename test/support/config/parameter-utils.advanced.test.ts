/**
 * Advanced tests for parameter utilities
 *
 * These tests focus on more complex scenarios and edge cases for the parameter utilities.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Configuration } from "../../../src/support";
import {
  isConfigReference,
  isPropReference,
  resolveConfigReference,
  resolvePropReference,
  resolveStepParameter,
} from "../../../src/support/config";
import type { PropertyPath, SmokeWorld } from "../../../src/world";

describe("Parameter Utilities - Advanced Tests", () => {
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

  describe("Complex Reference Patterns", () => {
    it("should handle config references with deep paths", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.services.users.endpoints.get") return "/api/v2/users";
        if (path === "api.services.users.version") return "2.0";
        return undefined;
      });

      // Each reference is resolved independently
      const endpoint = resolveConfigReference("config:api.services.users.endpoints.get");
      const version = resolveConfigReference("config:api.services.users.version");

      expect(endpoint).toBe("/api/v2/users");
      expect(version).toBe("2.0");
    });

    it("should handle references with valid characters", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.baseurl") return "https://example.com";
        if (path === "api.auth_token") return "abc123";
        return undefined;
      });

      // In the new implementation, hyphens are not allowed in config keys
      expect(isConfigReference("config:api.base-url")).toBe(false);

      // Underscores are allowed in property keys but not in config keys
      expect(isConfigReference("config:api.auth_token")).toBe(false);
      expect(isPropReference("prop:auth_token")).toBe(true);

      // Each valid reference is resolved independently
      const baseUrl = resolveConfigReference("config:api.baseurl");
      expect(baseUrl).toBe("https://example.com");
    });

    it("should handle references with numbers in path", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.endpoints.v1.users") return "/api/v1/users";
        if (path === "api.endpoints.v2.users") return "/api/v2/users";
        return undefined;
      });

      // Each reference is resolved independently
      const v1Endpoint = resolveConfigReference("config:api.endpoints.v1.users");
      const v2Endpoint = resolveConfigReference("config:api.endpoints.v2.users");

      expect(v1Endpoint).toBe("/api/v1/users");
      expect(v2Endpoint).toBe("/api/v2/users");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty strings", () => {
      expect(isConfigReference("")).toBe(false);
      expect(isPropReference("")).toBe(false);

      const result = resolveStepParameter("");
      expect(result).toBe("");
    });

    it("should handle complete references only", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "start") return "BEGIN";
        if (path === "middle") return "CENTER";
        if (path === "end") return "END";
        return undefined;
      });

      // In the new implementation, only complete references are valid
      expect(isConfigReference("config:start")).toBe(true);
      expect(isConfigReference("config:start is before")).toBe(false);

      // Each complete reference is resolved independently
      const startValue = resolveConfigReference("config:start");
      const middleValue = resolveConfigReference("config:middle");
      const endValue = resolveConfigReference("config:end");

      expect(startValue).toBe("BEGIN");
      expect(middleValue).toBe("CENTER");
      expect(endValue).toBe("END");

      // Non-references are returned as-is by resolveStepParameter
      expect(resolveStepParameter("config:start is before config:middle")).toBe(
        "config:start is before config:middle",
      );
    });

    it("should not handle adjacent references in a single parameter", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "first") return "Hello";
        if (path === "second") return "World";
        if (path === "firstconfig") return undefined;
        return undefined;
      });

      // In the new implementation, "config:firstconfig:second" is not a valid reference
      expect(isConfigReference("config:firstconfig:second")).toBe(false);

      // Each reference should be resolved separately
      const first = resolveConfigReference("config:first");
      const second = resolveConfigReference("config:second");

      expect(first).toBe("Hello");
      expect(second).toBe("World");

      // When using resolveStepParameter with an invalid reference, it returns as-is
      expect(resolveStepParameter("config:firstconfig:second")).toBe("config:firstconfig:second");
    });

    it("should handle strings that look like references but aren't valid", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "value") return "REPLACED";
        return undefined;
      });

      // In the new implementation, only complete references are valid
      expect(isConfigReference("config:value")).toBe(true);
      expect(isConfigReference("config: not a reference")).toBe(false);

      // Valid references are resolved
      expect(resolveConfigReference("config:value")).toBe("REPLACED");

      // Invalid references are returned as-is by resolveStepParameter
      expect(resolveStepParameter("This is config:value")).toBe("This is config:value");
      expect(resolveStepParameter("This is config: not a reference")).toBe(
        "This is config: not a reference",
      );
    });
  });

  describe("Mixed Reference Types", () => {
    it("should handle config and property references separately", () => {
      // Mock configuration values
      mockGetValue.mockImplementation((path) => {
        if (path === "api.baseUrl") return "https://example.com";
        if (path === "api.version") return "v2";
        return undefined;
      });

      // Mock property functions
      const mockGetProperty = vi.fn((path: PropertyPath) => {
        if (path === "userId") return "12345";
        if (path === "token") return "abc123";
        return undefined;
      });

      const mockHasProperty = vi.fn((path: PropertyPath) => {
        return path === "userId" || path === "token";
      });

      // In the new implementation, each parameter is either a reference or not
      const baseUrl = resolveStepParameter("config:api.baseUrl", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      const version = resolveStepParameter("config:api.version", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      const userId = resolveStepParameter("prop:userId", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      const token = resolveStepParameter("prop:token", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      expect(baseUrl).toBe("https://example.com");
      expect(version).toBe("v2");
      expect(userId).toBe("12345");
      expect(token).toBe("abc123");

      // Non-references are returned as-is
      const text = resolveStepParameter("curl -X GET", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      expect(text).toBe("curl -X GET");
    });
  });

  describe("SmokeWorld Integration", () => {
    it("should use SmokeWorld for property resolution", () => {
      // Mock configuration values
      mockGetValue.mockImplementation((path) => {
        if (path === "api.endpoint") return "/users";
        return undefined;
      });

      // Mock SmokeWorld
      const mockWorld = {
        hasProperty: vi.fn().mockImplementation((path: PropertyPath) => {
          return path === "userId" || path === "config.rootKey";
        }),
        getProperty: vi.fn().mockImplementation((path: PropertyPath) => {
          if (path === "userId") return "12345";
          if (path === "config.rootKey") return "api";
          return undefined;
        }),
      } as unknown as SmokeWorld;

      // Test with SmokeWorld - config reference
      const endpoint = resolveStepParameter("config:endpoint", { world: mockWorld });
      expect(endpoint).toBe("/users");
      expect(mockWorld.getProperty).toHaveBeenCalledWith("config.rootKey");

      // Test with SmokeWorld - property reference
      const userId = resolveStepParameter("prop:userId", { world: mockWorld });
      expect(userId).toBe("12345");
      expect(mockWorld.getProperty).toHaveBeenCalledWith("userId");
    });

    it("should handle root key from SmokeWorld", () => {
      // Mock configuration values
      mockGetValue.mockImplementation((path) => {
        if (path === "production.url") return "https://prod.example.com";
        if (path === "staging.url") return "https://staging.example.com";
        return undefined;
      });

      // Mock SmokeWorld with different root keys
      const createMockWorld = (rootKey: string) =>
        ({
          hasProperty: vi.fn().mockImplementation((path: PropertyPath) => {
            return path === "config.rootKey";
          }),
          getProperty: vi.fn().mockImplementation((path: PropertyPath) => {
            if (path === "config.rootKey") return rootKey;
            return undefined;
          }),
        }) as unknown as SmokeWorld;

      // Test with production root key
      const prodWorld = createMockWorld("production");
      const prodResult = resolveStepParameter("config:url", { world: prodWorld });
      expect(prodResult).toBe("https://prod.example.com");

      // Test with staging root key
      const stagingWorld = createMockWorld("staging");
      const stagingResult = resolveStepParameter("config:url", { world: stagingWorld });
      expect(stagingResult).toBe("https://staging.example.com");
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed references gracefully", () => {
      // This is not a valid reference format (missing path after colon)
      expect(isConfigReference("config:")).toBe(false);

      // Invalid references are returned as-is by resolveStepParameter
      const result = resolveStepParameter("This has config: but no path");
      expect(result).toBe("This has config: but no path");
    });

    it("should provide clear error messages for missing values", () => {
      mockGetValue.mockReturnValue(undefined);

      expect(() => resolveConfigReference("config:missing.path")).toThrow(
        "Configuration value not found: missing.path",
      );
    });

    it("should handle circular references in properties", () => {
      const mockGetProperty = vi.fn();
      const mockHasProperty = vi.fn().mockReturnValue(true);

      // Create a circular reference scenario
      mockGetProperty.mockImplementation((path: PropertyPath) => {
        if (path === "user") return "prop:user"; // Circular reference
        return undefined;
      });

      // In the new implementation, nested references are not processed,
      // so circular references are not a problem
      const result = resolvePropReference("prop:user", mockGetProperty, mockHasProperty);
      expect(result).toBe("prop:user");
    });
  });
});
