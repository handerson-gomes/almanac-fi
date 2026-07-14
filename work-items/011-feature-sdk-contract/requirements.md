# 011 — Feature SDK contract

## Story

As a contributor, I can define a build-time feature module with clear capabilities and permissions.

## Requirements

Implement FeatureModule/Manifest schemas, registration context, contribution registries, permission declarations, compatibility validation, and developer documentation.

## Acceptance criteria

An invalid manifest fails at startup; a feature can register a calculation, route, MCP contribution, and dashboard contribution through one contract.

## Dependencies

004, 007, 008, 009, 010

## Verification

Test valid and invalid feature registration fixtures.

## Status

Complete
