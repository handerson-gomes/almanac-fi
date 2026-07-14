# 039 — Generic financial change proposals and approval

## Story

As a user, I must explicitly approve financial writes proposed by AI or automation.

## Requirements

Implement reusable proposal/change-set model, diff rendering, expiration, approval/rejection/cancel state machine, actor attribution, capability access checks, and audit integration.

## Acceptance criteria

Write capabilities can require an approved proposal; no approval token is reusable outside its intended change; expired/stale proposals fail safely; audit records link decision and write.

## Dependencies

006, 007, 008, 014

## Verification

Test state transitions, authorization scopes, and atomic application.

## Status

Not started
