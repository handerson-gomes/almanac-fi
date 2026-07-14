# 033 — Scenario model and comparison

## Story

As a user, I can create isolated hypothetical scenarios without changing the active household plan.

## Requirements

Add Scenario and ScenarioAssumption persistence, scenario fork/base-version links, active-plan distinction, comparison capability/API, and scenario management UI.

## Acceptance criteria

Hypothetical writes cannot alter active plan; scenario changes retain source/version; comparisons identify changed assumptions; rollback/delete semantics are defined.

## Dependencies

006, 027, 028, 032

## Verification

Test active versus hypothetical isolation and comparison output.

## Status

Not started
