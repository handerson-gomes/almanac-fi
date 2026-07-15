# 036 — Shared allocation ledger and constraint engine

## Story

As a user, I can see one authoritative monthly account of every future claim on cash flow and any shortfall before adopting a plan.

## Requirements

Implement a deterministic monthly cash-flow and allocation engine that combines authoritative opening state, forecast gross and net income, required obligations, reserves, budget funding, goal funding, planned investment contributions, withdrawals, and allocation rules. Materialize immutable, versioned monthly ledger entries with opening/closing balances, allocation basis, destination, priority, constraint level, funding status, remaining surplus or shortfall, input versions, and data-as-of metadata.

Apply hard obligations first, evaluate fixed and percentage rules against their declared bases, prevent duplicate claims and over-allocation, and expose conflicts without inventing missing inputs. No feature-specific reservation or forecast-balance store is allowed.

## Acceptance criteria

The same versioned inputs produce identical ledger rows; allocations never exceed available forecast cash without an explicit shortfall; a dollar is not allocated twice; hard, minimum, preferred, flexible, and residual ordering is deterministic; ledger totals reconcile to the monthly forecast and source rules; historical versions are immutable.

## Dependencies

005, 006, 007, 032, 034, 035

## Verification

Run multi-year fixtures covering sufficient and insufficient cash, required payments, fixed and percentage rules, competing goals, budget funding, residual surplus, missing inputs, duplicate claims, deterministic recomputation, and ledger reconciliation.

## Status

Not started
