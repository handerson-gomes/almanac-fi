# 048 — AI Workbench

## Story

As a user, I can inspect and compare AI/workflow runs, tools, approvals, validation, calculations, errors, and trace coverage.

## Requirements

Build run list/detail, privacy-aware payload display, prompt/skill/workflow/calculation version displays, token/latency data, trace links, and multi-model comparison UI.

## Acceptance criteria

The UI never displays fields prohibited by current content policy; unknown external-host information is shown as unavailable; comparison preserves identical deterministic results.

## Dependencies

010, 042, 044, 045, 046, 047

## Verification

Run UI tests for metadata-only, redacted, and external-host states.

## Status

Not started
