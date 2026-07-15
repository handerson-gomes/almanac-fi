# 044 — Embedded AI runtime

## Story

As a user, I can ask an in-app AI assistant to invoke configured providers with safe run metadata.

## Requirements

Implement run lifecycle, provider/model invocation, streaming interface, retry/error policy, prompt/skill version capture, invocation modes, and a local assistant API/UI entry point.

## Acceptance criteria

Runs record selected/actual model, timing, and safe metadata; failures are actionable and non-secret; provider switching does not change deterministic calculation results.

## Dependencies

014, 041, 042, 043

## Verification

Run fake-provider streaming, retry, and run-record tests.

## Status

Deferred
