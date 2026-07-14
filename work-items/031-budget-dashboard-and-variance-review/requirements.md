# 031 — Budget dashboard and variance review

## Story

As a user, I can compare monthly planned and actual category spending and investigate significant variance.

## Requirements

Build budget overview/detail UI, category progress, variance visualizations, period comparison, transaction drill-down, uncategorized/transfer indicators, and accessible empty/error states.

## Acceptance criteria

Displayed totals match calculation results; all variance drill-downs use filtered transaction queries; no chart hides uncertainty/data-quality warnings.

## Dependencies

010, 017, 029, 030

## Verification

Run UI tests plus a fixture screenshot/data assertion suite.

## Status

Complete

## User experience impact

Users can open a monthly budget dashboard to compare planned and actual spending, scan category progress and variance, compare periods, and drill into the exact filtered transactions behind a number. Uncategorized spending and excluded transfers remain visible as data-quality indicators, with clear loading, empty, and error states.
