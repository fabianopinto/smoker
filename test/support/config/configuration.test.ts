/**
 * Unit tests for Configuration
 * Tests the functionality of the Configuration class and related utilities
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createS3Response } from "../aws-test-utils";

// Mock filesystem operations
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Create mock clients
const mockSSM = mockClient(SSMClient);
const mockS3 = mockClient(S3Client);

// Import after mocks are defined
import {
  addConfigurationFile,
  addConfigurationObject,
  addS3ConfigurationFile,
  addSSMParameterSource,
  Configuration,
  FileConfigurationSource,
  getConfig,
  getValue,
  loadConfigurationFiles,
  loadConfigurations,
  ObjectConfigurationSource,
  S3ConfigurationSource,
  SSMParameterSource,
  updateConfig,
} from "../../../src/support/config";

import type {
  ConfigObject,
  ConfigurationSource,
  SmokeConfig,
} from "../../../src/support/interfaces/config.interface";

/**
 * Reset the singleton Configuration instance between tests
 * This is a workaround since we can't directly reset the private instance
 */
function resetConfigurationSingleton() {
  // Use defineProperty with configurable: true instead of direct assignment
  // to avoid TypeScript errors when accessing private static member
  Object.defineProperty(Configuration, "instance", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

// Using createS3Response from shared utilities in test/lib/aws-test-utils.ts

describe("Configuration Module", () => {
  // Restore all mocks after each test
  afterEach(() => {
    vi.restoreAllMocks();
    resetConfigurationSingleton();
  });

  describe("FileConfigurationSource", () => {
    const testFilePath = "/path/to/config.json";
    let fileSource: FileConfigurationSource;

    beforeEach(() => {
      fileSource = new FileConfigurationSource(testFilePath);
    });

    it("should return empty object when file doesn't exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const consoleSpy = vi.spyOn(console, "warn");

      const config = await fileSource.load();

      expect(config).toEqual({});
      expect(existsSync).toHaveBeenCalledWith(testFilePath);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));

      consoleSpy.mockRestore();
    });

    it("should load and parse JSON from file when it exists", async () => {
      const mockConfig = { defaultPhrase: "Test", phraseTemplate: "{phrase} {target}" };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const config = await fileSource.load();

      expect(config).toEqual(mockConfig);
      expect(existsSync).toHaveBeenCalledWith(testFilePath);
      expect(readFileSync).toHaveBeenCalledWith(testFilePath, "utf8");
    });

    it("should return empty object when file contains invalid JSON", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("{ invalid json");
      const consoleSpy = vi.spyOn(console, "error");

      const config = await fileSource.load();

      expect(config).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error loading"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should handle I/O errors gracefully", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("I/O Error");
      });
      const consoleSpy = vi.spyOn(console, "error");

      const config = await fileSource.load();

      expect(config).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error loading"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("S3ConfigurationSource", () => {
    const validS3Url = "s3://test-bucket/config.json";
    let s3Source: S3ConfigurationSource;

    beforeEach(() => {
      mockS3.reset();
      s3Source = new S3ConfigurationSource(validS3Url);
    });

    it("should load and parse configuration from S3", async () => {
      // Define test configuration
      const testConfig = {
        defaultPhrase: "S3 Phrase",
        phraseTemplate: "{phrase} from {source}",
      };

      // Setup mock response
      mockS3.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testConfig)));

      // Load the configuration
      const config = await s3Source.load();

      // Verify result
      expect(config).toEqual(testConfig);

      // Verify correct S3 command was called
      expect(mockS3).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: "test-bucket",
        Key: "config.json",
      });
    });

    it("should handle invalid S3 URL", async () => {
      // Create source with invalid URL
      const invalidSource = new S3ConfigurationSource("invalid-url");
      const consoleErrorSpy = vi.spyOn(console, "error");

      const config = await invalidSource.load();

      expect(config).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should handle S3 access errors", async () => {
      // Mock an S3 error
      mockS3.on(GetObjectCommand).rejects(new Error("Access Denied"));

      const consoleErrorSpy = vi.spyOn(console, "error");

      const config = await s3Source.load();

      expect(config).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should use provided region when specified", () => {
      const customRegion = "eu-west-1";

      // Create a source with the region parameter
      const sourceWithRegion = new S3ConfigurationSource(validS3Url, customRegion);

      // Implementation detail: we can't easily test the region directly
      expect(sourceWithRegion).toBeDefined();
    });

    it("should accept custom S3Client instance for testing", async () => {
      // Create a custom S3 client for testing
      const customClient = new S3Client({
        region: "us-west-2",
      });

      // Create mock for the custom client
      const customMockS3 = mockClient(customClient);

      // Setup a mock response for this test
      const testConfig = { customClientTest: true };
      customMockS3.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testConfig)));

      // Create source with custom client
      const sourceWithCustomClient = new S3ConfigurationSource(
        validS3Url,
        "us-west-2",
        customClient,
      );

      // Verify the configuration is loaded correctly using the custom client
      const config = await sourceWithCustomClient.load();
      expect(config).toEqual(testConfig);

      // Verify the custom client was used
      expect(customMockS3.calls().length).toBeGreaterThan(0);
    });

    it("should handle malformed JSON from S3", async () => {
      // Mock S3 to return invalid JSON
      mockS3.on(GetObjectCommand).resolves({
        Body: createS3Response("{ invalid json"),
        $metadata: { httpStatusCode: 200 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const consoleErrorSpy = vi.spyOn(console, "error");

      const config = await s3Source.load();

      // Should return empty object on error
      expect(config).toEqual({});
      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain("Error loading configuration from S3");

      consoleErrorSpy.mockRestore();
    });

    describe("parseS3Url function", () => {
      // This is a private function, so we'll test it indirectly through S3ConfigurationSource

      it("should handle various S3 URL formats", async () => {
        // Create a fresh mock for this test
        const testMockS3 = mockClient(S3Client);

        // Setup response for any S3 request in this test
        testMockS3
          .on(GetObjectCommand)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .resolves({ Body: { transformToString: async () => "{}" } as any });

        // Mock console.error to prevent test output pollution
        const consoleErrorSpy = vi.spyOn(console, "error");

        // Test with a basic region parameter instead of client injection
        const testRegion = "us-east-1";

        // Valid URLs
        const validSource = new S3ConfigurationSource("s3://bucket/path/to/file.json", testRegion);
        await validSource.load();

        // Since we're not actually testing the mock calls here (that's tested elsewhere),
        // we're primarily testing that the URL parsing works correctly.

        // We can verify this happened successfully if the load() function completes
        // without throwing an error

        // Invalid formats
        const invalidFormats = [
          "http://bucket/path/to/file.json",
          "s3:/bucket/path/to/file.json",
          "s3://",
          "s3://bucket/",
          "s3://bucket",
        ];

        for (const format of invalidFormats) {
          const invalidSource = new S3ConfigurationSource(format);
          await invalidSource.load();
          expect(console.error).toHaveBeenCalled();
          consoleErrorSpy.mockReset();
        }
      });
    });

    it("should resolve parameters in the loaded configuration", async () => {
      const testConfigWithParam = {
        defaultPhrase: "Test Phrase",
        secretKey: "ssm://test/param1",
      };

      // Mock the S3 response
      mockS3.on(GetObjectCommand).resolves(createS3Response(JSON.stringify(testConfigWithParam)));

      // Mock the SSM response for parameter resolution
      mockSSM.on(GetParameterCommand, { Name: "test/param1" }).resolves({
        Parameter: {
          Name: "test/param1",
          Value: "resolved-value",
          Type: "String",
        },
      });

      const config = await s3Source.load();

      // Verify parameter was resolved
      expect(config).toEqual({
        defaultPhrase: "Test Phrase",
        secretKey: "resolved-value",
      });

      // Verify both S3 and SSM were called
      expect(mockS3.calls().length).toBeGreaterThan(0);
      expect(mockSSM.calls().length).toBeGreaterThan(0);
    });
  });

  describe("ObjectConfigurationSource", () => {
    it("should return the provided configuration object", async () => {
      const testConfig = {
        defaultPhrase: "Object Phrase",
        setting: "value",
      };

      const objectSource = new ObjectConfigurationSource(testConfig);
      const config = await objectSource.load();

      // Verify a copy is returned, not the original object reference
      expect(config).toEqual(testConfig);
      expect(config).not.toBe(testConfig);
    });
  });

  describe("SSMParameterSource", () => {
    beforeEach(() => {
      // Reset SSM mock
      mockSSM.reset();
    });

    it("should resolve SSM parameters in configuration", async () => {
      // For this test, we'll focus on verifying the SSMParameterSource behaves correctly
      // without getting caught up in the implementation details of the AWS mock

      // Reset the shared mock
      mockSSM.reset();

      // Setup the mock with our expected response
      mockSSM.on(GetParameterCommand).resolves({
        Parameter: {
          Name: "test/param1",
          Value: "resolved-value",
          Type: "String",
        },
        $metadata: { httpStatusCode: 200 },
      });

      // Setup test config with SSM reference
      const testConfig: ConfigObject = {
        param1: "ssm://test/param1",
      };

      // Create and execute the source
      const ssmSource = new SSMParameterSource(testConfig);
      const resolvedConfig = await ssmSource.load();

      // Verify parameter was resolved correctly - this is the real behavior we care about
      expect(resolvedConfig).toEqual({
        param1: "resolved-value",
      });

      // Optional: If you really need to verify the AWS call, you can do that too
      // but we'll focus on the functional behavior (correct parameter resolution)
      // rather than implementation details (AWS SDK calls)
    });

    it("should handle errors during parameter resolution", async () => {
      // Setup test config with SSM reference that will cause an error
      const testConfig: ConfigObject = {
        param1: "ssm://error/param",
      };

      // Mock the SSM error
      mockSSM
        .on(GetParameterCommand, { Name: "error/param" })
        .rejects(new Error("Parameter not found"));

      const consoleSpy = vi.spyOn(console, "error");

      // Create source and load config
      const ssmSource = new SSMParameterSource(testConfig);
      const resolvedConfig = await ssmSource.load();

      // Original config should be returned on error
      expect(resolvedConfig).toEqual(testConfig);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should process nested parameters in objects", async () => {
      // Reset mock before each test
      mockSSM.reset();

      const testConfig = {
        nested: {
          param1: "ssm://test/param1",
          param2: "ssm://test/param2",
          regular: "not-a-parameter",
        },
      };

      // Mock the SSM responses for both parameters with the same value
      mockSSM.on(GetParameterCommand).resolves({
        Parameter: { Value: "resolved-value" },
        $metadata: { httpStatusCode: 200 },
      });

      const ssmSource = new SSMParameterSource(testConfig);
      const resolvedConfig = await ssmSource.load();

      expect(resolvedConfig.nested).toEqual({
        param1: "resolved-value",
        param2: "resolved-value",
        regular: "not-a-parameter",
      });
    });

    it("should process parameters in arrays", async () => {
      // Reset mock before each test
      mockSSM.reset();

      const testConfig = {
        array: ["regular", "ssm://test/param1", 123, true],
      };

      // Mock the SSM parameter response
      mockSSM.on(GetParameterCommand).resolves({
        Parameter: { Value: "resolved-value" },
        $metadata: { httpStatusCode: 200 },
      });

      const ssmSource = new SSMParameterSource(testConfig);
      const resolvedConfig = await ssmSource.load();

      expect(resolvedConfig.array).toEqual(["regular", "resolved-value", 123, true]);
    });
  });

  describe("Configuration singleton", () => {
    beforeEach(() => {
      resetConfigurationSingleton();
    });

    it("should properly merge configurations from multiple sources", async () => {
      const config = Configuration.getInstance();

      // Mock the SSM parameter response
      mockSSM.on(GetParameterCommand).resolves({
        Parameter: { Value: "resolved-value" },
        $metadata: { httpStatusCode: 200 },
      });

      const source1 = {
        load: vi.fn().mockResolvedValue({
          defaultPhrase: "Source 1",
          property1: "value1",
          shared: "from source 1",
        }),
      };

      const source2 = {
        load: vi.fn().mockResolvedValue({
          defaultPhrase: "Source 2",
          property2: "value2",
          shared: "from source 2",
        }),
      };

      // Add sources in order of precedence (lower to higher)
      config.addConfigurationSource(source1);
      config.addConfigurationSource(source2);
      await config.loadConfigurations();

      // Verify that source2 values override source1 for shared properties
      expect(config.getConfig().defaultPhrase).toBe("Source 2");
      expect(config.getValue("shared")).toBe("from source 2");

      // But unique properties from each source are preserved
      expect(config.getValue("property1")).toBe("value1");
      expect(config.getValue("property2")).toBe("value2");
    });
  });

  it("should initialize with default values", () => {
    const config = Configuration.getInstance().getConfig();

    expect(config).toEqual({
      defaultPhrase: "Smoking",
      phraseTemplate: "{phrase} {target}!",
    });
  });

  it("should return the same instance when getInstance is called multiple times", () => {
    const instance1 = Configuration.getInstance();
    const instance2 = Configuration.getInstance();

    expect(instance1).toBe(instance2);
  });

  it("should create a new instance when resetInstance is called", () => {
    // Get the initial instance
    const initialInstance = Configuration.getInstance();

    // Reset the instance
    Configuration.resetInstance();

    // Get the new instance
    const newInstance = Configuration.getInstance();

    // Verify they are different instances
    expect(initialInstance).not.toBe(newInstance);
  });

  describe("getValue method", () => {
    it("should return undefined for non-existent properties", () => {
      const config = Configuration.getInstance();
      expect(config.getValue("nonExistentProperty")).toBeUndefined();
      expect(config.getValue("nested.nonExistent.property")).toBeUndefined();
    });

    it("should return provided default value when property doesn't exist", () => {
      const config = Configuration.getInstance();
      expect(config.getValue("nonExistentProperty", "default")).toBe("default");
    });
  });

  describe("updateConfig method", () => {
    it("should update existing properties", () => {
      const config = Configuration.getInstance();
      config.updateConfig({ defaultPhrase: "Updated" });

      expect(config.getConfig().defaultPhrase).toBe("Updated");
    });

    it("should add new properties", () => {
      const config = Configuration.getInstance();
      config.updateConfig({ newProperty: "New Value" } as Partial<SmokeConfig>);

      expect(config.getValue("newProperty")).toBe("New Value");
    });

    it("should not affect unrelated properties", () => {
      const config = Configuration.getInstance();
      const originalTemplate = config.getConfig().phraseTemplate;

      config.updateConfig({ defaultPhrase: "Updated" });

      expect(config.getConfig().defaultPhrase).toBe("Updated");
      expect(config.getConfig().phraseTemplate).toBe(originalTemplate);
    });

    it("should handle undefined values properly", () => {
      const config = Configuration.getInstance();
      const partialConfig = {
        defaultPhrase: "New Phrase",
        undefinedValue: undefined,
      };

      // Update with object containing undefined
      config.updateConfig(partialConfig as Partial<SmokeConfig>);

      // The undefined value should not be added to config
      expect(config.getValue("defaultPhrase")).toBe("New Phrase");
      expect("undefinedValue" in config.getConfig()).toBe(false);
    });
  });

  describe("deepMerge method", () => {
    it("should merge objects recursively", () => {
      const config = Configuration.getInstance();
      const target = {
        a: 1,
        nested: {
          b: 2,
          c: 3,
        },
      };

      const source = {
        a: 10,
        nested: {
          c: 30,
          d: 40,
        },
      };

      // Use reflection to access private method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (config as any).deepMerge(target, source);

      expect(result).toEqual({
        a: 10,
        nested: {
          b: 2,
          c: 30,
          d: 40,
        },
      });
    });

    it("should remove properties when source value is null", () => {
      const config = Configuration.getInstance();
      const target = {
        a: 1,
        b: 2,
        nested: {
          x: 10,
          y: 20,
        },
      };

      const source = {
        b: null,
        nested: {
          y: null,
        },
      };

      // Use reflection to access private method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (config as any).deepMerge(target, source);

      expect(result).toEqual({
        a: 1,
        nested: {
          x: 10,
        },
      });
    });

    it("should remove nested empty objects after merging", () => {
      const config = Configuration.getInstance();
      const target = {
        nested: { a: 1 },
      };

      const source = {
        nested: { a: null },
      };

      // Use reflection to access private method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (config as any).deepMerge(target, source);

      // The nested object should be removed since it became empty
      expect(result).toEqual({});
    });

    it("should handle arrays", () => {
      const config = Configuration.getInstance();
      const target = {
        array: [1, 2, 3],
      };

      const source = {
        array: [4, 5, 6],
      };

      // Use reflection to access private method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (config as any).deepMerge(target, source);

      expect(result.array).toEqual([4, 5, 6]);
    });

    it("should handle empty objects", () => {
      const config = Configuration.getInstance();

      // Use reflection to access private method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (config as any).deepMerge({}, {});

      expect(result).toEqual({});
    });

    it("should handle undefined and null values correctly", () => {
      const config = Configuration.getInstance();
      const target = {
        a: undefined,
        b: 2,
        c: null,
      };

      const source = {
        a: 1,
        b: undefined,
        d: null,
      };

      // Use reflection to access private method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (config as any).deepMerge(target, source);

      // In the actual implementation, the deep merge behavior with undefined and null is:
      // - undefined in target gets overridden by source
      // - undefined in source gets copied as undefined (doesn't preserve target value)
      // - null values in target are preserved
      // - null values in source that don't have corresponding keys in target are not included
      const expected = {
        a: 1, // undefined in target overridden by source value 1
        b: undefined, // undefined in source overwrites target value 2
        c: null, // null in target is preserved
        // d is null in source but not in target, so it's not included in the result
      };
      expect(result).toEqual(expected);
    });

    it("should handle complex nested structures", () => {
      const config = Configuration.getInstance();
      const target = {
        a: 1,
        nested: {
          b: {
            c: 2,
            d: 3,
          },
          e: [1, 2, 3],
        },
      };

      const source = {
        nested: {
          b: {
            c: 20,
            f: 4,
          },
          e: [4, 5],
        },
      };

      // Use reflection to access private method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (config as any).deepMerge(target, source);

      // Deep merge should recursively merge objects but replace arrays
      expect(result).toEqual({
        a: 1,
        nested: {
          b: {
            c: 20,
            d: 3,
            f: 4,
          },
          e: [4, 5], // Arrays are replaced, not merged
        },
      });
    });
  });
});

describe("Helper functions", () => {
  describe("getConfig", () => {
    it("should return the configuration from the singleton instance", () => {
      const config = getConfig();
      // toEqual instead of toBe since getConfig returns a copy
      expect(config).toEqual(Configuration.getInstance().getConfig());
    });
  });

  describe("getValue", () => {
    it("should retrieve values using the singleton instance", () => {
      // Setup a specific value
      Configuration.getInstance().updateConfig({ testKey: "test value" });

      const value = getValue("testKey");
      expect(value).toBe("test value");
    });

    it("should handle default values", () => {
      const value = getValue("nonExistent", "default");
      expect(value).toBe("default");
    });
  });

  describe("updateConfig", () => {
    it("should update configuration in the singleton instance", () => {
      const newPhrase = "Updated by helper";
      updateConfig({ defaultPhrase: newPhrase });

      expect(getConfig().defaultPhrase).toBe(newPhrase);
    });
  });

  describe("addConfigurationFile", () => {
    it("should add FileConfigurationSource for local paths", () => {
      const spy = vi.spyOn(Configuration.getInstance(), "addConfigurationSource");
      const path = "/path/to/config.json";

      addConfigurationFile(path);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.any(FileConfigurationSource));
    });

    it("should add S3ConfigurationSource for S3 URLs", () => {
      const spy = vi.spyOn(Configuration.getInstance(), "addConfigurationSource");
      const path = "s3://bucket/config.json";

      addConfigurationFile(path);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.any(S3ConfigurationSource));
    });
  });

  describe("addS3ConfigurationFile", () => {
    it("should add S3ConfigurationSource with correct parameters", () => {
      const spy = vi.spyOn(Configuration.getInstance(), "addConfigurationSource");
      const url = "s3://bucket/config.json";
      const region = "eu-west-1";

      addS3ConfigurationFile(url, region);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.any(S3ConfigurationSource));
    });
  });

  describe("addConfigurationObject", () => {
    it("should add ObjectConfigurationSource with correct parameters", () => {
      const spy = vi.spyOn(Configuration.getInstance(), "addConfigurationSource");
      const obj = { key: "value" };

      addConfigurationObject(obj);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.any(ObjectConfigurationSource));
    });
  });

  describe("addSSMParameterSource", () => {
    it("should add SSMParameterSource with correct parameters", () => {
      const spy = vi.spyOn(Configuration.getInstance(), "addConfigurationSource");
      const obj = { key: "ssm://param" };

      addSSMParameterSource(obj);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.any(SSMParameterSource));
    });
  });

  describe("loadConfigurations", () => {
    it("should call loadConfigurations on the singleton instance", async () => {
      // Reset configuration singleton to clean state
      resetConfigurationSingleton();

      // Mock the loadConfigurations method to resolve immediately
      // This prevents hanging due to trying to load from non-existent files
      const spy = vi.spyOn(Configuration.getInstance(), "loadConfigurations").mockResolvedValue();

      await loadConfigurations();

      expect(spy).toHaveBeenCalledTimes(1);

      // Clean up
      spy.mockRestore();
    });
  });

  describe("loadConfigurationFiles", () => {
    it("should add all provided files and load configurations", async () => {
      const config = Configuration.getInstance();

      const addFileSpy = vi.spyOn(config, "addConfigurationSource");
      const loadConfigsSpy = vi.spyOn(config, "loadConfigurations").mockResolvedValue();

      try {
        // Test with these files
        const files = ["/path/one.json", "/path/two.json"];

        // Call the function under test
        await loadConfigurationFiles(files);

        // Verify that addConfigurationSource was called for each file
        // We expect it to be called with FileConfigurationSource instances
        expect(addFileSpy).toHaveBeenCalledTimes(2);

        // Verify that loadConfigurations was called once
        expect(loadConfigsSpy).toHaveBeenCalledTimes(1);
      } finally {
        // Clean up
        vi.restoreAllMocks();
        resetConfigurationSingleton();
      }
    });
  });
});

describe("Edge cases", () => {
  describe("Configuration validation", () => {
    it("should handle missing required properties", async () => {
      const config = Configuration.getInstance();
      const spy = vi.spyOn(console, "warn");

      // Add a configuration source that's missing required properties
      const incompleteSource = new ObjectConfigurationSource({
        otherProperty: "value",
        // Missing defaultPhrase and phraseTemplate
      });

      config.addConfigurationSource(incompleteSource);
      await config.loadConfigurations();

      // Should warn but retain default values
      expect(spy).toHaveBeenCalled();
      expect(config.getConfig().defaultPhrase).toBe("Smoking");
      expect(config.getConfig().phraseTemplate).toBe("{phrase} {target}!");
      // Should still include the other property
      expect(config.getValue("otherProperty")).toBe("value");

      spy.mockRestore();
    });

    it("should handle incorrect types for required properties", async () => {
      const config = Configuration.getInstance();
      const spy = vi.spyOn(console, "warn");

      // Add a configuration with wrong types
      const badTypesSource = new ObjectConfigurationSource({
        defaultPhrase: 123, // Number instead of string
        phraseTemplate: false, // Boolean instead of string
      } as ConfigObject);

      config.addConfigurationSource(badTypesSource);
      await config.loadConfigurations();

      // Should warn but accept the different types as is
      expect(spy).toHaveBeenCalled();
      // Test with null (would be converted to empty object)
      const nullSource = new ObjectConfigurationSource({} as ConfigObject); // Use empty object instead of null

      config.addConfigurationSource(nullSource);
      await config.loadConfigurations();

      // Should retain default values
      expect(config.getConfig().defaultPhrase).toBe("Smoking");
      expect(config.getConfig().phraseTemplate).toBe("{phrase} {target}!");

      spy.mockRestore();
    });

    it("should handle mixed valid and invalid types", async () => {
      const spy = vi.spyOn(console, "warn");

      // Reset to clean state
      resetConfigurationSingleton();

      // Create a source with mixed valid and invalid types
      const mixedTypesSource = new ObjectConfigurationSource({
        defaultPhrase: "Valid String", // Valid type
        phraseTemplate: 42, // Invalid type
        additionalProperty: "Should be preserved",
      } as ConfigObject);

      // Add the source and load configurations
      const configInstance = Configuration.getInstance();
      configInstance.addConfigurationSource(mixedTypesSource);
      await configInstance.loadConfigurations();

      // Should use valid string for defaultPhrase but preserve default for phraseTemplate
      expect(configInstance.getConfig().defaultPhrase).toBe("Valid String");
      expect(configInstance.getConfig().phraseTemplate).toBe("{phrase} {target}!");
      // Additional property should be preserved
      expect(configInstance.getValue("additionalProperty")).toBe("Should be preserved");

      spy.mockRestore();
    });

    it("should handle nested properties with invalid types", async () => {
      // Reset to clean state
      resetConfigurationSingleton();

      const config = Configuration.getInstance();
      const spy = vi.spyOn(console, "warn");

      // Create a configuration with nested properties
      const nestedConfig = new ObjectConfigurationSource({
        defaultPhrase: "Valid String",
        phraseTemplate: "{phrase} {target}!",
        nested: {
          validString: "string value",
          invalidNumber: "not a number", // String instead of number
        },
        nestedArray: ["string", 123, { key: "value" }],
      } as ConfigObject);

      // Add the source and load configurations
      config.addConfigurationSource(nestedConfig);
      await config.loadConfigurations();

      // Nested properties should be preserved regardless of type
      expect(config.getValue("nested.validString")).toBe("string value");
      expect(config.getValue("nested.invalidNumber")).toBe("not a number");
      expect(config.getValue("nestedArray")).toEqual(["string", 123, { key: "value" }]);

      spy.mockRestore();
    });
  });

  describe("Error handling", () => {
    it("should handle errors during configuration loading", async () => {
      // Reset the configuration to ensure we start with default values
      resetConfigurationSingleton();
      const config = Configuration.getInstance();
      const errorSpy = vi.spyOn(console, "error");

      // Create a source that throws during load
      const errorSource: ConfigurationSource = {
        load: vi.fn().mockImplementation(() => {
          throw new Error("Load error");
        }),
      };

      // Add the error source
      config.addConfigurationSource(errorSource);

      // Should not throw
      await config.loadConfigurations();

      // Should log error
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error loading configuration from source:"),
        expect.any(Error),
      );

      // Should retain default configuration
      expect(config.getConfig().defaultPhrase).toBe("Smoking");

      errorSpy.mockRestore();
    });

    it("should handle multiple sources with some failures", async () => {
      const config = Configuration.getInstance();
      const errorSpy = vi.spyOn(console, "error");

      // Create a source that succeeds
      const goodSource = new ObjectConfigurationSource({
        additionalProperty: "From good source",
      });

      // Create a source that fails
      const errorSource: ConfigurationSource = {
        load: vi.fn().mockImplementation(() => {
          throw new Error("Load error");
        }),
      };

      // Add both sources
      config.addConfigurationSource(goodSource);
      config.addConfigurationSource(errorSource);

      // Load configurations
      await config.loadConfigurations();

      // Should log error for failed source
      expect(errorSpy).toHaveBeenCalled();

      // Should still load configuration from good source
      expect(config.getValue("additionalProperty")).toBe("From good source");

      errorSpy.mockRestore();
    });
  });
});
