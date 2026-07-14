# 035 — Shared allocation ledger

## Story

As every planner, I can see authoritative future claims on cash flow before proposing more funding.

## Requirements

Implement allocation records and monthly schedules linked to goals, feature, scenario, priority tier, funding strategy, constraint level, funding status, and version history; expose read capability.

## Acceptance criteria

No feature-specific reservation store is introduced; records enforce valid goal/scenario/version references; ledger totals reconcile to forecast allocation inputs.

## Dependencies

005, 007, 028, 033, 034

## Verification

Run ledger integrity, version-history, and reconciliation tests.

## Status

Not started
