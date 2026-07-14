# 013 — Synthetic household fixtures

## Story

As a contributor, I can develop and test with realistic non-sensitive household data.

## Requirements

Create deterministic synthetic households covering income, transfers, budgets, dependents, goals, debt, investments, missing data, and import corrections; provide a fixture loader.

## Acceptance criteria

Fixtures contain no real-person data; each has documented intended scenarios; tests can seed a temporary database reproducibly.

## Dependencies

005, 006, 007

## Verification

Seed each fixture and validate referential integrity.

## Status

Complete
