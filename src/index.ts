/**
 * Main entry point for the application
 *
 * @author Fabiano Pinto <fabianopinto@gmail.com>
 */

import { greet } from "./lib/greeter";

/**
 * Main function to demonstrate the greeter functionality
 * @returns {void}
 */
export function main(): void {
  const message = greet("World");
  console.info(message);
}

main();
