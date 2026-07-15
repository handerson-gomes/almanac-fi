# 045 — AI tool orchestration and structured output

## Story

As a user, AI can call explicitly approved capabilities and return validated recommendation packages.

## Requirements

Implement capability-to-tool adapter, tool-call loop limits, structured-output validation/retry, recommendation output contract, proposal-required write routing, and tool-result redaction.

## Acceptance criteria

Tool inputs/outputs are schema-validated; unsupported writes require approval proposals; invalid structured output cannot be presented as valid; recommendation includes facts, assumptions, calculations, risks, and missing information.

## Dependencies

039, 040, 043, 044

## Verification

Test valid, invalid, over-limit, and proposal-write tool runs.

## Status

Deferred
