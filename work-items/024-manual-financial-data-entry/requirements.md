# 024 — Manual financial data entry

## Story

As a user, I can record and correct authoritative financial actuals without relying on a connector.

## Requirements

Provide validated manual-entry capabilities, routes, and UI for institutions, accounts, dated balances, transactions and splits, and categories. Every record must use explicit `manual` provenance, preserve revision and audit history, and share the same typed constraints used by imported data.

## Acceptance criteria

Manual entries obey the same money, currency, institution, account-classification, category, and effective-date constraints as imported records. Corrections never erase provenance, and manual actuals participate in snapshots, reconciliation, and deterministic calculations exactly once.

## Dependencies

006, 016a, 017, 018

## Verification

Run manual create/correct audit, provenance, balance-as-of, split reconciliation, and calculation-inclusion tests.

## Status

Complete
