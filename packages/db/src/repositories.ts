import { randomUUID } from "node:crypto";

import {
  detectTransferCandidates,
  classifyIncome,
  type IncomeKind,
  normalizeMerchant,
  selectCategorySuggestion,
  type CategorizationMethod,
} from "@almanac-fi/core";

import type { AppDatabase } from "./index.js";
import { now } from "./index.js";
import {
  createHouseholdRepository,
  type HouseholdRepository,
} from "./households.js";
import { createGoalRepository, type GoalRepository } from "./goals.js";
import {
  createInvestmentRepository,
  type InvestmentRepository,
} from "./investments.js";
import {
  createObligationRepository,
  type ObligationRepository,
} from "./obligations.js";
import { createBudgetRepository, type BudgetRepository } from "./budgets.js";
import {
  createInstitutionServices,
  type AccountImportReviewRepository,
  type ExternalInstitutionConnectionRepository,
  type InstitutionRepository,
  type ProviderConnectionRepository,
} from "./institutions.js";
import {
  createFinancialStateRepository,
  type FinancialStateRepository,
} from "./financial-state.js";
import { createIncomeRepository, type IncomeRepository } from "./income.js";
import {
  createIncomeReconciliationRepository,
  type IncomeReconciliationRepository,
} from "./income-reconciliation.js";
import { createFundingRepository, type FundingRepository } from "./funding.js";
import {
  createAllocationLedgerRepository,
  type AllocationLedgerRepository,
} from "./allocation-ledger.js";
import {
  createPlanningRepository,
  type PlanningRepository,
} from "./planning.js";
import {
  createPlanningDashboardRepository,
  type PlanningDashboardRepository,
} from "./planning-dashboard.js";

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

export type Account = Readonly<{
  accountType: AccountType;
  createdAt: string;
  currency: string;
  externalConnectionId: string | null;
  externalId: string | null;
  id: string;
  institutionId: string;
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
  isCurrent: boolean;
  replacesBalanceId: string | null;
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
export type TransferMatch = Readonly<{
  confidence: number;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  id: string;
  inboundTransactionId: string;
  outboundTransactionId: string;
  reason: "ambiguous" | "exact" | "partial";
  status: "candidate" | "confirmed" | "rejected";
  updatedAt: string;
}>;
export type CategorizationReview = Readonly<{
  confidence: number | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmedCategoryId: string | null;
  createdAt: string;
  id: string;
  method: CategorizationMethod | null;
  normalizedMerchant: string | null;
  ruleId: string | null;
  status: "confirmed" | "dismissed" | "pending";
  suggestedCategoryId: string | null;
  transactionId: string;
  updatedAt: string;
}>;
export type IncomeClassificationRecord = Readonly<{
  confidence: number;
  confirmedAt: string | null;
  confirmedBy: string | null;
  createdAt: string;
  id: string;
  kind: IncomeKind;
  method:
    | "account_context"
    | "category_rule"
    | "transfer_match"
    | "user_confirmation";
  recurringGroup: string | null;
  status: "confirmed" | "inferred" | "pending";
  transactionId: string;
  updatedAt: string;
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
type AccountUpdate = {
  [
    Key in
      | "accountType"
      | "currency"
      | "externalConnectionId"
      | "externalId"
      | "institutionId"
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

export interface AccountRepository {
  addBalance(
    input: Omit<
      AccountBalance,
      "createdAt" | "id" | "isCurrent" | "replacesBalanceId"
    >,
  ): AccountBalance;
  create(input: Omit<Account, "createdAt" | "id" | "updatedAt">): Account;
  delete(id: string): boolean;
  findById(id: string): Account | undefined;
  list(page?: PageRequest): Page<Account>;
  listBalances(accountId: string, page?: PageRequest): Page<AccountBalance>;
  replaceBalance(
    id: string,
    input: Omit<
      AccountBalance,
      "accountId" | "createdAt" | "id" | "isCurrent" | "replacesBalanceId"
    >,
  ): AccountBalance | undefined;
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

export interface TransferMatchRepository {
  confirmedTransactionIds(): ReadonlySet<string>;
  decide(
    id: string,
    decision: "confirm" | "reject" | "unmatch",
    actor: string,
  ): TransferMatch | undefined;
  findById(id: string): TransferMatch | undefined;
  list(status?: TransferMatch["status"]): readonly TransferMatch[];
  refreshCandidates(): readonly TransferMatch[];
}
export interface CategorizationReviewRepository {
  applyBatch(
    input: Readonly<{
      actor: string;
      categoryId?: string | undefined;
      createMerchantRule?: boolean | undefined;
      decision: "confirm" | "dismiss";
      ids: readonly string[];
    }>,
  ): readonly CategorizationReview[];
  list(
    status?: CategorizationReview["status"],
  ): readonly CategorizationReview[];
  suggest(
    input: Readonly<{
      aiCategoryId?: string | undefined;
      enableAi?: boolean | undefined;
      transactionId: string;
    }>,
  ): CategorizationReview | undefined;
}
export interface IncomeClassificationRepository {
  confirm(
    id: string,
    kind: IncomeKind,
    actor: string,
  ): IncomeClassificationRecord | undefined;
  list(
    status?: IncomeClassificationRecord["status"],
  ): readonly IncomeClassificationRecord[];
  refresh(): readonly IncomeClassificationRecord[];
  summary(): Readonly<{
    incomeAmountMinor: number;
    recurringGroups: number;
    reviewCount: number;
  }>;
}

export interface UnitOfWork {
  readonly allocationLedger: AllocationLedgerRepository;
  readonly budgets: BudgetRepository;
  readonly accounts: AccountRepository;
  readonly auditEvents: AuditEventRepository;
  readonly categories: CategoryRepository;
  readonly categorizationRules: CategorizationRuleRepository;
  readonly categorizationReviews: CategorizationReviewRepository;
  readonly csvMappings: CsvMappingRepository;
  readonly accountImportReviews: AccountImportReviewRepository;
  readonly externalInstitutionConnections: ExternalInstitutionConnectionRepository;
  readonly financialState: FinancialStateRepository;
  readonly funding: FundingRepository;
  readonly importBatches: ImportBatchRepository;
  readonly institutions: InstitutionRepository;
  readonly incomeClassifications: IncomeClassificationRepository;
  readonly income: IncomeRepository;
  readonly incomeReconciliation: IncomeReconciliationRepository;
  readonly households: HouseholdRepository;
  readonly goals: GoalRepository;
  readonly investments: InvestmentRepository;
  readonly obligations: ObligationRepository;
  readonly providerConnections: ProviderConnectionRepository;
  readonly planning: PlanningRepository;
  readonly planningDashboard: PlanningDashboardRepository;
  readonly sourceRecords: SourceRecordRepository;
  readonly transactions: TransactionRepository;
  readonly transferMatches: TransferMatchRepository;
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
  const institutionServices = createInstitutionServices(database);
  const financialState = createFinancialStateRepository(database);
  const accounts: AccountRepository = {
    addBalance(input) {
      const record: AccountBalance = {
        ...input,
        createdAt: now(),
        id: randomUUID(),
        isCurrent: true,
        replacesBalanceId: null,
      };
      database.sqlite
        .prepare(
          "INSERT INTO account_balances (id, account_id, amount_minor, available_amount_minor, as_of, is_current, replaces_balance_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.accountId,
          record.amountMinor,
          record.availableAmountMinor,
          record.asOf,
          1,
          null,
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
          "INSERT INTO accounts (id, name, account_type, currency, status, institution_id, external_connection_id, external_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.name,
          record.accountType,
          record.currency,
          record.status,
          record.institutionId,
          record.externalConnectionId,
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
          "SELECT id, name, account_type AS accountType, currency, status, institution_id AS institutionId, external_connection_id AS externalConnectionId, external_id AS externalId, created_at AS createdAt, updated_at AS updatedAt FROM accounts WHERE id = ?",
        )
        .get(id) as Account | undefined;
    },
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, name, account_type AS accountType, currency, status, institution_id AS institutionId, external_connection_id AS externalConnectionId, external_id AS externalId, created_at AS createdAt, updated_at AS updatedAt FROM accounts WHERE id > ? ORDER BY id LIMIT ?",
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
          "SELECT id, account_id AS accountId, amount_minor AS amountMinor, available_amount_minor AS availableAmountMinor, as_of AS asOf, is_current AS isCurrent, replaces_balance_id AS replacesBalanceId, created_at AS createdAt FROM account_balances WHERE account_id = ? AND is_current = 1 AND id > ? ORDER BY id LIMIT ?",
        )
        .all(accountId, request?.cursor ?? "", limit + 1) as AccountBalance[];
      const items = rows
        .slice(0, limit)
        .map((row) => ({ ...row, isCurrent: Boolean(row.isCurrent) }));
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    replaceBalance(id, input) {
      const current = database.sqlite
        .prepare(
          "SELECT id, account_id AS accountId, amount_minor AS amountMinor, available_amount_minor AS availableAmountMinor, as_of AS asOf, is_current AS isCurrent, replaces_balance_id AS replacesBalanceId, created_at AS createdAt FROM account_balances WHERE id = ? AND is_current = 1",
        )
        .get(id) as AccountBalance | undefined;
      if (!current) return undefined;
      database.sqlite
        .prepare("UPDATE account_balances SET is_current = 0 WHERE id = ?")
        .run(id);
      const record: AccountBalance = {
        ...input,
        accountId: current.accountId,
        createdAt: now(),
        id: randomUUID(),
        isCurrent: true,
        replacesBalanceId: id,
      };
      database.sqlite
        .prepare(
          "INSERT INTO account_balances (id, account_id, amount_minor, available_amount_minor, as_of, is_current, replaces_balance_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.accountId,
          record.amountMinor,
          record.availableAmountMinor,
          record.asOf,
          1,
          record.replacesBalanceId,
          record.createdAt,
        );
      return record;
    },
    update(id, input) {
      const current = accounts.findById(id);
      if (!current) return undefined;
      const record: Account = {
        accountType:
          input.accountType === undefined
            ? current.accountType
            : input.accountType,
        createdAt: current.createdAt,
        currency:
          input.currency === undefined ? current.currency : input.currency,
        externalId:
          input.externalId === undefined
            ? current.externalId
            : input.externalId,
        externalConnectionId:
          input.externalConnectionId === undefined
            ? current.externalConnectionId
            : input.externalConnectionId,
        id: current.id,
        institutionId:
          input.institutionId === undefined
            ? current.institutionId
            : input.institutionId,
        name: input.name === undefined ? current.name : input.name,
        status: input.status === undefined ? current.status : input.status,
        updatedAt: now(),
      };
      database.sqlite
        .prepare(
          "UPDATE accounts SET name = ?, account_type = ?, currency = ?, status = ?, institution_id = ?, external_connection_id = ?, external_id = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          record.name,
          record.accountType,
          record.currency,
          record.status,
          record.institutionId,
          record.externalConnectionId,
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
      const conditions = [
        "is_current = 1",
        "account_id IN (SELECT id FROM accounts WHERE status != 'hidden')",
      ];
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
  function transferRecord(id: string): TransferMatch | undefined {
    return database.sqlite
      .prepare(
        "SELECT id, outbound_transaction_id AS outboundTransactionId, inbound_transaction_id AS inboundTransactionId, status, reason, confidence, created_at AS createdAt, updated_at AS updatedAt, decided_at AS decidedAt, decided_by AS decidedBy FROM transfer_matches WHERE id = ?",
      )
      .get(id) as TransferMatch | undefined;
  }
  const transferMatches: TransferMatchRepository = {
    confirmedTransactionIds() {
      const rows = database.sqlite
        .prepare(
          "SELECT outbound_transaction_id AS outboundId, inbound_transaction_id AS inboundId FROM transfer_matches WHERE status = 'confirmed'",
        )
        .all() as ReadonlyArray<{ inboundId: string; outboundId: string }>;
      return new Set(rows.flatMap((row) => [row.outboundId, row.inboundId]));
    },
    decide(id, decision, actor) {
      const current = transferRecord(id);
      if (!current) return undefined;
      if (decision === "unmatch" && current.status !== "confirmed") {
        throw new Error("Only a confirmed transfer can be unmatched.");
      }
      if (decision === "confirm" && current.status === "rejected") {
        throw new Error(
          "A rejected candidate must be restored before confirmation.",
        );
      }
      const status =
        decision === "confirm"
          ? "confirmed"
          : decision === "reject"
            ? "rejected"
            : "candidate";
      const timestamp = now();
      database.sqlite
        .prepare(
          "UPDATE transfer_matches SET status = ?, decided_at = ?, decided_by = ?, updated_at = ? WHERE id = ?",
        )
        .run(status, timestamp, actor, timestamp, id);
      const updated = transferRecord(id);
      auditEvents.append({
        actor,
        afterJson: JSON.stringify(updated),
        beforeJson: JSON.stringify(current),
        entityId: id,
        entityType: "transfer_match",
        operation: decision,
        sourceRecordId: null,
      });
      return updated;
    },
    findById: transferRecord,
    list(status) {
      return database.sqlite
        .prepare(
          `SELECT id, outbound_transaction_id AS outboundTransactionId, inbound_transaction_id AS inboundTransactionId, status, reason, confidence, created_at AS createdAt, updated_at AS updatedAt, decided_at AS decidedAt, decided_by AS decidedBy FROM transfer_matches ${status === undefined ? "" : "WHERE status = ?"} ORDER BY created_at, id`,
        )
        .all(...(status === undefined ? [] : [status])) as TransferMatch[];
    },
    refreshCandidates() {
      const detected = detectTransferCandidates(
        transactions.list({}, { limit: 100 }).items,
      );
      for (const candidate of detected) {
        const timestamp = now();
        database.sqlite
          .prepare(
            "INSERT INTO transfer_matches (id, outbound_transaction_id, inbound_transaction_id, status, reason, confidence, created_at, updated_at) VALUES (?, ?, ?, 'candidate', ?, ?, ?, ?) ON CONFLICT(outbound_transaction_id, inbound_transaction_id) DO UPDATE SET reason = excluded.reason, confidence = excluded.confidence, updated_at = excluded.updated_at WHERE transfer_matches.status = 'candidate'",
          )
          .run(
            randomUUID(),
            candidate.outboundTransactionId,
            candidate.inboundTransactionId,
            candidate.reason,
            candidate.confidence,
            timestamp,
            timestamp,
          );
      }
      return transferMatches.list("candidate");
    },
  };
  function categorizationReviewRecord(
    id: string,
  ): CategorizationReview | undefined {
    return database.sqlite
      .prepare(
        "SELECT id, transaction_id AS transactionId, normalized_merchant AS normalizedMerchant, suggested_category_id AS suggestedCategoryId, method, confidence, rule_id AS ruleId, status, confirmed_category_id AS confirmedCategoryId, confirmed_at AS confirmedAt, confirmed_by AS confirmedBy, created_at AS createdAt, updated_at AS updatedAt FROM categorization_reviews WHERE id = ?",
      )
      .get(id) as CategorizationReview | undefined;
  }
  const categorizationReviews: CategorizationReviewRepository = {
    applyBatch(input) {
      const updated: CategorizationReview[] = [];
      for (const id of input.ids) {
        const current = categorizationReviewRecord(id);
        if (!current || current.status !== "pending") continue;
        const categoryId = input.categoryId ?? current.suggestedCategoryId;
        if (input.decision === "confirm" && categoryId === null) {
          throw new Error("A category is required to confirm a review.");
        }
        const timestamp = now();
        database.sqlite
          .prepare(
            "UPDATE categorization_reviews SET status = ?, confirmed_category_id = ?, confirmed_at = ?, confirmed_by = ?, updated_at = ? WHERE id = ?",
          )
          .run(
            input.decision === "confirm" ? "confirmed" : "dismissed",
            input.decision === "confirm" ? categoryId : null,
            input.decision === "confirm" ? timestamp : null,
            input.actor,
            timestamp,
            id,
          );
        if (input.decision === "confirm") {
          database.sqlite
            .prepare(
              "UPDATE transactions SET category_id = ?, updated_at = ? WHERE id = ?",
            )
            .run(categoryId, timestamp, current.transactionId);
          if (
            input.createMerchantRule === true &&
            current.normalizedMerchant !== null
          ) {
            const exists = database.sqlite
              .prepare(
                "SELECT id FROM categorization_rules WHERE match_field = 'merchant' AND lower(match_value) = lower(?)",
              )
              .get(current.normalizedMerchant);
            if (!exists) {
              categorizationRules.create({
                active: true,
                categoryId: categoryId ?? "",
                matchField: "merchant",
                matchValue: current.normalizedMerchant,
                name: `Merchant: ${current.normalizedMerchant}`,
                precedence: 100,
              });
            }
          }
        }
        const next = categorizationReviewRecord(id);
        if (next) {
          updated.push(next);
          auditEvents.append({
            actor: input.actor,
            afterJson: JSON.stringify(next),
            beforeJson: JSON.stringify(current),
            entityId: id,
            entityType: "categorization_review",
            operation: input.decision,
            sourceRecordId: null,
          });
        }
      }
      return updated;
    },
    list(status) {
      return database.sqlite
        .prepare(
          `SELECT id, transaction_id AS transactionId, normalized_merchant AS normalizedMerchant, suggested_category_id AS suggestedCategoryId, method, confidence, rule_id AS ruleId, status, confirmed_category_id AS confirmedCategoryId, confirmed_at AS confirmedAt, confirmed_by AS confirmedBy, created_at AS createdAt, updated_at AS updatedAt FROM categorization_reviews ${status === undefined ? "" : "WHERE status = ?"} ORDER BY created_at, id`,
        )
        .all(
          ...(status === undefined ? [] : [status]),
        ) as CategorizationReview[];
    },
    suggest(input) {
      const transaction = transactions.findById(input.transactionId);
      if (
        !transaction ||
        transferMatches.confirmedTransactionIds().has(transaction.id)
      )
        return undefined;
      const normalizedMerchant = normalizeMerchant(
        transaction.merchant ?? transaction.payee,
      );
      const exactRule = categorizationRules.evaluate(transaction);
      const historical =
        normalizedMerchant === null
          ? undefined
          : (database.sqlite
              .prepare(
                "SELECT confirmed_category_id AS categoryId FROM categorization_reviews WHERE normalized_merchant = ? AND status = 'confirmed' ORDER BY confirmed_at DESC LIMIT 1",
              )
              .get(normalizedMerchant) as { categoryId: string } | undefined);
      const sourceCategory =
        transaction.sourceCategory === null
          ? undefined
          : categories.findByName(transaction.sourceCategory);
      const suggestion = selectCategorySuggestion(
        {
          ai:
            input.aiCategoryId === undefined
              ? undefined
              : {
                  categoryId: input.aiCategoryId,
                  confidence: 0.5,
                  method: "ai",
                  ruleId: null,
                },
          confirmedHistory:
            historical === undefined
              ? undefined
              : {
                  categoryId: historical.categoryId,
                  confidence: 0.95,
                  method: "confirmed_history",
                  ruleId: null,
                },
          merchantRule:
            exactRule?.matchField !== "merchant"
              ? undefined
              : {
                  categoryId: exactRule.categoryId,
                  confidence: 1,
                  method: "merchant_rule",
                  ruleId: exactRule.id,
                },
          sourceCategory:
            sourceCategory === undefined
              ? undefined
              : {
                  categoryId: sourceCategory.id,
                  confidence: 0.9,
                  method: "source_category",
                  ruleId: null,
                },
          userRule:
            exactRule === undefined || exactRule.matchField === "merchant"
              ? undefined
              : {
                  categoryId: exactRule.categoryId,
                  confidence: 1,
                  method: "user_rule",
                  ruleId: exactRule.id,
                },
        },
        { enableAi: input.enableAi === true },
      );
      const timestamp = now();
      const existing = database.sqlite
        .prepare(
          "SELECT id FROM categorization_reviews WHERE transaction_id = ?",
        )
        .get(transaction.id) as { id: string } | undefined;
      const id = existing?.id ?? randomUUID();
      database.sqlite
        .prepare(
          "INSERT INTO categorization_reviews (id, transaction_id, normalized_merchant, suggested_category_id, method, confidence, rule_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?) ON CONFLICT(transaction_id) DO UPDATE SET normalized_merchant = excluded.normalized_merchant, suggested_category_id = excluded.suggested_category_id, method = excluded.method, confidence = excluded.confidence, rule_id = excluded.rule_id, updated_at = excluded.updated_at WHERE categorization_reviews.status = 'pending'",
        )
        .run(
          id,
          transaction.id,
          normalizedMerchant,
          suggestion?.categoryId ?? null,
          suggestion?.method ?? null,
          suggestion?.confidence ?? null,
          suggestion?.ruleId ?? null,
          timestamp,
          timestamp,
        );
      return categorizationReviewRecord(id);
    },
  };
  function incomeRecord(id: string): IncomeClassificationRecord | undefined {
    return database.sqlite
      .prepare(
        "SELECT id, transaction_id AS transactionId, kind, method, confidence, recurring_group AS recurringGroup, status, confirmed_at AS confirmedAt, confirmed_by AS confirmedBy, created_at AS createdAt, updated_at AS updatedAt FROM income_classifications WHERE id = ?",
      )
      .get(id) as IncomeClassificationRecord | undefined;
  }
  const incomeClassifications: IncomeClassificationRepository = {
    confirm(id, kind, actor) {
      const current = incomeRecord(id);
      if (!current) return undefined;
      if (current.kind === "transfer" && kind === "income") {
        throw new Error("A confirmed transfer cannot be classified as income.");
      }
      const timestamp = now();
      database.sqlite
        .prepare(
          "UPDATE income_classifications SET kind = ?, method = 'user_confirmation', confidence = 1, status = 'confirmed', confirmed_at = ?, confirmed_by = ?, updated_at = ? WHERE id = ?",
        )
        .run(kind, timestamp, actor, timestamp, id);
      const updated = incomeRecord(id);
      auditEvents.append({
        actor,
        afterJson: JSON.stringify(updated),
        beforeJson: JSON.stringify(current),
        entityId: id,
        entityType: "income_classification",
        operation: "confirm",
        sourceRecordId: null,
      });
      return updated;
    },
    list(status) {
      return database.sqlite
        .prepare(
          `SELECT id, transaction_id AS transactionId, kind, method, confidence, recurring_group AS recurringGroup, status, confirmed_at AS confirmedAt, confirmed_by AS confirmedBy, created_at AS createdAt, updated_at AS updatedAt FROM income_classifications ${status === undefined ? "" : "WHERE status = ?"} ORDER BY created_at, id`,
        )
        .all(
          ...(status === undefined ? [] : [status]),
        ) as IncomeClassificationRecord[];
    },
    refresh() {
      const confirmedTransfers = transferMatches.confirmedTransactionIds();
      for (const transaction of transactions.list({}, { limit: 100 }).items) {
        const account = accounts.findById(transaction.accountId);
        const category =
          transaction.categoryId === null
            ? undefined
            : categories.findById(transaction.categoryId);
        const classification = classifyIncome({
          accountType: account?.accountType ?? "other",
          amountMinor: transaction.amountMinor,
          categoryName: category?.name,
          isConfirmedTransfer: confirmedTransfers.has(transaction.id),
          merchant: transaction.merchant,
          payee: transaction.payee,
        });
        const timestamp = now();
        database.sqlite
          .prepare(
            "INSERT INTO income_classifications (id, transaction_id, kind, method, confidence, recurring_group, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(transaction_id) DO UPDATE SET kind = excluded.kind, method = excluded.method, confidence = excluded.confidence, recurring_group = excluded.recurring_group, status = excluded.status, updated_at = excluded.updated_at WHERE income_classifications.status <> 'confirmed'",
          )
          .run(
            randomUUID(),
            transaction.id,
            classification.kind,
            classification.method,
            classification.confidence,
            classification.recurringGroup,
            classification.kind === "ambiguous" ? "pending" : "inferred",
            timestamp,
            timestamp,
          );
      }
      return incomeClassifications.list();
    },
    summary() {
      const row = database.sqlite
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN i.kind = 'income' THEN t.amount_minor ELSE 0 END), 0) AS incomeAmountMinor,
          COUNT(DISTINCT CASE WHEN i.kind = 'income' THEN i.recurring_group END) AS recurringGroups,
          SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) AS reviewCount
         FROM income_classifications i JOIN transactions t ON t.id = i.transaction_id`,
        )
        .get() as {
        incomeAmountMinor: number;
        recurringGroups: number;
        reviewCount: number;
      };
      return row;
    },
  };
  const households = createHouseholdRepository(database, (input) => {
    auditEvents.append({ ...input, sourceRecordId: null });
  });
  const goals = createGoalRepository(database, (input) => {
    auditEvents.append({ ...input, sourceRecordId: null });
  });
  const investments = createInvestmentRepository(database, (input) => {
    auditEvents.append({ ...input, sourceRecordId: null });
  });
  const obligations = createObligationRepository(database, (input) => {
    auditEvents.append({ ...input, sourceRecordId: null });
  });
  const income = createIncomeRepository(database, (input) => {
    auditEvents.append({ ...input, sourceRecordId: null });
  });
  const incomeReconciliation = createIncomeReconciliationRepository(
    database,
    income,
    (input) => {
      auditEvents.append({ ...input, sourceRecordId: null });
    },
  );
  const funding = createFundingRepository(database, (input) => {
    auditEvents.append({ ...input, sourceRecordId: null });
  });
  const allocationLedger = createAllocationLedgerRepository(
    database,
    financialState,
    (input) => {
      auditEvents.append({ ...input, sourceRecordId: null });
    },
  );
  const budgets = createBudgetRepository(database, (input) => {
    auditEvents.append({ ...input, sourceRecordId: null });
  });
  const planning = createPlanningRepository(database, (input) => {
    auditEvents.append({ ...input, sourceRecordId: null });
  });
  const planningDashboard = createPlanningDashboardRepository(
    database,
    financialState,
    planning,
  );
  return Object.freeze({
    accountImportReviews: institutionServices.accountImportReviews,
    allocationLedger,
    accounts,
    budgets,
    auditEvents,
    categories,
    categorizationRules,
    categorizationReviews,
    csvMappings,
    externalInstitutionConnections:
      institutionServices.externalInstitutionConnections,
    financialState,
    funding,
    importBatches,
    institutions: institutionServices.institutions,
    income,
    incomeClassifications,
    incomeReconciliation,
    households,
    goals,
    investments,
    obligations,
    providerConnections: institutionServices.providerConnections,
    planning,
    planningDashboard,
    sourceRecords,
    transactions,
    transferMatches,
  });
}

export function inUnitOfWork<Result>(
  database: AppDatabase,
  work: (unitOfWork: UnitOfWork) => Result,
): Result {
  return database.transaction(() => work(createUnitOfWork(database)));
}
