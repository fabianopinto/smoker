import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { dummy } from "../../src/lib/dummy";
import { getConfig, updateConfig } from "../../src/support/config";

describe("Dummy function", () => {
  // Store original config to restore after tests
  let originalPhrase: string;
  let originalTemplate: string;
  
  beforeEach(() => {
    // Store original values
    const config = getConfig();
    originalPhrase = config.defaultPhrase;
    originalTemplate = config.phraseTemplate;
  });

  afterEach(() => {
    // Restore original configuration
    updateConfig({
      defaultPhrase: originalPhrase,
      phraseTemplate: originalTemplate
    });
  });

  it("should generate a phrase with the provided target", () => {
    const result = dummy("System");
    expect(result).toBe("Smoking System!");
  });

  it("should handle empty string target", () => {
    const result = dummy("");
    expect(result).toBe("Smoking !");
  });

  it("should handle special characters in target", () => {
    const result = dummy("System@123");
    expect(result).toBe("Smoking System@123!");
  });

  it("should use updated default phrase when configuration changes", () => {
    updateConfig({ defaultPhrase: "Testing" });
    const result = dummy("System");
    expect(result).toBe("Testing System!");
  });

  it("should use updated template when configuration changes", () => {
    updateConfig({ phraseTemplate: "{phrase} -> {target}" });
    const result = dummy("System");
    expect(result).toBe("Smoking -> System");
  });

  it("should handle both configuration changes at once", () => {
    updateConfig({
      defaultPhrase: "Testing",
      phraseTemplate: "{phrase} | {target}"
    });
    const result = dummy("System");
    expect(result).toBe("Testing | System");
  });
});
