/**
 * World Properties Module
 *
 * This module provides a property management system for storing and resolving
 * properties within the test world. It implements a map of properties with methods
 * to check for and replace property references in strings.
 *
 * Properties can be used to store any type of data and can be referenced in test
 * steps using the pattern "property:propertyName". The system supports property
 * keys that match the regex pattern [a-zA-Z0-9_$]+.
 */

/**
 * Regular expression to validate property keys
 * Allows alphanumeric characters, underscore and dollar sign
 */
const PROPERTY_KEY_REGEX = /^[a-zA-Z0-9_$]+$/;

/**
 * Regular expression to extract property references from strings
 * Matches both simple "property:propertyName" and "property:propertyName:defaultValue" patterns
 */
const PROPERTY_REFERENCE_REGEX = /^property:([a-zA-Z0-9_$]+)(?::(.*))?$/;

/**
 * WorldProperties class
 *
 * Provides a system for managing properties in a test world. Properties are
 * key-value pairs where keys must match [a-zA-Z0-9_$]+ and values can be of any type.
 *
 * Properties can be referenced in strings using the pattern "property:propertyName".
 * This class provides methods to check for and replace such references.
 */
export class WorldProperties {
  /**
   * Internal property storage using Map for better dynamic key handling
   * @private
   */
  private properties = new Map<string, unknown>();

  /**
   * Set a property value
   *
   * @param key - The property key (must match [a-zA-Z0-9_$]+)
   * @param value - The value to store (can be any type)
   * @throws Error if the key is invalid
   */
  set(key: string, value: unknown): void {
    this.validateKey(key);
    this.properties.set(key, value);
  }

  /**
   * Get a property value
   *
   * @param key - The property key
   * @param defaultValue - Optional default value if property doesn't exist
   * @returns The property value or default value
   * @throws Error if the key is invalid
   */
  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    this.validateKey(key);
    return this.properties.has(key) ? (this.properties.get(key) as T) : defaultValue;
  }

  /**
   * Check if a property exists
   *
   * @param key - The property key
   * @returns True if the property exists, false otherwise
   * @throws Error if the key is invalid
   */
  has(key: string): boolean {
    this.validateKey(key);
    return this.properties.has(key);
  }

  /**
   * Remove a property
   *
   * @param key - The property key
   * @returns True if the property was removed, false if it didn't exist
   * @throws Error if the key is invalid
   */
  delete(key: string): boolean {
    this.validateKey(key);
    return this.properties.delete(key);
  }

  /**
   * Clear all properties
   */
  clear(): void {
    this.properties.clear();
  }

  /**
   * Get all property keys
   *
   * @returns Array of property keys
   */
  keys(): string[] {
    return Array.from(this.properties.keys());
  }

  /**
   * Check if a string is a property reference (e.g., "property:someProperty")
   *
   * @param input - The input string to check
   * @returns True if the string is a property reference, false otherwise
   */
  isPropertyReference(input: string): boolean {
    if (!input || typeof input !== "string") {
      return false;
    }
    return PROPERTY_REFERENCE_REGEX.test(input);
  }

  /**
   * Resolve a property reference string to its value
   *
   * Format options:
   * - "property:someProperty" - Returns the value of the property or throws if not found
   * - "property:someProperty:defaultValue" - Returns the property value if exists, or the default value
   * Otherwise, returns the original string if it's not a property reference.
   *
   * @param input - The input string that may be a property reference
   * @returns The resolved value or the original string
   * @throws Error if input starts with "property:" but is not a valid property reference
   * @throws Error if input is a property reference without a default value and the property doesn't exist
   */
  resolvePropertyValue(input: string): string {
    if (!input || typeof input !== "string") {
      return input;
    }

    // Check if the string starts with "property:" prefix
    if (!input.startsWith("property:")) {
      return input;
    }

    // Match the string against the property reference pattern
    const match = PROPERTY_REFERENCE_REGEX.exec(input);

    // If input starts with "property:" but doesn't match the pattern, it's invalid
    if (!match) {
      throw new Error(`Invalid property reference format: ${input}`);
    }

    // Extract property key (group 1) and optional default value (group 2)
    const propertyKey = match[1];
    const defaultValue = match[2];

    // If property exists, return its value
    if (this.has(propertyKey)) {
      return String(this.get(propertyKey));
    }

    // If property doesn't exist but default value is provided, return default value
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    // Property doesn't exist and no default provided
    throw new Error(`Property not found: ${propertyKey}`);
  }

  /**
   * Validate a property key
   *
   * @param key - The key to validate
   * @throws Error if the key is invalid
   * @private
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== "string") {
      throw new Error("Property key must be a non-empty string");
    }

    if (!PROPERTY_KEY_REGEX.test(key)) {
      throw new Error(
        `Invalid property key: ${key}. Property keys must match pattern [a-zA-Z0-9_$]+`,
      );
    }
  }
}

/**
 * Create a new instance of WorldProperties
 *
 * @returns A new WorldProperties instance
 */
export const createWorldProperties = (): WorldProperties => {
  return new WorldProperties();
};

export default WorldProperties;
