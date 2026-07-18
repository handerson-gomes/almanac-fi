# 038 — Core planning dashboard and planned-versus-actual reconciliation

## Story

As a user, I can understand what exists now, what income is expected, how future cash is allocated, and where actual results differ from the active plan.

## Requirements

Build the core planning dashboard over the shared snapshot, income forecast, allocation ledger, and active/scenario versions. Show current and spendable funds, gross and expected-net income, required obligations, recurring budgets, goal funding, planned investments, monthly surplus/shortfall, data-quality warnings, and active-versus-scenario differences.

Add planned-versus-actual reconciliation for income occurrences, budget spending, goal contributions, debt payments, forecast balances, and observed balances. Every view and drill-down must declare period, data-as-of timestamp, currency, plan version, and unresolved or low-confidence matches.

## Acceptance criteria

Displayed totals reconcile to core capabilities; current funds and future cash are visually distinct; budgets and goals are labeled and measured differently; hypothetical scenarios cannot be mistaken for the active plan; warnings and conflicts are never hidden by charts; the dashboard owns no independent financial state.

## Dependencies

010, 031, 032, 034, 036, 037

## Verification

Run UI and API integration fixtures for fixed and variable income, multi-account actuals, budgets, multiple goals, shortfall, scenario comparison, low-confidence reconciliation, stale data, missing valuation, and accessible empty/error states.

## Status

Completed
