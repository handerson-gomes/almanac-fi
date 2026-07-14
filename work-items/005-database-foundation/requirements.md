# 005 — SQLite and migration foundation

## Story

As a developer, I can create, migrate, and query an isolated local SQLite database.

## Requirements

Configure Drizzle, migration execution, temporary test databases, connection lifecycle, transaction helper, and schema naming conventions.

## Acceptance criteria

A fresh database migrates from zero; migrations are ordered and reversible where practical; integration tests use isolated databases.

## Dependencies

001, 003, 004

## Verification

Migrate a fresh temporary database and run an integration query.

## Status

Complete
