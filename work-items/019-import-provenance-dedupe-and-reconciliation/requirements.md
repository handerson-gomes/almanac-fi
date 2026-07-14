# 019 — Import provenance, deduplication, and reconciliation

## Story

As a user, repeated or corrected imports do not duplicate spending and remain explainable.

## Requirements

Implement import batch lifecycle, raw source retention, provider identity/checksum dedupe, idempotent upsert, pending-to-posted reconciliation, correction handling, and import results.

## Acceptance criteria

Re-running the same import is idempotent; corrected source records preserve history; duplicate decisions are auditable; failures leave no partial normalized data.

## Dependencies

006, 007, 016, 017

## Verification

Run duplicate, correction, and rollback integration fixtures.

## Status

Complete
