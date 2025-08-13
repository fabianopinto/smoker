/**
 * Tests for the Logger module
 *
 * This test suite verifies the functionality of the Logger module, including:
 * - Logger initialization with different configurations
 * - Log level management
 * - Structured logging with context
 * - Child logger creation and context inheritance
 * - Error serialization
 * - Environment-based configuration (pretty printing in dev vs prod)
 *
 * Test coverage includes:
 * - BaseLogger class functionality
 * - Default logger instance
 * - All log levels (trace, debug, info, warn, error, fatal)
 * - Edge cases and error conditions
 */

import { pino } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseLogger, logger } from "../../src/lib/logger";

// Mock pino to avoid actual logging during tests
vi.mock("pino", () => {
  type LogLevelUnion = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  // factory to create a fresh mocked logger instance per pino() call
  const createLogger = () => {
    const loggerObj: {
      trace: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      fatal: ReturnType<typeof vi.fn>;
      child: ReturnType<typeof vi.fn> & (() => typeof loggerObj);
      isLevelEnabled: ReturnType<typeof vi.fn> & ((level: LogLevelUnion) => boolean);
      level: LogLevelUnion;
    } = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn((obj: unknown) => {
        if (obj && typeof obj === "object" && "err" in (obj as Record<string, unknown>)) {
          pinoMock.stdSerializers.err((obj as { err: unknown }).err);
        }
      }),
      fatal: vi.fn((obj: unknown) => {
        if (obj && typeof obj === "object" && "err" in (obj as Record<string, unknown>)) {
          pinoMock.stdSerializers.err((obj as { err: unknown }).err);
        }
      }),
      child: vi.fn(),
      isLevelEnabled: vi.fn((level: LogLevelUnion) => {
        const order: LogLevelUnion[] = [
          "trace",
          "debug",
          "info",
          "warn",
          "error",
          "fatal",
          "silent",
        ];
        const currentIdx = order.indexOf(loggerObj.level ?? "info");
        const queryIdx = order.indexOf(level);
        if (currentIdx === -1 || queryIdx === -1) return true;
        return queryIdx >= currentIdx && loggerObj.level !== "silent";
      }),
      level: "info",
    };
    // child returns same logger object to keep chaining simple
    (loggerObj.child as unknown as (b?: unknown) => typeof loggerObj) = vi.fn(() => loggerObj);
    return loggerObj;
  };

  // pino should be a callable mock function and also expose stdSerializers
  const pinoMock = vi.fn((opts?: { level?: LogLevelUnion }) => {
    const instance = createLogger();
    if (opts && typeof opts.level === "string") {
      instance.level = opts.level;
    }
    return instance;
  }) as unknown as typeof pino & {
    stdSerializers: { err: (e: unknown) => unknown };
  };
  (pinoMock as unknown as { stdSerializers: unknown }).stdSerializers = {
    err: vi.fn((e: unknown) => ({
      type: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    })),
  };

  return { pino: pinoMock };
});

// Test fixtures
const TEST_FIXTURES = {
  // Logger configurations
  DEFAULT_OPTIONS: {
    level: "info",
    name: "test-logger",
    pretty: false,
    base: { pid: 12345 },
  },
  CUSTOM_OPTIONS: {
    level: "debug",
    name: "custom-logger",
    pretty: true,
    base: { env: "test" },
  },

  // Test messages
  MESSAGES: {
    SIMPLE: "Test message",
    WITH_CONTEXT: { key: "value" },
    WITH_ERROR: new Error("Test error"),
    WITH_METADATA: { data: { id: 1 }, details: "Additional info" },
  },

  // Error messages
  ERRORS: {
    INVALID_LEVEL: "Invalid log level",
  },
};

describe("Logger", () => {
  type MockedPinoLogger = ReturnType<ReturnType<typeof vi.mocked<typeof pino>>> & {
    trace: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    fatal: ReturnType<typeof vi.fn>;
    child: ReturnType<typeof vi.fn>;
    isLevelEnabled: ReturnType<typeof vi.fn>;
    level: string;
  };

  let mockPinoLogger: MockedPinoLogger;
  let testLogger: BaseLogger;

  beforeEach(() => {
    testLogger = new BaseLogger(TEST_FIXTURES.DEFAULT_OPTIONS);
    const calls = (vi.mocked(pino, true) as unknown as { mock: { results: { value: unknown }[] } })
      .mock.results;
    mockPinoLogger = (calls.at(-1)?.value || {}) as MockedPinoLogger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default options when none provided", () => {
      new BaseLogger();
      expect(vi.mocked(pino, true)).toHaveBeenCalledWith(
        expect.objectContaining({
          level: expect.any(String),
          name: expect.any(String),
          base: expect.any(Object),
        }),
      );
    });

    it("should initialize with custom options when provided", () => {
      new BaseLogger(TEST_FIXTURES.CUSTOM_OPTIONS);
      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: TEST_FIXTURES.CUSTOM_OPTIONS.level,
          name: TEST_FIXTURES.CUSTOM_OPTIONS.name,
          base: TEST_FIXTURES.CUSTOM_OPTIONS.base,
        }),
      );
    });

    it("should create pretty print transport in development", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      new BaseLogger({ pretty: true });
      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: expect.objectContaining({
            target: "pino-pretty",
          }),
        }),
      );

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe("child", () => {
    it("should create a child logger with the provided bindings", () => {
      const bindings = { component: "test-component", requestId: "123" };
      const childLogger = testLogger.child(bindings);

      expect(mockPinoLogger.child).toHaveBeenCalledWith(bindings);
      expect(childLogger).toBeInstanceOf(BaseLogger);
    });

    it("should maintain the parent's log level in child logger", () => {
      testLogger.setLevel("debug");
      const childLogger = testLogger.child({});

      expect(childLogger.isLevelEnabled("debug")).toBe(true);
    });
  });

  describe("log levels", () => {
    type LevelName = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    type LevelMethod = (
      obj: Record<string, unknown> | string,
      msg?: string | unknown,
      ...args: unknown[]
    ) => void;
    const callLevel = (level: LevelName, ...args: Parameters<LevelMethod>) => {
      (testLogger as unknown as Record<LevelName, LevelMethod>)[level](...args);
    };

    // Test all log levels (parameterized)
    const LEVELS: LevelName[] = ["trace", "debug", "info", "warn", "error", "fatal"];

    it.each(LEVELS)("should log %s message", (level) => {
      const message = `Test ${level} message`;
      callLevel(level, message);
      // when only a message string is provided, BaseLogger forwards a single arg
      expect(mockPinoLogger[level]).toHaveBeenCalledWith(message);
    });

    it.each(LEVELS)("should log %s message with context", (level) => {
      const context = { key: "value", count: 42 };
      callLevel(level, context, "Message with context");
      expect(mockPinoLogger[level]).toHaveBeenCalledWith(context, "Message with context");
    });

    it("should not forward undefined msg when only string provided (short-circuit)", () => {
      testLogger.info("only message");
      expect(mockPinoLogger.info).toHaveBeenCalledWith("only message");
    });

    it("should forward msg and args when provided for string input (trace)", () => {
      testLogger.trace("first", "second", "third");
      expect(mockPinoLogger.trace).toHaveBeenCalledWith("first", "second", "third");
    });

    it("should forward msg and args when provided for string input (debug)", () => {
      testLogger.debug("first", "second", "third");
      expect(mockPinoLogger.debug).toHaveBeenCalledWith("first", "second", "third");
    });

    it("should forward msg and args when provided for string input (warn)", () => {
      testLogger.warn("first", "second", "third");
      expect(mockPinoLogger.warn).toHaveBeenCalledWith("first", "second", "third");
    });

    it("should forward msg and args when provided for string input (error)", () => {
      testLogger.error("first", "second", "third");
      expect(mockPinoLogger.error).toHaveBeenCalledWith("first", "second", "third");
    });

    it("should forward msg and args when provided for string input (fatal)", () => {
      testLogger.fatal("first", "second", "third");
      expect(mockPinoLogger.fatal).toHaveBeenCalledWith("first", "second", "third");
    });
  });

  describe("isLevelEnabled", () => {
    it("should check if a log level is enabled", () => {
      testLogger.setLevel("warn");

      expect(testLogger.isLevelEnabled("error")).toBe(true);
      expect(testLogger.isLevelEnabled("debug")).toBe(false);
      expect(mockPinoLogger.isLevelEnabled).toHaveBeenCalledWith("error");
      expect(mockPinoLogger.isLevelEnabled).toHaveBeenCalledWith("debug");
    });
  });

  describe("setLevel", () => {
    it("should set the log level", () => {
      testLogger.setLevel("debug");
      expect(mockPinoLogger.level).toBe("debug");
    });

    it("should set any provided level string (no validation)", () => {
      testLogger.setLevel("invalid-level");
      expect(mockPinoLogger.level).toBe("invalid-level");
    });
  });

  describe("error serialization", () => {
    it("should serialize Error objects in log context", () => {
      const error = new Error("Test error");
      testLogger.error(error, "Error occurred");

      expect(pino.stdSerializers.err).toHaveBeenCalledWith(error);
      expect(mockPinoLogger.error).toHaveBeenCalledWith({ err: error }, "Error occurred");
    });
  });

  describe("fatal serialization", () => {
    it("should serialize Error objects in fatal log context", () => {
      const error = new Error("Fatal error");
      testLogger.fatal(error, "Fatal occurred");

      expect(pino.stdSerializers.err).toHaveBeenCalledWith(error);
      expect(mockPinoLogger.fatal).toHaveBeenCalledWith({ err: error }, "Fatal occurred");
    });
  });

  describe("default logger instance", () => {
    it("should export a default logger instance", () => {
      expect(logger).toBeInstanceOf(BaseLogger);
    });

    it("should use environment variables for default configuration", () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = "debug";

      // Create a new logger to pick up the environment variable
      new BaseLogger();
      const calls = (
        vi.mocked(pino, true) as unknown as { mock: { results: { value: unknown }[] } }
      ).mock.results;
      const instance = calls.at(-1)?.value as { level?: string } | undefined;
      expect(instance?.level).toBe("debug");

      process.env.LOG_LEVEL = originalLogLevel;
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages", () => {
      testLogger.info("");
      expect(mockPinoLogger.info).toHaveBeenCalledWith("");
    });

    it("should handle null/undefined context", () => {
      // @ts-expect-error intentional null to validate runtime behavior
      testLogger.info(null, "Message with null context");
      expect(mockPinoLogger.info).toHaveBeenCalledWith(null, "Message with null context");
    });

    it("should handle non-object context", () => {
      testLogger.info("not an object", "Message with non-object context");
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        "not an object",
        "Message with non-object context",
      );
    });
  });
});
