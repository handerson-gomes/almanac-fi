# 034 — Shared monthly forecast engine

## Story

As every planner, I can read one immutable, versioned household cash-flow forecast.

## Requirements

Implement monthly timeline input aggregation and deterministic projection of income, essential/discretionary expenses, taxes, debt, investments, withdrawals, allocations, opening/closing balances, and allocatable surplus; persist immutable versions.

## Acceptance criteria

Forecast output is versioned with inputs/data-as-of; a recomputation with the same inputs matches exactly; features cannot mutate balances directly; missing assumptions yield warnings.

## Dependencies

004, 007, 026, 028, 028b, 032, 033

## Verification

Run deterministic projection fixtures and immutability tests.

## Status

Not started
