/**
 * Tests for configuration parameter utilities
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Configuration } from "../../src/support";
import {
  isConfigReference,
  resolveConfigReference,
  resolveStepParameter,
} from "../../src/support/config";

describe("Configuration Parameter Utilities", () => {
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
    it("should return true when string is a complete config reference", () => {
      expect(isConfigReference("config:api.baseUrl")).toBe(true);
      // In the new implementation, only complete references are valid
      expect(isConfigReference("prefix config:api.baseUrl suffix")).toBe(false);
      expect(isConfigReference("multiple config:api.baseUrl and config:api.version")).toBe(false);
    });

    it("should return false when string is not a complete config reference", () => {
      expect(isConfigReference("no config reference")).toBe(false);
      expect(isConfigReference("config: not a reference")).toBe(false);
      expect(isConfigReference("")).toBe(false);
    });

    it("should handle valid characters in config paths", () => {
      // In the new implementation, hyphens are not allowed in config keys
      expect(isConfigReference("config:api.base-url")).toBe(false);
      // In the new implementation, underscores are not allowed in config keys
      expect(isConfigReference("config:api_service.endpoint")).toBe(false);
      // Numbers are allowed in config keys
      expect(isConfigReference("config:api.1.endpoint")).toBe(true);
    });
  });

  describe("resolveConfigReference", () => {
    it("should resolve complete config references", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.baseUrl") return "https://example.com";
        if (path === "api.version") return "v1";
        return undefined;
      });

      // In the new implementation, only complete references are resolved
      const baseUrl = resolveConfigReference("config:api.baseUrl");
      const version = resolveConfigReference("config:api.version");

      expect(baseUrl).toBe("https://example.com");
      expect(version).toBe("v1");

      // Manually combine the results
      const result = `Call ${baseUrl}/${version}/users`;
      expect(result).toBe("Call https://example.com/v1/users");
    });

    it("should handle config references independently", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "service.host") return "api.example.com";
        if (path === "service.port") return "8080";
        return undefined;
      });

      // In the new implementation, each reference is processed independently
      const host = resolveConfigReference("config:service.host");
      const port = resolveConfigReference("config:service.port");

      expect(host).toBe("api.example.com");
      expect(port).toBe("8080");

      // Manually combine the results
      const result = `http://${host}:${port}`;
      expect(result).toBe("http://api.example.com:8080");
    });

    it("should throw error when config value is not found", () => {
      mockGetValue.mockReturnValue(undefined);

      expect(() => resolveConfigReference("config:missing.value")).toThrow(
        "Configuration value not found: missing.value",
      );
    });

    it("should handle different value types", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "number") return 42;
        if (path === "boolean") return true;
        if (path === "object") return { key: "value" };
        return undefined;
      });

      expect(resolveConfigReference("config:number")).toBe("42");
      expect(resolveConfigReference("config:boolean")).toBe("true");
      expect(resolveConfigReference("config:object")).toBe("[object Object]");
    });
  });

  describe("resolveStepParameter", () => {
    it("should resolve parameter with config reference", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.endpoint") return "/users";
        return undefined;
      });

      const result = resolveStepParameter("config:api.endpoint");
      expect(result).toBe("/users");
    });

    it("should return original parameter when no config reference", () => {
      const result = resolveStepParameter("no config reference");
      expect(result).toBe("no config reference");
      expect(mockGetValue).not.toHaveBeenCalled();
    });

    it("should handle only complete references", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.version") return "v2";
        return undefined;
      });

      // In the new implementation, only complete references are processed
      const version = resolveStepParameter("config:api.version");
      expect(version).toBe("v2");

      // Mixed content is returned as-is
      const mixedResult = resolveStepParameter("Using API version config:api.version");
      expect(mixedResult).toBe("Using API version config:api.version");
    });

    it("should use root key when provided", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.baseUrl") return "https://example.com";
        return undefined;
      });

      const result = resolveStepParameter("config:baseUrl", { rootKey: "api" });
      expect(result).toBe("https://example.com");
    });

    it("should resolve property references", () => {
      const mockGetProperty = vi.fn().mockImplementation((path) => {
        if (path === "userId") return "12345";
        return undefined;
      });

      const mockHasProperty = vi.fn().mockImplementation((path) => {
        return path === "userId";
      });

      const result = resolveStepParameter("prop:userId", {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      });

      expect(result).toBe("12345");
      expect(mockGetProperty).toHaveBeenCalledWith("userId");
      expect(mockHasProperty).toHaveBeenCalledWith("userId");
    });

    it("should process config and property references separately", () => {
      mockGetValue.mockImplementation((path) => {
        if (path === "api.endpoint") return "/users";
        return undefined;
      });

      const mockGetProperty = vi.fn().mockImplementation((path) => {
        if (path === "userId") return "12345";
        return undefined;
      });

      const mockHasProperty = vi.fn().mockImplementation((path) => {
        return path === "userId";
      });

      // With the new implementation, we need to process each reference separately
      const options = {
        getPropertyFn: mockGetProperty,
        hasPropertyFn: mockHasProperty,
      };

      // Process the config reference
      const endpoint = resolveStepParameter("config:api.endpoint", options);

      // Process the property reference
      const userId = resolveStepParameter("prop:userId", options);

      // Manually combine the results
      const result = `${endpoint}/${userId}`;

      expect(result).toBe("/users/12345");
    });

    it("should throw error for missing property", () => {
      const mockGetProperty = vi.fn();
      const mockHasProperty = vi.fn().mockReturnValue(false);

      expect(() =>
        resolveStepParameter("prop:nonExistentProperty", {
          getPropertyFn: mockGetProperty,
          hasPropertyFn: mockHasProperty,
        }),
      ).toThrow("Property not found: nonExistentProperty");
    });

    it("should throw error for missing config value", () => {
      mockGetValue.mockReturnValue(undefined);

      expect(() => resolveStepParameter("config:nonExistentConfig")).toThrow(
        "Configuration value not found: nonExistentConfig",
      );
    });
  });
});
