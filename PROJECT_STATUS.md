# Project status

## Milestone: local financial data foundation

The local-first data foundation is complete and usable through the dashboard.

Completed work items:

- 016 — Accounts and institution connections
- 016a — Institution and account-classification refactor
- 017 — Transactions and splits
- 018 — Categories and categorization rules
- 019 — Import provenance, deduplication, and reconciliation
- 020 — CSV connector and normalization pipeline
- 021 — CSV mapping wizard
- 022 — SimpleFIN connection flow
- 023 — SimpleFIN sync and sync health
- 023a — Application UX foundation

Delivered capabilities:

- Create accounts and categories, then import account transactions from CSV.
- Map CSV columns from the uploaded headers, preview normalized rows, save mappings, and commit idempotent imports with provenance.
- Accept common bank amount notation, including signed dollar amounts and whole-dollar values, plus mixed pending and ISO transaction dates.
- Browse transactions in a responsive table with account and category columns, cursor-safe progressive loading, and inline expandable details.
- Preserve source identity, categorization, split reconciliation, and import audit data in the local SQLite database.
- Represent institutions independently from provider credentials and external logins, with every account owned by exactly one institution.
- Classify taxable, retirement, education, health-savings, depository, and debt accounts with specific subtypes for later tax-aware planning.
- Reconcile provider organizations by scoped organization ID and domain, retaining ambiguous or unclassified imports for explicit review.
- Claim one-time SimpleFIN setup tokens, keep Access URLs in the local SecretStore, show connection state, and disconnect without deleting imported financial records.
- Run initial 90-day, rolling 60-day, two-year deep, or custom-range SimpleFIN syncs; bootstrap institutions and accounts, refresh balances, reconcile pending/posting/correction revisions, and report persistent sync health.

Verification at this milestone: `pnpm check` passes with 103 tests.
