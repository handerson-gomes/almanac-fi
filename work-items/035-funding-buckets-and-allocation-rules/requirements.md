# 035 — Funding buckets and allocation rules

## Story

As a user, I can express how future cash should be directed into recurring budgets, dated goals, reserves, investments, and an unallocated buffer.

## Requirements

Add typed funding-bucket and allocation-rule models. A destination must reference a budget, goal, reserve, investment contribution, or explicit unallocated buffer. Rules support fixed minor-unit amounts or percentages; gross-income, expected-net-income, or remaining-cash percentage bases; cadence; effective dates; priority; hard, minimum, preferred, flexible, or residual constraint levels; optional minimum/maximum amounts; and source/destination accounts where applicable.

Keep funding allocation distinct from investment asset allocation. Define how hierarchical budget categories and accumulating goals participate without treating a budget as a goal or a goal as a recurring expense.

## Acceptance criteria

Every percentage declares its basis; every rule has one typed destination and currency policy; invalid date ranges, references, percentages, and constraint combinations are rejected; hard obligations and residual rules have unambiguous semantics; generic facts and free-form instructions cannot create monetary allocations.

## Dependencies

004, 006, 007, 008, 028, 028a, 028b, 030, 033

## Verification

Run rule-validation fixtures for fixed amounts, each percentage basis, nested budget buckets, goal funding, investment contributions, effective-date changes, minimum/maximum bounds, residual funding, and invalid combinations.

## Status

Not started
