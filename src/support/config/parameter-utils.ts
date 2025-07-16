/**
 * Utility functions for parameter resolution
 *
 * These functions are used to resolve configuration and property references in step parameters.
 * They are separated from the step definitions to allow for easier testing.
 */
import type { PropertyPath, SmokeWorld } from "../../world";
import { Configuration } from "./configuration";

/**
 * Check if a string is a configuration reference
 *
 * @param input The input string to check if it's a configuration reference
 * @returns True if the string is a configuration reference (starts with "config:"), false otherwise
 *
 * @example
 * const isConfig = isConfigReference("config:api.baseUrl");
 * // isConfig = true
 *
 * const notConfig = isConfigReference("just a regular string");
 * // notConfig = false
 */
export function isConfigReference(input: string): boolean {
  return /^config:([a-zA-Z0-9.]+)$/.test(input);
}

/**
 * Check if a string is a property reference
 *
 * @param input The input string to check if it's a property reference
 * @returns True if the string is a property reference (starts with "prop:"), false otherwise
 *
 * @example
 * const isProp = isPropReference("prop:userId");
 * // isProp = true
 *
 * const notProp = isPropReference("just a regular string");
 * // notProp = false
 */
export function isPropReference(input: string): boolean {
  return /^prop:([a-zA-Z0-9_]+)$/.test(input);
}

/**
 * Resolve a configuration reference
 *
 * @param input The configuration reference string (must start with "config:")
 * @param rootKey Optional root key to use as prefix for configuration paths
 * @returns The resolved configuration value as a string
 * @throws Error if the referenced configuration value is not found or if input is not a valid config reference
 *
 * @example
 * // If config has { "api": { "baseUrl": "https://example.com" } }
 * const resolved = resolveConfigReference("config:api.baseUrl");
 * // resolved = "https://example.com"
 */
export function resolveConfigReference(input: string, rootKey?: string): string {
  // Verify that input is a valid config reference
  if (!isConfigReference(input)) {
    throw new Error(`Not a valid configuration reference: ${input}`);
  }

  // Extract the path from the reference
  const path = input.substring(7); // Remove "config:" prefix

  // If a root key is provided, use it as prefix
  let fullPath = path;
  if (rootKey) {
    fullPath = `${rootKey}.${path}`;
  }

  const config = Configuration.getInstance();
  const value = config.getValue(fullPath);

  if (value === undefined) {
    // Try without the root key as fallback
    if (fullPath !== path) {
      const fallbackValue = config.getValue(path);
      if (fallbackValue !== undefined) {
        return String(fallbackValue);
      }
    }
    throw new Error(`Configuration value not found: ${fullPath}`);
  }

  return String(value);
}

/**
 * Resolve a property reference
 *
 * @param input The property reference string (must start with "prop:")
 * @param getPropertyFn Function to get a property value by path
 * @param hasPropertyFn Function to check if a property exists by path
 * @returns The resolved property value as a string
 * @throws Error if the referenced property value is not found or if input is not a valid property reference
 *
 * @example
 * // If properties has { "userId": "12345" }
 * const resolved = resolvePropReference("prop:userId",
 *   path => properties[path],
 *   path => path in properties
 * );
 * // resolved = "12345"
 */
export function resolvePropReference(
  input: string,
  getPropertyFn: (path: PropertyPath) => unknown,
  hasPropertyFn: (path: PropertyPath) => boolean,
): string {
  // Verify that input is a valid property reference
  if (!isPropReference(input)) {
    throw new Error(`Not a valid property reference: ${input}`);
  }

  // Extract the path from the reference
  const path = input.substring(5); // Remove "prop:" prefix

  if (!hasPropertyFn(path)) {
    throw new Error(`Property not found: ${path}`);
  }

  const value = getPropertyFn(path);
  return String(value);
}

/**
 * Resolve a step parameter that may be a configuration or property reference
 *
 * @param param The parameter string that may be a configuration or property reference
 * @param options Options for resolving references
 * @returns The resolved parameter value, or the original parameter if it's not a reference
 * @throws Error if the referenced value is not found
 *
 * @example
 * // Resolve with world object
 * const resolved = resolveStepParameter("config:api.baseUrl", {
 *   world,
 * });
 *
 * // Resolve with explicit functions
 * const resolved = resolveStepParameter("prop:userId", {
 *   rootKey: "api",
 *   getPropertyFn: path => properties[path],
 *   hasPropertyFn: path => path in properties,
 * });
 */

export function resolveStepParameter(
  param: string,
  options?: {
    rootKey?: string;
    getPropertyFn?: (path: PropertyPath) => unknown;
    hasPropertyFn?: (path: PropertyPath) => boolean;
    world?: SmokeWorld;
  },
): string {
  // If param is empty or not a string, return as is
  if (!param) {
    return param;
  }

  // Extract options
  const rootKey =
    options?.rootKey ||
    (options?.world &&
    typeof options.world.hasProperty === "function" &&
    options.world.hasProperty("config.rootKey") &&
    typeof options.world.getProperty === "function"
      ? (options.world.getProperty("config.rootKey") as string)
      : undefined);

  const getPropertyFn =
    options?.getPropertyFn ||
    (options?.world && typeof options.world.getProperty === "function"
      ? (path: PropertyPath) => {
          // We know world exists and has getProperty function because of the condition above
          const world = options.world as SmokeWorld;
          return world.getProperty(path);
        }
      : undefined);

  const hasPropertyFn =
    options?.hasPropertyFn ||
    (options?.world && typeof options.world.hasProperty === "function"
      ? (path: PropertyPath) => {
          // We know world exists and has hasProperty function because of the condition above
          const world = options.world as SmokeWorld;
          return world.hasProperty(path);
        }
      : undefined);

  // Check if param is a configuration reference
  if (isConfigReference(param)) {
    return resolveConfigReference(param, rootKey);
  }

  // Check if param is a property reference
  if (isPropReference(param) && getPropertyFn && hasPropertyFn) {
    return resolvePropReference(param, getPropertyFn, hasPropertyFn);
  }

  // If not a reference, return the original parameter
  return param;
}
