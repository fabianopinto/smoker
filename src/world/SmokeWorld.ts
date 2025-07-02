/**
 * World object for the Smoke scenarios
 * This class maintains state between steps
 */
import { World, setWorldConstructor } from "@cucumber/cucumber";
import { dummy } from "../lib/dummy";

/**
 * Interface extending Cucumber's World with custom methods for smoke tests
 */
export interface SmokeWorldInterface extends World {
  setTarget(target: string): void;
  getTarget(): string;
  generatePhrase(): void;
  getPhrase(): string;
}

/**
 * Custom World object for Smoke tests
 */
export class SmokeWorld extends World implements SmokeWorldInterface {
  // Properties to store state between steps
  private target = "";
  private phrase = "";

  // No custom constructor needed as we're using the parent constructor

  /**
   * Sets the target
   */
  setTarget(target: string): void {
    this.target = target;
  }

  /**
   * Gets the target
   */
  getTarget(): string {
    return this.target;
  }

  /**
   * Generates a phrase based on the stored target
   */
  generatePhrase(): void {
    this.phrase = dummy(this.target);
  }

  /**
   * Gets the generated phrase
   */
  getPhrase(): string {
    return this.phrase;
  }
}

// Register the World constructor with Cucumber
setWorldConstructor(SmokeWorld);
