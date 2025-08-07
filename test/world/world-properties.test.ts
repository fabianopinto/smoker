/**
 * Tests for WorldProperties class
 *
 * These tests verify the functionality of the WorldProperties class which
 * provides property storage and resolution mechanisms for the smoke testing framework.
 *
 * Test Coverage:
 * - Constructor and initialization
 * - Property storage operations (set, get, has, delete, clear, keys)
 * - Property reference validation
 * - Property reference resolution with default values
 * - Edge cases and error handling
 */

import { beforeEach, describe, expect, it } from "vitest";
import { WorldProperties, createWorldProperties } from "../../src/world/world-properties";

describe("WorldProperties", () => {
  // Test fixtures
  const TEST_FIXTURES = {
    PROPERTY_KEY: "testKey",
    PROPERTY_VALUE: "testValue",
    PROPERTY_VALUE_NUMBER: 123,
    PROPERTY_VALUE_BOOLEAN: true,
    PROPERTY_VALUE_OBJECT: { test: "value" },
    INVALID_KEY_SPECIAL_CHAR: "test-key",
    PROPERTY_REFERENCE: "property:testKey",
    PROPERTY_REFERENCE_WITH_DEFAULT: "property:testKey:defaultValue",
    PROPERTY_REFERENCE_MISSING: "property:missingKey",
    PROPERTY_REFERENCE_MISSING_WITH_DEFAULT: "property:missingKey:defaultValue",
    INVALID_REFERENCE_FORMAT: "property:invalid-key",
  };

  describe("constructor", () => {
    it("should create a new instance", () => {
      const properties = new WorldProperties();
      expect(properties).toBeInstanceOf(WorldProperties);
    });

    it("should create a new instance using factory function", () => {
      const properties = createWorldProperties();
      expect(properties).toBeInstanceOf(WorldProperties);
    });
  });

  describe("property storage", () => {
    let properties: WorldProperties;

    beforeEach(() => {
      properties = createWorldProperties();
    });

    describe("set", () => {
      it("should set a property value", () => {
        properties.set(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
        expect(properties.get(TEST_FIXTURES.PROPERTY_KEY)).toBe(TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should overwrite existing property", () => {
        properties.set(TEST_FIXTURES.PROPERTY_KEY, "initial value");
        properties.set(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
        expect(properties.get(TEST_FIXTURES.PROPERTY_KEY)).toBe(TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should store different types of values", () => {
        properties.set("stringProp", TEST_FIXTURES.PROPERTY_VALUE);
        properties.set("numberProp", TEST_FIXTURES.PROPERTY_VALUE_NUMBER);
        properties.set("booleanProp", TEST_FIXTURES.PROPERTY_VALUE_BOOLEAN);
        properties.set("objectProp", TEST_FIXTURES.PROPERTY_VALUE_OBJECT);

        expect(properties.get("stringProp")).toBe(TEST_FIXTURES.PROPERTY_VALUE);
        expect(properties.get("numberProp")).toBe(TEST_FIXTURES.PROPERTY_VALUE_NUMBER);
        expect(properties.get("booleanProp")).toBe(TEST_FIXTURES.PROPERTY_VALUE_BOOLEAN);
        expect(properties.get("objectProp")).toEqual(TEST_FIXTURES.PROPERTY_VALUE_OBJECT);
      });

      it("should throw error for invalid key", () => {
        expect(() => {
          properties.set(TEST_FIXTURES.INVALID_KEY_SPECIAL_CHAR, TEST_FIXTURES.PROPERTY_VALUE);
        }).toThrow(/Invalid property key/);
      });

      it("should throw error for empty key", () => {
        expect(() => {
          properties.set("", TEST_FIXTURES.PROPERTY_VALUE);
        }).toThrow(/Property key must be a non-empty string/);
      });

      it("should throw error for non-string key", () => {
        expect(() => {
          // @ts-expect-error Testing runtime type check
          properties.set(123, TEST_FIXTURES.PROPERTY_VALUE);
        }).toThrow(/Property key must be a non-empty string/);
      });
    });

    describe("get", () => {
      beforeEach(() => {
        properties.set(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should get a property value", () => {
        expect(properties.get(TEST_FIXTURES.PROPERTY_KEY)).toBe(TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should return undefined for non-existent property", () => {
        expect(properties.get("nonExistentKey")).toBeUndefined();
      });

      it("should return default value for non-existent property", () => {
        const defaultValue = "default";
        expect(properties.get("nonExistentKey", defaultValue)).toBe(defaultValue);
      });

      it("should throw error for invalid key", () => {
        expect(() => {
          properties.get(TEST_FIXTURES.INVALID_KEY_SPECIAL_CHAR);
        }).toThrow(/Invalid property key/);
      });
    });

    describe("has", () => {
      beforeEach(() => {
        properties.set(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should return true for existing property", () => {
        expect(properties.has(TEST_FIXTURES.PROPERTY_KEY)).toBe(true);
      });

      it("should return false for non-existent property", () => {
        expect(properties.has("nonExistentKey")).toBe(false);
      });

      it("should throw error for invalid key", () => {
        expect(() => {
          properties.has(TEST_FIXTURES.INVALID_KEY_SPECIAL_CHAR);
        }).toThrow(/Invalid property key/);
      });
    });

    describe("delete", () => {
      beforeEach(() => {
        properties.set(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
      });

      it("should delete an existing property", () => {
        expect(properties.delete(TEST_FIXTURES.PROPERTY_KEY)).toBe(true);
        expect(properties.has(TEST_FIXTURES.PROPERTY_KEY)).toBe(false);
      });

      it("should return false when deleting non-existent property", () => {
        expect(properties.delete("nonExistentKey")).toBe(false);
      });

      it("should throw error for invalid key", () => {
        expect(() => {
          properties.delete(TEST_FIXTURES.INVALID_KEY_SPECIAL_CHAR);
        }).toThrow(/Invalid property key/);
      });
    });

    describe("clear", () => {
      beforeEach(() => {
        properties.set(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
        properties.set("anotherKey", "anotherValue");
      });

      it("should remove all properties", () => {
        properties.clear();
        expect(properties.has(TEST_FIXTURES.PROPERTY_KEY)).toBe(false);
        expect(properties.has("anotherKey")).toBe(false);
        expect(properties.keys()).toHaveLength(0);
      });
    });

    describe("keys", () => {
      beforeEach(() => {
        properties.clear();
        properties.set(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
        properties.set("anotherKey", "anotherValue");
      });

      it("should return array of property keys", () => {
        const keys = properties.keys();
        expect(keys).toHaveLength(2);
        expect(keys).toContain(TEST_FIXTURES.PROPERTY_KEY);
        expect(keys).toContain("anotherKey");
      });

      it("should return empty array when no properties", () => {
        properties.clear();
        expect(properties.keys()).toHaveLength(0);
      });
    });
  });

  describe("property reference handling", () => {
    let properties: WorldProperties;

    beforeEach(() => {
      properties = createWorldProperties();
      properties.set(TEST_FIXTURES.PROPERTY_KEY, TEST_FIXTURES.PROPERTY_VALUE);
    });

    describe("isPropertyReference", () => {
      it("should return true for valid property reference", () => {
        expect(properties.isPropertyReference(TEST_FIXTURES.PROPERTY_REFERENCE)).toBe(true);
      });

      it("should return true for property reference with default value", () => {
        expect(properties.isPropertyReference(TEST_FIXTURES.PROPERTY_REFERENCE_WITH_DEFAULT)).toBe(
          true,
        );
      });

      it("should return false for non-property reference string", () => {
        expect(properties.isPropertyReference("normalString")).toBe(false);
      });

      it("should return false for null or undefined", () => {
        expect(properties.isPropertyReference(null as unknown as string)).toBe(false);
        expect(properties.isPropertyReference(undefined as unknown as string)).toBe(false);
      });

      it("should return false for non-string values", () => {
        expect(properties.isPropertyReference(123 as unknown as string)).toBe(false);
        expect(properties.isPropertyReference({} as unknown as string)).toBe(false);
      });
    });

    describe("resolvePropertyValue", () => {
      it("should resolve property reference to its value", () => {
        expect(properties.resolvePropertyValue(TEST_FIXTURES.PROPERTY_REFERENCE)).toBe(
          TEST_FIXTURES.PROPERTY_VALUE,
        );
      });

      it("should return original string if not a property reference", () => {
        const normalString = "normalString";
        expect(properties.resolvePropertyValue(normalString)).toBe(normalString);
      });

      it("should return original string for null or undefined", () => {
        expect(properties.resolvePropertyValue(null as unknown as string)).toBe(null);
        expect(properties.resolvePropertyValue(undefined as unknown as string)).toBe(undefined);
      });

      it("should throw error if property key doesn't exist", () => {
        expect(() => {
          properties.resolvePropertyValue(TEST_FIXTURES.PROPERTY_REFERENCE_MISSING);
        }).toThrow(/Property not found/);
      });

      it("should throw error for invalid property reference format", () => {
        expect(() => {
          properties.resolvePropertyValue(TEST_FIXTURES.INVALID_REFERENCE_FORMAT);
        }).toThrow(/Invalid property reference format/);
      });

      it("should use default value when property doesn't exist", () => {
        expect(
          properties.resolvePropertyValue(TEST_FIXTURES.PROPERTY_REFERENCE_MISSING_WITH_DEFAULT),
        ).toBe("defaultValue");
      });

      it("should prefer property value over default value when property exists", () => {
        expect(properties.resolvePropertyValue(TEST_FIXTURES.PROPERTY_REFERENCE_WITH_DEFAULT)).toBe(
          TEST_FIXTURES.PROPERTY_VALUE,
        );
      });
    });
  });
});
