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
      CREATE TABLE IF NOT EXISTS institution_connections (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        institution_name TEXT NOT NULL,
        institution_url TEXT,
        external_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'error', 'needs_reauth')),
        secret_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL CHECK (account_type IN ('cash', 'checking', 'credit_card', 'investment', 'loan', 'other', 'savings')),
        currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
        status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'hidden')),
        connection_id TEXT REFERENCES institution_connections(id) ON DELETE SET NULL,
        external_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(connection_id, external_id)
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
    `,
    down: `DROP INDEX IF EXISTS account_balances_account_as_of; DROP TABLE IF EXISTS account_balances;
      DROP TABLE IF EXISTS accounts; DROP TABLE IF EXISTS institution_connections;`,
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
