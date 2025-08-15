# Development

- Back to Docs Index: [index.md](index.md)
- Related: [Reference](reference.md), [User Guide](user-guide.md)

## Contents

- [Architecture & Standards](#architecture--standards)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Release Process](#release-process)

## Architecture & Standards

- Separation of concerns, interface-driven design, dependency injection, and type safety.
- Use barrel files for clean exports.
- Error model: use `SmokerError` with `code`, `domain`, `details`, `retryable`, `cause`.
- Logger: shared Pino logger from `src/lib/logger.ts`; prefer structured logs.

See detailed examples in [Logger](reference.md#logger) and [Errors](reference.md#errors).

## Testing

Adopt the standard test style:

- File headers with JSDoc
- Imports: one group, alphabetized, inline type imports
- Nested describes per Class/method; test names `should [behavior] when [condition]`
- Fixtures via `TEST_FIXTURES` at top
- `beforeEach` resets mocks; `afterEach` cleanup
- Assert promises via `await expect(...).resolves/rejects`
- AWS SDK v3: use `aws-sdk-client-mock` with command-level mocks

Run tests:

```bash
npx vitest run
npx vitest run test/clients/aws/aws-cloudwatch-metrics.test.ts
npx vitest run --testNamePattern="RestClient"
```

## CI/CD

- GitHub Actions or CodePipeline can invoke Lambda-based smoke tests.
- Typical steps: install, build, package, deploy Lambda, invoke with tags/config, publish metrics, store reports in S3.

## Release Process

- Version with SemVer
- Update CHANGELOG
- Ensure tests, coverage, lint and type checks pass
