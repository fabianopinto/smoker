/**
 * env-utils.test.ts
 *
 * Coverage:
 * - requireEnv throws SmokerError with standardized code/domain when missing
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ERR_ENV_MISSING, SmokerError } from "../../src/errors";
import { EnvUtils } from "../../src/lib/env-utils";

describe("EnvUtils", () => {
  const VAR = "__TEST_VAR__";
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[VAR];
    Reflect.deleteProperty(process.env, VAR);
  });

  afterEach(() => {
    if (prev !== undefined) process.env[VAR] = prev;
    else Reflect.deleteProperty(process.env, VAR);
  });

  describe("getEnv", () => {
    it("should return default when missing or empty", () => {
      expect(EnvUtils.getEnv(VAR, "dflt")).toBe("dflt");
      process.env[VAR] = "";
      expect(EnvUtils.getEnv(VAR, "dflt")).toBe("dflt");
    });

    it("should trim and return value when set", () => {
      process.env[VAR] = "  value  ";
      expect(EnvUtils.getEnv(VAR)).toBe("value");
    });

    it("should throw when variable is empty string", () => {
      const name = VAR;
      process.env[name] = "";
      try {
        EnvUtils.requireEnv(name);
        throw new Error("Expected to throw");
      } catch (e) {
        expect(SmokerError.isSmokerError(e)).toBe(true);
        const err = e as SmokerError;
        expect(err.code).toBe(ERR_ENV_MISSING);
        expect(err.domain).toBe("env");
        expect(err.details).toEqual(expect.objectContaining({ name }));
      }
    });

    it("should return trimmed value when present", () => {
      const name = VAR;
      process.env[name] = "  value  ";
      expect(EnvUtils.requireEnv(name)).toBe("value");
    });
  });

  describe("requireEnv", () => {
    it("should throw SmokerError with ERR_ENV_MISSING and domain 'env' when variable is missing", () => {
      const name = VAR;
      Reflect.deleteProperty(process.env, name);
      try {
        EnvUtils.requireEnv(name);
        throw new Error("Expected to throw");
      } catch (e) {
        expect(SmokerError.isSmokerError(e)).toBe(true);
        const err = e as SmokerError;
        expect(err.code).toBe(ERR_ENV_MISSING);
        expect(err.domain).toBe("env");
        expect(err.details).toEqual(expect.objectContaining({ name }));
      }
    });
  });

  describe("getBoolEnv", () => {
    it("should parse truthy and falsy values and fallback on unknown", () => {
      process.env[VAR] = "true";
      expect(EnvUtils.getBoolEnv(VAR, false)).toBe(true);
      process.env[VAR] = "1";
      expect(EnvUtils.getBoolEnv(VAR, false)).toBe(true);
      process.env[VAR] = "yes";
      expect(EnvUtils.getBoolEnv(VAR, false)).toBe(true);
      process.env[VAR] = "false";
      expect(EnvUtils.getBoolEnv(VAR, true)).toBe(false);
      process.env[VAR] = "0";
      expect(EnvUtils.getBoolEnv(VAR, true)).toBe(false);
      process.env[VAR] = "no";
      expect(EnvUtils.getBoolEnv(VAR, true)).toBe(false);
      process.env[VAR] = "maybe";
      expect(EnvUtils.getBoolEnv(VAR, true)).toBe(true);
      Reflect.deleteProperty(process.env, VAR);
      expect(EnvUtils.getBoolEnv(VAR, true)).toBe(true);
    });
  });

  describe("getNumberEnv", () => {
    it("should parse finite numbers or use default", () => {
      process.env[VAR] = "42";
      expect(EnvUtils.getNumberEnv(VAR, 7)).toBe(42);
      process.env[VAR] = "abc";
      expect(EnvUtils.getNumberEnv(VAR, 7)).toBe(7);
      Reflect.deleteProperty(process.env, VAR);
      expect(EnvUtils.getNumberEnv(VAR, 9)).toBe(9);
    });
  });

  describe("getJsonEnv", () => {
    it("should parse JSON or return default when invalid/missing", () => {
      interface Cfg {
        a: number;
      }
      const dflt: Cfg = { a: 1 };
      process.env[VAR] = '{"a":2}';
      expect(EnvUtils.getJsonEnv<Cfg>(VAR, dflt)).toEqual({ a: 2 });
      process.env[VAR] = "not-json";
      expect(EnvUtils.getJsonEnv<Cfg>(VAR, dflt)).toEqual(dflt);
      Reflect.deleteProperty(process.env, VAR);
      expect(EnvUtils.getJsonEnv<Cfg>(VAR, dflt)).toEqual(dflt);
    });
  });
});
