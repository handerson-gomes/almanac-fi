# 046 — Resumable workflow engine

## Story

As a user, I can start, answer, pause, resume, and inspect approval-aware financial workflows.

## Requirements

Implement workflow definitions/versioning, persisted state, typed steps, input collection, calculation/skill/tool steps, approval waits, idempotency, retry/resume semantics, and run APIs.

## Acceptance criteria

A paused run resumes after restart; workflow version and calculation/skill versions are recorded; state transitions are auditable; retries do not duplicate writes.

## Dependencies

006, 007, 039, 040, 042a, 045

## Verification

Run restart, approval, retry, and idempotency workflow integration tests.

## Status

Deferred
