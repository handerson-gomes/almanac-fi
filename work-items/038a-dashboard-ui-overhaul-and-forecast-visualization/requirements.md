# 038a — Dashboard UI overhaul and forecast visualization

## Story

As a desktop user, I can understand my household's current financial position,
near-term commitments, allocation flow, history, and long-range active plan from a
modern, coherent dashboard before entering a specialized planning or AI workflow.

## Requirements

Implement the confirmed
[UI overhaul specification](../../thoughts/shared/specs/2026-07-21-ui-overhaul.md)
over the authoritative financial-state snapshot, income forecast, allocation
ledger, active plan, scenarios, and planned-versus-actual reconciliation completed
in work items 031–038.

Replace the peer-level administration navigation with Dashboard, Activity,
Planning, Review, and Settings. Keep the dashboard curated with limited
personalization. Move configuration and less-used operational workflows into the
specified Settings groups without making existing functionality unreachable.

The first dashboard viewport must show spendable funds, funds unallocated through
month-end, upcoming commitments, allocation flow, cash-flow context, and issues
requiring review. Provide variable timeframes appropriate to each view, including
near-term 7-, 30-, and 90-day commitments and 1-month through 10-year forecasts.
Show one active household plan by default with one optional, clearly hypothetical
scenario overlay.

Add deterministic, versioned read models and accessible visualizations for the
snapshot, commitment occurrences, observed cash flow, allocation Sankey, forecast
series, and net-worth history. Preserve observed-versus-forecast boundaries,
source provenance, freshness, missing inputs, partial periods, and calculation
versions. A synchronized table or equivalent textual representation must accompany
each chart where needed for accessibility and verification.

Dashboard loading and interaction must use database facts and deterministic
calculations only. It must not invoke an AI provider. Generated explanation begins
only in a separately named, user-initiated workflow.

The package ownership, task IDs, dependencies, execution waves, and recommended
pull-request slices are defined in the
[package task breakdown](../../thoughts/shared/plans/2026-07-21-ui-overhaul-package-breakdown.md).

## Acceptance criteria

- Using the representative fixture, a user can identify within 60 seconds:
  spendable funds now, unallocated funds through month-end, where money is
  allocated, upcoming commitments, whether the active plan is sustainable, and
  what requires attention.
- Current money and forecast money remain visually, semantically, and
  computationally distinct.
- Allocation-flow totals reconcile to source records and the shared ledger, with
  automated proof that no dollar is counted twice.
- Active and scenario data remain version-isolated; identical versioned inputs
  produce identical series.
- Stale, missing, partial, unresolved, and low-confidence data retain timestamps
  and explicit warnings rather than silent estimates.
- Existing workflows remain reachable under the new information architecture or
  have intentional redirects.
- Primary dashboard and Review tasks work with keyboard and screen-reader output;
  chart meaning does not rely on color alone.
- Desktop widths are the primary experience, with a limited snapshot and Review
  experience at narrow widths.
- No dashboard request or render invokes a model-provider endpoint.
- The full workspace quality gate passes.

## Dependencies

023a, 031, 032, 034, 036, 037, 038

## Verification

Run deterministic calculation tests, repository and HTTP integration tests,
frontend state/component tests, end-to-end fixture journeys, automated
accessibility checks, visual checks at the specified widths, and performance
profiling for snapshot, history, allocation, and 10-year forecast reads.

Run `pnpm check` from the workspace root before completion. The detailed
package-specific commands and global definition of done are in the package task
breakdown.

## Status

Not started
