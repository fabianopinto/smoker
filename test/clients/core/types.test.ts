import { describe, expect, it } from "vitest";
import { ClientType, ClientTypeUtils } from "../../../src/clients";

describe("ClientType", () => {
  it("should have the correct values", () => {
    expect(ClientType.REST).toBe("rest");
    expect(ClientType.MQTT).toBe("mqtt");
    expect(ClientType.S3).toBe("s3");
    expect(ClientType.CLOUDWATCH).toBe("cloudwatch");
    expect(ClientType.SSM).toBe("ssm");
    expect(ClientType.SQS).toBe("sqs");
    expect(ClientType.KINESIS).toBe("kinesis");
    expect(ClientType.KAFKA).toBe("kafka");
  });

  it("should have all expected client types", () => {
    const expectedTypes = ["rest", "mqtt", "s3", "cloudwatch", "ssm", "sqs", "kinesis", "kafka"];

    // Ensure all expected types exist in the enum
    expectedTypes.forEach((type) => {
      expect(Object.values(ClientType)).toContain(type);
    });

    // Ensure no extra types exist
    expect(Object.values(ClientType).length).toBe(expectedTypes.length);
  });
});

describe("ClientTypeUtils", () => {
  describe("getAllTypes", () => {
    it("should return all client types", () => {
      const types = ClientTypeUtils.getAllTypes();

      // Should return all enum values
      expect(types.length).toBe(Object.values(ClientType).length);

      // Should contain all client types
      expect(types).toContain(ClientType.REST);
      expect(types).toContain(ClientType.MQTT);
      expect(types).toContain(ClientType.S3);
      expect(types).toContain(ClientType.CLOUDWATCH);
      expect(types).toContain(ClientType.SSM);
      expect(types).toContain(ClientType.SQS);
      expect(types).toContain(ClientType.KINESIS);
      expect(types).toContain(ClientType.KAFKA);
    });
  });

  describe("fromString", () => {
    it("should convert valid string to ClientType", () => {
      expect(ClientTypeUtils.fromString("rest")).toBe(ClientType.REST);
      expect(ClientTypeUtils.fromString("mqtt")).toBe(ClientType.MQTT);
      expect(ClientTypeUtils.fromString("s3")).toBe(ClientType.S3);
      expect(ClientTypeUtils.fromString("cloudwatch")).toBe(ClientType.CLOUDWATCH);
      expect(ClientTypeUtils.fromString("ssm")).toBe(ClientType.SSM);
      expect(ClientTypeUtils.fromString("sqs")).toBe(ClientType.SQS);
      expect(ClientTypeUtils.fromString("kinesis")).toBe(ClientType.KINESIS);
      expect(ClientTypeUtils.fromString("kafka")).toBe(ClientType.KAFKA);
    });

    it("should handle uppercase strings", () => {
      expect(ClientTypeUtils.fromString("REST")).toBe(ClientType.REST);
      expect(ClientTypeUtils.fromString("MQTT")).toBe(ClientType.MQTT);
      expect(ClientTypeUtils.fromString("S3")).toBe(ClientType.S3);
    });

    it("should handle mixed case strings", () => {
      expect(ClientTypeUtils.fromString("Rest")).toBe(ClientType.REST);
      expect(ClientTypeUtils.fromString("mQtT")).toBe(ClientType.MQTT);
      expect(ClientTypeUtils.fromString("CloudWatch")).toBe(ClientType.CLOUDWATCH);
    });

    it("should return undefined for invalid types", () => {
      expect(ClientTypeUtils.fromString("invalid")).toBeUndefined();
      expect(ClientTypeUtils.fromString("")).toBeUndefined();
      expect(ClientTypeUtils.fromString("unknown")).toBeUndefined();
    });
  });

  describe("isValidType", () => {
    it("should return true for valid types", () => {
      expect(ClientTypeUtils.isValidType("rest")).toBe(true);
      expect(ClientTypeUtils.isValidType("mqtt")).toBe(true);
      expect(ClientTypeUtils.isValidType("s3")).toBe(true);
      expect(ClientTypeUtils.isValidType("cloudwatch")).toBe(true);
      expect(ClientTypeUtils.isValidType("ssm")).toBe(true);
      expect(ClientTypeUtils.isValidType("sqs")).toBe(true);
      expect(ClientTypeUtils.isValidType("kinesis")).toBe(true);
      expect(ClientTypeUtils.isValidType("kafka")).toBe(true);
    });

    it("should handle case insensitivity", () => {
      expect(ClientTypeUtils.isValidType("REST")).toBe(true);
      expect(ClientTypeUtils.isValidType("Mqtt")).toBe(true);
      expect(ClientTypeUtils.isValidType("S3")).toBe(true);
    });

    it("should return false for invalid types", () => {
      expect(ClientTypeUtils.isValidType("invalid")).toBe(false);
      expect(ClientTypeUtils.isValidType("")).toBe(false);
      expect(ClientTypeUtils.isValidType("unknown")).toBe(false);
      expect(ClientTypeUtils.isValidType("rest2")).toBe(false);
    });
  });
});
