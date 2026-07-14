# 009 — Fastify application shell

## Story

As a local user, I can start a health-checked HTTP API with feature-ready registration points.

## Requirements

Create Fastify construction, config/database lifecycle wiring, health/readiness routes, request logging/redaction, graceful shutdown, and route registration API.

## Acceptance criteria

The server starts with no financial features; health and readiness behave deterministically; startup/shutdown and error handling are tested.

## Dependencies

003, 005, 008

## Verification

Run server integration and graceful shutdown tests.

## Status

Complete
