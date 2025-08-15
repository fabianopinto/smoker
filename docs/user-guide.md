# User Guide

- Back to Docs Index: [index.md](index.md)
- Related: [Overview](overview.md), [Reference](reference.md)

## Contents

- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [Running in AWS](#running-in-aws)
- [Reporting & Monitoring](#reporting--monitoring)

## Configuration

Sources supported: Defaults, Local JSON, S3 JSON, Programmatic, Environment variables, CLI.

```mermaid
flowchart TD
  A[Defaults] --> M[Deep Merge]
  B[Local JSON] --> M
  C[S3 JSON] --> M
  D[Programmatic] --> M
  E[ENV Vars] --> M
  F[CLI Args] --> M
  M --> R[Final Runtime Config]
```

- External references: `ssm:/path`, `s3://bucket/key`, `config:path.to.value`, `property:name`.
- Deletion with `null` to remove keys.

Examples and details are consolidated from: `usage/configuration.md`.

## Running Locally

```bash
npm start -- --paths "dist/features/**/*.feature" --tags "@smoke" --logLevel debug
```

Key options: `--paths`, `--tags`, `--config`, `--timeout`, `--parallel`, `--format`.

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant CLI as Smoker CLI
  participant CFG as Config Resolver
  participant CUC as Cucumber Runner
  U->>CLI: smoker start --paths --tags --config
  CLI->>CFG: load+merge config
  CFG-->>CLI: resolved config
  CLI->>CUC: run features
  CUC-->>CLI: results
  CLI-->>U: summary + reports
```

## Running in AWS

AWS Lambda event, env var and IAM basics.

```mermaid
sequenceDiagram
  autonumber
  participant CI as CI/CD
  participant L as AWS Lambda
  participant CFG as Resolver
  participant S3 as S3 (Reports)
  participant CW as CloudWatch
  CI->>L: Invoke(event)
  L->>CFG: resolve config (S3/SSM/ENV)
  CFG-->>L: merged config
  L->>L: execute Cucumber
  alt publish reports
    L->>S3: put results
  end
  alt metrics
    L->>CW: put metrics
  end
  L-->>CI: response
```

## Reporting & Monitoring

- Reports: JSON, HTML, JUnit; store locally or in S3.
- Metrics: CloudWatch custom metrics (e.g., TestsTotal, TestsPassed, TestsFailed, Duration).

For step patterns and examples, see [Getting Started](getting-started.md) and [Reference](reference.md#world-api).
