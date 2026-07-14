# 014 — Telemetry foundation and privacy policy

## Story

As a user, I can keep observability metadata-only by default while developers have vendor-neutral instrumentation.

## Requirements

Implement telemetry initialization before app loading, OTLP configuration, content-policy enum, redaction utilities, safe attribute allowlist, no-op mode, and span helper API.

## Acceptance criteria

Default traces omit financial content; redacted/full modes require explicit settings; exporters can be disabled with no behavior change.

## Dependencies

003, 004, 009

## Verification

Test span attributes for each content policy and disabled mode.

## Status

Complete
