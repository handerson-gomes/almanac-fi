# Almanac FI User Interface Overhaul Specification

**Status:** Confirmed for implementation planning  
**Date:** 2026-07-21  
**Branch:** codex/ui-overhaul-plan  
**Work item:** [038a — Dashboard UI overhaul and forecast visualization](../../../work-items/038a-dashboard-ui-overhaul-and-forecast-visualization/requirements.md)  
**Primary surface:** Desktop web application  
**Product references:** product.md, product_shared_forecast_addendum.md, branding.md, doc/system-structure.md

## Executive summary

Almanac FI will move from a collection of peer-level administration screens to a desktop-first financial command center. The home screen will answer, from authoritative local data and deterministic calculations, what funds are available now, what remains unallocated through month-end, where this period's money is going, which commitments are approaching, and whether the active household plan remains sustainable.

The redesign centers the shared forecast and allocation ledger without conflating present money with future cash. The active household plan is the default forecast. Hypothetical scenarios appear only as explicit comparison overlays. Model-generated interpretation is excluded from the default dashboard and begins only when the user enters a named AI workflow.

This is a cross-stack overhaul. It includes a new information architecture, a modern application shell, chart-ready server read models, deterministic aggregation changes, variable-timeframe controls, accessible visualizations, migration of current routes, and staged delivery.

## Problem statement

The current web application exposes eleven destinations as equal primary-navigation items. The overview shows API status, four current-state values, and expanded account tables. Planning, budgeting, transaction review, data connections, imports, categorization, and household configuration are separate screens without a coherent hierarchy.

This creates four problems:

1. Operational setup competes with financial understanding.
2. Current balances, monthly activity, future allocations, and scenarios are not presented as one understandable progression.
3. The user cannot quickly see the effect of upcoming commitments on available funds.
4. Existing forecast and allocation capabilities are presented primarily as forms and reconciliations rather than an intelligible time-based plan.

The redesign must make the system useful within a short daily or weekly review while retaining the precision, provenance, and extensibility expected by technically proficient users.

## Product goals

### Primary goals

- Present a useful financial snapshot within one screen.
- Distinguish current liquidity from future allocatable cash.
- Show how income and available cash are allocated across obligations, budgets, goals, investments, and remaining surplus.
- Make upcoming commitments understandable from seven days through long-range forecast horizons.
- Support history and forecast views with explicit, context-appropriate timeframes.
- Surface shortfalls, stale data, incomplete inputs, and reconciliation issues without inventing missing values.
- Preserve the active household plan as the authoritative default while making scenarios easy to compare.
- Reduce primary navigation to frequent user tasks.
- Move configuration and data plumbing into a structured Settings area.
- Keep all default dashboard content deterministic and local.

### Secondary goals

- Establish reusable chart, card, timeframe, freshness, and warning patterns.
- Make feature-contributed dashboard modules possible without turning the dashboard into a free-form canvas.
- Improve responsive behavior for snapshot and review tasks on smaller screens.
- Provide a migration path from the current routes without breaking bookmarks.

## Non-goals

- A fully featured mobile planning experience.
- A user-designed, drag-and-drop dashboard.
- Automatic AI summaries or recommendations on page load.
- Automated money movement, trading, or plan mutations.
- A replacement for the AI Workbench.
- Probabilistic financial values presented as authoritative.
- Investment asset-allocation modeling in the initial dashboard. Funding allocation is in scope; portfolio composition remains a separate future feature.
- Cloud hosting or multi-user collaboration changes.
- A public plugin marketplace.

## Users and operating context

The primary user is a technically proficient personal-finance user running Almanac locally on a desktop. They may be a developer, AI enthusiast, open-source contributor, or FIRE-oriented planner. They value inspectable calculations, explicit assumptions, data provenance, and dense but understandable information.

The interface should feel like a calm analytical instrument rather than a consumer-fintech engagement product. Modernity comes from hierarchy, spacing, typography, interaction quality, and useful charts—not gamification, decorative gradients, urgency, or opaque scores.

## Success criteria

### Primary usability criterion

Within 60 seconds of opening the dashboard, a user can determine:

- What is spendable today?
- What remains unallocated through month-end?
- Where is this period's money going?
- What commitments are approaching?
- Is the active plan sustainable over the selected horizon?
- What needs attention?

### Measurable acceptance targets

- The six questions above are answerable without visiting Settings.
- No default dashboard request invokes a model provider.
- Every financial value exposes a data-as-of timestamp and calculation or source provenance through visible text or an accessible detail.
- Every warning links to an actionable review or planning destination.
- The initial desktop dashboard becomes usable within one second at the 95th percentile on the standard synthetic household fixture with five years of transactions.
- Changing a cached timeframe updates the affected visualization within 200 milliseconds at the 95th percentile.
- A ten-year monthly forecast read completes within 750 milliseconds at the 95th percentile on the standard synthetic fixture.
- All essential dashboard tasks pass automated keyboard and accessibility checks.
- No critical information depends on color alone.

## Experience principles

### Facts before interpretation

The default dashboard contains database facts and deterministic calculations only. It may sum, average, group, reconcile, project through versioned rules, and compare authoritative records. It does not generate narrative or infer missing financial inputs.

### Now is not later

Current balances, institution-reported available balances, spendable funds, and future allocatable cash remain distinct. The interface must never imply that forecast income is already available.

### One active plan

The active household plan is the default future state. A scenario is a clearly labeled overlay based on a specific active-plan version. Scenario results never replace the active plan until the user completes a reviewed apply flow.

### Time is local to the question

The application has one global As of date, but each visualization owns the timeframe appropriate to its question. A monthly Sankey does not change because the user selects a ten-year forecast horizon.

### Problems explain themselves

Shortfalls, stale data, missing inputs, and allocation conflicts show their cause, affected destinations, data source, and next action. They do not merely change a card to red.

### Settings hold configuration, not understanding

Accounts, connections, imports, categories, household configuration, providers, privacy, and developer tooling live under Settings. The financial state produced by those systems remains visible and drillable from the primary experience.

## Information architecture

### Primary navigation

| Destination | Purpose                                                                                                  | Current capabilities absorbed                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Dashboard   | Current snapshot, commitments, allocation, history, forecast, and attention summary                      | Overview plus the read-only portions of Planning and Budgets                                                 |
| Activity    | Transactions, cash-flow activity, account drill-down, and category analysis                              | Transactions plus account activity views                                                                     |
| Planning    | Active plan, budgets, goals, allocations, assumptions, and scenarios                                     | Planning and Budgets                                                                                         |
| Review      | Unified inbox for unresolved imports, categorization, forecast reconciliation, stale data, and conflicts | Import review plus review queues currently embedded in several pages                                         |
| Settings    | Data sources, organization, system preferences, and developer tools                                      | Institutions, Accounts, Connections, CSV Import, Categories, Household, provider and telemetry configuration |

### Navigation behavior

- Use a persistent left sidebar at desktop widths of 1024 pixels and above.
- Collapse to an icon rail between 768 and 1023 pixels.
- Use a compact top bar and drawer navigation below 768 pixels.
- Show Review as a primary item with a deterministic count badge.
- Display the current household, data freshness, and sync state in the shell header.
- Keep the As of control in the dashboard header, not in global navigation.
- Preserve keyboard-visible focus and a skip-to-content link.

### Settings taxonomy

Settings is structured into four groups:

#### Data

- Accounts
- Institutions
- Connections and sync
- CSV import
- Import history
- Data export and backup

#### Organization

- Categories and rules
- Household members
- Income sources and schedules
- Recurring obligations
- Default currency and locale

#### Planning defaults

- Budget configuration
- Goal defaults
- Funding buckets and allocation rules
- Forecast assumptions
- Displayed timeframe defaults

#### System

- Model providers
- Privacy and trace policy
- Telemetry destination
- Secrets
- Developer tools
- AI Workbench
- About and calculation versions

### Existing route migration

| Current route  | New destination                   |
| -------------- | --------------------------------- |
| /              | /dashboard                        |
| /transactions  | /activity/transactions            |
| /budgets       | /planning/budgets                 |
| /planning      | /planning/active                  |
| /accounts      | /settings/data/accounts           |
| /institutions  | /settings/data/institutions       |
| /connections   | /settings/data/connections        |
| /import        | /settings/data/import             |
| /import-review | /review?type=import               |
| /categories    | /settings/organization/categories |
| /profile       | /settings/organization/household  |

The root path redirects to /dashboard. Old routes remain as redirects for at least one release.

## Core user journeys

### Journey 1: Daily snapshot

1. The user opens Almanac.
2. The dashboard loads the active household at today's As of timestamp.
3. The user reads Spendable today and Unallocated through month-end.
4. The commitments strip shows the next seven days within the default 30-day window.
5. Any stale data or near-term shortfall is visible without scrolling on a standard desktop viewport.
6. Selecting a metric opens its supporting account, commitment, or calculation detail.

### Journey 2: Understand this month's allocation

1. The user views the current-month Allocation flow card.
2. Actual flows through the As of date and forecast flows for the remaining month use distinct link styles.
3. The user selects a destination such as Housing, Emergency reserve, or Retirement.
4. A detail drawer lists the contributing rules, transactions, planned amount, actual amount, variance, and provenance.
5. If an adjustment is needed, the drawer links to the relevant Planning workflow.

### Journey 3: Review upcoming commitments

1. The user selects 7 days, 30 days, 90 days, 1 year, or 2 years.
2. The timeline automatically changes from daily to weekly or monthly aggregation.
3. Income and outflow commitments remain visually distinct.
4. Selecting an item reveals its source schedule, confidence, expected date, matching status, and affected account or funding bucket.
5. Missing dates or uncertain matches appear in Review rather than being assigned an invented date.

### Journey 4: Check long-range sustainability

1. The user opens the Active-plan forecast card.
2. The default horizon is one year, shown monthly.
3. The user selects two, five, or ten years.
4. The chart changes granularity without changing the underlying versioned forecast.
5. The user optionally enables one scenario overlay.
6. Shortfall periods and allocation conflicts are selectable.
7. The detail drawer explains deterministic causes and links to Planning.

### Journey 5: Enter an AI analysis flow

1. The user selects an explicit action such as Explain this forecast.
2. Almanac shows which active-plan version, scenario, period, calculations, and missing inputs will be supplied.
3. The user starts the workflow.
4. Model-generated output appears in an Intelligence treatment, names the provider and model, and remains distinct from calculated values.
5. Proposed changes require review and approval before creating a new plan version.

## Timeframe model

### Global time context

The dashboard header exposes:

- Household
- As of timestamp
- Currency
- Active-plan version
- Data freshness state

Changing As of refreshes all factual and deterministic reads. It does not silently move the active-plan version.

### Surface-specific ranges

| Surface               | Default       | Presets                                     | Automatic granularity                                                  |
| --------------------- | ------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| Commitments           | 30 days       | 7D, 30D, 90D, 1Y, 2Y                        | Day through 30D, week through 90D, month beyond 90D                    |
| Allocation Sankey     | Current month | Last month, current month, next month       | One selected month                                                     |
| Cash-flow history     | 6 months      | 1M, 3M, 6M, YTD, 1Y, 5Y, All                | Day for 1M, week through 6M, month beyond 6M                           |
| Net-worth history     | 1 year        | 3M, 6M, YTD, 1Y, 5Y, All                    | Day through 3M, week through 1Y, month beyond 1Y                       |
| Active-plan forecast  | 1 year        | 1M, 1Y, 2Y, 5Y, 10Y                         | Day for 1M commitments, month through 2Y, quarter for 5Y, year for 10Y |
| Planned versus actual | Current month | Last month, current month, quarter, YTD, 1Y | Month or quarter depending on range                                    |

### Time semantics

- Ranges use the household's configured timezone.
- The As of timestamp is inclusive for observed transactions and balances.
- Forecast periods begin after the As of boundary.
- Current-month combined views include observed values through As of and forecast values after As of.
- Historical comparison periods align calendar periods rather than fixed day counts.
- The selected range is reflected in the URL.
- Each card remembers its last selected preset locally; it does not alter the authoritative plan.
- Custom arbitrary dates are deferred until preset behavior is validated.

## Dashboard layout

### Desktop wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Almanac FI     Household ▾    As of Jul 21, 2026 ▾   Synced 12m ago   ⚙︎   │
├──────────────┬───────────────────────────────────────────────────────────────┤
│ Dashboard    │ Financial snapshot                              Active plan   │
│ Activity     │                                                       v18     │
│ Planning     │ ┌──────────────────────┐ ┌──────────────────────┐             │
│ Review   (4) │ │ Spendable today      │ │ Unallocated month-end│             │
│              │ │ $12,480              │ │ $3,240               │             │
│              │ │ Calculated · 12m ago │ │ After commitments    │             │
│              │ └──────────────────────┘ └──────────────────────┘             │
│              │                                                               │
│ Settings     │ ┌───────────────────────────────────────────────────────────┐ │
│              │ │ Upcoming commitments          7D  30D  90D  1Y  2Y      │ │
│              │ │ Jul 22 Paycheck +$4,800   Jul 25 Mortgage -$2,400       │ │
│              │ │ Jul 28 Retirement -$900   Aug 01 Utilities -$310        │ │
│              │ └───────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │ ┌────────────────────────────┐ ┌────────────────────────────┐ │
│              │ │ Allocation flow           │ │ Cash flow                 │ │
│              │ │ Last  Current  Next month │ │ 1M 3M 6M YTD 1Y 5Y All  │ │
│              │ │                            │ │                            │ │
│              │ │ Net income ━━┳━ Housing   │ │ income  ─────────         │ │
│              │ │              ┣━ Budgets   │ │ outflow ────────          │ │
│              │ │              ┣━ Goals     │ │ net     ─────────         │ │
│              │ │              ┣━ Investing │ │                            │ │
│              │ │              ┗━ Surplus   │ │                            │ │
│              │ │ solid actual · faded plan │ │ Compared with prior range │ │
│              │ └────────────────────────────┘ └────────────────────────────┘ │
│              │                                                               │
│              │ ┌───────────────────────────────────────────────────────────┐ │
│              │ │ Active-plan forecast      1M  1Y  2Y  5Y  10Y           │ │
│              │ │ Scenario comparison: None ▾                              │ │
│              │ │ projected balance ─────────────────────────────          │ │
│              │ │ remaining surplus ─────────────────────────────          │ │
│              │ │ ▲ shortfall in Mar 2027                                  │ │
│              │ │ [Review shortfall]             [Explain this forecast]   │ │
│              │ └───────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │ ┌────────────────────────────┐ ┌────────────────────────────┐ │
│              │ │ Goals and funding         │ │ Needs attention           │ │
│              │ │ Emergency fund     74%    │ │ 2 stale balances          │ │
│              │ │ College            41%    │ │ 1 unresolved income match │ │
│              │ │ Retirement         on plan│ │ 1 allocation conflict     │ │
│              │ └────────────────────────────┘ └────────────────────────────┘ │
└──────────────┴───────────────────────────────────────────────────────────────┘
```

### Responsive snapshot wireframe

Below 768 pixels, the interface supports review rather than full plan construction:

```text
┌──────────────────────────────┐
│ ☰ Almanac      As of Jul 21 │
├──────────────────────────────┤
│ Spendable today             │
│ $12,480 · calculated        │
├──────────────────────────────┤
│ Unallocated month-end       │
│ $3,240 · after commitments  │
├──────────────────────────────┤
│ Upcoming             30D ▾  │
│ Jul 22  Paycheck     +4,800 │
│ Jul 25  Mortgage     -2,400 │
│ View timeline →             │
├──────────────────────────────┤
│ Allocation summary          │
│ Obligations  48%            │
│ Budgets      24%            │
│ Goals        12%            │
│ Investing     9%            │
│ Unallocated   7%            │
│ View flow on desktop →      │
├──────────────────────────────┤
│ Needs attention          4  │
└──────────────────────────────┘
```

The mobile view replaces the full Sankey with an accessible ranked allocation summary. It does not attempt full scenario editing.

## Dashboard modules

### Application header

The header shows the current household, As of timestamp, active-plan identifier, last successful data sync, and warning state. Sync controls are available from a compact status menu; configuration remains in Settings.

### Spendable today

Definition: eligible liquid funds from the authoritative financial-state snapshot after holds and explicit current reserves. It excludes forecast income, investments, certificates, and credit availability.

The card shows:

- Amount and currency
- Data-as-of timestamp
- Included-account count
- Stale or missing-balance warning
- Link to contributing cash accounts
- Calculation version

### Unallocated through month-end

Definition: spendable funds plus expected net income remaining in the current month, less required obligations, recurring budget funding, goal funding, and planned investment contributions in the active allocation ledger.

This is not labeled available cash. It is a deterministic forecast value.

The card shows:

- Forecast unallocated amount or shortfall
- Remaining expected income
- Remaining commitments
- Active-plan version
- Forecast version and data-as-of date
- Link to calculation detail

### Upcoming commitments

The timeline includes:

- Expected net-income occurrences
- Recurring obligations
- Debt payments
- Budget funding events
- Goal allocations
- Planned investment contributions
- Planned withdrawals when implemented

Each occurrence has an expected date or period, amount, direction, source type, confidence, funding status, and source record. Items without a defensible date are placed in Review rather than arbitrarily ordered.

The compact 30-day dashboard view emphasizes the next seven days. Longer ranges aggregate by week or month but remain drillable to occurrences.

### Allocation Sankey

The Sankey answers: where did or will this period's money go?

The canonical flow is:

```text
Gross income
├── Taxes and deductions
└── Expected net income
    └── Allocatable cash
        ├── Required obligations
        ├── Recurring budgets
        ├── Financial safety and reserves
        ├── Long-term critical goals
        ├── Time-bound goals
        ├── Lifestyle goals
        ├── Planned investing
        └── Unallocated surplus
```

Opening spendable funds appear as a separate source only when the active plan explicitly uses current cash for the selected period. They are never silently blended into income.

For the current month:

- Observed and reconciled flows through As of use solid, higher-contrast links.
- Forecast remaining flows use lower-contrast or patterned links.
- The legend names both states.
- Hover and focus expose actual, planned, variance, funding status, and provenance.
- A synchronized table supplies the same information for keyboard and screen-reader users.

For historical months, only observed and reconciled values appear. For future months, only forecast values appear. Shortfalls use a dedicated deficit node or warning treatment rather than a negative-width flow.

### Cash-flow history

The chart shows income, outflow, and net cash flow for the selected historical range. Transfers are excluded from income and spending. The chart supports comparison with the immediately preceding aligned period.

The chart does not use forecast values. The current partial period is visibly marked.

### Active-plan forecast

The forecast chart shows:

- Opening balance
- Expected net income
- Obligations
- Budget funding
- Goal funding
- Planned investing
- Remaining surplus or shortfall
- Closing balance

The initial view uses monthly points for one year. Five-year views use quarters and ten-year views use years for rendering, while retaining the immutable monthly forecast as the source.

Only one optional scenario overlay is shown in the initial release. The legend names the active-plan version and scenario. Comparing more than one hypothetical scenario is handled on the Planning scenario-comparison page.

### Goals and funding

Goal cards show target, target date, funded amount, planned contribution, projected completion, priority, and on-plan status. They do not imply that planned allocations are already funded.

### Needs attention

The dashboard shows a compact count and the highest-severity items:

- Allocation shortfalls
- Unfunded hard or minimum constraints
- Missing income forecast
- Missing allocation ledger
- Stale balances
- Missing valuations
- Unresolved income matches
- Low-confidence reconciliation
- Import review
- Uncategorized material transactions

All items lead to the unified Review inbox with the relevant filter applied.

## Detail drawer

Selecting a metric, flow, commitment, conflict, or chart point opens a right-side drawer on desktop and a full-height sheet on smaller screens.

The drawer contains:

- Plain-language label
- Amount and currency
- Period and As of timestamp
- Observed, forecast, or combined state
- Calculation version
- Active-plan and forecast versions
- Source records or contributing groups
- Missing inputs and warnings
- Planned versus actual comparison when applicable
- Link to the appropriate Activity, Planning, Review, or Settings workflow

The dashboard drawer is read-only. Plan edits happen in Planning so version creation and approval remain explicit.

## Deterministic and AI boundaries

### Dashboard-safe operations

- Query authoritative records
- Sum and group minor-unit monetary values
- Calculate averages and aligned comparisons
- Expand typed schedules into occurrences
- Reconcile forecast rows with observed transactions
- Apply versioned funding rules
- Aggregate immutable allocation-ledger rows
- Detect missing inputs, stale data, shortfalls, and conflicts

### Operations requiring an explicit AI flow

- Narrative explanation
- Open-ended diagnosis
- Recommendation generation
- Suggested plan changes
- Suggested categorization when a deterministic rule does not apply
- Scenario drafting from free-form intent

AI actions are labeled actions, never background side effects. Before execution, the user can inspect the data context, plan version, calculations, and privacy policy. Outputs use the branding guideline's Intelligence treatment and name the provider and model.

## Personalization

The dashboard remains curated. Initial personalization is limited to:

- Remembered timeframe preset per card
- One selected scenario overlay
- Collapsed or expanded lower-priority modules
- Currency display when authoritative conversion support exists
- Household selection when multiple households are supported

Users cannot arbitrarily add, remove, resize, or reorder core snapshot modules in the initial release. Future feature extensions may contribute cards only to named extension slots with size, provenance, accessibility, and performance contracts.

## Visual design system

### Direction

- Calm, precise, analytical, and modern
- Dense enough for desktop financial review without resembling a spreadsheet
- Clear hierarchy and generous separation between conceptual layers
- No gamification, celebratory confetti, urgency copy, or decorative fintech gradients
- Minimal motion, used only to explain transitions

### Color

- Ledger blue, #155eef: deterministic and calculated values
- Intelligence amber, #B7791F: model-generated content only
- Existing slate neutrals: surfaces, borders, and text
- Green and red: success and error states, not decoration
- Actual versus forecast is distinguished by pattern, opacity, label, or stroke as well as color

### Typography and numbers

- Inter throughout the working application
- Tabular numerals for every financial value
- Sentence case for navigation, headings, and actions
- Compact labels paired with full accessible descriptions

### Layout tokens

- 8-pixel base spacing grid
- 12-pixel compact and 16-pixel standard card padding
- 20- to 24-pixel dashboard grid gaps
- 12-pixel card radius
- Subtle one-pixel borders; shadows reserved for elevated drawers and menus
- Minimum interactive target of 40 by 40 pixels on desktop and 44 by 44 pixels on touch layouts

### Motion

- Honor prefers-reduced-motion
- Use 150- to 200-millisecond transitions for drawers and range changes
- Do not animate financial values from zero
- Do not animate the Sankey on initial load in a way that delays comprehension

## Accessibility requirements

- Meet WCAG 2.2 AA for the redesigned surfaces.
- Every chart has a title, summary, legend, accessible data table, and downloadable CSV where appropriate.
- Chart points, Sankey nodes, and links are keyboard focusable or mirrored by an adjacent keyboard-operable list.
- Tooltips are available on focus and do not contain exclusive information.
- Positive and negative amounts include textual direction or sign.
- Actual, projected, stale, warning, and AI-generated states do not rely on color alone.
- Focus order follows visual order.
- Drawers trap focus while open, restore focus when closed, and support Escape.
- Loading states use stable skeleton dimensions and status announcements.
- Error messages retain the prior valid view when safe and explain the next action.

## Empty, loading, stale, and error states

### No financial data

The dashboard shows a setup checklist with one primary action: connect a source or import a CSV. It does not show zero-valued financial cards that could be mistaken for calculated truth.

### Current data but no active plan

The dashboard shows the factual snapshot and historical activity. Forecast modules show an explicit No active plan state with a link to create one.

### Active plan but missing inputs

Forecast modules identify the exact missing typed inputs, such as income schedules or obligations. They do not derive those values from generic household facts.

### Stale balances

The last known value remains visible with its timestamp and Stale label. A warning links to connection or manual-balance review.

### Partial current month

Observed values stop at As of. Forecast remainder is visually distinct. The combined total is labeled Observed plus planned, not Actual.

### Failed chart request

The affected module retains its prior valid data when available, shows the failed timestamp, and offers Retry. Other dashboard modules remain usable.

## Data architecture

### Existing authoritative capabilities to reuse

The current repository already provides:

- Financial-state snapshots with spendable funds, net worth, account breakdown, activity, and balance warnings
- Person-linked income sources and schedules
- Monthly income forecast rows and reconciliation
- Recurring obligations and debt-payment forecast inputs
- Funding buckets and effective-dated allocation rules
- Immutable allocation-ledger runs, months, and entries
- Active plans, scenarios, forecast versions, and planning-dashboard reconciliation
- Budget periods and categorized transaction actuals

These remain the sources of truth.

### Read-model rule

New dashboard endpoints are read models over authoritative records. They may aggregate and shape data for visualization but may not create independent forecast state. Financial aggregation occurs in deterministic TypeScript modules or database repositories, not React components.

The browser may format dates and currency, choose chart coordinates, and manage interaction state. It may not calculate authoritative totals, infer missing occurrences, or merge observed and forecast values without a server-declared boundary.

### Proposed API contracts

#### Dashboard snapshot

GET /households/{id}/dashboard-snapshot

Query:

- asOf
- currency
- periodStart

Response:

- context: household, currency, timezone, As of, active-plan version, forecast version
- freshness: latest balance, transaction, sync, and calculation timestamps
- spendableToday
- unallocatedThroughPeriodEnd
- currentPeriodSummary
- reviewSummary
- warnings
- calculationVersions

This composes existing financial-state and planning-dashboard data without changing their authority boundaries.

#### Commitment occurrences

GET /households/{id}/commitment-occurrences

Query:

- start
- end
- granularity
- scenarioId, optional

Response item:

- id
- expectedDate or period
- amountMinor
- currency
- direction: inflow or outflow
- type: income, obligation, debt, budget, goal, investment, withdrawal
- label
- sourceId and sourceType
- planVersionId
- fundingStatus
- confidence
- observedMatchId, optional
- observedAmountMinor, optional
- state: observed, forecast, reconciled, unresolved

Occurrences without a defensible expected date are returned in an undated collection and create Review items.

#### Allocation flow

GET /households/{id}/allocation-flow

Query:

- periodStart
- asOf
- scenarioId, optional

Response:

- context and versions
- nodes: id, label, group, amountMinor, state, warningCount
- links: source, target, amountMinor, state, fundingStatus
- totals: observed, forecastRemaining, combined, shortfall
- reconciliation summary
- warnings

The server guarantees that no dollar is represented twice within one state. Gross-to-net deductions and net-to-allocation flows are explicit.

#### Cash-flow history

GET /households/{id}/cash-flow-series

Query:

- start
- end
- granularity
- currency

Response point:

- period
- inflowMinor
- outflowMinor
- netMinor
- transactionCount
- excludedTransferCount
- completeness
- dataAsOf

This endpoint contains observed values only.

#### Forecast series

GET /households/{id}/forecast-series

Query:

- start
- horizon: one_month, one_year, two_year, five_year, ten_year
- granularity
- scenarioId, optional

Response point:

- period
- openingBalanceMinor
- expectedNetIncomeMinor
- requiredObligationsMinor
- recurringBudgetsMinor
- goalFundingMinor
- plannedInvestmentsMinor
- withdrawalsMinor
- surplusMinor
- shortfallMinor
- closingBalanceMinor
- missingIncomeCount
- conflictCount

Response context includes active-plan version, scenario base version, allocation-ledger run, input checksum, calculation versions, currency, and data-as-of timestamp.

#### Net-worth history

GET /households/{id}/net-worth-series

Query:

- start
- end
- granularity
- currency

Response point:

- period
- assetsMinor
- liabilitiesMinor
- netWorthMinor
- staleAccountCount
- missingValuationCount

No currency conversion occurs without an authoritative rate source and explicit conversion metadata.

### Existing contract changes

- Extend allocationLedgerHorizonQuerySchema with two_year and ten_year.
- Retain monthly ledger rows as the source for long-range aggregation.
- Add expected dates or occurrence-expansion support for obligations and allocations; the current forecast-obligation list lacks enough date detail for a daily timeline.
- Add timezone to the household or dashboard context.
- Add plan and calculation version metadata consistently to dashboard reads.
- Add structured warning identifiers, severity, affected entity, and remediation route.
- Add observed-versus-forecast state fields to combined current-period reads.
- Add chart completeness metadata so partial periods and missing sources remain visible.

### Calculation modules

Add deterministic modules for:

- Month-end unallocated funds
- Commitment occurrence expansion
- Range-to-granularity resolution
- Observed current-period allocation aggregation
- Observed and forecast flow reconciliation
- Sankey node and link construction with double-count prevention
- Cash-flow historical aggregation
- Net-worth historical aggregation
- Long-horizon forecast aggregation
- Dashboard review-summary prioritization

Each module accepts typed inputs, returns typed output, declares a calculation version, and receives unit coverage for boundaries and missing data.

### Versioning and provenance

Every forecast response identifies:

- Active-plan version
- Scenario and base version when present
- Income-forecast run
- Allocation-ledger run
- Input checksum
- Calculation versions
- Data-as-of timestamp

Every observed response identifies its date boundary, included records, currency, and completeness warnings. UI components receive provenance from contracts rather than reconstructing it.

## Functional requirements

### Must have, P0

- Modern desktop application shell and reduced navigation
- Dashboard snapshot with Spendable today and Unallocated through month-end
- Global As of context
- Upcoming 30-day commitments with 7-day emphasis
- Current-month hybrid allocation Sankey
- Six-month observed cash-flow history
- One-year active-plan forecast
- Unified Review summary and inbox
- Stale, missing, loading, empty, and error states
- Read-only detail drawer with provenance
- Settings route migration
- No automatic model calls
- Accessible chart alternatives

### Should have, P1

- All agreed timeframe presets
- Two-, five-, and ten-year forecast aggregation
- One optional scenario overlay
- Net-worth history
- Goal funding cards
- Planned-versus-actual range comparison
- Remembered per-card timeframe selections
- CSV download for chart data
- Responsive snapshot experience

### Nice to have, P2

- Named extension slots for feature-contributed cards
- User-controlled collapse of lower-priority modules
- Print-friendly snapshot
- Saved comparison links
- Advanced chart annotations for plan-version changes
- Custom date ranges after preset validation

## Phased implementation plan

### Phase 0: Contract and design foundation

Deliver:

- Dashboard domain vocabulary and date semantics
- Design tokens and accessible chart primitives
- Proposed read schemas in api-contracts
- Deterministic calculation interfaces
- Expanded synthetic household covering actuals, forecasts, shortfalls, stale data, and scenarios
- Route migration map

Exit criteria:

- Contract examples validate.
- No endpoint conflates observed and forecast money.
- Synthetic fixtures cover all primary dashboard states.

### Phase 1: Shell and factual snapshot

Deliver:

- Desktop sidebar and responsive shell
- New navigation and Settings groups
- Dashboard snapshot endpoint
- Spendable today and month-end unallocated cards
- Freshness, plan-version, loading, empty, stale, and error treatments
- Review badge and initial inbox
- Redirects from old routes

Exit criteria:

- The user can answer the first two success questions.
- Existing settings workflows remain reachable.
- No model-provider call occurs.

### Phase 2: Commitments and history

Deliver:

- Commitment occurrence expansion
- 7D, 30D, and 90D timeline
- Cash-flow history endpoint and chart
- Read-only detail drawer
- Review items for undated or uncertain commitments

Exit criteria:

- Upcoming income and outflows are traceable to typed sources.
- Transfers are excluded from cash-flow spending.
- Partial current periods are visibly marked.

### Phase 3: Allocation flow

Deliver:

- Allocation-flow endpoint
- Current, prior, and next-month Sankey
- Actual versus forecast styling
- Synchronized accessible table
- Node and link drill-down
- Shortfall and funding-status states

Exit criteria:

- Flow totals reconcile with source records and the allocation ledger.
- Automated tests prove no double allocation.
- The user can answer where the selected period's money is going.

### Phase 4: Long-range forecast and scenarios

Deliver:

- Forecast-series endpoint
- 1M, 1Y, 2Y, 5Y, and 10Y presets
- Automatic aggregation
- Active-plan forecast chart
- One scenario overlay
- Conflict drawer and Planning handoff
- Goals and funding summary

Exit criteria:

- Active and scenario data remain version-isolated.
- Identical versioned inputs produce identical series.
- The user can identify the first shortfall and its cause.

### Phase 5: Consolidation and polish

Deliver:

- Net-worth history
- Full Review inbox integration
- Planned-versus-actual comparisons
- Performance profiling and query indexes
- Responsive snapshot refinement
- Accessibility audit
- Route deprecation notices
- Contributor documentation for dashboard extension slots

Exit criteria:

- Primary success test passes with representative users or structured usability evaluation.
- Performance and accessibility targets pass in CI.
- All legacy screens are either migrated, intentionally retained under Settings, or redirected.

## Testing strategy

### Deterministic unit tests

- Current versus future money boundaries
- Month-end unallocated calculation
- Recurring schedule expansion across month ends, leap years, and daylight-saving boundaries
- Granularity selection at every range threshold
- Transfer exclusion
- Partial-period aggregation
- Sankey conservation and double-count prevention
- Shortfall ordering by constraint and priority
- Scenario isolation
- Long-range aggregation equivalence with monthly source rows

### Repository and API integration tests

- As-of balance selection
- Dated commitment generation
- Missing and stale source behavior
- Allocation ledger and Sankey reconciliation
- Active-plan and scenario responses
- Structured warnings and remediation routes
- Currency mismatch rejection
- Stable checksums and version metadata

### Frontend component tests

- Every card's loading, empty, stale, warning, and error state
- Timeframe selection and URL state
- Actual versus forecast legend
- Drawer focus management
- Review badge counts
- No AI requests during dashboard rendering

### End-to-end tests

- Open dashboard and answer the six success questions using a synthetic household
- Drill from Sankey to contributing records
- Change commitments from 7D to 2Y
- Compare active plan with a scenario
- Navigate from conflict to Planning without mutating the plan
- Navigate every legacy route to its new destination
- Complete snapshot and review tasks using keyboard only

### Visual and accessibility regression

- Desktop widths: 1280, 1440, and 1920 pixels
- Intermediate width: 900 pixels
- Snapshot mobile widths: 390 and 430 pixels
- Light mode initially; dark mode is a separate design pass
- Automated axe checks plus manual screen-reader and high-contrast verification

## Security and privacy requirements

- Dashboard endpoints are local and read-only.
- Dashboard reads do not invoke model providers.
- Financial values are not added to remote telemetry under metadata-only tracing.
- Error logs use identifiers and calculation versions rather than transaction descriptions or balances.
- AI workflow entry shows the context and trace privacy policy before execution.
- Scenario application and plan changes continue through explicit approval and version creation.
- Secrets and connection credentials never appear in dashboard payloads.

## Risks and mitigations

| Risk                                              | Mitigation                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| One dashboard becomes visually overloaded         | Curated hierarchy, progressive disclosure, detail drawer, and lower-priority modules below the fold            |
| Actual and forecast values appear interchangeable | Explicit state fields, separate styling, labels, As of boundary, and accessible legend                         |
| Sankey double-counts gross and net income         | Server-owned flow contract and conservation tests                                                              |
| Long horizons become slow                         | Monthly authoritative rows, server aggregation, indexed range reads, and response caching by immutable version |
| Settings hides frequently needed correction flows | Dashboard and Review deep links open the exact settings or planning destination                                |
| Stale values appear trustworthy                   | Persistent timestamp and stale treatment on the affected value                                                 |
| AI boundary erodes over time                      | Contract tests asserting no model requests and a named explicit workflow boundary                              |
| Responsive requirements inflate scope             | Mobile is limited to snapshot and review; full planning remains desktop-first                                  |
| Existing routes break contributor workflows       | Redirect period and documented route migration                                                                 |

## Rollout and migration

- Ship the new shell behind a local feature flag during Phases 1 through 3.
- Preserve all current data and database migrations.
- Keep legacy routes as redirects.
- Use the synthetic household as the default contributor preview.
- Record dashboard calculation and contract versions in release notes.
- Remove the feature flag only after snapshot, commitments, Sankey, and Review reach P0 acceptance.
- Deprecate legacy route components after one release with no unique capabilities remaining.

## Acceptance checklist

### Problem definition

- [x] Clear problem statement
- [x] Success criteria defined
- [x] Primary users and operating context identified

### User experience

- [x] Core dashboard journey mapped
- [x] Timeframe behavior defined
- [x] Empty, stale, error, and partial-period states defined
- [x] Desktop and responsive wireframes included
- [x] Settings and primary navigation responsibilities defined

### Technical design

- [x] Authoritative sources identified
- [x] Proposed API read models specified
- [x] Deterministic calculation ownership defined
- [x] Performance, accessibility, security, and testing requirements defined
- [x] Active-plan and scenario boundaries preserved

### Decisions

- [x] Dashboard is curated with limited personalization
- [x] Spendable today and month-end unallocated funds are distinct
- [x] Current-month allocation combines observed and forecast remainder with explicit styling
- [x] Global As of and local timeframe controls are separate
- [x] AI content requires an explicit workflow
- [x] Desktop is the primary planning surface
- [x] Cross-stack implementation is in scope

## Implementation handoff

Implementation should proceed phase by phase, beginning with contract examples and synthetic fixtures. Each phase must preserve the data-authority rules in doc/system-structure.md and may not introduce UI-only financial calculations.

The package-level execution backlog, dependencies, verification commands, and
recommended pull-request slices are in the
[package task breakdown](../plans/2026-07-21-ui-overhaul-package-breakdown.md).

The breakdown covers `packages/core`, `packages/db`,
`packages/api-contracts`, `packages/fixtures`, `apps/server`, `apps/web`, and
cross-package quality work. No unresolved product decision blocks Wave 0.
