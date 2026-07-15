# 037 — Active plan versioning and hypothetical scenarios

## Story

As a user, I can explore changes to income, budgets, goals, and funding rules without altering the accepted household plan.

## Requirements

Add immutable active-plan versions and isolated hypothetical scenarios that fork an explicit base version. Scenario changes may override typed income assumptions, budgets, goals, obligations, and allocation rules only within the scenario. Provide deterministic comparison, conflict simulation, apply-as-new-active-version, and rollback-by-new-version capabilities with optimistic base-version checks and audit records.

This is a user-facing core planning capability, not an agent proposal workflow. Generic proposal orchestration and automated planners remain deferred.

## Acceptance criteria

Scenario writes cannot change active records or ledger rows; comparisons identify every changed typed input and downstream monthly effect; stale scenarios cannot become active silently; applying a reviewed scenario creates new immutable plan, forecast, and ledger versions; deletion removes only the hypothetical scenario.

## Dependencies

006, 007, 008, 034, 035, 036

## Verification

Test active/hypothetical isolation, typed overrides, deterministic comparison, conflicts, stale-base rejection, apply-as-new-version, delete semantics, audit history, and rollback by new version.

## Status

Not started
