# 017 — Transactions and splits

## Story

As a user, I can view normalized transactions and splits while preserving their source and accounting meaning.

## Requirements

Add transactions, transaction splits, pending/posted state, merchant/payee fields, dates, amount/currency, source links, immutable source identity, query filters, and list/detail UI.

## Acceptance criteria

Money signs follow the domain convention; split totals reconcile to parent transaction; source linkage is enforced; date/account/category queries are paginated and tested.

## Dependencies

004, 006, 007, 016

## Verification

Run transaction/split reconciliation and query contract tests.

## Status

Complete
