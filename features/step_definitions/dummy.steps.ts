import { Given, Then, When } from "@cucumber/cucumber";
import { logger } from "../../src/lib";
import { type SmokeWorld } from "../../src/world/world";

Given("a target named {string}", function (this: SmokeWorld, userTarget: string) {
  logger.info(`--${this.constructor.name}--a target named ${userTarget}==`);
  this.setProperty("p1", "102");
  logger.info(`--${this.constructor.name}--a target named ${userTarget}==2==`);
});

Given("a target with an empty name", function (this: SmokeWorld) {
  logger.info(`--${this.constructor.name}--a target with an empty name==`);
});

When("I generate a phrase", function (this: SmokeWorld) {
  logger.info(`--${this.constructor.name}--I generate a phrase==`);
});

Then("I should get {string}", function (this: SmokeWorld, expectedPhrase: string) {
  logger.info(`--${this.constructor.name}--I should get ${expectedPhrase}==`);
});

Given("the phrase is set to {string}", function (this: SmokeWorld, phrase: string) {
  logger.info(`--${this.constructor.name}--the phrase is set to ${phrase}==`);
});

Given("the phrase template is set to {string}", function (this: SmokeWorld, template: string) {
  logger.info(`--${this.constructor.name}--the phrase template is set to ${template}==`);
});
