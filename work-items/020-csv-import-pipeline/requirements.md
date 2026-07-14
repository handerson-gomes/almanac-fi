# 020 — CSV connector and normalization pipeline

## Story

As a user, I can import a mapped CSV file into a selected account using the shared ingestion model.

## Requirements

Implement CSV connector capabilities, parser, mapping schema, date/amount/currency normalization, account selection, preview result, and commit through ImportBatch.

## Acceptance criteria

Malformed rows are reported without silent coercion; imports use provenance/dedupe; mapping produces deterministic normalized transactions; no AI is required.

## Dependencies

004, 015, 016, 017, 019

## Verification

Run fixture imports for multiple date/sign formats.

## Status

Complete
