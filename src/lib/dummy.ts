/**
 * A simple smoke module to demonstrate TypeScript functionality
 * Uses configuration for customizable phrase templates
 */
import { getConfig } from "../support/config";

/**
 * Generates a smoke phrase message
 * @param target - The target to address
 * @returns A smoke phrase message
 */
export function dummy(target: string): string {
  const config = getConfig();
  return config.phraseTemplate
    .replace("{phrase}", config.defaultPhrase)
    .replace("{target}", target);
}
