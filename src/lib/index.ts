/**
 * Library Module Index
 *
 * This module serves as the barrel file for the library components,
 * re-exporting interfaces and implementations for easier imports.
 * It provides a single entry point for importing library functionality.
 */

export { BaseLogger, type Logger, type LoggerOptions } from "./logger";

/**
 * Default logger instance for application-wide use
 */
import { BaseLogger } from "./logger";
export const logger = new BaseLogger();
