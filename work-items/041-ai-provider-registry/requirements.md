# 041 — AI provider registry

## Story

As a user, I can configure whichever supported model provider I have access to.

## Requirements

Implement provider abstraction and registry for OpenAI, Anthropic, Google, and OpenAI-compatible endpoints, configuration validation, model discovery/normalization, and fake provider for tests.

## Acceptance criteria

No feature imports a vendor SDK directly; unconfigured providers are reported safely; provider credentials stay in SecretStore/config; fake provider supports deterministic tests.

## Dependencies

003, 015, 040

## Verification

Test provider registration, capability normalization, and missing-config states.

## Status

Not started
