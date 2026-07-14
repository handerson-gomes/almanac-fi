# 060 — Backup, restore, and data portability

## Story

As a user, I can make verified local backups and restore/export my financial data without losing provenance.

## Requirements

Implement consistent SQLite/raw-file backup, manifest/checksum, safe restore into a stopped/new data home, version compatibility checks, export formats, and restore UI/CLI flows.

## Acceptance criteria

Backups include required raw provenance and exclude/refer to secrets safely; restore is verified before replacement; a round trip preserves data/audit integrity.

## Dependencies

003, 006, 059

## Verification

Run backup/restore round trips with fixture database and corrupted archive tests.

## Status

Not started
