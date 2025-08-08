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
