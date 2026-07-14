# 061 — Production SecretStore integrations

## Story

As a packaged-app user, connector/provider secrets can use OS-backed storage rather than plain files.

## Requirements

Implement encrypted local-file and OS-keychain SecretStore providers, migration from environment development values, availability diagnostics, and fallback policy.

## Acceptance criteria

Secrets are encrypted/keychain-backed at rest where supported; unavailable secure storage requires explicit user-visible decision; migration never logs values.

## Dependencies

015, 022, 041, 059

## Verification

Test providers with fakes and migration/error paths.

## Status

Not started
