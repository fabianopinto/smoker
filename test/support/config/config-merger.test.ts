/**
 * Tests for the Config Merger Module
 *
 * This test suite verifies the deepMerge function and its special handling rules
 * for different data types when merging configuration objects.
 *
 * Test coverage includes:
 * - Primitive value overwriting
 * - Recursive object merging
 * - Array replacement behavior
 * - Null value property removal
 * - Undefined value skipping
 * - Immutability guarantees
 * - Complex nested scenarios and edge cases
 */

import { describe, expect, it } from "vitest";
import { deepMerge } from "../../../src/support/config/config-merger";
import type { ConfigValue } from "../../../src/support/config/configuration";

/**
 * Test fixtures for consistent testing across all test cases
 */
const TEST_FIXTURES = {
  // Simple merge test cases
  SIMPLE_TARGET: { a: 1, b: "test" },
  SIMPLE_SOURCE: { b: "updated", c: 3 },

  // Nested object merge test cases
  NESTED_TARGET: {
    database: { host: "localhost", port: 5432 },
    logging: { level: "info", format: "json" },
  },
  NESTED_SOURCE: {
    database: { port: 3306, ssl: true },
    cache: { enabled: true },
  },
  NESTED_EXPECTED: {
    database: { host: "localhost", port: 3306, ssl: true },
    logging: { level: "info", format: "json" },
    cache: { enabled: true },
  },

  // Array merge test cases
  ARRAYS_TARGET: { items: [1, 2, 3], tags: ["old"] },
  ARRAYS_SOURCE: { items: [4, 5], tags: ["new", "updated"] },
  ARRAYS_EXPECTED: { items: [4, 5], tags: ["new", "updated"] },

  // Null value handling test cases
  NULL_VALUES_TARGET: { keep: "value", remove: "old", nested: { keep: "nested", remove: "old" } },
  NULL_VALUES_SOURCE: { remove: null, nested: { remove: null, add: "new" } },
  NULL_VALUES_EXPECTED: { keep: "value", nested: { keep: "nested", add: "new" } },

  // Undefined value handling test cases
  UNDEFINED_VALUES_TARGET: { keep: "original", change: "old" },
  UNDEFINED_VALUES_SOURCE: {
    keep: undefined as unknown as ConfigValue,
    change: "new",
    add: "added",
  },
  UNDEFINED_VALUES_EXPECTED: { keep: "original", change: "new", add: "added" },
};

/**
 * Creates a deep copy of an object for testing immutability
 *
 * @template T - Type of the object to copy
 * @param obj - Object to copy
 * @returns Deep copy of the input object
 */
function createDeepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Creates test configuration with various data types
 *
 * @returns Configuration object with different data types
 */
function createComplexConfig(): Record<string, ConfigValue> {
  return {
    string: "test",
    number: 42,
    boolean: true,
    array: [1, 2, 3],
    object: { nested: "value" },
    nullValue: null,
    undefinedValue: undefined as unknown as ConfigValue, // Explicit type assertion for testing
  };
}

/**
 * Creates nested configuration for deep merging tests
 *
 * @returns Deeply nested configuration object
 */
function createNestedConfig(): Record<string, ConfigValue> {
  return {
    level1: { level2: { level3: { value: "deep", array: ["nested"] } }, sibling: "value" },
    root: "value",
  };
}

/**
 * Tests for deepMerge
 */
describe("deepMerge", () => {
  /**
   * Tests for primitive value handling
   * Primitive values (string, number, boolean) are overwritten with source values
   */
  describe("Primitive Value Overwriting", () => {
    it("should overwrite string values from source to target", () => {
      const target = { name: "original" };
      const source = { name: "updated" };

      const result = deepMerge(target, source);

      // String value should be overwritten with source value
      expect(result).toEqual({ name: "updated" });
      // Result should be a new object instance
      expect(result).not.toBe(target);
    });

    it("should overwrite number values from source to target", () => {
      const target = { count: 10 };
      const source = { count: 20 };

      const result = deepMerge(target, source);

      expect(result).toEqual({ count: 20 });
    });

    it("should overwrite boolean values from source to target", () => {
      const target = { enabled: false };
      const source = { enabled: true };

      const result = deepMerge(target, source);

      expect(result).toEqual({ enabled: true });
    });

    it("should handle mixed primitive types", () => {
      const target = { value: "string" };
      const source = { value: 42 };

      const result = deepMerge(target, source);

      expect(result).toEqual({ value: 42 });
    });
  });

  /**
   * Tests for recursive object merging behavior
   * Merges objects recursively without modifying the target object
   */
  describe("Recursive Object Merging", () => {
    it("should merge simple nested objects", () => {
      const target = TEST_FIXTURES.NESTED_TARGET;
      const source = TEST_FIXTURES.NESTED_SOURCE;

      const result = deepMerge(target, source);

      expect(result).toEqual(TEST_FIXTURES.NESTED_EXPECTED);
    });

    it("should merge deeply nested objects", () => {
      const target = createNestedConfig();
      const source = { level1: { level2: { level3: { newValue: "added" }, newSibling: "added" } } };

      const result = deepMerge(target, source);

      expect(result.level1).toMatchObject({
        level2: {
          level3: { value: "deep", array: ["nested"], newValue: "added" },
          newSibling: "added",
        },
        sibling: "value", // sibling is at level1, not inside level2
      });
    });

    it("should add new properties to nested objects", () => {
      const target = { config: { existing: "value" } };
      const source = { config: { new: "property" } };

      const result = deepMerge(target, source);

      expect(result).toEqual({ config: { existing: "value", new: "property" } });
    });

    it("should handle empty objects", () => {
      const target = { config: {} };
      const source = { config: { added: "value" } };

      const result = deepMerge(target, source);

      expect(result).toEqual({ config: { added: "value" } });
    });
  });

  /**
   * Tests for array replacement behavior
   */
  describe("Array Replacement", () => {
    it("should replace arrays completely", () => {
      const target = TEST_FIXTURES.ARRAYS_TARGET;
      const source = TEST_FIXTURES.ARRAYS_SOURCE;

      const result = deepMerge(target, source);

      expect(result).toEqual(TEST_FIXTURES.ARRAYS_EXPECTED);
    });

    it("should replace array with different length", () => {
      const target = { items: [1, 2, 3, 4, 5] };
      const source = { items: ["a"] };

      const result = deepMerge(target, source);

      expect(result).toEqual({ items: ["a"] });
    });

    it("should replace empty array with populated array", () => {
      const target = { items: [] };
      const source = { items: [1, 2, 3] };

      const result = deepMerge(target, source);

      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it("should replace array with empty array", () => {
      const target = { items: [1, 2, 3] };
      const source = { items: [] };

      const result = deepMerge(target, source);

      expect(result).toEqual({ items: [] });
    });
  });

  /**
   * Null value property removal
   */
  describe("Null Value Property Removal", () => {
    it("should remove properties with null values", () => {
      const target = TEST_FIXTURES.NULL_VALUES_TARGET;
      const source = TEST_FIXTURES.NULL_VALUES_SOURCE;

      const result = deepMerge(target, source);

      expect(result).toEqual(TEST_FIXTURES.NULL_VALUES_EXPECTED);
      expect(result).not.toHaveProperty("remove");
    });

    it("should remove nested properties with null values", () => {
      const target = { config: { keep: "value", remove: "old" }, other: "value" };
      const source = { config: { remove: null, add: "new" } };

      const result = deepMerge(target, source);

      expect(result.config).toEqual({ keep: "value", add: "new" });
      expect(result.config).not.toHaveProperty("remove");
    });

    it("should handle null values in root properties", () => {
      const target = { keep: "value", remove: "old" };
      const source = { remove: null };

      const result = deepMerge(target, source);

      expect(result).toEqual({ keep: "value" });
      expect(result).not.toHaveProperty("remove");
    });
  });

  /**
   * Undefined value skipping
   * Skips properties with undefined values and preserves original values when source has undefined.
   */
  describe("Undefined Value Skipping", () => {
    it("should skip properties with undefined values", () => {
      const target = TEST_FIXTURES.UNDEFINED_VALUES_TARGET;
      const source = TEST_FIXTURES.UNDEFINED_VALUES_SOURCE;

      const result = deepMerge(target, source);

      expect(result).toEqual(TEST_FIXTURES.UNDEFINED_VALUES_EXPECTED);
    });

    it("should preserve original values when source has undefined", () => {
      const target = { preserve: "original", change: "old" };
      const source = { preserve: undefined as unknown as ConfigValue, change: "new" };

      const result = deepMerge(target, source);

      expect(result).toEqual({ preserve: "original", change: "new" });
    });

    it("should handle undefined in nested objects", () => {
      const target = { config: { preserve: "value", change: "old" } };
      const source = { config: { preserve: undefined as unknown as ConfigValue, change: "new" } };

      const result = deepMerge(target, source);

      expect(result).toEqual({ config: { preserve: "value", change: "new" } });
    });
  });

  /**
   * Immutability guarantees
   * Creates a new object rather than modifying the target object directly, ensuring immutability.
   */
  describe("Immutability Guarantees", () => {
    it("should not modify the target object", () => {
      const target = createDeepCopy(TEST_FIXTURES.SIMPLE_TARGET);
      const originalTarget = createDeepCopy(target);
      const source = TEST_FIXTURES.SIMPLE_SOURCE;

      const result = deepMerge(target, source);

      expect(target).toEqual(originalTarget);
      expect(result).not.toBe(target);
    });

    it("should not modify the source object", () => {
      const target = TEST_FIXTURES.SIMPLE_TARGET;
      const source = createDeepCopy(TEST_FIXTURES.SIMPLE_SOURCE);
      const originalSource = createDeepCopy(source);

      const result = deepMerge(target, source);

      expect(source).toEqual(originalSource);
      expect(result).not.toBe(source);
    });

    it("should create new nested objects", () => {
      const target = { config: { value: "original" } };
      const source = { config: { value: "updated" } };

      const result = deepMerge(target, source);

      expect(result.config).not.toBe(source.config);
    });

    it("should preserve array references when not replaced", () => {
      const target = { items: TEST_FIXTURES.ARRAYS_TARGET, other: "value" };
      const source = { other: "updated" };

      const result = deepMerge(target, source);
      expect(result.items).toBe(TEST_FIXTURES.ARRAYS_TARGET); // Same reference since not replaced
      expect(result.other).toBe("updated");
    });

    /**
     * Edge cases and complex scenarios
     */
    describe("Edge Cases and Complex Scenarios", () => {
      it("should handle empty target object", () => {
        const target = {};
        const source = { added: "value", nested: { deep: "value" } };

        const result = deepMerge(target, source);

        expect(result).toEqual(source);
      });

      it("should handle empty source object", () => {
        const target = { existing: "value", nested: { deep: "value" } };
        const source = {};

        const result = deepMerge(target, source);

        expect(result).toEqual(target);
        expect(result).not.toBe(target);
      });

      const target = {};
      const source = {};
      const result = deepMerge(target, source);

      expect(result).toEqual({});
      expect(result).not.toBe(target);
    });

    it("should handle complex mixed data types", () => {
      const target = createComplexConfig();
      const source = {
        string: 42, // Type change
        number: "string", // Type change
        boolean: null, // Remove property
        array: { converted: "to object" }, // Type change
        object: ["converted", "to", "array"], // Type change
        newProperty: "added",
      };

      const result = deepMerge(target, source);

      expect(result).toEqual({
        string: 42,
        number: "string",
        array: { converted: "to object" },
        object: ["converted", "to", "array"],
        nullValue: null,
        undefinedValue: undefined,
        newProperty: "added",
      });
      expect(result).not.toHaveProperty("boolean");
    });

    it("should handle deep nesting with mixed operations", () => {
      const target = {
        level1: { keep: "value", remove: "old", modify: { nested: "original" }, array: [1, 2, 3] },
      };
      const source = {
        level1: {
          remove: null,
          modify: { nested: "updated", added: "new" },
          array: ["replaced"],
          newProperty: "added",
        },
        newRoot: "property",
      };

      const result = deepMerge(target, source);

      expect(result).toEqual({
        level1: {
          keep: "value",
          modify: { nested: "updated", added: "new" },
          array: ["replaced"],
          newProperty: "added",
        },
        newRoot: "property",
      });
      expect(result.level1).not.toHaveProperty("remove");
    });

    it("should handle object to primitive conversion", () => {
      const target = { config: { nested: "object" } };
      const source = { config: "primitive" };

      const result = deepMerge(target, source);

      expect(result).toEqual({ config: "primitive" });
    });

    it("should handle primitive to object conversion", () => {
      const target = { config: "primitive" };
      const source = { config: { nested: "object" } };

      const result = deepMerge(target, source);

      expect(result).toEqual({ config: { nested: "object" } });
    });
  });

  /**
   * Integration scenarios
   * Tests for integration scenarios, including merging configuration from multiple sources.
   */
  describe("Integration Scenarios", () => {
    it("should merge configuration from multiple sources", () => {
      // Simulate merging default, environment, and user configs
      const defaultConfig = {
        database: { host: "localhost", port: 5432, ssl: false },
        logging: { level: "info", format: "text" },
        cache: { enabled: false },
      };

      const envConfig = { database: { host: "prod-db", ssl: true }, logging: { level: "warn" } };

      const userConfig = { logging: { format: "json" }, cache: { enabled: true, ttl: 3600 } };

      // Chain multiple merges
      const step1 = deepMerge(defaultConfig, envConfig);
      const finalResult = deepMerge(step1, userConfig);

      expect(finalResult).toEqual({
        database: { host: "prod-db", port: 5432, ssl: true },
        logging: { level: "warn", format: "json" },
        cache: { enabled: true, ttl: 3600 },
      });
    });

    it("should handle configuration override patterns", () => {
      // Simulate feature flag overrides
      const baseConfig = {
        features: {
          newUI: false,
          analytics: true,
          beta: { enabled: false, features: ["feature1"] },
        },
        settings: { theme: "light", notifications: true },
      };

      const overrides = {
        features: {
          newUI: true,
          beta: { enabled: true }, // Partial override
          experimental: null, // Remove if exists
        },
        settings: { theme: "dark" },
      };

      const result = deepMerge(baseConfig, overrides);

      expect(result).toEqual({
        features: { newUI: true, analytics: true, beta: { enabled: true, features: ["feature1"] } },
        settings: { theme: "dark", notifications: true },
      });
    });
  });
});
