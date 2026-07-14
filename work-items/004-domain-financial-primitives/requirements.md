# 004 — Financial domain primitives

## Story

As a developer, I can represent money and time consistently without floating-point errors.

## Requirements

Provide branded/value types and Zod schemas for integer minor-unit money, ISO currency, dates, IDs, percentages, and explicit transaction sign conventions.

## Acceptance criteria

All authoritative money APIs reject floats; currency is explicit; serialization is stable; tests cover negative, zero, rounding, and multi-currency cases.

## Dependencies

001

## Verification

Unit-test schemas and value operations.

## Status

Complete
