# 059 — Local CLI

## Story

As a technical user, I can operate setup, imports, sync, database migration, backups, evaluations, and MCP from a scriptable local CLI.

## Requirements

Implement CLI commands with validated flags, noninteractive-safe outputs, JSON mode where useful, confirmation prompts for destructive operations, exit codes, and shared application services.

## Acceptance criteria

CLI behavior matches capabilities/API rules; secrets are never printed; help and errors are actionable; commands work without dashboard.

## Dependencies

003, 020, 023, 049, 055

## Verification

Run CLI command integration tests and shell completion/help checks.

## Status

Deferred
