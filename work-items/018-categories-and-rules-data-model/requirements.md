# 018 — Categories and categorization-rule data model

## Story

As a user, I can maintain a category hierarchy and deterministic categorization rules.

## Requirements

Add category tree, active/archive state, rule schema, ordering/precedence, rule ownership, CRUD capabilities/routes, and management UI.

## Acceptance criteria

Cycles are rejected; archived categories are handled predictably; rule precedence is deterministic; rules are independently testable.

## Dependencies

005, 007, 008, 010, 017

## Verification

Test hierarchy validation and ordered rule evaluation.

## Status

Complete
