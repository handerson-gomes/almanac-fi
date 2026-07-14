# 027 — Household profile and time-aware facts

## Story

As a user, I can record household members, dependents, and dated financial facts with source and confidence.

## Requirements

Add household/person/dependent entities plus flexible typed facts, effective dates, sources, confidence, sensitivity, verification metadata, CRUD, and profile UI.

## Acceptance criteria

Overlapping/invalid effective dates are rejected; facts retain history; sensitive facts are tagged; historical views resolve facts as-of a date.

## Dependencies

004, 005, 007, 008, 010

## Verification

Test fact effective-date resolution and profile CRUD.

## Status

Not started
