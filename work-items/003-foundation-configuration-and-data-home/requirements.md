# 003 — Configuration and local data home

## Story

As a local user, I can configure the app safely and know where its data is stored.

## Requirements

Implement Zod-validated configuration, `.env.example`, environment precedence, app-data directory resolution, directory creation, and safe startup diagnostics.

## Acceptance criteria

Invalid configuration fails with actionable errors; defaults keep data local; no real secret values appear in logs or examples.

## Dependencies

001, 002

## Verification

Test valid defaults, invalid values, and data-directory creation.

## Status

Complete
