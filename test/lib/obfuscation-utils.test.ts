/**
 * obfuscation-utils.test.ts
 *
 * Coverage:
 * - partialMask shows only configured edges
 * - obfuscateHeaders masks common secret headers
 * - obfuscateObject masks properties by regex
 * - obfuscateHeaders handles non-string header path
 * - obfuscateObject handles primitive input early return
 * - obfuscateObject catches and logs path when shouldMaskKey throws
 */

import { describe, expect, it, vi } from "vitest";
import { logger } from "../../src/lib/logger";
import { ObfuscationUtils } from "../../src/lib/obfuscation-utils";

describe("ObfuscationUtils", () => {
  it("partialMask should keep edges and mask middle", () => {
    expect(
      ObfuscationUtils.partialMask("abcdef", {
        visibleStart: 2,
        visibleEnd: 2,
        maskChar: "*",
        minMasked: 2,
      }),
    ).toBe("ab**ef");
  });

  it("obfuscateHeaders should pass through non-string values unchanged", () => {
    const out = ObfuscationUtils.obfuscateHeaders({ count: 10, note: "ok" } as unknown as Record<
      string,
      string
    >);
    // non-string preserved as-is due to runtime cast path
    expect((out as unknown as Record<string, unknown>).count).toBe(10);
    expect(out.note).toBe("ok");
  });

  it("partialMask should handle very short strings", () => {
    expect(ObfuscationUtils.partialMask("a", { visibleStart: 1, visibleEnd: 1 })).toBe("*");
    expect(ObfuscationUtils.partialMask("ab", { visibleStart: 1, visibleEnd: 1 })).toBe("**");
  });

  it("mask and partialMask should return input when empty string provided", () => {
    expect(ObfuscationUtils.mask("")).toBe("");
    expect(ObfuscationUtils.partialMask("")).toBe("");
  });

  it("obfuscateHeaders should mask secrets", () => {
    const out = ObfuscationUtils.obfuscateHeaders({
      authorization: "Bearer token",
      "x-api-key": "abc",
      other: "visible",
    });
    expect(out.authorization).not.toContain("token");
    // For short credentials, only the tail may be visible (implementation-dependent)
    const maskedCred = out.authorization.split(/\s+/, 2)[1];
    expect(maskedCred).toMatch(/^\*+ken$/); // stars + last 3 of "token"
    expect(out["x-api-key"]).not.toContain("abc");
    expect(out.other).toBe("visible");
  });

  it("obfuscateHeaders should handle credentials without scheme", () => {
    const out = ObfuscationUtils.obfuscateHeaders({ authorization: "token", other: "10" });
    expect(out.authorization).not.toBe("token");
    expect(out.authorization).toMatch(/^\*+ken$/);
    expect(out.other).toBe("10");
  });

  it("obfuscateObject should mask by regex properties", () => {
    const out = ObfuscationUtils.obfuscateObject(
      { password: "pwd", token: "tkn", data: { secret: "abc" }, keep: "ok" },
      { patterns: [/pass/i, /token/i, /secret/i], fullMask: true },
    );
    expect(out.password).not.toBe("pwd");
    expect(out.token).not.toBe("tkn");
    expect(out.data.secret).not.toBe("abc");
    expect(out.keep).toBe("ok");
  });

  it("obfuscateObject should accept string patterns (converted to RegExp)", () => {
    const out = ObfuscationUtils.obfuscateObject(
      { Password: "pwd", keep: "ok" },
      { patterns: ["password"], fullMask: true },
    );
    expect(out.Password).not.toBe("pwd");
    expect(out.keep).toBe("ok");
  });

  it("obfuscateObject should use shouldMaskKey predicate when provided", () => {
    interface T {
      safe: string;
      reveal: string;
      x: { y: string };
    }
    const out = ObfuscationUtils.obfuscateObject<T>(
      { safe: "ok", reveal: "no", x: { y: "z" } },
      { fullMask: false, shouldMaskKey: (k, _v, path) => k === "y" && path.join(".") === "x" },
    );
    expect(out.safe).toBe("ok");
    expect(out.x.y).not.toBe("z");
  });

  it("obfuscateObject should handle arrays and circular references safely", () => {
    interface Elem {
      token?: string;
      value?: string;
    }
    interface A {
      arr: Elem[];
      self?: unknown;
    }
    const a: A = { arr: [{ token: "abc" }, { value: "ok" }] };
    a.self = a as unknown; // circular
    const out = ObfuscationUtils.obfuscateObject(a, { fullMask: true });
    // array element masked
    expect(out.arr[0].token).not.toBe("abc");
    expect(out.arr[1].value).toBe("ok");
    // ensure still an object and circular didn't explode
    expect(out.self).toBeDefined();
  });

  it("obfuscateObject should leave non-string values unchanged even when selected", () => {
    const out = ObfuscationUtils.obfuscateObject(
      { num: 123, nested: { flag: true } },
      { fullMask: true, shouldMaskKey: (k) => k === "num" || k === "flag" },
    );
    expect(out.num).toBe(123);
    expect(out.nested.flag).toBe(true);
  });

  it("obfuscateObject should return primitives unchanged", () => {
    expect(ObfuscationUtils.obfuscateObject(123 as unknown as number)).toBe(123);
    expect(ObfuscationUtils.obfuscateObject("abc" as unknown as string)).toBe("abc");
    expect(ObfuscationUtils.obfuscateObject(null as unknown as null)).toBeNull();
  });

  it("obfuscateObject should log and return input when traversal fails", () => {
    const warnSpy = vi.spyOn(logger, "warn");
    const input = { a: "x" };
    const out = ObfuscationUtils.obfuscateObject(input, {
      shouldMaskKey: () => {
        throw new Error("boom");
      },
    });
    expect(out).toBe(input);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});
