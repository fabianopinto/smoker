import { Given, Then, When } from "@cucumber/cucumber";
import { strictEqual } from "node:assert";
import { updateConfig } from "../../src/support";
import type { SmokeWorld } from "../../src/world";

Given("a target named {string}", function (this: SmokeWorld, userTarget: string) {
  this.setTarget(userTarget);
});

Given("a target with an empty name", function (this: SmokeWorld) {
  this.setTarget("");
});

When("I generate a phrase", function (this: SmokeWorld) {
  this.generatePhrase();
});

Then("I should get {string}", function (this: SmokeWorld, expectedPhrase: string) {
  strictEqual(this.getPhrase(), expectedPhrase);
});

// Additional step definitions for configuration
Given("the phrase is set to {string}", function (phrase: string) {
  updateConfig({ defaultPhrase: phrase });
});

Given("the phrase template is set to {string}", function (template: string) {
  updateConfig({ phraseTemplate: template });
});
