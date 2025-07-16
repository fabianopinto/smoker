/**
 * Basic tests for parameter utilities
 *
 * These tests focus on core functionality and simple use cases for the parameter utilities.
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
import type { SmokeWorld } from "../../../src/world";

describe("Parameter Utilities - Basic Tests", () => {
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

  describe("isConfigReference", () => {
    it("should detect complete config references", () => {
      expect(isConfigReference("config:api.url")).toBe(true);
      expect(isConfigReference("config:api.baseUrl")).toBe(true);
      expect(isConfigReference("config:settings.enabled")).toBe(true);
    });

    it("should return false for strings that are not complete config references", () => {
      expect(isConfigReference("prefix config:api.url")).toBe(false);
      expect(isConfigReference("config:api.url suffix")).toBe(false);
      expect(isConfigReference("no references here")).toBe(false);
      expect(isConfigReference("almost config: but not quite")).toBe(false);
      expect(isConfigReference("")).toBe(false);
    });

    it("should handle valid characters in reference paths", () => {
      expect(isConfigReference("config:api.endpoint")).toBe(true);
      expect(isConfigReference("config:api.v1endpoint")).toBe(true);
      expect(isConfigReference("config:api.endpoint.v2")).toBe(true);
    });

    it("should reject invalid characters in reference paths", () => {
      expect(isConfigReference("config:api-service.endpoint")).toBe(false);
      expect(isConfigReference("config:api_service.endpoint")).toBe(false);
    });
  });

  describe("isPropReference", () => {
    it("should detect complete property references", () => {
      expect(isPropReference("prop:userId")).toBe(true);
      expect(isPropReference("prop:user")).toBe(true);
      expect(isPropReference("prop:enabled")).toBe(true);
    });

    it("should return false for strings that are not complete property references", () => {
      expect(isPropReference("prefix prop:userId")).toBe(false);
      expect(isPropReference("prop:userId suffix")).toBe(false);
      expect(isPropReference("no references here")).toBe(false);
      expect(isPropReference("almost prop: but not quite")).toBe(false);
      expect(isPropReference("")).toBe(false);
    });

    it("should handle valid characters in reference paths", () => {
      expect(isPropReference("prop:userId")).toBe(true);
      expect(isPropReference("prop:user123")).toBe(true);
      expect(isPropReference("prop:user_id")).toBe(true);
    });

    it("should reject invalid characters in reference paths", () => {
      expect(isPropReference("prop:user-id")).toBe(false);
      expect(isPropReference("prop:user.id")).toBe(false);
    });
  });

  describe("resolveConfigReference", () => {
    it("should resolve config references", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.url") return "https://example.com";
        return undefined;
      });

      const result = resolveConfigReference("config:api.url");
      expect(result).toBe("https://example.com");
    });

    it("should handle different config references independently", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.url") return "https://example.com";
        if (path === "api.version") return "v2";
        return undefined;
      });

      const url = resolveConfigReference("config:api.url");
      const version = resolveConfigReference("config:api.version");

      expect(url).toBe("https://example.com");
      expect(version).toBe("v2");
    });

    it("should not process nested config references", () => {
      // In the new implementation, nested references are not processed
      mockGetValue.mockImplementation((path) => {
        if (path === "api.endpoint") return "config:api.baseUrl/users";
        if (path === "api.baseUrl") return "https://example.com/api";
        return undefined;
      });

      const result = resolveConfigReference("config:api.endpoint");
      expect(result).toBe("config:api.baseUrl/users");
      expect(mockGetValue).toHaveBeenCalledWith("api.endpoint");
      // api.baseUrl should not be called because nested references are not processed
      expect(mockGetValue).not.toHaveBeenCalledWith("api.baseUrl");
    });

    it("should not process deeply nested config references", () => {
      // In the new implementation, nested references are not processed
      mockGetValue.mockImplementation((path) => {
        if (path === "level1") return "config:level2";
        if (path === "level2") return "config:level3";
        if (path === "level3") return "Final value";
        return undefined;
      });

      const result = resolveConfigReference("config:level1");
      expect(result).toBe("config:level2");
      expect(mockGetValue).toHaveBeenCalledWith("level1");
      // level2 and level3 should not be called because nested references are not processed
      expect(mockGetValue).not.toHaveBeenCalledWith("level2");
      expect(mockGetValue).not.toHaveBeenCalledWith("level3");
    });

    it("should use rootKey when provided", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "dev.api.url") return "https://dev.example.com";
        if (path === "prod.api.url") return "https://prod.example.com";
        return undefined;
      });

      // Test with dev rootKey
      const devResult = resolveConfigReference("config:api.url", "dev");
      expect(devResult).toBe("https://dev.example.com");
      expect(mockGetValue).toHaveBeenCalledWith("dev.api.url");

      // Test with prod rootKey
      const prodResult = resolveConfigReference("config:api.url", "prod");
      expect(prodResult).toBe("https://prod.example.com");
      expect(mockGetValue).toHaveBeenCalledWith("prod.api.url");
    });

    it("should fall back to direct path when rootKey path is not found", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "env.setting") return undefined; // Not found with rootKey
        if (path === "setting") return "direct value"; // Found without rootKey
        return undefined;
      });

      const result = resolveConfigReference("config:setting", "env");
      expect(result).toBe("direct value");
      expect(mockGetValue).toHaveBeenCalledWith("env.setting");
      expect(mockGetValue).toHaveBeenCalledWith("setting");
    });

    it("should throw error when config value is not found", () => {
      mockGetValue.mockReturnValue(undefined);

      expect(() => resolveConfigReference("config:nonexistent")).toThrow(
        "Configuration value not found: nonexistent",
      );
    });

    it("should not handle adjacent config references in a single parameter", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "protocol") return "https://";
        if (path === "domain") return "example.com";
        if (path === "protocolconfig") return undefined;
        return undefined;
      });

      // In the new implementation, "config:protocolconfig:domain" is not a valid reference
      expect(isConfigReference("config:protocolconfig:domain")).toBe(false);

      // Each reference should be resolved separately
      const protocol = resolveConfigReference("config:protocol");
      const domain = resolveConfigReference("config:domain");

      expect(protocol).toBe("https://");
      expect(domain).toBe("example.com");
    });

    it("should handle non-string config values", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "number") return 123;
        if (path === "boolean") return true;
        if (path === "null") return null;
        if (path === "object") return { key: "value" };
        return undefined;
      });

      expect(resolveConfigReference("config:number")).toBe("123");
      expect(resolveConfigReference("config:boolean")).toBe("true");
      expect(resolveConfigReference("config:null")).toBe("null");
      expect(resolveConfigReference("config:object")).toBe("[object Object]");
    });
  });

  describe("resolvePropReference", () => {
    // Setup mock functions for property access
    const mockGetProperty = vi.fn();
    const mockHasProperty = vi.fn();

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should resolve property references", () => {
      mockHasProperty.mockImplementation((path) => path === "userId");
      mockGetProperty.mockImplementation((path) => {
        if (path === "userId") return "12345";
        return undefined;
      });

      const result = resolvePropReference("prop:userId", mockGetProperty, mockHasProperty);
      expect(result).toBe("12345");
      expect(mockHasProperty).toHaveBeenCalledWith("userId");
      expect(mockGetProperty).toHaveBeenCalledWith("userId");
    });

    it("should handle different property references independently", () => {
      mockHasProperty.mockImplementation((path) => path === "firstName" || path === "lastName");
      mockGetProperty.mockImplementation((path) => {
        if (path === "firstName") return "John";
        if (path === "lastName") return "Doe";
        return undefined;
      });

      const firstName = resolvePropReference("prop:firstName", mockGetProperty, mockHasProperty);
      const lastName = resolvePropReference("prop:lastName", mockGetProperty, mockHasProperty);

      expect(firstName).toBe("John");
      expect(lastName).toBe("Doe");
    });

    it("should throw error when property is not found", () => {
      mockHasProperty.mockReturnValue(false);

      expect(() =>
        resolvePropReference("prop:nonexistent", mockGetProperty, mockHasProperty),
      ).toThrow("Property not found: nonexistent");
    });

    it("should handle non-string property values", () => {
      mockHasProperty.mockReturnValue(true);
      mockGetProperty.mockImplementation((path) => {
        if (path === "number") return 123;
        if (path === "boolean") return true;
        if (path === "null") return null;
        if (path === "object") return { key: "value" };
        return undefined;
      });

      expect(resolvePropReference("prop:number", mockGetProperty, mockHasProperty)).toBe("123");
      expect(resolvePropReference("prop:boolean", mockGetProperty, mockHasProperty)).toBe("true");
      expect(resolvePropReference("prop:null", mockGetProperty, mockHasProperty)).toBe("null");
      expect(resolvePropReference("prop:object", mockGetProperty, mockHasProperty)).toBe(
        "[object Object]",
      );
    });
  });

  describe("resolveStepParameter", () => {
    it("should return original string when no references exist", () => {
      const result = resolveStepParameter("No references here");
      expect(result).toBe("No references here");
    });

    it("should resolve config references", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.url") return "https://example.com";
        return undefined;
      });

      const result = resolveStepParameter("config:api.url");
      expect(result).toBe("https://example.com");
    });

    it("should resolve property references with explicit functions", () => {
      const mockGetProperty = vi.fn((path) => {
        if (path === "userId") return "12345";
        return undefined;
      });

      const mockHasProperty = vi.fn((path) => path === "userId");

      const result = resolveStepParameter("prop:userId", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      expect(result).toBe("12345");
    });

    it("should handle config and property references as separate parameters", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.url") return "https://example.com";
        return undefined;
      });

      const mockGetProperty = vi.fn((path) => {
        if (path === "userId") return "12345";
        return undefined;
      });

      const mockHasProperty = vi.fn((path) => path === "userId");

      // Each parameter is resolved independently
      const urlResult = resolveStepParameter("config:api.url", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      const idResult = resolveStepParameter("prop:userId", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      expect(urlResult).toBe("https://example.com");
      expect(idResult).toBe("12345");

      // Non-references are returned as-is
      const textResult = resolveStepParameter("API URL: /users/", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      expect(textResult).toBe("API URL: /users/");
    });

    it("should use rootKey when provided", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "dev.api.url") return "https://dev.example.com";
        return undefined;
      });

      const result = resolveStepParameter("config:api.url", { rootKey: "dev" });
      expect(result).toBe("https://dev.example.com");
    });

    it("should use world object for property resolution", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.url") return "https://example.com";
        return undefined;
      });

      const mockWorld = {
        hasProperty: vi.fn((path) => path === "userId"),
        getProperty: vi.fn((path) => {
          if (path === "userId") return "12345";
          return undefined;
        }),
      } as unknown as SmokeWorld;

      // Config reference
      const urlResult = resolveStepParameter("config:api.url", {
        world: mockWorld,
      });
      expect(urlResult).toBe("https://example.com");

      // Property reference
      const idResult = resolveStepParameter("prop:userId", {
        world: mockWorld,
      });
      expect(idResult).toBe("12345");
      expect(mockWorld.hasProperty).toHaveBeenCalledWith("userId");
      expect(mockWorld.getProperty).toHaveBeenCalledWith("userId");
    });

    it("should get rootKey from world object", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "dev.api.url") return "https://dev.example.com";
        return undefined;
      });

      const mockWorld = {
        hasProperty: vi.fn((path) => path === "config.rootKey"),
        getProperty: vi.fn((path) => {
          if (path === "config.rootKey") return "dev";
          return undefined;
        }),
      } as unknown as SmokeWorld;

      const result = resolveStepParameter("config:api.url", {
        world: mockWorld,
      });

      expect(result).toBe("https://dev.example.com");
      expect(mockWorld.hasProperty).toHaveBeenCalledWith("config.rootKey");
      expect(mockWorld.getProperty).toHaveBeenCalledWith("config.rootKey");
    });

    it("should prioritize explicit rootKey over world rootKey", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "explicit.api.url") return "https://explicit.example.com";
        if (path === "world.api.url") return "https://world.example.com";
        return undefined;
      });

      const mockWorld = {
        hasProperty: vi.fn((path) => path === "config.rootKey"),
        getProperty: vi.fn((path) => {
          if (path === "config.rootKey") return "world";
          return undefined;
        }),
      } as unknown as SmokeWorld;

      const result = resolveStepParameter("config:api.url", {
        rootKey: "explicit",
        world: mockWorld,
      });

      expect(result).toBe("https://explicit.example.com");
    });

    it("should prioritize explicit property functions over world", () => {
      const mockGetProperty = vi.fn((path) => {
        if (path === "userId") return "explicit-12345";
        return undefined;
      });

      const mockHasProperty = vi.fn((path) => path === "userId");

      const mockWorld = {
        hasProperty: vi.fn((path) => {
          // The world.hasProperty is called to check for config.rootKey
          if (path === "config.rootKey") return false;
          if (path === "userId") return true;
          return false;
        }),
        getProperty: vi.fn((path) => {
          if (path === "userId") return "world-12345";
          return undefined;
        }),
      } as unknown as SmokeWorld;

      const result = resolveStepParameter("prop:userId", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
        world: mockWorld,
      });

      expect(result).toBe("explicit-12345");
      // World's hasProperty is called to check for config.rootKey
      expect(mockWorld.hasProperty).toHaveBeenCalledWith("config.rootKey");
      // But world's getProperty should not be called for userId
      expect(mockWorld.getProperty).not.toHaveBeenCalledWith("userId");
    });
  });
});
