# 002 — Quality gates and CI

## Story

As a contributor, I receive fast, consistent feedback before changes are merged.

## Requirements

Configure ESLint, Prettier, Vitest base config, coverage policy, commit-safe scripts, and CI for install, lint, typecheck, unit tests, and build.

## Acceptance criteria

CI runs on a clean checkout; root commands have documented exit behavior; generated artifacts and secrets are ignored.

## Dependencies

001

## Verification

Run the CI commands locally in a clean install.

## Status

Complete
