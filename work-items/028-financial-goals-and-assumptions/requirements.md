# 028 — Financial goals and assumptions

## Story

As a user, I can define dated goals and scenario assumptions with priority and funding constraints.

## Requirements

Add goal and assumption schemas, persistence, CRUD, priority tier, constraint level, funding strategy, linked dependents/accounts, and assumption-editor UI.

## Acceptance criteria

Goals have explicit target/currency/date/status; assumptions are time-aware and source-tagged; invalid priority/constraint combinations are rejected.

## Dependencies

004, 027

## Verification

Run goal/assumption validation and UI tests.

## Status

Complete

## User experience impact

Users can define dated financial goals with explicit amounts, currencies, priorities, funding constraints, and optional account or dependent links. They can also maintain source-tagged assumptions over time, so planning views use the values that apply to a chosen date without overwriting history.
