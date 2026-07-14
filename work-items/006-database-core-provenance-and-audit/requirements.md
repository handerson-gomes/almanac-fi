# 006 — Core provenance and audit schema

## Story

As a user, I can trace normalized financial records back to immutable imports and see material changes.

## Requirements

Add ImportBatch, SourceRecord, AuditEvent, calculation/run metadata, checksums, timestamps, and actor/source fields with append-only audit behavior.

## Acceptance criteria

Every normalized importable record can reference a source record; audit events preserve before/after references without exposing secrets; constraints are tested.

## Dependencies

005

## Verification

Run migration and provenance/audit integration tests.

## Status

Complete
