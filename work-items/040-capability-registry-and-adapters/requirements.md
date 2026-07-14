# 040 — Capability registry and interface adapters

## Story

As a developer, I implement financial behavior once and expose it consistently through API, CLI, embedded AI, MCP, and tests.

## Requirements

Implement typed Capability contract/registry, access modes/scopes, input/output validation, execution context, API adapter, test harness adapter, and registration checks.

## Acceptance criteria

Adapters cannot bypass schemas/access controls; identical capability inputs yield equivalent outputs across adapters; proposal-write behavior integrates with approvals.

## Dependencies

008, 011, 039

## Verification

Run cross-adapter contract tests with a sample capability.

## Status

Not started
