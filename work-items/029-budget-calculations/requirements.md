# 029 — Budget calculations

## Story

As a user, I receive reproducible budget usage and variance calculations for a period.

## Requirements

Implement versioned deterministic calculations for budget totals, actual categorized spending, remaining amount, variance, and transfer exclusions using minor units.

## Acceptance criteria

Same inputs give identical structured output; transfers are excluded; uncategorized handling is explicit; calculation IDs/versions are recorded.

## Dependencies

004, 017, 018, 025, 025a, 026

## Verification

Unit-test calculations against synthetic fixtures and edge periods.

## Status

Complete

## User experience impact

Users receive consistent planned-versus-actual totals for any budget period, including category usage, remaining amounts, and variance. Confirmed transfers are excluded, uncategorized spending is called out separately, and every result carries a stable calculation ID and version for reproducibility.
