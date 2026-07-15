# 032 — Authoritative financial state and available-funds snapshot

## Story

As a user, I can see a consistent as-of picture of the money, assets, and obligations that actually exist without mixing in forecast income.

## Requirements

Implement a versioned, read-only financial-state snapshot that aggregates institution/account ownership, latest dated balances, institution-reported available balances, current transactions, confirmed transfers, investment valuations, liabilities, required payments, budget actuals, and data-quality warnings. Define explicit current-balance, available-balance, liquid/spendable-funds, and net-worth fields with account inclusion rules, currency scope, calculation version, and data-as-of metadata.

Generic household facts and future forecast records must not contribute monetary values to this snapshot.

## Acceptance criteria

Snapshot totals reconcile to their authoritative records; transfers do not inflate inflows or outflows; future income is excluded from current available funds; missing or stale balances and valuations remain explicit warnings; every total identifies its currency, included accounts, calculation version, and data-as-of timestamp.

## Dependencies

016a, 017, 024, 025, 026, 028a, 028b, 029, 030

## Verification

Run cross-check fixtures for cash, credit, investment, liability, stale-balance, transfer, multi-currency, and missing-valuation cases against repository totals and budget output.

## Status

Not started
