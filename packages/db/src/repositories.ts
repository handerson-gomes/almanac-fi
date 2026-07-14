import { randomUUID } from "node:crypto";

import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type Page<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;
export type PageRequest = Readonly<{
  cursor?: string | undefined;
  limit?: number | undefined;
}>;
export type ImportBatch = Readonly<{
  actor: string;
  checksum: string;
  createdAt: string;
  id: string;
  source: string;
  status: "completed" | "failed" | "processing";
}>;
export type SourceRecord = Readonly<{
  batchId: string;
  checksum: string;
  createdAt: string;
  id: string;
  rawPayload: string;
  sourceType: string;
}>;
export type AuditEvent = Readonly<{
  actor: string;
  afterJson: string | null;
  beforeJson: string | null;
  createdAt: string;
  entityId: string;
  entityType: string;
  id: string;
  operation: string;
  sourceRecordId: string | null;
}>;
export const accountTypes = [
  "cash",
  "checking",
  "credit_card",
  "investment",
  "loan",
  "other",
  "savings",
] as const;
export type AccountType = (typeof accountTypes)[number];
export const accountStatuses = ["active", "closed", "hidden"] as const;
export type AccountStatus = (typeof accountStatuses)[number];
export const connectionStatuses = [
  "connected",
  "disconnected",
  "error",
  "needs_reauth",
] as const;
export type ConnectionStatus = (typeof connectionStatuses)[number];

export type InstitutionConnection = Readonly<{
  createdAt: string;
  externalId: string | null;
  id: string;
  institutionName: string;
  institutionUrl: string | null;
  provider: string;
  secretKey: string | null;
  status: ConnectionStatus;
  updatedAt: string;
}>;
export type Account = Readonly<{
  accountType: AccountType;
  connectionId: string | null;
  createdAt: string;
  currency: string;
  externalId: string | null;
  id: string;
  name: string;
  status: AccountStatus;
  updatedAt: string;
}>;
export type AccountBalance = Readonly<{
  accountId: string;
  amountMinor: number;
  asOf: string;
  availableAmountMinor: number | null;
  createdAt: string;
  id: string;
}>;
export type Category = Readonly<{
  createdAt: string;
  id: string;
  name: string;
  parentId: string | null;
  status: "active" | "archived";
  updatedAt: string;
}>;
export type CategorizationRule = Readonly<{
  active: boolean;
  categoryId: string;
  createdAt: string;
  id: string;
  matchField: "merchant" | "payee" | "source_category";
  matchValue: string;
  name: string;
  precedence: number;
  updatedAt: string;
}>;
export type Transaction = Readonly<{
  accountId: string;
  amountMinor: number;
  categoryId: string | null;
  createdAt: string;
  currency: string;
  id: string;
  isCurrent: boolean;
  merchant: string | null;
  payee: string | null;
  postedAt: string | null;
  replacesTransactionId: string | null;
  sourceCategory: string | null;
  sourceIdentity: string;
  sourceRecordId: string;
  status: "pending" | "posted";
  transactionDate: string;
  updatedAt: string;
}>;
export type TransactionSplit = Readonly<{
  amountMinor: number;
  categoryId: string | null;
  createdAt: string;
  id: string;
  memo: string | null;
  transactionId: string;
}>;
export type TransactionDetails = Readonly<{
  splits: readonly TransactionSplit[];
  transaction: Transaction;
}>;
export type CsvMapping = Readonly<{
  createdAt: string;
  id: string;
  mappingJson: string;
  name: string;
  updatedAt: string;
}>;
export type TransactionFilter = Readonly<{
  accountId?: string | undefined;
  categoryId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  status?: Transaction["status"] | undefined;
}>;
export type TransactionSplitInput = Readonly<{
  amountMinor: number;
  categoryId: string | null;
  memo: string | null;
}>;
type CategorizationRuleUpdate = {
  [
    Key in
      | "active"
      | "categoryId"
      | "matchField"
      | "matchValue"
      | "name"
      | "precedence"
  ]?: CategorizationRule[Key] | undefined;
};
type InstitutionConnectionUpdate = {
  [
    Key in
      | "externalId"
      | "institutionName"
      | "institutionUrl"
      | "provider"
      | "secretKey"
      | "status"
  ]?: InstitutionConnection[Key] | undefined;
};
type AccountUpdate = {
  [
    Key in
      | "accountType"
      | "connectionId"
      | "currency"
      | "externalId"
      | "name"
      | "status"
  ]?: Account[Key] | undefined;
};

export interface ImportBatchRepository {
  create(
    input: Omit<ImportBatch, "createdAt" | "id" | "status"> & {
      status?: ImportBatch["status"] | undefined;
    },
  ): ImportBatch;
  findByChecksum(checksum: string): ImportBatch | undefined;
}

export interface SourceRecordRepository {
  create(input: Omit<SourceRecord, "createdAt" | "id">): SourceRecord;
  findByChecksum(checksum: string): SourceRecord | undefined;
}

export interface AuditEventRepository {
  append(input: Omit<AuditEvent, "createdAt" | "id">): AuditEvent;
  list(page?: PageRequest): Page<AuditEvent>;
}

export interface InstitutionConnectionRepository {
  create(
    input: Omit<InstitutionConnection, "createdAt" | "id" | "updatedAt">,
  ): InstitutionConnection;
  delete(id: string): boolean;
  findById(id: string): InstitutionConnection | undefined;
  list(page?: PageRequest): Page<InstitutionConnection>;
  update(
    id: string,
    input: InstitutionConnectionUpdate,
  ): InstitutionConnection | undefined;
}

export interface AccountRepository {
  addBalance(input: Omit<AccountBalance, "createdAt" | "id">): AccountBalance;
  create(input: Omit<Account, "createdAt" | "id" | "updatedAt">): Account;
  delete(id: string): boolean;
  findById(id: string): Account | undefined;
  list(page?: PageRequest): Page<Account>;
  listBalances(accountId: string, page?: PageRequest): Page<AccountBalance>;
  update(id: string, input: AccountUpdate): Account | undefined;
}

export interface CategoryRepository {
  create(input: Omit<Category, "createdAt" | "id" | "updatedAt">): Category;
  findById(id: string): Category | undefined;
  findByName(name: string): Category | undefined;
  list(page?: PageRequest): Page<Category>;
  update(
    id: string,
    input: Readonly<{
      name?: string | undefined;
      parentId?: string | null | undefined;
      status?: Category["status"] | undefined;
    }>,
  ): Category | undefined;
}

export interface CategorizationRuleRepository {
  create(
    input: Omit<CategorizationRule, "createdAt" | "id" | "updatedAt">,
  ): CategorizationRule;
  evaluate(
    input: Pick<Transaction, "merchant" | "payee" | "sourceCategory">,
  ): CategorizationRule | undefined;
  list(page?: PageRequest): Page<CategorizationRule>;
  update(
    id: string,
    input: CategorizationRuleUpdate,
  ): CategorizationRule | undefined;
}

export interface TransactionRepository {
  assignUncategorizedSourceCategories(): number;
  create(
    input: Omit<
      Transaction,
      "createdAt" | "id" | "isCurrent" | "replacesTransactionId" | "updatedAt"
    >,
    splits?: readonly TransactionSplitInput[],
  ): TransactionDetails;
  findById(id: string): Transaction | undefined;
  findCurrentBySourceIdentity(sourceIdentity: string): Transaction | undefined;
  getDetails(id: string): TransactionDetails | undefined;
  list(filter?: TransactionFilter, page?: PageRequest): Page<Transaction>;
  replaceCurrent(
    input: Omit<
      Transaction,
      "createdAt" | "id" | "isCurrent" | "replacesTransactionId" | "updatedAt"
    >,
    splits?: readonly TransactionSplitInput[],
  ): TransactionDetails;
}

export interface CsvMappingRepository {
  create(input: Omit<CsvMapping, "createdAt" | "id" | "updatedAt">): CsvMapping;
  delete(id: string): boolean;
  list(page?: PageRequest): Page<CsvMapping>;
  update(
    id: string,
    input: Pick<CsvMapping, "mappingJson" | "name">,
  ): CsvMapping | undefined;
}

export interface UnitOfWork {
  readonly accounts: AccountRepository;
  readonly auditEvents: AuditEventRepository;
  readonly categories: CategoryRepository;
  readonly categorizationRules: CategorizationRuleRepository;
  readonly csvMappings: CsvMappingRepository;
  readonly importBatches: ImportBatchRepository;
  readonly institutionConnections: InstitutionConnectionRepository;
  readonly sourceRecords: SourceRecordRepository;
  readonly transactions: TransactionRepository;
}

function pageSize(request: PageRequest = {}): number {
  return Math.min(Math.max(request.limit ?? 50, 1), 100);
}

function transactionCursor(transaction: Transaction): string {
  return `${transaction.transactionDate}|${transaction.id}`;
}

function parseTransactionCursor(
  cursor: string | undefined,
): Readonly<{ id: string; transactionDate: string }> | undefined {
  if (cursor === undefined) return undefined;
  const separator = cursor.lastIndexOf("|");
  if (separator <= 0 || separator === cursor.length - 1) return undefined;
  return {
    id: cursor.slice(separator + 1),
    transactionDate: cursor.slice(0, separator),
  };
}

export function createUnitOfWork(database: AppDatabase): UnitOfWork {
  const institutionConnections: InstitutionConnectionRepository = {
    create(input) {
      const timestamp = now();
      const record: InstitutionConnection = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO institution_connections (id, provider, institution_name, institution_url, external_id, status, secret_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.provider,
          record.institutionName,
          record.institutionUrl,
          record.externalId,
          record.status,
          record.secretKey,
          record.createdAt,
          record.updatedAt,
        );
      return record;
    },
    delete(id) {
      return (
        database.sqlite
          .prepare("DELETE FROM institution_connections WHERE id = ?")
          .run(id).changes > 0
      );
    },
    findById(id) {
      return database.sqlite
        .prepare(
          "SELECT id, provider, institution_name AS institutionName, institution_url AS institutionUrl, external_id AS externalId, status, secret_key AS secretKey, created_at AS createdAt, updated_at AS updatedAt FROM institution_connections WHERE id = ?",
        )
        .get(id) as InstitutionConnection | undefined;
    },
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, provider, institution_name AS institutionName, institution_url AS institutionUrl, external_id AS externalId, status, secret_key AS secretKey, created_at AS createdAt, updated_at AS updatedAt FROM institution_connections WHERE id > ? ORDER BY id LIMIT ?",
        )
        .all(request?.cursor ?? "", limit + 1) as InstitutionConnection[];
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    update(id, input) {
      const current = institutionConnections.findById(id);
      if (!current) return undefined;
      const record: InstitutionConnection = {
        createdAt: current.createdAt,
        externalId:
          input.externalId === undefined
            ? current.externalId
            : input.externalId,
        id: current.id,
        institutionName:
          input.institutionName === undefined
            ? current.institutionName
            : input.institutionName,
        institutionUrl:
          input.institutionUrl === undefined
            ? current.institutionUrl
            : input.institutionUrl,
        provider:
          input.provider === undefined ? current.provider : input.provider,
        secretKey:
          input.secretKey === undefined ? current.secretKey : input.secretKey,
        status: input.status === undefined ? current.status : input.status,
        updatedAt: now(),
      };
      database.sqlite
        .prepare(
          "UPDATE institution_connections SET provider = ?, institution_name = ?, institution_url = ?, external_id = ?, status = ?, secret_key = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          record.provider,
          record.institutionName,
          record.institutionUrl,
          record.externalId,
          record.status,
          record.secretKey,
          record.updatedAt,
          id,
        );
      return record;
    },
  };
  const accounts: AccountRepository = {
    addBalance(input) {
      const record: AccountBalance = {
        ...input,
        createdAt: now(),
        id: randomUUID(),
      };
      database.sqlite
        .prepare(
          "INSERT INTO account_balances (id, account_id, amount_minor, available_amount_minor, as_of, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.accountId,
          record.amountMinor,
          record.availableAmountMinor,
          record.asOf,
          record.createdAt,
        );
      return record;
    },
    create(input) {
      const timestamp = now();
      const record: Account = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO accounts (id, name, account_type, currency, status, connection_id, external_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.name,
          record.accountType,
          record.currency,
          record.status,
          record.connectionId,
          record.externalId,
          record.createdAt,
          record.updatedAt,
        );
      return record;
    },
    delete(id) {
      return (
        database.sqlite.prepare("DELETE FROM accounts WHERE id = ?").run(id)
          .changes > 0
      );
    },
    findById(id) {
      return database.sqlite
        .prepare(
          "SELECT id, name, account_type AS accountType, currency, status, connection_id AS connectionId, external_id AS externalId, created_at AS createdAt, updated_at AS updatedAt FROM accounts WHERE id = ?",
        )
        .get(id) as Account | undefined;
    },
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, name, account_type AS accountType, currency, status, connection_id AS connectionId, external_id AS externalId, created_at AS createdAt, updated_at AS updatedAt FROM accounts WHERE id > ? ORDER BY id LIMIT ?",
        )
        .all(request?.cursor ?? "", limit + 1) as Account[];
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    listBalances(accountId, request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, account_id AS accountId, amount_minor AS amountMinor, available_amount_minor AS availableAmountMinor, as_of AS asOf, created_at AS createdAt FROM account_balances WHERE account_id = ? AND id > ? ORDER BY id LIMIT ?",
        )
        .all(accountId, request?.cursor ?? "", limit + 1) as AccountBalance[];
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    update(id, input) {
      const current = accounts.findById(id);
      if (!current) return undefined;
      const record: Account = {
        accountType:
          input.accountType === undefined
            ? current.accountType
            : input.accountType,
        connectionId:
          input.connectionId === undefined
            ? current.connectionId
            : input.connectionId,
        createdAt: current.createdAt,
        currency:
          input.currency === undefined ? current.currency : input.currency,
        externalId:
          input.externalId === undefined
            ? current.externalId
            : input.externalId,
        id: current.id,
        name: input.name === undefined ? current.name : input.name,
        status: input.status === undefined ? current.status : input.status,
        updatedAt: now(),
      };
      database.sqlite
        .prepare(
          "UPDATE accounts SET name = ?, account_type = ?, currency = ?, status = ?, connection_id = ?, external_id = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          record.name,
          record.accountType,
          record.currency,
          record.status,
          record.connectionId,
          record.externalId,
          record.updatedAt,
          id,
        );
      return record;
    },
  };
  const categories: CategoryRepository = {
    create(input) {
      const timestamp = now();
      const record: Category = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO categories (id, name, parent_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.name,
          record.parentId,
          record.status,
          record.createdAt,
          record.updatedAt,
        );
      return record;
    },
    findById(id) {
      return database.sqlite
        .prepare(
          "SELECT id, name, parent_id AS parentId, status, created_at AS createdAt, updated_at AS updatedAt FROM categories WHERE id = ?",
        )
        .get(id) as Category | undefined;
    },
    findByName(name) {
      return database.sqlite
        .prepare(
          "SELECT id, name, parent_id AS parentId, status, created_at AS createdAt, updated_at AS updatedAt FROM categories WHERE lower(name) = lower(?)",
        )
        .get(name) as Category | undefined;
    },
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, name, parent_id AS parentId, status, created_at AS createdAt, updated_at AS updatedAt FROM categories WHERE id > ? ORDER BY id LIMIT ?",
        )
        .all(request?.cursor ?? "", limit + 1) as Category[];
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    update(id, input) {
      const current = categories.findById(id);
      if (!current) return undefined;
      const parentId =
        input.parentId === undefined ? current.parentId : input.parentId;
      for (let ancestorId = parentId; ancestorId !== null;) {
        if (ancestorId === id)
          throw new Error("Category hierarchy cannot contain a cycle.");
        const ancestor = categories.findById(ancestorId);
        if (!ancestor) throw new Error("The parent category does not exist.");
        ancestorId = ancestor.parentId;
      }
      const record: Category = {
        createdAt: current.createdAt,
        id: current.id,
        name: input.name === undefined ? current.name : input.name,
        parentId,
        status: input.status === undefined ? current.status : input.status,
        updatedAt: now(),
      };
      database.sqlite
        .prepare(
          "UPDATE categories SET name = ?, parent_id = ?, status = ?, updated_at = ? WHERE id = ?",
        )
        .run(record.name, record.parentId, record.status, record.updatedAt, id);
      return record;
    },
  };
  const categorizationRules: CategorizationRuleRepository = {
    create(input) {
      const timestamp = now();
      const record: CategorizationRule = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO categorization_rules (id, name, category_id, match_field, match_value, precedence, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.name,
          record.categoryId,
          record.matchField,
          record.matchValue,
          record.precedence,
          record.active ? 1 : 0,
          record.createdAt,
          record.updatedAt,
        );
      return record;
    },
    evaluate(input) {
      const rules = (
        database.sqlite
          .prepare(
            "SELECT r.id, r.name, r.category_id AS categoryId, r.match_field AS matchField, r.match_value AS matchValue, r.precedence, r.active, r.created_at AS createdAt, r.updated_at AS updatedAt FROM categorization_rules r JOIN categories c ON c.id = r.category_id WHERE r.active = 1 AND c.status = 'active' ORDER BY r.precedence ASC, r.id ASC",
          )
          .all() as CategorizationRule[]
      ).map((rule) => ({
        ...rule,
        active: Boolean(rule.active),
      }));
      return rules.find((rule) => {
        const value =
          rule.matchField === "source_category"
            ? input.sourceCategory
            : input[rule.matchField];
        return (
          value?.trim().toLocaleLowerCase() ===
          rule.matchValue.trim().toLocaleLowerCase()
        );
      });
    },
    list(request) {
      const limit = pageSize(request);
      const rows = (
        database.sqlite
          .prepare(
            "SELECT id, name, category_id AS categoryId, match_field AS matchField, match_value AS matchValue, precedence, active, created_at AS createdAt, updated_at AS updatedAt FROM categorization_rules WHERE id > ? ORDER BY precedence ASC, id ASC LIMIT ?",
          )
          .all(request?.cursor ?? "", limit + 1) as CategorizationRule[]
      ).map((rule) => ({ ...rule, active: Boolean(rule.active) }));
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    update(id, input) {
      const current = database.sqlite
        .prepare(
          "SELECT id, name, category_id AS categoryId, match_field AS matchField, match_value AS matchValue, precedence, active, created_at AS createdAt, updated_at AS updatedAt FROM categorization_rules WHERE id = ?",
        )
        .get(id) as CategorizationRule | undefined;
      if (!current) return undefined;
      const normalizedCurrent: CategorizationRule = {
        ...current,
        active: Boolean(current.active),
      };
      const record: CategorizationRule = {
        active:
          input.active === undefined ? normalizedCurrent.active : input.active,
        categoryId:
          input.categoryId === undefined
            ? normalizedCurrent.categoryId
            : input.categoryId,
        createdAt: normalizedCurrent.createdAt,
        id: normalizedCurrent.id,
        matchField:
          input.matchField === undefined
            ? normalizedCurrent.matchField
            : input.matchField,
        matchValue:
          input.matchValue === undefined
            ? normalizedCurrent.matchValue
            : input.matchValue,
        name: input.name === undefined ? normalizedCurrent.name : input.name,
        precedence:
          input.precedence === undefined
            ? normalizedCurrent.precedence
            : input.precedence,
        updatedAt: now(),
      };
      database.sqlite
        .prepare(
          "UPDATE categorization_rules SET name = ?, category_id = ?, match_field = ?, match_value = ?, precedence = ?, active = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          record.name,
          record.categoryId,
          record.matchField,
          record.matchValue,
          record.precedence,
          record.active ? 1 : 0,
          record.updatedAt,
          id,
        );
      return record;
    },
  };
  function insertTransaction(
    input: Omit<
      Transaction,
      "createdAt" | "id" | "isCurrent" | "replacesTransactionId" | "updatedAt"
    >,
    replacesTransactionId: string | null,
    splits: readonly TransactionSplitInput[] = [],
  ): TransactionDetails {
    if (
      splits.length > 0 &&
      splits.reduce((sum, split) => sum + split.amountMinor, 0) !==
        input.amountMinor
    ) {
      throw new Error(
        "Transaction split totals must equal the parent transaction amount.",
      );
    }
    const timestamp = now();
    const transaction: Transaction = {
      ...input,
      createdAt: timestamp,
      id: randomUUID(),
      isCurrent: true,
      replacesTransactionId,
      updatedAt: timestamp,
    };
    database.sqlite
      .prepare(
        "INSERT INTO transactions (id, account_id, source_record_id, source_identity, replaces_transaction_id, is_current, status, transaction_date, posted_at, amount_minor, currency, merchant, payee, source_category, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        transaction.id,
        transaction.accountId,
        transaction.sourceRecordId,
        transaction.sourceIdentity,
        transaction.replacesTransactionId,
        1,
        transaction.status,
        transaction.transactionDate,
        transaction.postedAt,
        transaction.amountMinor,
        transaction.currency,
        transaction.merchant,
        transaction.payee,
        transaction.sourceCategory,
        transaction.categoryId,
        transaction.createdAt,
        transaction.updatedAt,
      );
    const createdSplits = splits.map((split): TransactionSplit => {
      const record: TransactionSplit = {
        ...split,
        createdAt: timestamp,
        id: randomUUID(),
        transactionId: transaction.id,
      };
      database.sqlite
        .prepare(
          "INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.transactionId,
          record.categoryId,
          record.amountMinor,
          record.memo,
          record.createdAt,
        );
      return record;
    });
    return { splits: createdSplits, transaction };
  }
  function transactionRecord(
    row: Transaction | undefined,
  ): Transaction | undefined {
    return row === undefined
      ? undefined
      : { ...row, isCurrent: Boolean(row.isCurrent) };
  }
  const transactions: TransactionRepository = {
    assignUncategorizedSourceCategories() {
      const sourceCategories = database.sqlite
        .prepare(
          "SELECT DISTINCT source_category AS sourceCategory FROM transactions WHERE source_category IS NOT NULL AND category_id IS NULL",
        )
        .all() as ReadonlyArray<{ sourceCategory: string }>;
      let assigned = 0;
      for (const { sourceCategory } of sourceCategories) {
        const category =
          categories.findByName(sourceCategory) ??
          categories.create({
            name: sourceCategory,
            parentId: null,
            status: "active",
          });
        assigned += database.sqlite
          .prepare(
            "UPDATE transactions SET category_id = ?, updated_at = ? WHERE source_category = ? AND category_id IS NULL",
          )
          .run(category.id, now(), sourceCategory).changes;
      }
      return assigned;
    },
    create(input, splits) {
      return insertTransaction(input, null, splits);
    },
    findById(id) {
      return transactionRecord(
        database.sqlite
          .prepare(
            "SELECT id, account_id AS accountId, source_record_id AS sourceRecordId, source_identity AS sourceIdentity, replaces_transaction_id AS replacesTransactionId, is_current AS isCurrent, status, transaction_date AS transactionDate, posted_at AS postedAt, amount_minor AS amountMinor, currency, merchant, payee, source_category AS sourceCategory, category_id AS categoryId, created_at AS createdAt, updated_at AS updatedAt FROM transactions WHERE id = ?",
          )
          .get(id) as Transaction | undefined,
      );
    },
    findCurrentBySourceIdentity(sourceIdentity) {
      return transactionRecord(
        database.sqlite
          .prepare(
            "SELECT id, account_id AS accountId, source_record_id AS sourceRecordId, source_identity AS sourceIdentity, replaces_transaction_id AS replacesTransactionId, is_current AS isCurrent, status, transaction_date AS transactionDate, posted_at AS postedAt, amount_minor AS amountMinor, currency, merchant, payee, source_category AS sourceCategory, category_id AS categoryId, created_at AS createdAt, updated_at AS updatedAt FROM transactions WHERE source_identity = ? AND is_current = 1",
          )
          .get(sourceIdentity) as Transaction | undefined,
      );
    },
    getDetails(id) {
      const transaction = transactions.findById(id);
      if (!transaction) return undefined;
      const splits = database.sqlite
        .prepare(
          "SELECT id, transaction_id AS transactionId, category_id AS categoryId, amount_minor AS amountMinor, memo, created_at AS createdAt FROM transaction_splits WHERE transaction_id = ? ORDER BY id",
        )
        .all(id) as TransactionSplit[];
      return { splits, transaction };
    },
    list(filter = {}, request) {
      const conditions = ["is_current = 1"];
      const values: (string | number)[] = [];
      const cursor = parseTransactionCursor(request?.cursor);
      if (cursor) {
        conditions.push(
          "(transaction_date < ? OR (transaction_date = ? AND id > ?))",
        );
        values.push(cursor.transactionDate, cursor.transactionDate, cursor.id);
      }
      if (filter.accountId !== undefined) {
        conditions.push("account_id = ?");
        values.push(filter.accountId);
      }
      if (filter.categoryId !== undefined) {
        conditions.push("category_id = ?");
        values.push(filter.categoryId);
      }
      if (filter.dateFrom !== undefined) {
        conditions.push("transaction_date >= ?");
        values.push(filter.dateFrom);
      }
      if (filter.dateTo !== undefined) {
        conditions.push("transaction_date <= ?");
        values.push(filter.dateTo);
      }
      if (filter.status !== undefined) {
        conditions.push("status = ?");
        values.push(filter.status);
      }
      const limit = pageSize(request);
      values.push(limit + 1);
      const rows = database.sqlite
        .prepare(
          `SELECT id, account_id AS accountId, source_record_id AS sourceRecordId, source_identity AS sourceIdentity, replaces_transaction_id AS replacesTransactionId, is_current AS isCurrent, status, transaction_date AS transactionDate, posted_at AS postedAt, amount_minor AS amountMinor, currency, merchant, payee, source_category AS sourceCategory, category_id AS categoryId, created_at AS createdAt, updated_at AS updatedAt FROM transactions WHERE ${conditions.join(" AND ")} ORDER BY transaction_date DESC, id LIMIT ?`,
        )
        .all(...values) as Transaction[];
      const normalizedRows = rows.map(
        (row) => transactionRecord(row) as Transaction,
      );
      const items = normalizedRows.slice(0, limit);
      const lastItem = items.at(-1);
      const nextCursor =
        normalizedRows.length > limit && lastItem
          ? transactionCursor(lastItem)
          : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    replaceCurrent(input, splits) {
      const current = transactions.findCurrentBySourceIdentity(
        input.sourceIdentity,
      );
      if (current) {
        database.sqlite
          .prepare(
            "UPDATE transactions SET is_current = 0, updated_at = ? WHERE id = ?",
          )
          .run(now(), current.id);
      }
      return insertTransaction(input, current?.id ?? null, splits);
    },
  };
  const csvMappings: CsvMappingRepository = {
    create(input) {
      const timestamp = now();
      const record: CsvMapping = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO csv_mappings (id, name, mapping_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.name,
          record.mappingJson,
          record.createdAt,
          record.updatedAt,
        );
      return record;
    },
    delete(id) {
      return (
        database.sqlite.prepare("DELETE FROM csv_mappings WHERE id = ?").run(id)
          .changes > 0
      );
    },
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, name, mapping_json AS mappingJson, created_at AS createdAt, updated_at AS updatedAt FROM csv_mappings WHERE id > ? ORDER BY id LIMIT ?",
        )
        .all(request?.cursor ?? "", limit + 1) as CsvMapping[];
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    update(id, input) {
      const current = database.sqlite
        .prepare(
          "SELECT id, name, mapping_json AS mappingJson, created_at AS createdAt, updated_at AS updatedAt FROM csv_mappings WHERE id = ?",
        )
        .get(id) as CsvMapping | undefined;
      if (!current) return undefined;
      const record: CsvMapping = { ...current, ...input, updatedAt: now() };
      database.sqlite
        .prepare(
          "UPDATE csv_mappings SET name = ?, mapping_json = ?, updated_at = ? WHERE id = ?",
        )
        .run(record.name, record.mappingJson, record.updatedAt, id);
      return record;
    },
  };
  const importBatches: ImportBatchRepository = {
    create(input) {
      const record: ImportBatch = {
        ...input,
        createdAt: now(),
        id: randomUUID(),
        status: input.status ?? "completed",
      };
      database.sqlite
        .prepare(
          "INSERT INTO import_batches (id, checksum, source, actor, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.checksum,
          record.source,
          record.actor,
          record.status,
          record.createdAt,
        );
      return record;
    },
    findByChecksum(checksum) {
      const row = database.sqlite
        .prepare(
          "SELECT id, checksum, source, actor, status, created_at AS createdAt FROM import_batches WHERE checksum = ?",
        )
        .get(checksum) as ImportBatch | undefined;
      return row;
    },
  };
  const sourceRecords: SourceRecordRepository = {
    create(input) {
      const record: SourceRecord = {
        ...input,
        createdAt: now(),
        id: randomUUID(),
      };
      database.sqlite
        .prepare(
          "INSERT INTO source_records (id, batch_id, source_type, raw_payload, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.batchId,
          record.sourceType,
          record.rawPayload,
          record.checksum,
          record.createdAt,
        );
      return record;
    },
    findByChecksum(checksum) {
      return database.sqlite
        .prepare(
          "SELECT id, batch_id AS batchId, source_type AS sourceType, raw_payload AS rawPayload, checksum, created_at AS createdAt FROM source_records WHERE checksum = ?",
        )
        .get(checksum) as SourceRecord | undefined;
    },
  };
  const auditEvents: AuditEventRepository = {
    append(input) {
      const record: AuditEvent = {
        ...input,
        createdAt: now(),
        id: randomUUID(),
      };
      database.sqlite
        .prepare(
          "INSERT INTO audit_events (id, entity_type, entity_id, operation, before_json, after_json, actor, source_record_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.entityType,
          record.entityId,
          record.operation,
          record.beforeJson,
          record.afterJson,
          record.actor,
          record.sourceRecordId,
          record.createdAt,
        );
      return record;
    },
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, entity_type AS entityType, entity_id AS entityId, operation, before_json AS beforeJson, after_json AS afterJson, actor, source_record_id AS sourceRecordId, created_at AS createdAt FROM audit_events WHERE id > ? ORDER BY id LIMIT ?",
        )
        .all(request?.cursor ?? "", limit + 1) as AuditEvent[];
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
  };
  return Object.freeze({
    accounts,
    auditEvents,
    categories,
    categorizationRules,
    csvMappings,
    importBatches,
    institutionConnections,
    sourceRecords,
    transactions,
  });
}

export function inUnitOfWork<Result>(
  database: AppDatabase,
  work: (unitOfWork: UnitOfWork) => Result,
): Result {
  return database.transaction(() => work(createUnitOfWork(database)));
}
