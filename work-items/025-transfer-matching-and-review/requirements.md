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

Complete

## User experience impact

Users can scan for likely transfers between their accounts, review exact, partial, or ambiguous candidates, confirm or reject a match, and undo a confirmed match. Only confirmed pairs are excluded from income and spending reports, and every review decision is retained in the audit history.
