# Changelog

All notable changes to this project will be documented here.

## [Unreleased]
- Documentation
  - Introduced a simplified, consolidated documentation structure under `docs/` (overview, getting-started, user-guide, reference, development)
  - Added governance docs: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`

- Added
  - CloudWatch Metrics publishing and tests (`feat(cloudwatch)`)
  - Default configuration provider extracted (`DefaultConfigurationProvider`) and config/world integration improvements
  - Core utility modules (date, number, string, url, random, retry, object, env, obfuscation) and error codes, exposed via barrels
  - Dummy feature and step definitions for smoke testing

- Changed
  - World API: integrate `WorldProperties` and finalize API; remove legacy last* helpers in favor of property-based storage (BREAKING)
  - World API: remove typed client getters; standardize on `getClient` (BREAKING)
  - Refactor world to use `clientKey` helper for client name construction
  - Logger: replace console usage with Pino-based `BaseLogger`; resolve env at construction; provide default instance
  - Rename `src/index.ts` to `src/main.ts` and update references
  - Enforce Node.js 22+, add CloudWatch metrics dependency, and make postbuild cross‑platform

- Fixed
  - Retry utilities: stabilize timer behavior; add trace/debug logs
  - Add type assertion for error handling in service client steps

- Tests
  - Stabilize exponential-jitter test with deterministic random and retried run
  - Increase coverage for S3 error paths, `SmokerError` JSON/defaults, and config logging
  - Clean up support tests and tidy imports; remove unused SSM mock helper

- Docs
  - Standardize Mermaid diagrams and switch to top-down flow
  - Remove architecture diagram from README overview
