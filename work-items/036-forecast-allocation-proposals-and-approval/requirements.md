# 036 — Forecast allocation proposals and approval

## Story

As a user, I can review conflicts and trade-offs before a planner commits a new allocation and forecast version.

## Requirements

Implement the read-forecast/read-ledger/simulate/conflict-detect/propose/approve/commit workflow, approval records, optimistic version checks, and rollback by new version; expose APIs.

## Acceptance criteria

Accepted proposals create a new immutable forecast and ledger version; stale proposals cannot commit; conflicts explain affected goals/surplus; rejected proposals make no allocation write.

## Dependencies

006, 014, 033, 034, 035

## Verification

Integration-test approval, rejection, stale-version, conflict, and audit paths.

## Status

Not started
