# 025 — Transfer matching and review

## Story

As a user, internal transfers do not inflate income or spending and uncertain matches are reviewable.

## Requirements

Implement deterministic transfer candidate detection, matching states, user review/confirm/unmatch actions, matched-pair links, and reporting exclusions.

## Acceptance criteria

Confirmed transfers are excluded from income/spending totals; unmatched candidates are not silently classified as transfers; every decision is auditable and reversible.

## Dependencies

006, 017, 024

## Verification

Test exact, partial, ambiguous, and reversal transfer cases.

## Status

Not started
