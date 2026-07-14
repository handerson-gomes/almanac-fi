# 063 — Distribution packaging

## Story

As a user, I can install or run the application through supported local distribution options.

## Requirements

Produce npm CLI packaging and Docker image, versioning/release process, data-volume guidance, image hardening, and smoke-test matrix; explicitly defer Electron unless separately approved.

## Acceptance criteria

Published artifacts start with local-safe defaults; Docker persists data correctly and does not embed secrets; version compatibility is documented.

## Dependencies

059, 060, 061, 062

## Verification

Build/run package and container smoke tests against a fixture.

## Status

Not started
