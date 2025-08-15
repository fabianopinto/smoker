# Getting Started

- Back to Docs Index: [index.md](index.md)
- Next: [User Guide](user-guide.md)

## Installation

Prerequisites: Node.js 22+, npm, AWS CLI (optional).

```bash
npm install
npm run build
```

## Quickstart

Create a minimal feature and run it.

```gherkin
Feature: API Health Check
  Scenario: Verify API is responding
    Given I have a REST client configured for "https://api.example.com"
    When I send a GET request to "/health"
    Then the response status should be 200
```

```bash
npm run build
npm start -- --paths "dist/features/your-test.feature"
```
