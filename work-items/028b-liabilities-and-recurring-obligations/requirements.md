# 028b — Liabilities and recurring obligations

## Story

As a user, I can record debts and recurring contractual obligations so cash-flow forecasts and payoff scenarios are grounded in them.

## Requirements

Add liability/debt and recurring-obligation models with balances, rates, minimum payments, payment dates, effective dates, source/confidence, account links, manual CRUD, audit records, and read capabilities. Model unknown rates/terms explicitly rather than inventing values.

## Acceptance criteria

Debt payments flow into forecast inputs exactly once; effective-date changes retain history; invalid amortization/payment data is rejected; scenarios can override terms without altering the active record.

## Dependencies

016, 027, 024

## Verification

Run debt/obligation validation, historical effective-date, forecast-input, and scenario-isolation tests.

## Status

Not started
