# 047 — AI and workflow observability

## Story

As a user, I can inspect how the system executed while trace privacy remains controlled.

## Requirements

Instrument AI, tool, capability, workflow, calculation, approval, connector, and MCP spans; implement documented attributes, trace/run linking, metadata-only defaults, and coverage labels for embedded vs external-hosted runs.

## Acceptance criteria

Spans use the allowed attributes only under metadata-only; run views link to trace IDs; external MCP sessions state unavailable visibility honestly; tests inspect exported spans.

## Dependencies

014, 023, 044, 045, 046

## Verification

Use an in-memory exporter to test span trees and redaction.

## Status

Deferred
