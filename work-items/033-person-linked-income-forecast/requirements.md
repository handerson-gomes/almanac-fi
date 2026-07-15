# 033 — Person-linked income sources and forecast schedules

## Story

As a user, I can define how each household member is expected to earn income so future cash-flow projections start from explicit, reviewable inputs.

## Requirements

Add typed income-source and income-schedule models linked to a household person. Support W-2, contractor, self-employment, bonus, investment, and other income components; fixed or variable behavior; gross amount; cadence; expected net amount or explicit withholding/deduction assumptions; effective dates; growth assumptions; variability bounds; confidence; source; and verification metadata.

Base compensation, bonuses, and materially different income streams must be separate schedules. Generate normalized expected monthly occurrences without using generic household facts as monetary inputs.

## Acceptance criteria

Every schedule has a person, currency, gross-income basis, cadence, effective period, and source. Expected net cash is either explicit, deterministically derived from typed assumptions, or unknown with a warning. Variable income retains low/expected/high values; overlapping incompatible schedules are rejected; annual and multi-year views aggregate the same monthly occurrences.

## Dependencies

004, 006, 007, 008, 027

## Verification

Run fixtures for fixed W-2 pay, contractor variability, midyear starts, raises, bonuses, unknown withholding, overlapping schedules, and monthly-to-five-year aggregation.

## Status

Not started
