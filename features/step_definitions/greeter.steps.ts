import { Given, When, Then } from "@cucumber/cucumber";
import { greet } from "../../src/lib/greeter";
import assert from "node:assert";

let name: string;
let greeting: string;

Given("a user named {string}", function (userName: string) {
  name = userName;
});

Given("a user with an empty name", function () {
  name = "";
});

When("I generate a greeting", function () {
  greeting = greet(name);
});

Then("I should get {string}", function (expectedGreeting: string) {
  assert.strictEqual(greeting, expectedGreeting);
});
