# 049 — AI evaluation harness

## Story

As a contributor, I can run reproducible feature and model evaluations against synthetic fixtures.

## Requirements

Implement dataset schema, evaluator interface, fixture seeding, expected structured output/tool assertions, scoring/report format, CLI commands, and isolation from real providers by default.

## Acceptance criteria

Evaluations run offline with fakes; results identify feature/model/prompt/workflow/calculation versions; failures are machine-readable and do not leak financial data.

## Dependencies

013, 042, 045, 046

## Verification

Run a sample evaluation suite and validate report schema.

## Status

Not started
