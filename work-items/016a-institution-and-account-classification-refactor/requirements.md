# 016a — Institution and account-classification refactor

## Story

As a user, I can organize every financial account under its real-world institution and classify the account precisely enough for future tax-aware planning, whether the account was entered manually or discovered through an integration.

## Context

The current `institution_connections` model combines the local identity of an institution with the credentials and state of an external connection. Accounts consequently belong to a connection rather than directly to an institution. That does not support manual institutions, multiple institutions returned by one SimpleFIN Access URL, or multiple logins at the same institution.

The current account-type enum also collapses tax-relevant accounts into `investment`. Retirement planning needs to distinguish plan family and tax treatment without guessing.

This work item implements [ADR 0001](../../doc/adr/0001-separate-institutions-from-provider-connections.md).

## Domain model

```text
ProviderConnection (one integration credential)
  └── ExternalInstitutionConnection (one remote login/conn_id)
        ├── Institution (local identity)
        └── Account(s) discovered through that login

Account ── required owner ──> Institution
Account ── optional source ─> ExternalInstitutionConnection
```

### Institution

`Institution` is the stable, local identity of a financial institution, such as PNC or Charles Schwab. It exists independently of any integration and contains at least an ID, display name, optional canonical website/domain, and timestamps.

Every account must reference exactly one institution. A user who tracks physical cash may create a local institution such as “Cash”; a null institution is not permitted.

### Provider connection

`ProviderConnection` represents one claimed integration credential, such as one SimpleFIN Access URL. It contains provider identity, a credential-free provider/server namespace, connection status, a `SecretStore` key reference, and timestamps. Raw credentials must never be persisted in the database, API payloads, logs, or UI.

One provider connection may yield many external institution connections.

### External institution connection

`ExternalInstitutionConnection` represents one provider-reported login or connection, such as a SimpleFIN v2 `conn_id`. It belongs to exactly one provider connection and exactly one institution. It retains the provider connection ID, remote connection ID/name, remote organization ID/URL when available, status, and timestamps.

Multiple external connections may resolve to the same institution, including separate login credentials for the same bank. Remote connection IDs are unique within their provider connection, not globally.

### Account

Replace `accounts.connection_id` with:

- required `institution_id`;
- optional `external_connection_id`; and
- optional external account ID, unique within a non-null external connection.

Manual accounts have no external connection. Imported accounts retain their external connection after disconnection so their provenance remains explainable.

## Account classification

Replace the broad account-type enum with the following stable subtype codes.

### Depository

- `cash`
- `checking`
- `savings`
- `money_market`
- `certificate_of_deposit`

### Credit and debt

- `credit_card`
- `mortgage`
- `auto_loan`
- `student_loan`
- `personal_loan`
- `other_loan`

### Taxable investing

- `taxable_brokerage`

### Retirement

- `traditional_ira`
- `roth_ira`
- `traditional_sep_ira`
- `roth_sep_ira`
- `traditional_simple_ira`
- `roth_simple_ira`
- `traditional_401k`
- `roth_401k`
- `mixed_401k`
- `traditional_403b`
- `roth_403b`
- `mixed_403b`
- `traditional_457b`
- `roth_457b`
- `mixed_457b`
- `pension`
- `other_retirement`

### Other tax-advantaged and fallback types

- `hsa`
- `529`
- `other`
- `unclassified`

`mixed_*` means the available provider balance combines pre-tax and Roth assets that cannot yet be separated reliably. `unclassified` is allowed only as an explicit missing-information state; downstream tax-aware calculations must not infer tax treatment from it.

## Requirements

### Persistence and reset

- Replace the conflated institution-connection schema with institution, provider-connection, and external-institution-connection persistence and the account relationships above.
- Enforce required institution ownership and all relationship/uniqueness constraints in SQLite, the Drizzle schema, repository types, and validation contracts.
- Update every existing account consumer, including transactions, CSV import, investments, liabilities, fixtures, and core calculations, to use the new relationships and subtype codes.
- A destructive local database reset is explicitly accepted. No row-level migration or backward-compatible API period is required. The resulting migration chain must create a valid schema from an empty database, and the documented reset procedure must make the data loss explicit before deletion.

### Contracts, repositories, and API

- Add validated repository and API CRUD operations for institutions.
- Add provider-connection and external-connection read/lifecycle contracts needed by import adapters and the UI.
- Replace account `connectionId` contracts with required `institutionId` and optional `externalConnectionId`.
- Return a conflict/domain error when deleting an institution that still owns accounts.
- Disconnecting or deleting provider credentials must preserve institutions, external-connection provenance, accounts, balances, holdings, investment activity, obligations, and transactions. The external connection becomes disconnected rather than being silently removed from historical records.

### Institution matching and import review

- Normalize provider output behind a provider-neutral reconciliation service; SimpleFIN claiming and network sync remain owned by work items 022 and 023.
- Match an incoming organization first by remote organization ID within the provider/server namespace, then by normalized institution domain.
- Never merge automatically when candidates conflict or more than one institution matches. Stage the item for user review with the evidence used by each candidate match.
- After resolving an institution, upsert the external connection by provider connection plus remote connection ID, then associate its accounts.
- When the provider supplies no reliable account subtype, create/stage the account as `unclassified` and require user classification before the import is considered complete.
- Re-importing the same provider, connection, organization, and account identities must be idempotent.

### User interface

- Add institution management for listing, creating, and editing institutions. Deletion must explain which accounts prevent removal.
- Require an institution in the account form and provide an inline “Add institution” path that returns the newly created institution to the form.
- Present account subtypes in understandable groups; identify `mixed_*` and `unclassified` as needing additional detail rather than assigning false tax precision.
- Add a provider-neutral import-review surface for ambiguous institution matches and unclassified accounts. Users can select/create the institution and choose the account subtype before completing review.
- Add a connection-management surface that shows the provider connection, the institutions/logins discovered through it, sync status, and the destructive effect of revoking credentials without implying that local financial history will be deleted.

## Acceptance criteria

- An institution can be created without any integration, and a manual account can be created under it with no external connection.
- Account creation and update reject a missing or nonexistent institution.
- One provider connection can own external connections for multiple institutions, and multiple external connections can map to the same institution.
- An external account is deduplicated within its external connection; identical remote account IDs on different external connections do not collide.
- Exact provider/server-scoped organization-ID matches are automatic; unique normalized-domain matches are automatic; conflicts are reviewable and are never merged silently.
- Imported accounts with no reliable subtype remain visibly `unclassified`, cannot complete import review, and are reported as missing information to tax-aware consumers.
- Traditional, Roth, and mixed variants for 401(k), 403(b), and 457(b), plus the listed IRA variants and other retirement types, round-trip through database, API, and UI validation.
- Removing or disconnecting credentials does not delete locally retained financial records or sever their provenance.
- An institution with accounts cannot be deleted; after its accounts are reassigned or removed, deletion succeeds.
- A fresh database can be created, institutions/accounts can be re-entered, and the existing CSV import flow can be exercised successfully against the rebuilt model.
- API, repository, reconciliation, UI, and regression tests cover the new model and all quality checks pass.

## Out of scope

- Calculating taxes, contribution limits, required minimum distributions, withdrawal penalties, or tax projections.
- Splitting a provider-supplied mixed retirement balance into invented traditional and Roth amounts.
- Claiming SimpleFIN tokens or performing live SimpleFIN synchronization; those remain in work items 022 and 023.
- Preserving or migrating existing local financial data during the schema reset.

## Dependencies

006, 007, 008, 010, 015, 016, 019, 020, 023a, 028a, 028b

## Verification

Run fresh-database migration tests; repository and API constraint/lifecycle tests; provider reconciliation and idempotency fixtures; account/institution UI tests; CSV import regression tests; and the full workspace quality suite.

## Status

Complete
