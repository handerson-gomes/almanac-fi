# 043 — Scoped AI context builder

## Story

As a user, models receive only purpose-scoped, minimized financial context rather than raw database access.

## Requirements

Implement purpose/schema-driven context builders using snapshot/profile/goal data, sensitivity filtering, data-as-of/missing-information metadata, size limits, and context summaries.

## Acceptance criteria

AI execution has no unrestricted repository access; sensitive fields honor policy; context output is validated, inspectable, and tested for minimization.

## Dependencies

014, 027, 028, 032, 040, 042a

## Verification

Test context inclusion/exclusion for each purpose and privacy policy.

## Status

Not started
