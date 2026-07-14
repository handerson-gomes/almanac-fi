# 024 — Manual financial data entry

## Story

As a user, I can add or correct local accounts, transactions, categories, and balances without a connector.

## Requirements

Provide validated manual-entry capabilities/routes and UI with explicit provenance source `manual`, audit events, correction behavior, and approval-ready write operations.

## Acceptance criteria

Manual entries obey the same money/category/account constraints as imports; edits leave audit history; manual data participates in all queries/calculations.

## Dependencies

006, 016, 017, 018

## Verification

Run manual create/edit audit and calculation-inclusion tests.

## Status

Not started
