# 023 — SimpleFIN sync and sync health

## Story

As a user, I can perform initial, rolling, and deep syncs and see what happened.

## Requirements

Implement account/transaction fetch, configurable date windows, normalization, idempotent import integration, balances refresh, retry-safe sync runs, error classification, and sync-health dashboard.

## Acceptance criteria

Initial, 60–90-day, and deep sync modes are supported; retries do not duplicate data; health reports last success, coverage, errors, and affected accounts.

## Dependencies

016, 017, 019, 022, 014

## Verification

Run mocked sync fixtures for pending/posting/correction and UI health states.

## Status

Deferred
