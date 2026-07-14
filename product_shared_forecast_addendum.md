# Update for product.md

This document is intended to be appended to the existing Product Definition.

# Architectural Invariant: Shared Forecast & Allocation Engine

> No planner owns future financial state. Every planner consumes the same versioned household forecast and proposes changes through a single shared allocation ledger.

This is a platform service, not a feature.

## Motivation

Every planning module (Vacation, Retirement, College, Vehicle, Home Purchase, Emergency Fund, etc.) must share one authoritative financial forecast.

Without this, independent planners can overcommit future income.

## Shared Monthly Forecast

Maintain a versioned monthly timeline containing:

- projected income
- projected essential expenses
- projected discretionary expenses
- taxes
- debt payments
- planned investment contributions
- planned withdrawals
- goal allocations
- opening balances
- closing balances
- remaining allocatable surplus

## Shared Allocation Ledger

Maintain one authoritative allocation ledger describing every future claim on cash flow.

Each allocation records:

- goal
- originating feature
- scenario
- priority tier
- funding strategy
- monthly allocations
- funding status
- version history

No feature may reserve funds outside this ledger.

## Read-before-write contract

Every planner must:

1. Read forecast
2. Read allocation ledger
3. Simulate proposal
4. Detect conflicts
5. Explain trade-offs
6. Request approval
7. Commit allocation
8. Generate new forecast version

## Allocation priorities

Recommended tiers:

1. Required obligations
2. Financial safety
3. Long-term critical
4. Time-bound major goals
5. Lifestyle goals
6. Residual investing

## Constraint levels

Allocations support:

- hard
- minimum
- preferred
- flexible
- residual

## Forecast versioning

Forecasts are immutable.

Every accepted proposal creates a new forecast version.

Benefits:

- auditability
- rollback
- scenario comparison
- reproducibility
- AI traceability

## Scenarios

Separate:

- Active household plan
- Hypothetical scenarios

Planners simulate inside scenarios before modifying the active plan.

## Dashboard

The planning dashboard should visualize:

- monthly allocation timeline
- goal funding
- remaining surplus
- forecast conflicts
- planned vs actual funding
- scenario comparison
- goal priorities

## Platform rule

Features may:

- read forecast
- read allocations
- propose allocations

Features may not:

- own forecast state
- persist independent projections
- reserve funds outside the shared allocation ledger
- mutate forecast balances directly

The shared forecast and allocation ledger become the central planning substrate for every current and future feature.
