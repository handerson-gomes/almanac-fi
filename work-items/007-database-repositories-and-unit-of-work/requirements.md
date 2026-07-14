# 007 — Repository and unit-of-work layer

## Story

As a feature author, I can persist domain data through tested interfaces rather than scattered SQL.

## Requirements

Define repository interfaces, a repository registry, transaction-scoped unit-of-work behavior, pagination/filter conventions, and SQLite implementations.

## Acceptance criteria

Feature code has no direct database-client dependency; related writes rollback atomically; repository contracts have integration tests.

## Dependencies

005, 006

## Verification

Test commit, rollback, and repository contract behavior.

## Status

Complete
