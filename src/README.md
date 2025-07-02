# Cucumber.js Implementation Guide

## Project Structure

```
src/
├── support/           # Configuration management
│   └── config.ts      # Configuration system implementation
├── lib/               # Core business logic
│   └── dummy.ts       # Dummy functionality using configuration
└── world/             # Cucumber.js World implementation
    └── SmokeWorld.ts  # Custom World with interface for maintaining state between steps
```

## World Pattern

The World object in Cucumber.js is a container for state that's shared between steps in a scenario. In our implementation:

- `SmokeWorld` extends Cucumber's `World` class
- It maintains the target and phrase state between steps
- It provides methods to access and manipulate that state
- Step definitions use `this` to access the World object
- TypeScript interface declaration ensures proper typing

### Usage in Step Definitions

```typescript
Given("a target named {string}", function (this: SmokeWorld, userTarget: string) {
  this.setTarget(userTarget);
});
```

## Configuration Pattern

The configuration system provides a way to manage settings used across the application:

- Singleton pattern ensures consistent configuration throughout the test run
- Configuration values can be modified during test execution
- Step definitions can change configuration values
- Business logic accesses configuration through helper functions

### Usage in Features

```gherkin
Scenario: Phrase with custom phrase text
  Given the phrase is set to "Testing"
  And a target named "System"
  When I generate a phrase
  Then I should get "Testing System!"
```

### Usage in Step Definitions

```typescript
Given("the phrase is set to {string}", function (phrase: string) {
  updateConfig({ defaultPhrase: phrase });
});
```

### Usage in Business Logic

```typescript
export function dummy(target: string): string {
  const config = getConfig();
  return config.phraseTemplate
    .replace("{phrase}", config.defaultPhrase)
    .replace("{target}", target);
}
```

## Benefits

- **Separation of concerns**: Business logic in src/lib, World in src/world, Configuration in src/support
- **State management**: World object maintains state between steps
- **Configuration**: Settings can be changed during test execution
- **Type safety**: TypeScript interfaces ensure proper typing
- **Reusability**: World and configuration patterns can be reused across features
