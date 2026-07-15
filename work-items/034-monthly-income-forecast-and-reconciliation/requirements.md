# 034 — Monthly income forecast and actual-income reconciliation

## Story

As a user, I can compare expected income with deposits that actually arrived and see a trustworthy income forecast from next month through five years.

## Requirements

Implement deterministic monthly income projection from typed income schedules and reconcile expected occurrences with transaction income classifications. Persist immutable forecast runs and explicit match records containing expected gross/net amounts, observed deposits, variance, match method, confidence, review state, input version, and data-as-of metadata.

Support next-month, six-month, one-year, and five-year views by selecting or aggregating the same monthly forecast rows. User-confirmed matches override inference without changing the source schedule or transaction.

## Acceptance criteria

Transfers and refunds are never matched as earned income; fixed and variable sources produce reproducible monthly rows; unmatched expectations and unexplained deposits remain visible; gross, expected net, observed net, and variance are never conflated; identical versioned inputs produce identical output.

## Dependencies

017, 025, 026, 032, 033

## Verification

Run reconciliation fixtures for salary, contractor variance, bonus, split deposits, missing deposits, unrelated credits, refunds, transfers, user confirmation, and all supported horizons.

## Status

Not started
