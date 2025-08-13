/**
 * Logger Module
 *
 * This module defines the interface and implementation for logging operations throughout the application.
 * It provides a consistent API for structured logging with different severity levels
 * and contextual information.
 *
 * Features:
 * - Standard log levels (trace, debug, info, warn, error, fatal)
 * - Structured logging with context objects
 * - Child logger creation for component-specific logging
 * - Runtime log level configuration
 * - High-performance structured JSON logging
 * - Environment-aware configuration (pretty printing in dev)
 * - Error serialization
 */

import { pino, type Logger as PinoLogger } from "pino";

/**
 * Logger interface for structured application logging
 *
 * Defines a consistent logging API that can be implemented using various
 * logging libraries. The current implementation uses Pino for high-performance
 * structured logging.
 */
export interface Logger {
  /**
   * Create a child logger with additional context
   *
   * Child loggers inherit settings from their parent but include
   * additional context information with each log message.
   *
   * @param bindings - Context properties to include with every log message
   * @return A new child logger instance with the provided context
   *
   * @example
   * // Create a component-specific child logger
   * const componentLogger = logger.child({ component: "auth" });
   * componentLogger.info("User authenticated"); // logs with component="auth"
   */
  child(bindings: Record<string, unknown>): Logger;

  /**
   * Check if a specific log level is enabled
   *
   * Useful for avoiding expensive operations when a particular
   * log level is not enabled.
   *
   * @param level - The log level to check
   * @return True if the level is enabled, false otherwise
   *
   * @example
   * if (logger.isLevelEnabled("debug")) {
   *   // Only perform expensive debug operations if debug logging is enabled
   *   const debugData = generateExpensiveDebugData();
   *   logger.debug({ data: debugData }, "Debug info");
   * }
   */
  isLevelEnabled(level: string): boolean;

  /**
   * Set the logger level
   *
   * Changes the minimum level at which logs will be output.
   *
   * @param level - The new minimum log level
   *
   * @example
   * // Set logger to only output warnings and above
   * logger.setLevel("warn");
   */
  setLevel(level: string): void;

  /**
   * Log a trace message
   *
   * For very detailed diagnostic information (more verbose than debug).
   *
   * @param obj - Optional context object to include with the message
   * @param msg - The log message
   * @param ...args - Optional format arguments (printf-style)
   *
   * @example
   * logger.trace({ requestId }, "Processing request");
   * logger.trace("Value is %d", value);
   */
  trace(obj: Record<string, unknown> | string, msg?: string | unknown, ...args: unknown[]): void;

  /**
   * Log a debug message
   *
   * For diagnostic information useful during development and troubleshooting.
   *
   * @param obj - Optional context object to include with the message
   * @param msg - The log message
   * @param ...args - Optional format arguments (printf-style)
   *
   * @example
   * logger.debug({ user: "john" }, "User session created");
   * logger.debug("Debug value: %j", complexObject);
   */
  debug(obj: Record<string, unknown> | string, msg?: string | unknown, ...args: unknown[]): void;

  /**
   * Log an info message
   *
   * For general information about application operation.
   *
   * @param obj - Optional context object to include with the message
   * @param msg - The log message
   * @param ...args - Optional format arguments (printf-style)
   *
   * @example
   * logger.info({ feature: "login" }, "Feature enabled");
   * logger.info("Application started on port %d", port);
   */
  info(obj: Record<string, unknown> | string, msg?: string | unknown, ...args: unknown[]): void;

  /**
   * Log a warning message
   *
   * For potentially problematic situations that don't cause errors.
   *
   * @param obj - Optional context object to include with the message
   * @param msg - The log message
   * @param ...args - Optional format arguments (printf-style)
   *
   * @example
   * logger.warn({ attemptCount: 3 }, "Retry limit approaching");
   * logger.warn("Resource usage at %d%%", usagePercent);
   */
  warn(obj: Record<string, unknown> | string, msg?: string | unknown, ...args: unknown[]): void;

  /**
   * Log an error message
   *
   * For error conditions that affect operation but don't stop the application.
   *
   * @param obj - Optional context object (including error) to include with the message
   * @param msg - The log message
   * @param ...args - Optional format arguments (printf-style)
   *
   * @example
   * try {
   *   // Some operation
   * } catch (error) {
   *   logger.error({ error }, "Operation failed");
   * }
   * logger.error("Failed to connect to %s", serviceUrl);
   */
  error(
    obj: Record<string, unknown> | string | Error,
    msg?: string | unknown,
    ...args: unknown[]
  ): void;

  /**
   * Log a fatal message
   *
   * For severe error conditions that will likely lead to application termination.
   *
   * @param obj - Optional context object (including error) to include with the message
   * @param msg - The log message
   * @param ...args - Optional format arguments (printf-style)
   *
   * @example
   * logger.fatal({ error }, "System failure, shutting down");
   * logger.fatal("Critical resource unavailable: %s", resourceName);
   */
  fatal(
    obj: Record<string, unknown> | string | Error,
    msg?: string | unknown,
    ...args: unknown[]
  ): void;
}

/**
 * Logger configuration options
 *
 * Defines options for configuring logger instances including
 * log level, name, and other Pino-specific settings.
 */
export interface LoggerOptions {
  /**
   * The minimum log level to output
   */
  level?: string;

  /**
   * Name for the logger instance (included in log output)
   */
  name?: string;

  /**
   * Whether to enable pretty printing (defaults to development environment)
   */
  pretty?: boolean;

  /**
   * Additional base context to include with all logs
   */
  base?: Record<string, unknown>;
}

/**
 * Default logger options
 */
const DEFAULT_OPTIONS: LoggerOptions = {
  // pretty default will be finalized at construction time based on NODE_ENV
  pretty: true,
};

/**
 * Creates Pino transport configuration based on options
 *
 * @param options - Logger configuration options
 * @returns Pino transport configuration
 */
function createTransport(options: LoggerOptions) {
  if (options.pretty) {
    return {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    };
  }
  return {};
}

/**
 * Base logger implementation using Pino
 *
 * Implements the Logger interface using Pino for high-performance
 * structured logging with support for different environments.
 *
 * @class BaseLogger
 * @implements {Logger}
 */
export class BaseLogger implements Logger {
  private logger: PinoLogger;

  /**
   * Create a new logger instance
   *
   * @param options - Configuration options for the logger
   */
  constructor(options?: LoggerOptions) {
    // Resolve options at construction time to pick up environment changes
    const level = options?.level ?? process.env.LOG_LEVEL ?? DEFAULT_OPTIONS.level ?? "info";
    const pretty = options?.pretty ?? process.env.NODE_ENV !== "production";
    const name = options?.name ?? DEFAULT_OPTIONS.name ?? "smoker";
    const base = options?.base ?? DEFAULT_OPTIONS.base ?? { pid: process.pid };

    const mergedOptions = {
      level,
      pretty,
      name,
      base,
    };

    const transport = createTransport(mergedOptions);

    this.logger = pino({
      level: mergedOptions.level,
      name: mergedOptions.name,
      base: mergedOptions.base,
      ...transport,
      serializers: {
        error: pino.stdSerializers.err,
      },
    });
  }

  /**
   * Create a child logger with additional context
   *
   * @param bindings - Context to include with every log from this child
   * @returns A new child logger instance
   */
  child(bindings: Record<string, unknown>): Logger {
    const childLogger = new BaseLogger();
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  /**
   * Check if a log level is enabled
   *
   * @param level - The log level to check
   * @returns True if the level is enabled, false otherwise
   */
  isLevelEnabled(level: string): boolean {
    return this.logger.isLevelEnabled(level);
  }

  /**
   * Set the minimum log level
   *
   * @param level - The new minimum log level
   */
  setLevel(level: string): void {
    this.logger.level = level;
  }

  /**
   * Log at trace level
   */
  trace(obj: Record<string, unknown> | string, msg?: string | unknown, ...args: unknown[]): void {
    if (typeof obj === "string") {
      this.logger.trace(obj, ...(msg !== undefined ? [msg, ...args] : []));
    } else {
      this.logger.trace(obj, msg as string, ...args);
    }
  }

  /**
   * Log at debug level
   */
  debug(obj: Record<string, unknown> | string, msg?: string | unknown, ...args: unknown[]): void {
    if (typeof obj === "string") {
      this.logger.debug(obj, ...(msg !== undefined ? [msg, ...args] : []));
    } else {
      this.logger.debug(obj, msg as string, ...args);
    }
  }

  /**
   * Log at info level
   */
  info(obj: Record<string, unknown> | string, msg?: string | unknown, ...args: unknown[]): void {
    if (typeof obj === "string") {
      this.logger.info(obj, ...(msg !== undefined ? [msg, ...args] : []));
    } else {
      this.logger.info(obj, msg as string, ...args);
    }
  }

  /**
   * Log at warn level
   */
  warn(obj: Record<string, unknown> | string, msg?: string | unknown, ...args: unknown[]): void {
    if (typeof obj === "string") {
      this.logger.warn(obj, ...(msg !== undefined ? [msg, ...args] : []));
    } else {
      this.logger.warn(obj, msg as string, ...args);
    }
  }

  /**
   * Log at error level
   */
  error(
    obj: Record<string, unknown> | string | Error,
    msg?: string | unknown,
    ...args: unknown[]
  ): void {
    if (obj instanceof Error) {
      this.logger.error({ err: obj }, msg as string, ...args);
    } else if (typeof obj === "string") {
      this.logger.error(obj, ...(msg !== undefined ? [msg, ...args] : []));
    } else {
      this.logger.error(obj, msg as string, ...args);
    }
  }

  /**
   * Log at fatal level
   */
  fatal(
    obj: Record<string, unknown> | string | Error,
    msg?: string | unknown,
    ...args: unknown[]
  ): void {
    if (obj instanceof Error) {
      this.logger.fatal({ err: obj }, msg as string, ...args);
    } else if (typeof obj === "string") {
      this.logger.fatal(obj, ...(msg !== undefined ? [msg, ...args] : []));
    } else {
      this.logger.fatal(obj, msg as string, ...args);
    }
  }
}

/**
 * Default logger instance for convenience
 */
export const logger = new BaseLogger();
