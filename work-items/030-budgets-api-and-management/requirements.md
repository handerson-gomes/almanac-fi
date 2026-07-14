# 030 — Budget APIs and management

## Story

As a user, I can create monthly budget periods and category targets.

## Requirements

Add Budget, BudgetPeriod, and BudgetLine persistence/repositories, proposal-safe CRUD capabilities/routes, cloning, and validation around period/currency/category coverage.

## Acceptance criteria

Duplicate active period definitions are prevented; target changes are audited; API responses use calculation-compatible schemas; period cloning is deterministic.

## Dependencies

006, 007, 008, 018, 029

## Verification

Run budget CRUD, cloning, and audit integration tests.

## Status

Complete

## User experience impact

Users can create reusable budgets, define draft or active monthly periods, and set category targets in schemas that feed directly into budget calculations. They can clone a prior period to start the next month, while duplicate active periods are prevented and every target change is auditable.
