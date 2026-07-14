# 032 — Cash-flow and financial snapshot

## Story

As a user or tool caller, I can retrieve a consistent read-only snapshot of accounts, income, spending, budgets, goals, and data quality.

## Requirements

Implement versioned cash-flow, savings-rate, and snapshot calculations/capabilities with date ranges, data-as-of metadata, missing-data warnings, and API exposure.

## Acceptance criteria

Snapshot inputs are scoped and explicit; totals reconcile to transactions; transfer treatment is consistent; response is safe for AI context and MCP.

## Dependencies

017, 025, 026, 028, 029, 030

## Verification

Run cross-check tests between snapshot, transaction totals, and budget output.

## Status

Not started
