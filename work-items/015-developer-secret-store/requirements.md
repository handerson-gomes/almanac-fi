# 015 — Development SecretStore

## Story

As a contributor, I can use environment-backed secrets through one interface without putting them in ordinary data tables.

## Requirements

Implement SecretStore interface, environment implementation, secret-key naming/validation, redacted diagnostics, and fake test implementation.

## Acceptance criteria

Secrets are never returned in logs/errors; application services depend on the interface; tests prove database schemas do not contain connector credential values.

## Dependencies

003, 007

## Verification

Run secret-store tests and inspect startup diagnostics.

## Status

Complete
