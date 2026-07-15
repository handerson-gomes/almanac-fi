import {
  type AnySQLiteColumn,
  integer,
  real,
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

export const institutions = sqliteTable("institutions", {
  createdAt: text("created_at").notNull(),
  domain: text("domain"),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  updatedAt: text("updated_at").notNull(),
  websiteUrl: text("website_url"),
});

export const providerConnections = sqliteTable("provider_connections", {
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerNamespace: text("provider_namespace").notNull(),
  secretKey: text("secret_key"),
  status: text("status", {
    enum: ["connected", "disconnected", "error", "needs_reauth"],
  }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const externalInstitutionConnections = sqliteTable(
  "external_institution_connections",
  {
    createdAt: text("created_at").notNull(),
    id: text("id").primaryKey(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    providerConnectionId: text("provider_connection_id")
      .notNull()
      .references(() => providerConnections.id),
    remoteConnectionId: text("remote_connection_id").notNull(),
    remoteName: text("remote_name").notNull(),
    remoteOrganizationId: text("remote_organization_id"),
    remoteOrganizationUrl: text("remote_organization_url"),
    status: text("status", {
      enum: ["connected", "disconnected", "error", "needs_reauth"],
    }).notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const accounts = sqliteTable("accounts", {
  accountType: text("account_type", {
    enum: [
      "cash",
      "checking",
      "savings",
      "money_market",
      "certificate_of_deposit",
      "credit_card",
      "mortgage",
      "auto_loan",
      "student_loan",
      "personal_loan",
      "other_loan",
      "taxable_brokerage",
      "traditional_ira",
      "roth_ira",
      "traditional_sep_ira",
      "roth_sep_ira",
      "traditional_simple_ira",
      "roth_simple_ira",
      "traditional_401k",
      "roth_401k",
      "mixed_401k",
      "traditional_403b",
      "roth_403b",
      "mixed_403b",
      "traditional_457b",
      "roth_457b",
      "mixed_457b",
      "pension",
      "other_retirement",
      "hsa",
      "529",
      "other",
      "unclassified",
    ],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  currency: text("currency").notNull(),
  externalConnectionId: text("external_connection_id").references(
    () => externalInstitutionConnections.id,
  ),
  externalId: text("external_id"),
  id: text("id").primaryKey(),
  institutionId: text("institution_id")
    .notNull()
    .references(() => institutions.id),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "closed", "hidden"] }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const accountImportReviews = sqliteTable("account_import_reviews", {
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(),
  candidateInstitutionIdsJson: text("candidate_institution_ids_json").notNull(),
  createdAt: text("created_at").notNull(),
  currency: text("currency").notNull(),
  id: text("id").primaryKey(),
  matchEvidenceJson: text("match_evidence_json").notNull(),
  providerConnectionId: text("provider_connection_id")
    .notNull()
    .references(() => providerConnections.id),
  remoteAccountId: text("remote_account_id").notNull(),
  remoteConnectionId: text("remote_connection_id").notNull(),
  remoteConnectionName: text("remote_connection_name").notNull(),
  remoteOrganizationId: text("remote_organization_id"),
  remoteOrganizationUrl: text("remote_organization_url"),
  resolvedInstitutionId: text("resolved_institution_id").references(
    () => institutions.id,
    { onDelete: "set null" },
  ),
  status: text("status", { enum: ["pending", "resolved"] }).notNull(),
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
  isCurrent: integer("is_current", { mode: "boolean" }).notNull(),
  replacesBalanceId: text("replaces_balance_id").references(
    (): AnySQLiteColumn => accountBalances.id,
  ),
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

export const transferMatches = sqliteTable("transfer_matches", {
  confidence: real("confidence").notNull(),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
  decidedBy: text("decided_by"),
  id: text("id").primaryKey(),
  inboundTransactionId: text("inbound_transaction_id")
    .notNull()
    .references(() => transactions.id),
  outboundTransactionId: text("outbound_transaction_id")
    .notNull()
    .references(() => transactions.id),
  reason: text("reason", { enum: ["ambiguous", "exact", "partial"] }).notNull(),
  status: text("status", {
    enum: ["candidate", "confirmed", "rejected"],
  }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const categorizationReviews = sqliteTable("categorization_reviews", {
  confidence: real("confidence"),
  confirmedAt: text("confirmed_at"),
  confirmedBy: text("confirmed_by"),
  confirmedCategoryId: text("confirmed_category_id").references(
    () => categories.id,
  ),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  method: text("method", {
    enum: [
      "ai",
      "confirmed_history",
      "merchant_rule",
      "statistical",
      "source_category",
      "user_rule",
    ],
  }),
  normalizedMerchant: text("normalized_merchant"),
  ruleId: text("rule_id").references(() => categorizationRules.id),
  status: text("status", {
    enum: ["pending", "confirmed", "dismissed"],
  }).notNull(),
  suggestedCategoryId: text("suggested_category_id").references(
    () => categories.id,
  ),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id),
  updatedAt: text("updated_at").notNull(),
});

export const incomeClassifications = sqliteTable("income_classifications", {
  confidence: real("confidence").notNull(),
  confirmedAt: text("confirmed_at"),
  confirmedBy: text("confirmed_by"),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  kind: text("kind", {
    enum: ["ambiguous", "income", "not_income", "refund", "transfer"],
  }).notNull(),
  method: text("method", {
    enum: [
      "account_context",
      "category_rule",
      "transfer_match",
      "user_confirmation",
    ],
  }).notNull(),
  recurringGroup: text("recurring_group"),
  status: text("status", {
    enum: ["inferred", "pending", "confirmed"],
  }).notNull(),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id),
  updatedAt: text("updated_at").notNull(),
});

export const csvMappings = sqliteTable("csv_mappings", {
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  mappingJson: text("mapping_json").notNull(),
  name: text("name").notNull().unique(),
  updatedAt: text("updated_at").notNull(),
});
