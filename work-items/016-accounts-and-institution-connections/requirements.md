# 016 — Accounts and institution connections

## Story

As a user, I can store accounts and their non-secret institution connection metadata.

## Requirements

Add schemas, migrations, repositories, CRUD capabilities/routes, and UI for account type, currency, status, institution metadata, balances, and connection state.

## Acceptance criteria

Account identities are stable; balance timestamps are retained; connection secrets are referenced only by secret key; validation covers account types/currencies.

## Dependencies

004, 005, 007, 008, 009, 010, 015

## Verification

Run account CRUD integration tests and UI smoke tests.

## Status

Complete
