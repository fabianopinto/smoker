/**
 * Configuration for the cucumber tests
 * This provides a centralized location for all configurable parameters
 */

export interface SmokeConfig {
  defaultPhrase: string;
  phraseTemplate: string;
}

export class Configuration {
  private static instance: Configuration;
  private config: SmokeConfig;

  private constructor() {
    // Default configuration
    this.config = {
      defaultPhrase: "Smoking",
      phraseTemplate: "{phrase} {target}!",
    };
  }

  /**
   * Gets the singleton instance of the Configuration
   */
  public static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }

  /**
   * Gets the current configuration
   */
  public getConfig(): SmokeConfig {
    return this.config;
  }

  /**
   * Updates the configuration
   */
  public updateConfig(partialConfig: Partial<SmokeConfig>): void {
    this.config = {
      ...this.config,
      ...partialConfig,
    };
  }
}

/**
 * Helper function to access the configuration
 */
export function getConfig(): SmokeConfig {
  return Configuration.getInstance().getConfig();
}

/**
 * Helper function to update the configuration
 */
export function updateConfig(partialConfig: Partial<SmokeConfig>): void {
  Configuration.getInstance().updateConfig(partialConfig);
}
