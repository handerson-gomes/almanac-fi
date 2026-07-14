# 042a — Versioned methodology knowledge base

## Story

As a contributor, I can provide dated, jurisdiction-aware financial methodology that workflows cite without confusing it with the user's facts.

## Requirements

Implement Markdown/YAML knowledge-entry loading, metadata schema, version/effective-date and jurisdiction resolution, source-quality metadata, feature/topic tags, validation, read capability, and contributor authoring documentation. Keep methodology separate from SQLite household information and do not encode jurisdiction-specific guidance as universal fact.

## Acceptance criteria

An entry includes ID, effective/reviewed dates, jurisdiction, source quality, and applicable topics; resolution is deterministic for a date/jurisdiction; workflows/context can cite resolved versions; invalid or stale entries produce warnings.

## Dependencies

005, 007, 014, 040

## Verification

Run loader/validator tests for version selection, jurisdiction filtering, stale guidance, and privacy-safe capability output.

## Status

Not started
