import { randomUUID } from "node:crypto";
import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type Security = Readonly<{
  createdAt: string;
  currency: string;
  id: string;
  name: string;
  securityType: "cash" | "etf" | "fund" | "other" | "stock";
  symbol: string | null;
  updatedAt: string;
}>;
export type Holding = Readonly<{
  accountId: string;
  asOf: string;
  costBasisMinor: number | null;
  createdAt: string;
  id: string;
  marketValueMinor: number | null;
  priceMinor: number | null;
  quantity: number | null;
  securityId: string;
  source: string;
  sourceRecordId: string | null;
  updatedAt: string;
}>;
export type InvestmentTransaction = Readonly<{
  accountId: string;
  cashAmountMinor: number | null;
  costBasisMinor: number | null;
  createdAt: string;
  id: string;
  priceMinor: number | null;
  quantity: number | null;
  securityId: string | null;
  source: string;
  sourceRecordId: string | null;
  transactionDate: string;
  transactionType:
    "buy" | "contribution" | "dividend" | "fee" | "sell" | "withdrawal";
}>;
export type InvestmentValuation = Readonly<{
  asOf: string | null;
  missing: readonly Readonly<{ holdingId: string; reason: string }>[];
  totalValueMinor: number;
}>;
type HoldingUpdate = {
  [
    Key in
      "asOf" | "costBasisMinor" | "marketValueMinor" | "priceMinor" | "quantity"
  ]?: Holding[Key] | undefined;
};
type Auditor = (
  input: Readonly<{
    actor: string;
    afterJson: string | null;
    beforeJson: string | null;
    entityId: string;
    entityType: string;
    operation: string;
  }>,
) => void;
export interface InvestmentRepository {
  createHolding(
    input: Omit<Holding, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): Holding;
  createSecurity(
    input: Omit<Security, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): Security;
  createTransaction(
    input: Omit<InvestmentTransaction, "createdAt" | "id">,
    actor?: string,
  ): InvestmentTransaction;
  deleteHolding(id: string, actor?: string): boolean;
  listHoldings(accountId?: string): readonly Holding[];
  listSecurities(): readonly Security[];
  listTransactions(accountId?: string): readonly InvestmentTransaction[];
  currentValuation(accountId?: string): InvestmentValuation;
  updateHolding(
    id: string,
    input: HoldingUpdate,
    actor?: string,
  ): Holding | undefined;
}
export function createInvestmentRepository(
  database: AppDatabase,
  audit: Auditor,
): InvestmentRepository {
  const holdingById = (id: string): Holding | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, account_id AS accountId, security_id AS securityId, as_of AS asOf, quantity, price_minor AS priceMinor, market_value_minor AS marketValueMinor, cost_basis_minor AS costBasisMinor, source, source_record_id AS sourceRecordId, created_at AS createdAt, updated_at AS updatedAt FROM holdings WHERE id = ?",
      )
      .get(id) as Holding | undefined;
  const recordAudit = (
    entityType: string,
    operation: string,
    actor: string,
    before: unknown,
    after: unknown,
    id: string,
  ): void =>
    audit({
      actor,
      afterJson: after === null ? null : JSON.stringify(after),
      beforeJson: before === null ? null : JSON.stringify(before),
      entityId: id,
      entityType,
      operation,
    });
  return {
    createHolding(input, actor = "user") {
      const timestamp = now();
      const record: Holding = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO holdings (id, account_id, security_id, as_of, quantity, price_minor, market_value_minor, cost_basis_minor, source, source_record_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.accountId,
          record.securityId,
          record.asOf,
          record.quantity,
          record.priceMinor,
          record.marketValueMinor,
          record.costBasisMinor,
          record.source,
          record.sourceRecordId,
          timestamp,
          timestamp,
        );
      recordAudit("holding", "create", actor, null, record, record.id);
      return record;
    },
    createSecurity(input, actor = "user") {
      const timestamp = now();
      const record: Security = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO securities (id, symbol, name, security_type, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.symbol,
          record.name,
          record.securityType,
          record.currency,
          timestamp,
          timestamp,
        );
      recordAudit("security", "create", actor, null, record, record.id);
      return record;
    },
    createTransaction(input, actor = "user") {
      const record: InvestmentTransaction = {
        ...input,
        createdAt: now(),
        id: randomUUID(),
      };
      database.sqlite
        .prepare(
          "INSERT INTO investment_transactions (id, account_id, security_id, transaction_date, transaction_type, cash_amount_minor, quantity, price_minor, cost_basis_minor, source, source_record_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.accountId,
          record.securityId,
          record.transactionDate,
          record.transactionType,
          record.cashAmountMinor,
          record.quantity,
          record.priceMinor,
          record.costBasisMinor,
          record.source,
          record.sourceRecordId,
          record.createdAt,
        );
      recordAudit(
        "investment_transaction",
        "create",
        actor,
        null,
        record,
        record.id,
      );
      return record;
    },
    deleteHolding(id, actor = "user") {
      const current = holdingById(id);
      if (!current) return false;
      database.sqlite.prepare("DELETE FROM holdings WHERE id = ?").run(id);
      recordAudit("holding", "delete", actor, current, null, id);
      return true;
    },
    listHoldings(accountId) {
      return database.sqlite
        .prepare(
          `SELECT id, account_id AS accountId, security_id AS securityId, as_of AS asOf, quantity, price_minor AS priceMinor, market_value_minor AS marketValueMinor, cost_basis_minor AS costBasisMinor, source, source_record_id AS sourceRecordId, created_at AS createdAt, updated_at AS updatedAt FROM holdings ${accountId === undefined ? "" : "WHERE account_id = ?"} ORDER BY as_of DESC, id`,
        )
        .all(...(accountId === undefined ? [] : [accountId])) as Holding[];
    },
    listSecurities() {
      return database.sqlite
        .prepare(
          "SELECT id, symbol, name, security_type AS securityType, currency, created_at AS createdAt, updated_at AS updatedAt FROM securities ORDER BY name, id",
        )
        .all() as Security[];
    },
    listTransactions(accountId) {
      return database.sqlite
        .prepare(
          `SELECT id, account_id AS accountId, security_id AS securityId, transaction_date AS transactionDate, transaction_type AS transactionType, cash_amount_minor AS cashAmountMinor, quantity, price_minor AS priceMinor, cost_basis_minor AS costBasisMinor, source, source_record_id AS sourceRecordId, created_at AS createdAt FROM investment_transactions ${accountId === undefined ? "" : "WHERE account_id = ?"} ORDER BY transaction_date DESC, id`,
        )
        .all(
          ...(accountId === undefined ? [] : [accountId]),
        ) as InvestmentTransaction[];
    },
    currentValuation(accountId) {
      const holdings = database.sqlite
        .prepare(
          `SELECT h.id, h.as_of AS asOf, h.quantity, h.price_minor AS priceMinor, h.market_value_minor AS marketValueMinor FROM holdings h WHERE h.id IN (SELECT h2.id FROM holdings h2 WHERE h2.account_id = h.account_id AND h2.security_id = h.security_id ORDER BY h2.as_of DESC, h2.id DESC LIMIT 1) ${accountId === undefined ? "" : "AND h.account_id = ?"}`,
        )
        .all(...(accountId === undefined ? [] : [accountId])) as Array<
        Pick<
          Holding,
          "asOf" | "id" | "marketValueMinor" | "priceMinor" | "quantity"
        >
      >;
      let totalValueMinor = 0;
      const missing: Array<{ holdingId: string; reason: string }> = [];
      for (const holding of holdings) {
        const value =
          holding.marketValueMinor ??
          (holding.quantity !== null && holding.priceMinor !== null
            ? Math.round(holding.quantity * holding.priceMinor)
            : null);
        if (value === null)
          missing.push({
            holdingId: holding.id,
            reason: "Market value or both quantity and price are required.",
          });
        else totalValueMinor += value;
      }
      return {
        asOf:
          holdings
            .map((item) => item.asOf)
            .sort()
            .at(0) ?? null,
        missing,
        totalValueMinor,
      };
    },
    updateHolding(id, input, actor = "user") {
      const current = holdingById(id);
      if (!current) return undefined;
      const updated: Holding = {
        ...current,
        asOf: input.asOf === undefined ? current.asOf : input.asOf,
        costBasisMinor:
          input.costBasisMinor === undefined
            ? current.costBasisMinor
            : input.costBasisMinor,
        marketValueMinor:
          input.marketValueMinor === undefined
            ? current.marketValueMinor
            : input.marketValueMinor,
        priceMinor:
          input.priceMinor === undefined
            ? current.priceMinor
            : input.priceMinor,
        quantity:
          input.quantity === undefined ? current.quantity : input.quantity,
        updatedAt: now(),
      };
      database.sqlite
        .prepare(
          "UPDATE holdings SET as_of = ?, quantity = ?, price_minor = ?, market_value_minor = ?, cost_basis_minor = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          updated.asOf,
          updated.quantity,
          updated.priceMinor,
          updated.marketValueMinor,
          updated.costBasisMinor,
          updated.updatedAt,
          id,
        );
      recordAudit("holding", "update", actor, current, updated, id);
      return updated;
    },
  };
}
