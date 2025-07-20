/**
 * Configuration Merging Module
 *
 * This module provides utilities for merging configuration objects in a deep, recursive manner.
 * It handles special cases like arrays, null values, and empty objects to ensure consistent
 * and predictable configuration merging behavior.
 *
 * The deep merge functionality is essential for combining configuration from multiple sources
 * while maintaining proper hierarchy and allowing overrides at any level of nesting.
 */

import type { ConfigValue } from "./configuration";

/**
 * Deep merge two objects recursively
 *
 * Combines properties from source into target with special handling for nested objects,
 * arrays, and null values. This function creates a new object rather than modifying the
 * target object directly, ensuring immutability.
 *
 * Special handling rules:
 * - Arrays are replaced completely (not merged element by element)
 * - Null values remove the property from the result
 * - Undefined values are skipped (property remains unchanged)
 * - Objects are merged recursively
 * - Primitive values overwrite existing values
 *
 * @param target - Target object to merge into
 * @param source - Source object to merge from
 * @return New object with merged properties
 *
 * @example
 * // Merge configuration objects
 * const base = { logging: { level: "info", format: "json" } };
 * const override = { logging: { level: "debug" } };
 * const result = deepMerge(base, override);
 * // Result: { logging: { level: "debug", format: "json" } }
 */
export function deepMerge(
  target: Record<string, ConfigValue>,
  source: Record<string, ConfigValue>,
): Record<string, ConfigValue> {
  const result: Record<string, ConfigValue> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    // Skip undefined values
    if (value === undefined) {
      continue;
    }

    // Handle null values by removing the property
    if (value === null) {
      // Simply delete the property - this is controlled by the configuration designer
      // and we're not using dynamic property names from external sources
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete result[key];
      continue;
    }

    // If property doesn't exist in target, just add it
    if (!(key in result)) {
      result[key] = value;
      continue;
    }

    const targetValue = result[key];

    // If both values are objects, merge them recursively
    if (
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue) &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, ConfigValue>,
        value as Record<string, ConfigValue>,
      );
    } else {
      // Otherwise, replace the value
      result[key] = value;
    }
  }

  return result;
}
