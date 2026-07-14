# 021 — CSV mapping wizard

## Story

As a user, I can preview a CSV, map columns, configure signs, and save a reusable mapping before importing.

## Requirements

Build accessible mapping UI with sample rows, field mapping, date formats, amount-sign configuration, validation errors, preview, confirmation, and saved mapping management.

## Acceptance criteria

The user cannot commit an invalid mapping; preview totals match committed totals; saved mappings can be reused and edited; cancellation has no writes.

## Dependencies

010, 020

## Verification

Run component/E2E tests through preview, commit, and saved mapping reuse.

## Status

Complete
