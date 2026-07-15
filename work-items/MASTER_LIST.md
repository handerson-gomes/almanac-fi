# Work Items Master List

This is the dependency-ordered implementation backlog for Almanac FI. Each item has its own directory and a requirements file. Work items are intentionally narrow enough for a coding agent to own; contributors must preserve the financial concepts and invariants in [System Structure](../doc/system-structure.md), [product.md](../product.md), and [product_shared_forecast_addendum.md](../product_shared_forecast_addendum.md).

## Rules for implementation

- Follow the active critical path and listed dependencies. Numeric IDs are stable identifiers, not permission to start deferred work.
- Keep authoritative financial calculations deterministic, versioned TypeScript using integer minor units.
- SQLite is the local source of truth; raw import provenance and audit history must be retained.
- Generic household facts are contextual only; calculations consume typed financial records.
- Current funds, forecast income, and allocated future cash must remain distinct.
- Never bypass the shared forecast and allocation ledger for future cash-flow commitments.
- Budgets are recurring envelopes; goals are accumulating targets; both use typed funding rules and the shared ledger.
- AI, planner extensions, MCP, and external integrations are deferred until work items 024 and 032–038 are complete.
- Telemetry defaults to metadata-only; secret and financial-content handling must be tested.

## Status legend

- **Not started** — no accepted implementation.
- **In progress** — one agent actively owns it.
- **Blocked** — prerequisite or decision required.
- **Deferred** — intentionally outside the active core-infrastructure sequence.
- **Complete** — acceptance criteria and verification are satisfied.

## Dependency-ordered backlog

### Foundation (001–015)

| ID  | Work item                                                                                         | Status      | Depends on              |
| --- | ------------------------------------------------------------------------------------------------- | ----------- | ----------------------- |
| 001 | [Workspace bootstrap](./001-foundation-workspace-bootstrap/requirements.md)                       | Complete    | None                    |
| 002 | [Quality gates and CI](./002-foundation-quality-and-ci/requirements.md)                           | Complete    | 001                     |
| 003 | [Configuration and local data home](./003-foundation-configuration-and-data-home/requirements.md) | Complete    | 001, 002                |
| 004 | [Financial domain primitives](./004-domain-financial-primitives/requirements.md)                  | Complete    | 001                     |
| 005 | [SQLite and migration foundation](./005-database-foundation/requirements.md)                      | Complete    | 001, 003, 004           |
| 006 | [Core provenance and audit schema](./006-database-core-provenance-and-audit/requirements.md)      | Complete    | 005                     |
| 007 | [Repository and unit-of-work layer](./007-database-repositories-and-unit-of-work/requirements.md) | Complete    | 005, 006                |
| 008 | [API contracts and error envelope](./008-api-contracts-and-error-envelope/requirements.md)        | Complete    | 001, 004                |
| 009 | [Fastify application shell](./009-server-application-shell/requirements.md)                       | Complete    | 003, 005, 008           |
| 010 | [React dashboard shell](./010-web-application-shell/requirements.md)                              | Complete    | 001, 008, 009           |
| 011 | [Feature SDK contract](./011-feature-sdk-contract/requirements.md)                                | Complete    | 004, 007, 008, 009, 010 |
| 012 | [Feature registry and generator](./012-feature-registry-and-generator/requirements.md)            | Complete    | 011                     |
| 013 | [Synthetic household fixtures](./013-synthetic-household-fixtures/requirements.md)                | Complete    | 005, 006, 007           |
| 014 | [Telemetry foundation and privacy policy](./014-telemetry-foundation-and-privacy/requirements.md) | Complete    | 003, 004, 009           |
| 015 | [Development SecretStore](./015-developer-secret-store/requirements.md)                           | Complete    | 003, 007                |

### Financial data and shared planning substrate (016–038)

| ID   | Work item                                                                                                                     | Status      | Depends on                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------- |
| 016  | [Accounts and institution connections](./016-accounts-and-institution-connections/requirements.md)                            | Complete    | 004, 005, 007, 008, 009, 010, 015  |
| 016a | [Institution and account-classification refactor](./016a-institution-and-account-classification-refactor/requirements.md)     | Complete    | 006, 007, 008, 010, 015, 016, 019, 020, 023a, 028a, 028b |
| 017  | [Transactions and splits](./017-transactions-and-splits/requirements.md)                                                      | Complete    | 004, 006, 007, 016                 |
| 018  | [Categories and categorization-rule data model](./018-categories-and-rules-data-model/requirements.md)                        | Complete    | 005, 007, 008, 010, 017            |
| 019  | [Import provenance, deduplication, and reconciliation](./019-import-provenance-dedupe-and-reconciliation/requirements.md)     | Complete    | 006, 007, 016, 017                 |
| 020  | [CSV connector and normalization pipeline](./020-csv-import-pipeline/requirements.md)                                         | Complete    | 004, 015, 016, 017, 019            |
| 021  | [CSV mapping wizard](./021-csv-import-mapping-wizard/requirements.md)                                                         | Complete    | 010, 020                           |
| 022  | [SimpleFIN connection flow](./022-simplefin-connection-flow/requirements.md)                                                  | Deferred    | 015, 016a                          |
| 023  | [SimpleFIN sync and sync health](./023-simplefin-sync-and-sync-health/requirements.md)                                        | Deferred    | 014, 016a, 017, 019, 022           |
| 023a | [Application UX foundation](./023a-application-ux-foundation/requirements.md)                                                  | Complete    | 010, 016, 017, 018, 021            |
| 024  | [Manual financial data entry](./024-manual-financial-data-entry/requirements.md)                                              | Not started | 006, 016a, 017, 018                |
| 025  | [Transfer matching and review](./025-transfer-matching-and-review/requirements.md)                                            | Complete    | 006, 017, 024                      |
| 025a | [Categorization engine and review queue](./025a-categorization-engine-and-review-queue/requirements.md)                       | Complete    | 017, 018, 025                      |
| 026  | [Income classification](./026-income-classification/requirements.md)                                                          | Complete    | 017, 018, 025, 025a                |
| 027  | [Household profile and time-aware facts](./027-household-profile-and-time-aware-facts/requirements.md)                        | Complete    | 004, 005, 007, 008, 010            |
| 028  | [Financial goals and assumptions](./028-financial-goals-and-assumptions/requirements.md)                                      | Complete    | 004, 027                           |
| 028a | [Investments, holdings, and investment transactions](./028a-investments-holdings-and-investment-transactions/requirements.md) | Complete    | 016, 017, 024                      |
| 028b | [Liabilities and recurring obligations](./028b-liabilities-and-recurring-obligations/requirements.md)                         | Complete    | 016, 027, 024                      |
| 029  | [Budget calculations](./029-budget-calculations/requirements.md)                                                              | Complete    | 004, 017, 018, 025, 025a, 026      |
| 030  | [Budget APIs and management](./030-budgets-api-and-management/requirements.md)                                                | Complete    | 006, 007, 008, 018, 029            |
| 031  | [Budget dashboard and variance review](./031-budget-dashboard-and-variance-review/requirements.md)                            | Complete    | 010, 017, 029, 030                 |
| 032  | [Authoritative financial state and available-funds snapshot](./032-authoritative-financial-state/requirements.md)              | Not started | 016a, 017, 024, 025, 026, 028a, 028b, 029, 030 |
| 033  | [Person-linked income sources and forecast schedules](./033-person-linked-income-forecast/requirements.md)                     | Not started | 004, 006, 007, 008, 027            |
| 034  | [Monthly income forecast and actual-income reconciliation](./034-monthly-income-forecast-and-reconciliation/requirements.md)   | Not started | 017, 025, 026, 032, 033            |
| 035  | [Funding buckets and allocation rules](./035-funding-buckets-and-allocation-rules/requirements.md)                             | Not started | 004, 006, 007, 008, 028, 028a, 028b, 030, 033 |
| 036  | [Shared allocation ledger and constraint engine](./036-allocation-ledger-and-constraint-engine/requirements.md)                | Not started | 005, 006, 007, 032, 034, 035       |
| 037  | [Active plan versioning and hypothetical scenarios](./037-plan-versioning-and-scenarios/requirements.md)                       | Not started | 006, 007, 008, 034, 035, 036       |
| 038  | [Core planning dashboard and planned-versus-actual reconciliation](./038-core-planning-dashboard-and-reconciliation/requirements.md) | Not started | 010, 031, 032, 034, 036, 037       |

### Deferred AI platform (039–050)

| ID   | Work item                                                                                                     | Status      | Depends on                    |
| ---- | ------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------- |
| 039  | [Generic financial change proposals and approval](./039-generic-change-proposal-and-approval/requirements.md) | Deferred | 006, 007, 008, 014, 037       |
| 040  | [Capability registry and interface adapters](./040-capability-registry-and-adapters/requirements.md)          | Deferred | 008, 011, 039                 |
| 041  | [AI provider registry](./041-ai-provider-registry/requirements.md)                                            | Deferred | 003, 015, 040                 |
| 042  | [Model capabilities and selection](./042-model-capabilities-and-selection/requirements.md)                    | Deferred | 010, 041                      |
| 042a | [Versioned methodology knowledge base](./042a-versioned-methodology-knowledge-base/requirements.md)           | Deferred | 005, 007, 014, 040            |
| 043  | [Scoped AI context builder](./043-scoped-ai-context-builder/requirements.md)                                  | Deferred | 014, 027, 028, 032, 036, 040, 042a |
| 044  | [Embedded AI runtime](./044-embedded-ai-runtime/requirements.md)                                              | Deferred | 014, 041, 042, 043            |
| 045  | [AI tool orchestration and structured output](./045-ai-tools-and-structured-output/requirements.md)           | Deferred | 039, 040, 043, 044            |
| 046  | [Resumable workflow engine](./046-resumable-workflow-engine/requirements.md)                                  | Deferred | 006, 007, 039, 040, 042a, 045 |
| 047  | [AI and workflow observability](./047-ai-and-workflow-observability/requirements.md)                          | Deferred | 014, 023, 044, 045, 046       |
| 048  | [AI Workbench](./048-ai-workbench/requirements.md)                                                            | Deferred | 010, 042, 044, 045, 046, 047  |
| 049  | [AI evaluation harness](./049-evaluation-harness/requirements.md)                                             | Deferred | 013, 042, 045, 046            |
| 050  | [Initial AI evaluation datasets](./050-initial-ai-evaluation-datasets/requirements.md)                        | Deferred | 013, 049                      |

### Deferred planner extensions (051–054a)

| ID   | Work item                                                                                                           | Status      | Depends on                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| 051  | [Emergency fund feature](./051-emergency-fund-feature/requirements.md)                                              | Deferred | 012, 028, 032, 034, 035, 036, 037, 038, 045, 046, 049            |
| 052  | [Retirement planner feature](./052-retirement-planner-feature/requirements.md)                                      | Deferred | 012, 016a, 027, 028, 028a, 028b, 033, 034, 035, 036, 037, 038, 042a, 045, 046, 049 |
| 053  | [College savings feature](./053-college-savings-feature/requirements.md)                                            | Deferred | 012, 016a, 027, 028, 033, 034, 035, 036, 037, 038, 045, 046, 049 |
| 054  | [Major purchase scenario feature](./054-major-purchase-scenario-feature/requirements.md)                            | Deferred | 012, 028, 032, 034, 035, 036, 037, 038, 045, 046, 049            |
| 054a | [Debt payoff and investing comparison feature](./054a-debt-payoff-and-investing-comparison-feature/requirements.md) | Deferred | 012, 016a, 028a, 028b, 032, 034, 035, 036, 037, 038, 042a, 045, 046, 049 |

### Deferred integrations and later operations (055–064)

| ID  | Work item                                                                                                                | Status      | Depends on                        |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------- |
| 055 | [MCP STDIO server foundation](./055-mcp-stdio-server/requirements.md)                                                    | Deferred | 001, 040, 047                     |
| 056 | [MCP resources and query tools](./056-mcp-resources-and-query-tools/requirements.md)                                     | Deferred | 032, 036, 037, 040, 055           |
| 057 | [MCP planning and workflow tools](./057-mcp-planning-and-workflow-tools/requirements.md)                                 | Deferred | 039, 046, 047, 051, 052, 053, 055 |
| 058 | [MCP host integration documentation](./058-mcp-host-integration-documentation/requirements.md)                           | Deferred | 055, 056, 057                     |
| 059 | [Local CLI](./059-local-cli/requirements.md)                                                                             | Deferred | 003, 020, 023, 049, 055           |
| 060 | [Backup, restore, and data portability](./060-backup-restore-and-data-portability/requirements.md)                       | Not started | 003, 006, 059                     |
| 061 | [Production SecretStore integrations](./061-production-secret-store-integrations/requirements.md)                        | Deferred | 015, 022, 041, 059                |
| 062 | [Security, privacy, and local-network hardening](./062-security-privacy-and-local-network-hardening/requirements.md)     | Not started | 002, 014, 039, 047, 055, 061      |
| 063 | [Distribution packaging](./063-distribution-packaging/requirements.md)                                                   | Not started | 059, 060, 061, 062                |
| 064 | [Release readiness and contributor documentation](./064-release-readiness-and-contributor-documentation/requirements.md) | Not started | 012, 050, 058, 060, 062, 063      |

## Critical path

The active financial-core dependency path is:

- `024 → 032`
- `027 → 033 → 035`
- `032 + 033 → 034`
- `032 + 034 + 035 → 036 → 037 → 038`

Work items 039–059 and 061 are explicitly deferred. They are not prerequisites for the active core path and must not introduce parallel forecast, allocation, or financial-state models when resumed.

The typed income forecast, funding rules, and shared allocation ledger (033–036) are platform prerequisites for every planner. Feature work must not create a feature-owned projection, allocation, or future balance store.
