Feature: Greeter
  In order to greet users
  As a developer
  I want to have a function that generates greetings

  Scenario: Greeting a user
    Given a user named "Alice"
    When I generate a greeting
    Then I should get "Hello, Alice!"

  Scenario: Greeting with an empty name
    Given a user with an empty name
    When I generate a greeting
    Then I should get "Hello, !"
