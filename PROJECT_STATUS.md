# Project status

## Milestone: local financial data foundation

The local-first data foundation is complete and usable through the dashboard.

Completed work items:

- 016 — Accounts and institution connections
- 017 — Transactions and splits
- 018 — Categories and categorization rules
- 019 — Import provenance, deduplication, and reconciliation
- 020 — CSV connector and normalization pipeline
- 021 — CSV mapping wizard
- 023a — Application UX foundation

Delivered capabilities:

- Create accounts and categories, then import account transactions from CSV.
- Map CSV columns from the uploaded headers, preview normalized rows, save mappings, and commit idempotent imports with provenance.
- Accept common bank amount notation, including signed dollar amounts and whole-dollar values, plus mixed pending and ISO transaction dates.
- Browse transactions in a responsive table with account and category columns, cursor-safe progressive loading, and inline expandable details.
- Preserve source identity, categorization, split reconciliation, and import audit data in the local SQLite database.

Deferred work items 022 and 023 remain intentionally deferred: SimpleFIN connection and sync work is not part of this milestone.

The next planned work item is 024 — Manual financial data entry.

Verification at this milestone: `pnpm check` passes with 40 tests.
