Feature: Smoke
  In order to address targets
  As a developer
  I want to have a configurable function that generates phrases

  # Default phrase scenario using World object
  Scenario: Smoke with a target
    Given a target named "System"
    When I generate a phrase
    Then I should get "Smoking System!"

  # Empty target scenario using World object
  Scenario: Smoke with an empty target
    Given a target with an empty name
    When I generate a phrase
    Then I should get "Smoking !"

  # Scenarios utilizing configuration capabilities
  Scenario: Smoke with custom phrase text
    Given the phrase is set to "Testing"
    And a target named "System"
    When I generate a phrase
    Then I should get "Testing System!"

  Scenario: Smoke with custom template
    Given the phrase template is set to "Testing {target}! It smokes."
    And a target named "System"
    When I generate a phrase
    Then I should get "Testing System! It smokes."

  Scenario: Smoke with both custom phrase and template
    Given the phrase is set to "Testing"
    And the phrase template is set to "{phrase} {target} to smoke."
    And a target named "System"
    When I generate a phrase
    Then I should get "Testing System to smoke."
