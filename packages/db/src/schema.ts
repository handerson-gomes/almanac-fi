import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const importBatches = sqliteTable("import_batches", {
  actor: text("actor").notNull(),
  checksum: text("checksum").notNull().unique(),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  status: text("status", {
    enum: ["completed", "failed", "processing"],
  }).notNull(),
});

export const sourceRecords = sqliteTable("source_records", {
  batchId: text("batch_id")
    .notNull()
    .references(() => importBatches.id),
  checksum: text("checksum").notNull(),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  rawPayload: text("raw_payload").notNull(),
  sourceType: text("source_type").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  actor: text("actor").notNull(),
  afterJson: text("after_json"),
  beforeJson: text("before_json"),
  createdAt: text("created_at").notNull(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  id: text("id").primaryKey(),
  operation: text("operation").notNull(),
  sourceRecordId: text("source_record_id").references(() => sourceRecords.id),
});

export const calculationRuns = sqliteTable("calculation_runs", {
  calculationVersion: text("calculation_version").notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  inputChecksum: text("input_checksum").notNull(),
  status: text("status", {
    enum: ["started", "completed", "failed"],
  }).notNull(),
});

export const institutionConnections = sqliteTable("institution_connections", {
  createdAt: text("created_at").notNull(),
  externalId: text("external_id"),
  id: text("id").primaryKey(),
  institutionName: text("institution_name").notNull(),
  institutionUrl: text("institution_url"),
  provider: text("provider").notNull(),
  secretKey: text("secret_key"),
  status: text("status", {
    enum: ["connected", "disconnected", "error", "needs_reauth"],
  }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
  accountType: text("account_type", {
    enum: [
      "cash",
      "checking",
      "credit_card",
      "investment",
      "loan",
      "other",
      "savings",
    ],
  }).notNull(),
  connectionId: text("connection_id").references(
    () => institutionConnections.id,
    {
      onDelete: "set null",
    },
  ),
  createdAt: text("created_at").notNull(),
  currency: text("currency").notNull(),
  externalId: text("external_id"),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "closed", "hidden"] }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const accountBalances = sqliteTable("account_balances", {
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  amountMinor: integer("amount_minor").notNull(),
  asOf: text("as_of").notNull(),
  availableAmountMinor: integer("available_amount_minor"),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
});

export const categories = sqliteTable("categories", {
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id").references((): AnySQLiteColumn => categories.id),
  status: text("status", { enum: ["active", "archived"] }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const categorizationRules = sqliteTable("categorization_rules", {
  active: integer("active", { mode: "boolean" }).notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  matchField: text("match_field", {
    enum: ["merchant", "payee", "source_category"],
  }).notNull(),
  matchValue: text("match_value").notNull(),
  name: text("name").notNull(),
  precedence: integer("precedence").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  amountMinor: integer("amount_minor").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  createdAt: text("created_at").notNull(),
  currency: text("currency").notNull(),
  id: text("id").primaryKey(),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull(),
  merchant: text("merchant"),
  payee: text("payee"),
  postedAt: text("posted_at"),
  replacesTransactionId: text("replaces_transaction_id").references(
    (): AnySQLiteColumn => transactions.id,
  ),
  sourceCategory: text("source_category"),
  sourceIdentity: text("source_identity").notNull(),
  sourceRecordId: text("source_record_id")
    .notNull()
    .references(() => sourceRecords.id),
  status: text("status", { enum: ["pending", "posted"] }).notNull(),
  transactionDate: text("transaction_date").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const transactionSplits = sqliteTable("transaction_splits", {
  amountMinor: integer("amount_minor").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  memo: text("memo"),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
});

export const csvMappings = sqliteTable("csv_mappings", {
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  mappingJson: text("mapping_json").notNull(),
  name: text("name").notNull().unique(),
  updatedAt: text("updated_at").notNull(),
});
