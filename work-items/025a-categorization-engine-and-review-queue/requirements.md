# 025a — Categorization engine and review queue

## Story

As a user, I receive deterministic category suggestions first and can review only the ambiguous transactions, with optional AI assistance later.

## Requirements

Implement merchant normalization and a layered categorization service: source category, exact user rule, merchant rule, confirmed historical decision, optional statistical classifier, optional AI suggestion, and user confirmation. Persist method, confidence, rule reference, and confirmation metadata. Build a review queue with batch actions and a capability/API surface; the optional AI stage must be disabled unless explicitly invoked.

## Acceptance criteria

Precedence is deterministic and testable; confirmed user decisions override all suggestions; every suggestion explains method/confidence; queue actions are audited and do not send transactions to a remote model by default; confirmed decisions can create/update local rules.

## Dependencies

017, 018, 025

## Verification

Run fixtures for rule hits, merchant normalization, historical matches, ambiguous reviews, transfer exclusion, and an explicitly enabled fake-AI suggestion.

## Status

Complete

## User experience impact

Users receive explainable local category suggestions in a predictable order and can focus on a queue of transactions that still need review. They can confirm or dismiss items in batches, preserve their decisions for future matching, and optionally create a merchant rule; AI suggestions remain off unless explicitly requested.
