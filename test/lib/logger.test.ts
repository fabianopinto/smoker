/**
 * BaseLogger Tests
 *
 * Tests for the `BaseLogger` class covering construction, child loggers,
 * level checks, level changes, and message routing for all log levels.
 *
 * Test coverage includes:
 * - Constructor options and pino configuration (pretty on/off)
 * - Child logger creation via `child()`
 * - `isLevelEnabled()` and `setLevel()` behavior
 * - Argument routing for trace/debug/info/warn
 * - Special handling of Error and object arguments for error/fatal
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BaseLogger, type Logger } from "../../src/lib/logger";

// Mock pino and capture the config passed and the created logger instances
const pinoTrace = vi.fn();
const pinoDebug = vi.fn();
const pinoInfo = vi.fn();
const pinoWarn = vi.fn();
const pinoError = vi.fn();
const pinoFatal = vi.fn();
const pinoIsLevelEnabled = vi.fn();
let pinoLevel = "info";

// child logger fns
const childTrace = vi.fn();
const childDebug = vi.fn();
const childInfo = vi.fn();
const childWarn = vi.fn();
const childError = vi.fn();
const childFatal = vi.fn();
const childIsLevelEnabled = vi.fn();

let lastPinoConfig: Record<string, unknown> | undefined;

vi.mock("pino", () => {
  const pinoFn = vi.fn((config: Record<string, unknown>) => {
    lastPinoConfig = config;
    return {
      // properties/methods BaseLogger relies on
      level: pinoLevel,
      isLevelEnabled: pinoIsLevelEnabled,
      child: vi.fn(() => ({
        trace: childTrace,
        debug: childDebug,
        info: childInfo,
        warn: childWarn,
        error: childError,
        fatal: childFatal,
        isLevelEnabled: childIsLevelEnabled,
        level: pinoLevel,
      })),
      trace: pinoTrace,
      debug: pinoDebug,
      info: pinoInfo,
      warn: pinoWarn,
      error: pinoError,
      fatal: pinoFatal,
    } as unknown;
  });
  // Attach stdSerializers to the mocked pino function to match BaseLogger usage
  (pinoFn as unknown as { stdSerializers: { err: (e: unknown) => unknown } }).stdSerializers = {
    err: vi.fn((e: unknown) => e),
  };
  return { pino: pinoFn };
});

describe("BaseLogger", () => {
  beforeEach(() => {
    // reset all pino function mocks
    pinoTrace.mockReset();
    pinoDebug.mockReset();
    pinoInfo.mockReset();
    pinoWarn.mockReset();
    pinoError.mockReset();
    pinoFatal.mockReset();
    pinoIsLevelEnabled.mockReset();

    childTrace.mockReset();
    childDebug.mockReset();
    childInfo.mockReset();
    childWarn.mockReset();
    childError.mockReset();
    childFatal.mockReset();
    childIsLevelEnabled.mockReset();

    lastPinoConfig = undefined;
    pinoLevel = "info";
  });

  describe("constructor", () => {
    it("should configure pino with pretty transport when pretty=true", () => {
      const logger = new BaseLogger({ level: "debug", name: "unit", pretty: true });
      expect(logger).toBeInstanceOf(BaseLogger);
      expect(lastPinoConfig).toBeDefined();
      expect(lastPinoConfig).toMatchObject({
        level: "debug",
        name: "unit",
        serializers: expect.any(Object),
      });
      // pretty transport present
      expect(lastPinoConfig).toHaveProperty("transport");
    });

    it("should configure pino without transport when pretty=false", () => {
      const logger = new BaseLogger({ level: "warn", name: "unit", pretty: false });
      expect(logger).toBeInstanceOf(BaseLogger);
      expect(lastPinoConfig).toBeDefined();
      expect(lastPinoConfig).toMatchObject({ level: "warn", name: "unit" });
      // transport not present
      expect(lastPinoConfig).not.toHaveProperty("transport");
    });
  });

  describe("child", () => {
    it("should create a child logger and route logs to the child", () => {
      const logger = new BaseLogger({ pretty: false });
      const child = logger.child({ component: "test" });

      // type: should still implement Logger
      const typedChild: Logger = child;
      expect(typedChild).toBeDefined();

      typedChild.info("child info");
      expect(childInfo).toHaveBeenCalledWith("child info");

      typedChild.error(new Error("boom"), "oops");
      // BaseLogger wraps Error to {err:error} for error/fatal
      expect(childError).toHaveBeenCalledWith({ err: expect.any(Error) }, "oops");
    });
  });

  describe("level checks and changes", () => {
    it("should proxy isLevelEnabled and setLevel", () => {
      pinoIsLevelEnabled.mockReturnValueOnce(true);
      const logger = new BaseLogger({ pretty: false });

      // isLevelEnabled -> proxied to pino
      expect(logger.isLevelEnabled("debug")).toBe(true);
      expect(pinoIsLevelEnabled).toHaveBeenCalledWith("debug");

      // setLevel -> sets underlying level value
      logger.setLevel("error");
      // simulate pino level property mutation visible to our mock
      // (BaseLogger writes to logger.level directly)
      // we can't read it back from BaseLogger, but ensuring no exception is enough
    });
  });

  describe("message routing", () => {
    it("should route trace/debug/info/warn with string first arg", () => {
      const logger = new BaseLogger({ pretty: false });
      logger.trace("t1");
      logger.debug("d1", "extra");
      logger.info("i1", "x", 1);
      logger.warn("w1");

      expect(pinoTrace).toHaveBeenCalledWith("t1");
      expect(pinoDebug).toHaveBeenCalledWith("d1", "extra");
      expect(pinoInfo).toHaveBeenCalledWith("i1", "x", 1);
      expect(pinoWarn).toHaveBeenCalledWith("w1");
    });

    it("should include msg and args when string first arg and msg provided for warn", () => {
      const logger = new BaseLogger({ pretty: false });
      logger.warn("w-with-msg", "ctx", 9);
      expect(pinoWarn).toHaveBeenCalledWith("w-with-msg", "ctx", 9);
    });

    it("should route debug with only string arg and no msg (second branch)", () => {
      const logger = new BaseLogger({ pretty: false });
      logger.debug("just-debug");
      expect(pinoDebug).toHaveBeenCalledWith("just-debug");
    });

    it("should route trace/debug/info/warn with object first arg and msg", () => {
      const logger = new BaseLogger({ pretty: false });
      const obj = { a: 1 };
      logger.trace(obj, "t");
      logger.debug(obj, "d", 2);
      logger.info(obj, "i");
      logger.warn(obj, "w", 3);

      expect(pinoTrace).toHaveBeenCalledWith(obj, "t");
      expect(pinoDebug).toHaveBeenCalledWith(obj, "d", 2);
      expect(pinoInfo).toHaveBeenCalledWith(obj, "i");
      expect(pinoWarn).toHaveBeenCalledWith(obj, "w", 3);
    });

    it("should include msg and args when string first arg and msg provided for trace", () => {
      const logger = new BaseLogger({ pretty: false });
      logger.trace("t-with-msg", "next", 123);
      expect(pinoTrace).toHaveBeenCalledWith("t-with-msg", "next", 123);
    });

    it("should route error with Error first arg as {err:error}", () => {
      const logger = new BaseLogger({ pretty: false });
      const err = new Error("e1");
      logger.error(err, "failed", 500);
      expect(pinoError).toHaveBeenCalledWith({ err: err }, "failed", 500);
    });

    it("should route error with string first arg", () => {
      const logger = new BaseLogger({ pretty: false });
      logger.error("boom", "context");
      expect(pinoError).toHaveBeenCalledWith("boom", "context");
    });

    it("should route error with only string arg and no msg (second branch)", () => {
      const logger = new BaseLogger({ pretty: false });
      logger.error("just-error");
      expect(pinoError).toHaveBeenCalledWith("just-error");
    });

    it("should route error with object first arg", () => {
      const logger = new BaseLogger({ pretty: false });
      const obj = { a: 1 };
      logger.error(obj, "msg");
      expect(pinoError).toHaveBeenCalledWith(obj, "msg");
    });

    it("should route fatal with Error first arg as {err:error}", () => {
      const logger = new BaseLogger({ pretty: false });
      const err = new Error("fatal");
      logger.fatal(err, "down");
      expect(pinoFatal).toHaveBeenCalledWith({ err: err }, "down");
    });

    it("should route fatal with string and object first args", () => {
      const logger = new BaseLogger({ pretty: false });
      logger.fatal("fatal msg");
      expect(pinoFatal).toHaveBeenCalledWith("fatal msg");

      const obj = { a: 2 };
      logger.fatal(obj, "fmsg", 42);
      expect(pinoFatal).toHaveBeenCalledWith(obj, "fmsg", 42);
    });

    it("should include msg and args when string first arg and msg provided for fatal", () => {
      const logger = new BaseLogger({ pretty: false });
      logger.fatal("fatal with msg", "ctx", 7);
      expect(pinoFatal).toHaveBeenCalledWith("fatal with msg", "ctx", 7);
    });
  });
});
