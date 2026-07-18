import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

export type SqliteConnection = Database.Database;
export type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

const migrations = [
  {
    id: "0001_initial",
    up: `
      CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY, checksum TEXT NOT NULL UNIQUE, source TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS source_records (
        id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES import_batches(id), source_type TEXT NOT NULL,
        raw_payload TEXT NOT NULL, checksum TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL,
        before_json TEXT, after_json TEXT, actor TEXT NOT NULL, source_record_id TEXT REFERENCES source_records(id), created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS calculation_runs (
        id TEXT PRIMARY KEY, calculation_version TEXT NOT NULL, input_checksum TEXT NOT NULL, status TEXT NOT NULL,
        created_at TEXT NOT NULL, completed_at TEXT
      );
      CREATE TRIGGER IF NOT EXISTS audit_events_append_only_update BEFORE UPDATE ON audit_events
        BEGIN SELECT RAISE(ABORT, 'audit_events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_events_append_only_delete BEFORE DELETE ON audit_events
        BEGIN SELECT RAISE(ABORT, 'audit_events are append-only'); END;
    `,
    down: `DROP TABLE IF EXISTS calculation_runs; DROP TRIGGER IF EXISTS audit_events_append_only_delete;
      DROP TRIGGER IF EXISTS audit_events_append_only_update; DROP TABLE IF EXISTS audit_events;
      DROP TABLE IF EXISTS source_records; DROP TABLE IF EXISTS import_batches;`,
  },
  {
    id: "0002_accounts_and_institution_connections",
    up: `
      CREATE TABLE IF NOT EXISTS institutions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        website_url TEXT,
        domain TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS institutions_domain_unique
        ON institutions(lower(domain)) WHERE domain IS NOT NULL;
      CREATE TABLE IF NOT EXISTS provider_connections (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_namespace TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'error', 'needs_reauth')),
        secret_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS external_institution_connections (
        id TEXT PRIMARY KEY,
        provider_connection_id TEXT NOT NULL REFERENCES provider_connections(id),
        institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
        remote_connection_id TEXT NOT NULL,
        remote_name TEXT NOT NULL,
        remote_organization_id TEXT,
        remote_organization_url TEXT,
        status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'error', 'needs_reauth')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(provider_connection_id, remote_connection_id)
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL CHECK (account_type IN ('cash', 'checking', 'savings', 'money_market', 'certificate_of_deposit', 'credit_card', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan', 'other_loan', 'taxable_brokerage', 'traditional_ira', 'roth_ira', 'traditional_sep_ira', 'roth_sep_ira', 'traditional_simple_ira', 'roth_simple_ira', 'traditional_401k', 'roth_401k', 'mixed_401k', 'traditional_403b', 'roth_403b', 'mixed_403b', 'traditional_457b', 'roth_457b', 'mixed_457b', 'pension', 'other_retirement', 'hsa', '529', 'other', 'unclassified')),
        currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
        status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'hidden')),
        institution_id TEXT NOT NULL REFERENCES institutions(id),
        external_connection_id TEXT REFERENCES external_institution_connections(id),
        external_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(external_connection_id, external_id),
        CHECK ((external_connection_id IS NULL AND external_id IS NULL) OR
               (external_connection_id IS NOT NULL AND external_id IS NOT NULL))
      );
      CREATE TABLE IF NOT EXISTS account_import_reviews (
        id TEXT PRIMARY KEY,
        provider_connection_id TEXT NOT NULL REFERENCES provider_connections(id),
        remote_connection_id TEXT NOT NULL,
        remote_connection_name TEXT NOT NULL,
        remote_organization_id TEXT,
        remote_organization_url TEXT,
        remote_account_id TEXT NOT NULL,
        account_name TEXT NOT NULL,
        currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
        account_type TEXT NOT NULL CHECK (account_type IN ('cash', 'checking', 'savings', 'money_market', 'certificate_of_deposit', 'credit_card', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan', 'other_loan', 'taxable_brokerage', 'traditional_ira', 'roth_ira', 'traditional_sep_ira', 'roth_sep_ira', 'traditional_simple_ira', 'roth_simple_ira', 'traditional_401k', 'roth_401k', 'mixed_401k', 'traditional_403b', 'roth_403b', 'mixed_403b', 'traditional_457b', 'roth_457b', 'mixed_457b', 'pension', 'other_retirement', 'hsa', '529', 'other', 'unclassified')),
        candidate_institution_ids_json TEXT NOT NULL,
        match_evidence_json TEXT NOT NULL,
        resolved_institution_id TEXT REFERENCES institutions(id) ON DELETE SET NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'resolved')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(provider_connection_id, remote_connection_id, remote_account_id)
      );
      CREATE TABLE IF NOT EXISTS account_balances (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        amount_minor INTEGER NOT NULL,
        available_amount_minor INTEGER,
        as_of TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS account_balances_account_as_of ON account_balances(account_id, as_of DESC);
      CREATE TRIGGER IF NOT EXISTS accounts_external_institution_insert
        BEFORE INSERT ON accounts
        WHEN NEW.external_connection_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM external_institution_connections
          WHERE id = NEW.external_connection_id AND institution_id = NEW.institution_id
        )
        BEGIN SELECT RAISE(ABORT, 'external connection belongs to another institution'); END;
      CREATE TRIGGER IF NOT EXISTS accounts_external_institution_update
        BEFORE UPDATE OF institution_id, external_connection_id ON accounts
        WHEN NEW.external_connection_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM external_institution_connections
          WHERE id = NEW.external_connection_id AND institution_id = NEW.institution_id
        )
        BEGIN SELECT RAISE(ABORT, 'external connection belongs to another institution'); END;
    `,
    down: `DROP TRIGGER IF EXISTS accounts_external_institution_update;
      DROP TRIGGER IF EXISTS accounts_external_institution_insert;
      DROP INDEX IF EXISTS account_balances_account_as_of; DROP TABLE IF EXISTS account_balances;
      DROP TABLE IF EXISTS account_import_reviews; DROP TABLE IF EXISTS accounts;
      DROP TABLE IF EXISTS external_institution_connections; DROP TABLE IF EXISTS provider_connections;
      DROP INDEX IF EXISTS institutions_domain_unique; DROP TABLE IF EXISTS institutions;`,
  },
  {
    id: "0003_transactions_categories_and_csv_imports",
    up: `
      ALTER TABLE import_batches ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed', 'failed', 'processing'));
      CREATE UNIQUE INDEX IF NOT EXISTS source_records_checksum_unique ON source_records(checksum);
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT REFERENCES categories(id),
        status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categorization_rules (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, category_id TEXT NOT NULL REFERENCES categories(id),
        match_field TEXT NOT NULL CHECK (match_field IN ('merchant', 'payee', 'source_category')),
        match_value TEXT NOT NULL, precedence INTEGER NOT NULL, active INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
        source_record_id TEXT NOT NULL REFERENCES source_records(id), source_identity TEXT NOT NULL,
        replaces_transaction_id TEXT REFERENCES transactions(id), is_current INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'posted')),
        transaction_date TEXT NOT NULL, posted_at TEXT, amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'), merchant TEXT, payee TEXT,
        source_category TEXT, category_id TEXT REFERENCES categories(id),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS transactions_current_source_identity_unique
        ON transactions(source_identity) WHERE is_current = 1;
      CREATE INDEX IF NOT EXISTS transactions_account_date ON transactions(account_id, transaction_date DESC);
      CREATE TABLE IF NOT EXISTS transaction_splits (
        id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id), amount_minor INTEGER NOT NULL, memo TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS csv_mappings (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, mapping_json TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `,
    down: `DROP TABLE IF EXISTS csv_mappings; DROP TABLE IF EXISTS transaction_splits;
      DROP INDEX IF EXISTS transactions_account_date; DROP INDEX IF EXISTS transactions_current_source_identity_unique;
      DROP TABLE IF EXISTS transactions; DROP TABLE IF EXISTS categorization_rules; DROP TABLE IF EXISTS categories;
      DROP INDEX IF EXISTS source_records_checksum_unique;`,
  },
  {
    id: "0004_transfer_matches",
    up: `
      CREATE TABLE IF NOT EXISTS transfer_matches (
        id TEXT PRIMARY KEY,
        outbound_transaction_id TEXT NOT NULL REFERENCES transactions(id),
        inbound_transaction_id TEXT NOT NULL REFERENCES transactions(id),
        status TEXT NOT NULL CHECK (status IN ('candidate', 'confirmed', 'rejected')),
        reason TEXT NOT NULL CHECK (reason IN ('ambiguous', 'exact', 'partial')),
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT,
        UNIQUE(outbound_transaction_id, inbound_transaction_id),
        CHECK(outbound_transaction_id <> inbound_transaction_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS transfer_matches_confirmed_outbound
        ON transfer_matches(outbound_transaction_id) WHERE status = 'confirmed';
      CREATE UNIQUE INDEX IF NOT EXISTS transfer_matches_confirmed_inbound
        ON transfer_matches(inbound_transaction_id) WHERE status = 'confirmed';
    `,
    down: `DROP INDEX IF EXISTS transfer_matches_confirmed_inbound;
      DROP INDEX IF EXISTS transfer_matches_confirmed_outbound; DROP TABLE IF EXISTS transfer_matches;`,
  },
  {
    id: "0005_categorization_reviews",
    up: `
      CREATE TABLE IF NOT EXISTS categorization_reviews (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
        normalized_merchant TEXT,
        suggested_category_id TEXT REFERENCES categories(id),
        method TEXT CHECK (method IN ('ai', 'confirmed_history', 'merchant_rule', 'statistical', 'source_category', 'user_rule')),
        confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
        rule_id TEXT REFERENCES categorization_rules(id),
        status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'dismissed')),
        confirmed_category_id TEXT REFERENCES categories(id),
        confirmed_at TEXT, confirmed_by TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS categorization_reviews_status ON categorization_reviews(status, created_at);
    `,
    down: `DROP INDEX IF EXISTS categorization_reviews_status; DROP TABLE IF EXISTS categorization_reviews;`,
  },
  {
    id: "0006_income_classifications",
    up: `
      CREATE TABLE IF NOT EXISTS income_classifications (
        id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
        kind TEXT NOT NULL CHECK (kind IN ('ambiguous', 'income', 'not_income', 'refund', 'transfer')),
        method TEXT NOT NULL CHECK (method IN ('account_context', 'category_rule', 'transfer_match', 'user_confirmation')),
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        recurring_group TEXT, status TEXT NOT NULL CHECK (status IN ('inferred', 'pending', 'confirmed')),
        confirmed_at TEXT, confirmed_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS income_classifications_status ON income_classifications(status, kind);
    `,
    down: `DROP INDEX IF EXISTS income_classifications_status; DROP TABLE IF EXISTS income_classifications;`,
  },
  {
    id: "0007_household_profile",
    up: `
      CREATE TABLE IF NOT EXISTS households (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        name TEXT NOT NULL, birth_date TEXT, relationship TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dependents (
        id TEXT PRIMARY KEY, person_id TEXT NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
        dependent_until TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS household_facts (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        person_id TEXT REFERENCES people(id) ON DELETE CASCADE, fact_key TEXT NOT NULL,
        value_type TEXT NOT NULL CHECK (value_type IN ('boolean', 'date', 'number', 'string')),
        value_json TEXT NOT NULL, effective_from TEXT NOT NULL, effective_to TEXT,
        source TEXT NOT NULL, confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        sensitivity TEXT NOT NULL CHECK (sensitivity IN ('standard', 'sensitive')),
        verified_at TEXT, verified_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK(effective_to IS NULL OR effective_to > effective_from)
      );
      CREATE INDEX IF NOT EXISTS household_facts_resolution ON household_facts(household_id, fact_key, effective_from, effective_to);
    `,
    down: `DROP INDEX IF EXISTS household_facts_resolution; DROP TABLE IF EXISTS household_facts;
      DROP TABLE IF EXISTS dependents; DROP TABLE IF EXISTS people; DROP TABLE IF EXISTS households;`,
  },
  {
    id: "0008_goals_and_assumptions",
    up: `
      CREATE TABLE IF NOT EXISTS financial_goals (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        name TEXT NOT NULL, target_amount_minor INTEGER NOT NULL CHECK(target_amount_minor >= 0), currency TEXT NOT NULL,
        target_date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'paused')),
        priority_tier TEXT NOT NULL CHECK(priority_tier IN ('aspirational', 'essential', 'important')),
        constraint_level TEXT NOT NULL CHECK(constraint_level IN ('hard', 'soft')),
        funding_strategy TEXT NOT NULL CHECK(funding_strategy IN ('cash', 'investments', 'mixed')),
        dependent_id TEXT REFERENCES people(id), account_id TEXT REFERENCES accounts(id),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK(NOT(priority_tier = 'aspirational' AND constraint_level = 'hard'))
      );
      CREATE TABLE IF NOT EXISTS scenario_assumptions (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        assumption_key TEXT NOT NULL, value_json TEXT NOT NULL, effective_from TEXT NOT NULL, effective_to TEXT,
        source TEXT NOT NULL, confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK(effective_to IS NULL OR effective_to > effective_from)
      );
      CREATE INDEX IF NOT EXISTS scenario_assumptions_resolution ON scenario_assumptions(household_id, assumption_key, effective_from, effective_to);
    `,
    down: `DROP INDEX IF EXISTS scenario_assumptions_resolution; DROP TABLE IF EXISTS scenario_assumptions; DROP TABLE IF EXISTS financial_goals;`,
  },
  {
    id: "0009_investments",
    up: `
      CREATE TABLE IF NOT EXISTS securities (
        id TEXT PRIMARY KEY, symbol TEXT, name TEXT NOT NULL, security_type TEXT NOT NULL CHECK(security_type IN ('cash', 'etf', 'fund', 'stock', 'other')),
        currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS holdings (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), security_id TEXT NOT NULL REFERENCES securities(id),
        as_of TEXT NOT NULL, quantity REAL, price_minor INTEGER, market_value_minor INTEGER, cost_basis_minor INTEGER,
        source TEXT NOT NULL, source_record_id TEXT REFERENCES source_records(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK(quantity IS NULL OR quantity >= 0), CHECK(price_minor IS NULL OR price_minor >= 0),
        UNIQUE(account_id, security_id, as_of)
      );
      CREATE TABLE IF NOT EXISTS investment_transactions (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), security_id TEXT REFERENCES securities(id),
        transaction_date TEXT NOT NULL, transaction_type TEXT NOT NULL CHECK(transaction_type IN ('buy', 'contribution', 'dividend', 'fee', 'sell', 'withdrawal')),
        cash_amount_minor INTEGER, quantity REAL, price_minor INTEGER, cost_basis_minor INTEGER,
        source TEXT NOT NULL, source_record_id TEXT REFERENCES source_records(id), created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS holdings_current ON holdings(account_id, security_id, as_of DESC);
      CREATE INDEX IF NOT EXISTS investment_transactions_history ON investment_transactions(account_id, transaction_date DESC);
    `,
    down: `DROP INDEX IF EXISTS investment_transactions_history; DROP INDEX IF EXISTS holdings_current;
      DROP TABLE IF EXISTS investment_transactions; DROP TABLE IF EXISTS holdings; DROP TABLE IF EXISTS securities;`,
  },
  {
    id: "0010_liabilities_and_obligations",
    up: `
      CREATE TABLE IF NOT EXISTS liabilities (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), account_id TEXT REFERENCES accounts(id),
        name TEXT NOT NULL, currency TEXT NOT NULL, source TEXT NOT NULL, confidence REAL NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS liability_terms (
        id TEXT PRIMARY KEY, liability_id TEXT NOT NULL REFERENCES liabilities(id) ON DELETE CASCADE,
        balance_minor INTEGER NOT NULL CHECK(balance_minor >= 0), annual_rate_bps INTEGER,
        minimum_payment_minor INTEGER NOT NULL CHECK(minimum_payment_minor >= 0), payment_day INTEGER CHECK(payment_day BETWEEN 1 AND 31),
        effective_from TEXT NOT NULL, effective_to TEXT, created_at TEXT NOT NULL,
        CHECK(annual_rate_bps IS NULL OR annual_rate_bps >= 0), CHECK(effective_to IS NULL OR effective_to > effective_from),
        CHECK(balance_minor = 0 OR minimum_payment_minor <= balance_minor)
      );
      CREATE TABLE IF NOT EXISTS recurring_obligations (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), liability_id TEXT REFERENCES liabilities(id),
        name TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0), currency TEXT NOT NULL,
        cadence TEXT NOT NULL CHECK(cadence IN ('annual', 'monthly', 'weekly')), payment_day INTEGER,
        effective_from TEXT NOT NULL, effective_to TEXT, source TEXT NOT NULL, confidence REAL NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(effective_to IS NULL OR effective_to > effective_from)
      );
      CREATE TABLE IF NOT EXISTS liability_scenario_overrides (
        id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, liability_id TEXT NOT NULL REFERENCES liabilities(id),
        terms_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(scenario_id, liability_id)
      );
      CREATE INDEX IF NOT EXISTS liability_terms_resolution ON liability_terms(liability_id, effective_from, effective_to);
    `,
    down: `DROP INDEX IF EXISTS liability_terms_resolution; DROP TABLE IF EXISTS liability_scenario_overrides;
      DROP TABLE IF EXISTS recurring_obligations; DROP TABLE IF EXISTS liability_terms; DROP TABLE IF EXISTS liabilities;`,
  },
  {
    id: "0011_budgets",
    up: `
      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY, household_id TEXT REFERENCES households(id), name TEXT NOT NULL, currency TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'archived')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS budget_periods (
        id TEXT PRIMARY KEY, budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        date_from TEXT NOT NULL, date_to TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active', 'draft')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(date_to >= date_from)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS budget_periods_active_unique ON budget_periods(budget_id, date_from, date_to) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS budget_lines (
        id TEXT PRIMARY KEY, period_id TEXT NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories(id), target_amount_minor INTEGER NOT NULL CHECK(target_amount_minor >= 0),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(period_id, category_id)
      );
    `,
    down: `DROP TABLE IF EXISTS budget_lines; DROP INDEX IF EXISTS budget_periods_active_unique; DROP TABLE IF EXISTS budget_periods; DROP TABLE IF EXISTS budgets;`,
  },
  {
    id: "0012_manual_entry_revisions",
    up: `
      ALTER TABLE account_balances ADD COLUMN is_current INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE account_balances ADD COLUMN replaces_balance_id TEXT REFERENCES account_balances(id);
      CREATE INDEX IF NOT EXISTS account_balances_current_as_of
        ON account_balances(account_id, as_of) WHERE is_current = 1;
    `,
    down: `DROP INDEX IF EXISTS account_balances_current_as_of;`,
  },
  {
    id: "0013_person_linked_income_forecast",
    up: `
      CREATE TABLE IF NOT EXISTS income_sources (
        id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('w2', 'contractor', 'self_employment', 'bonus', 'investment', 'other')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS income_schedules (
        id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES income_sources(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        behavior TEXT NOT NULL CHECK(behavior IN ('fixed', 'variable')),
        gross_amount_minor INTEGER NOT NULL CHECK(gross_amount_minor >= 0),
        low_gross_amount_minor INTEGER, high_gross_amount_minor INTEGER,
        gross_income_basis TEXT NOT NULL CHECK(gross_income_basis = 'gross'),
        cadence TEXT NOT NULL CHECK(cadence IN ('weekly', 'biweekly', 'semimonthly', 'monthly', 'quarterly', 'annual')),
        currency TEXT NOT NULL CHECK(currency GLOB '[A-Z][A-Z][A-Z]'),
        expected_net_amount_minor INTEGER,
        withholding_rate_bps INTEGER CHECK(withholding_rate_bps BETWEEN 0 AND 10000),
        deduction_amount_minor INTEGER CHECK(deduction_amount_minor >= 0),
        effective_from TEXT NOT NULL, effective_to TEXT,
        annual_growth_bps INTEGER NOT NULL DEFAULT 0 CHECK(annual_growth_bps BETWEEN -10000 AND 100000),
        source TEXT NOT NULL, confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        verified_at TEXT, verified_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK(effective_to IS NULL OR effective_to > effective_from),
        CHECK(low_gross_amount_minor IS NULL OR low_gross_amount_minor <= gross_amount_minor),
        CHECK(high_gross_amount_minor IS NULL OR high_gross_amount_minor >= gross_amount_minor),
        CHECK(behavior = 'variable' OR (low_gross_amount_minor IS NULL AND high_gross_amount_minor IS NULL)),
        CHECK(behavior = 'fixed' OR (low_gross_amount_minor IS NOT NULL AND high_gross_amount_minor IS NOT NULL)),
        CHECK(expected_net_amount_minor IS NULL OR behavior = 'fixed')
      );
      CREATE INDEX IF NOT EXISTS income_sources_person ON income_sources(person_id, name);
      CREATE INDEX IF NOT EXISTS income_schedules_source_effective
        ON income_schedules(source_id, effective_from, effective_to);
      CREATE TRIGGER IF NOT EXISTS income_schedules_person_matches_source_insert
        BEFORE INSERT ON income_schedules
        WHEN NOT EXISTS (SELECT 1 FROM income_sources WHERE id = NEW.source_id AND person_id = NEW.person_id)
        BEGIN SELECT RAISE(ABORT, 'income schedule person must match its source'); END;
      CREATE TRIGGER IF NOT EXISTS income_schedules_person_matches_source_update
        BEFORE UPDATE OF source_id, person_id ON income_schedules
        WHEN NOT EXISTS (SELECT 1 FROM income_sources WHERE id = NEW.source_id AND person_id = NEW.person_id)
        BEGIN SELECT RAISE(ABORT, 'income schedule person must match its source'); END;
    `,
    down: `DROP TRIGGER IF EXISTS income_schedules_person_matches_source_update;
      DROP TRIGGER IF EXISTS income_schedules_person_matches_source_insert;
      DROP INDEX IF EXISTS income_schedules_source_effective; DROP INDEX IF EXISTS income_sources_person;
      DROP TABLE IF EXISTS income_schedules; DROP TABLE IF EXISTS income_sources;`,
  },
  {
    id: "0014_income_forecast_reconciliation",
    up: `
      CREATE TABLE IF NOT EXISTS income_forecast_runs (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        start_month TEXT NOT NULL, months INTEGER NOT NULL CHECK(months BETWEEN 1 AND 600),
        input_version TEXT NOT NULL, data_as_of TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS income_forecast_rows (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES income_forecast_runs(id) ON DELETE CASCADE,
        schedule_id TEXT NOT NULL REFERENCES income_schedules(id), source_id TEXT NOT NULL REFERENCES income_sources(id),
        person_id TEXT NOT NULL REFERENCES people(id), month TEXT NOT NULL,
        currency TEXT NOT NULL CHECK(currency GLOB '[A-Z][A-Z][A-Z]'),
        expected_gross_amount_minor INTEGER NOT NULL, expected_net_amount_minor INTEGER,
        low_gross_amount_minor INTEGER NOT NULL, low_net_amount_minor INTEGER,
        high_gross_amount_minor INTEGER NOT NULL, high_net_amount_minor INTEGER,
        warnings_json TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(run_id, schedule_id, month)
      );
      CREATE TABLE IF NOT EXISTS income_reconciliation_matches (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES income_forecast_runs(id) ON DELETE CASCADE,
        forecast_row_id TEXT REFERENCES income_forecast_rows(id) ON DELETE CASCADE,
        expected_gross_amount_minor INTEGER, expected_net_amount_minor INTEGER,
        observed_net_amount_minor INTEGER, variance_minor INTEGER,
        match_method TEXT NOT NULL CHECK(match_method IN ('inferred', 'unmatched_expected', 'unexplained_deposit', 'user_confirmed')),
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        review_state TEXT NOT NULL CHECK(review_state IN ('matched', 'needs_review', 'confirmed', 'unexplained')),
        input_version TEXT NOT NULL, data_as_of TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK(forecast_row_id IS NOT NULL OR match_method = 'unexplained_deposit')
      );
      CREATE TABLE IF NOT EXISTS income_reconciliation_match_deposits (
        match_id TEXT NOT NULL REFERENCES income_reconciliation_matches(id) ON DELETE CASCADE,
        transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id), observed_amount_minor INTEGER NOT NULL,
        PRIMARY KEY(match_id, transaction_id)
      );
      CREATE INDEX IF NOT EXISTS income_forecast_runs_household ON income_forecast_runs(household_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS income_forecast_rows_run_month ON income_forecast_rows(run_id, month);
      CREATE INDEX IF NOT EXISTS income_reconciliation_matches_run ON income_reconciliation_matches(run_id, review_state);
    `,
    down: `DROP INDEX IF EXISTS income_reconciliation_matches_run; DROP INDEX IF EXISTS income_forecast_rows_run_month;
      DROP INDEX IF EXISTS income_forecast_runs_household; DROP TABLE IF EXISTS income_reconciliation_match_deposits;
      DROP TABLE IF EXISTS income_reconciliation_matches; DROP TABLE IF EXISTS income_forecast_rows; DROP TABLE IF EXISTS income_forecast_runs;`,
  },
] as const;

export type AppDatabase = Readonly<{
  client: DrizzleDatabase;
  close: () => void;
  migrate: () => void;
  sqlite: SqliteConnection;
  transaction: <Result>(work: () => Result) => Result;
}>;

export function createDatabase(filename = ":memory:"): AppDatabase {
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");
  const client = drizzle(sqlite, { schema });

  return Object.freeze({
    client,
    close: () => sqlite.close(),
    migrate: () => {
      sqlite.exec(
        "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
      );
      const legacyAccountsMigration = sqlite
        .prepare(
          "SELECT 1 FROM _migrations WHERE id = '0002_accounts_and_institution_connections'",
        )
        .get();
      const institutionsTable = sqlite
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'institutions'",
        )
        .get();
      if (legacyAccountsMigration && !institutionsTable) {
        throw new Error(
          "Legacy account schema detected. Back up any needed data, then delete almanac-fi.sqlite and restart to apply the required 016a database reset.",
        );
      }
      for (const migration of migrations) {
        const applied = sqlite
          .prepare("SELECT 1 FROM _migrations WHERE id = ?")
          .get(migration.id);
        if (!applied) {
          sqlite.transaction(() => {
            sqlite.exec(migration.up);
            sqlite
              .prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)")
              .run(migration.id, now());
          })();
        }
      }
    },
    sqlite,
    transaction: <Result>(work: () => Result): Result =>
      sqlite.transaction(work)(),
  });
}

export function now(): string {
  return new Date().toISOString();
}

export function migrationIds(): readonly string[] {
  return migrations.map((migration) => migration.id);
}

export { schema };
