# 062 — Security, privacy, and local-network hardening

## Story

As a user, the local app is safe by default and does not expose financial data unnecessarily.

## Requirements

Review and implement localhost binding/defaults, CORS/CSRF policy as applicable, security headers, input limits, log/trace redaction tests, dependency checks, data-file permissions, threat model, and disclosure policy.

## Acceptance criteria

No remote network binding occurs by default; sensitive endpoints/logs are tested; threat model documents residual risks; security checks run in CI.

## Dependencies

002, 014, 039, 047, 055, 061

## Verification

Run security regression tests and dependency/license scans.

## Status

Not started
