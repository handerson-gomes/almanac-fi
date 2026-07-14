# 026 — Income classification

## Story

As a user, I can identify recurring income separately from transfers and ordinary spending.

## Requirements

Implement deterministic income classification using category/rule/account context, confirmation state, recurring-income grouping, review queue, and summaries.

## Acceptance criteria

Transfers are never income; user confirmation supersedes inference; changes are auditable; classification behavior is covered by synthetic fixtures.

## Dependencies

017, 018, 025, 025a

## Verification

Run classification tests for salary, refunds, transfers, and ambiguous deposits.

## Status

Complete

## User experience impact

Users can see deposits separated into recurring income, refunds, transfers, and items needing review. Confirmed transfers never appear as income, recurring pay sources are grouped consistently, and a user-confirmed classification overrides future inference while remaining auditable.
