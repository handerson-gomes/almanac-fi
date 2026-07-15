# 055 — MCP STDIO server foundation

## Story

As an external MCP host, I can start a local financial MCP server with a clear, secure capability boundary.

## Requirements

Create the MCP app/CLI entry point using STDIO, lifecycle/error protocol handling, feature contribution registration, server metadata/versioning, and no HTTP exposure by default.

## Acceptance criteria

The server launches via documented command; malformed requests do not crash it; only registered capabilities are visible; no arbitrary SQL/filesystem tools exist.

## Dependencies

001, 040, 047

## Verification

Run MCP inspector/protocol smoke tests.

## Status

Deferred
