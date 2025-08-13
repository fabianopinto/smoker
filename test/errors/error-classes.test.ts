/**
 * Error Classes Test Suite
 *
 * Verifies the structure, inheritance, and serialization of the Smoker error system.
 * Coverage areas:
 * - Root SmokerError fields, JSON serialization, and type guard
 * - KafkaConnectionError factory defaults and details
 * - MQTT connection/disconnect errors factory defaults and details
 */

import { describe, expect, it } from "vitest";
import {
  ERR_KAFKA_CONNECT,
  ERR_MQTT_CONNECT,
  ERR_MQTT_DISCONNECT,
  KafkaConnectionError,
  MqttConnectionError,
  MqttDisconnectError,
  SmokerError,
} from "../../src/errors";
import type { SmokerErrorOptions } from "../../src/errors/smoker-error";

describe("Error classes", () => {
  describe("SmokerError", () => {
    it("should expose structured fields and safe JSON", () => {
      const err = new SmokerError("root message", {
        code: "ERR_TEST",
        domain: "test",
        details: { a: 1 },
        severity: "error",
        retryable: false,
        cause: new Error("inner"),
      });

      expect(err).toBeInstanceOf(SmokerError);
      expect(err.code).toBe("ERR_TEST");
      expect(err.domain).toBe("test");
      expect(err.details).toEqual({ a: 1 });
      expect(err.severity).toBe("error");
      expect(err.retryable).toBe(false);
      expect(typeof err.timestamp).toBe("string");

      const json = err.toJSON();
      expect(json).toMatchObject({
        name: "SmokerError",
        code: "ERR_TEST",
        domain: "test",
        message: "root message",
        severity: "error",
        retryable: false,
        details: { a: 1 },
      });
      // cause is safely represented
      expect(json.cause).toMatchObject({ name: "Error", message: "inner" });

      // type guard
      expect(SmokerError.isSmokerError(err)).toBe(true);
      expect(SmokerError.isSmokerError({})).toBe(false);
    });

    it("should default details to an empty object when not provided", () => {
      const opts: SmokerErrorOptions = {
        code: "ERR_TEST_NO_DETAILS",
        domain: "test",
        // no details provided on purpose
      };
      const err = new SmokerError("root message", opts);

      expect(err).toBeInstanceOf(SmokerError);
      expect(err.details).toEqual({});

      const json = err.toJSON();
      expect(json.details).toEqual({});
    });

    it("should serialize non-Error cause as-is in JSON", () => {
      const cause = { reason: "plain-object" };
      const err = new SmokerError("root message", {
        code: "ERR_TEST_CAUSE_OBJECT",
        domain: "test",
        cause,
      });

      const json = err.toJSON();
      expect(json.cause).toEqual(cause);
    });

    it("should prefer opts.message over constructor message in JSON output", () => {
      const err = new SmokerError("ctor message", {
        code: "ERR_TEST_MSG_OVERRIDE",
        domain: "test",
        message: "opts message",
      });

      const json = err.toJSON();
      expect(json.message).toBe("opts message");
    });

    it("should include an ISO timestamp string in JSON", () => {
      const err = new SmokerError("msg", { code: "E", domain: "test" });
      const json = err.toJSON();
      expect(typeof json.timestamp).toBe("string");
      // Ensure it parses as a valid date
      expect(Number.isNaN(Date.parse(json.timestamp as string))).toBe(false);
    });

    it("fromUnknown should create a SmokerError with provided opts", () => {
      const e = SmokerError.fromUnknown("factory msg", {
        code: "ERR_FACTORY",
        domain: "factory",
        details: { x: 1 },
        retryable: true,
        severity: "warn",
      });

      expect(e).toBeInstanceOf(SmokerError);
      expect(e.message).toBe("factory msg");
      expect(e.code).toBe("ERR_FACTORY");
      expect(e.domain).toBe("factory");
      expect(e.retryable).toBe(true);
      expect(e.severity).toBe("warn");
      expect(e.details).toEqual({ x: 1 });
    });
  });

  describe("KafkaConnectionError", () => {
    it("should default to retryable and include brokers in details", () => {
      const brokers = ["localhost:9092", "localhost:9093"];
      const err = KafkaConnectionError.connecting(brokers);

      expect(err).toBeInstanceOf(KafkaConnectionError);
      expect(err).toBeInstanceOf(SmokerError);
      expect(err.code).toBe(ERR_KAFKA_CONNECT);
      expect(err.domain).toBe("messaging");
      expect(err.retryable).toBe(true);
      expect(err.details).toMatchObject({ component: "kafka", brokers });
    });
  });

  describe("Mqtt errors", () => {
    it("should create a retryable MQTT connection error with clientId and url", () => {
      const err = MqttConnectionError.connecting("client-1", "mqtt://broker:1883");

      expect(err).toBeInstanceOf(MqttConnectionError);
      expect(err).toBeInstanceOf(SmokerError);
      expect(err.code).toBe(ERR_MQTT_CONNECT);
      expect(err.domain).toBe("messaging");
      expect(err.retryable).toBe(true);
      expect(err.details).toMatchObject({
        component: "mqtt",
        clientId: "client-1",
        url: "mqtt://broker:1883",
      });
    });

    it("should create a non-retryable MQTT disconnect error with clientId", () => {
      const err = MqttDisconnectError.disconnecting("client-2");

      expect(err).toBeInstanceOf(MqttDisconnectError);
      expect(err).toBeInstanceOf(SmokerError);
      expect(err.code).toBe(ERR_MQTT_DISCONNECT);
      expect(err.domain).toBe("messaging");
      expect(err.retryable).toBe(false);
      expect(err.details).toMatchObject({ component: "mqtt", clientId: "client-2" });
    });
  });
});
