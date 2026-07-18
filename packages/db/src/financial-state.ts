import {
  calculateBudget,
  calculateFinancialState,
  type FinancialState,
} from "@almanac-fi/core";

import type { AppDatabase } from "./index.js";
import type { Account } from "./repositories.js";

export interface FinancialStateRepository {
  snapshot(
    input: Readonly<{ asOf: string; currency: string }>,
  ): FinancialState & {
    budgetActuals: readonly Readonly<{
      actualAmountMinor: number;
      periodId: string;
    }>[];
  };
}

type AccountBalanceRow = Readonly<{
  accountId: string;
  amountMinor: number;
  asOf: string;
  availableAmountMinor: number | null;
}>;

export function createFinancialStateRepository(
  database: AppDatabase,
): FinancialStateRepository {
  return {
    snapshot(input) {
      const accounts = database.sqlite
        .prepare(
          "SELECT id, account_type AS accountType, currency FROM accounts WHERE currency = ? ORDER BY id",
        )
        .all(input.currency) as Array<
        Pick<Account, "accountType" | "currency" | "id">
      >;
      const balances = database.sqlite
        .prepare(
          `SELECT b.account_id AS accountId, b.amount_minor AS amountMinor, b.available_amount_minor AS availableAmountMinor, b.as_of AS asOf
           FROM account_balances b
           WHERE b.is_current = 1 AND b.as_of <= ?
             AND b.id IN (SELECT b2.id FROM account_balances b2 WHERE b2.account_id = b.account_id AND b2.is_current = 1 AND b2.as_of <= ? ORDER BY b2.as_of DESC, b2.id DESC LIMIT 1)`,
        )
        .all(input.asOf, input.asOf) as AccountBalanceRow[];
      const balancesByAccount = new Map(
        balances.map((balance) => [balance.accountId, balance]),
      );
      const holdings = database.sqlite
        .prepare(
          `SELECT h.account_id AS accountId, h.id, h.market_value_minor AS marketValueMinor, h.quantity, h.price_minor AS priceMinor
           FROM holdings h JOIN securities s ON s.id = h.security_id
           WHERE s.currency = ? AND h.id IN (
             SELECT h2.id FROM holdings h2 WHERE h2.account_id = h.account_id AND h2.security_id = h.security_id AND h2.as_of <= ? ORDER BY h2.as_of DESC, h2.id DESC LIMIT 1
           )`,
        )
        .all(input.currency, input.asOf) as Array<{
        accountId: string;
        id: string;
        marketValueMinor: number | null;
        priceMinor: number | null;
        quantity: number | null;
      }>;
      const valuationByAccount = new Map<string, number | null>();
      for (const holding of holdings) {
        const value =
          holding.marketValueMinor ??
          (holding.quantity !== null && holding.priceMinor !== null
            ? Math.round(holding.quantity * holding.priceMinor)
            : null);
        const previous = valuationByAccount.get(holding.accountId);
        valuationByAccount.set(
          holding.accountId,
          value === null || previous === null ? null : (previous ?? 0) + value,
        );
      }
      const liabilities = database.sqlite
        .prepare(
          `SELECT l.account_id AS accountId, t.balance_minor AS balanceMinor
           FROM liabilities l JOIN liability_terms t ON t.liability_id = l.id
           WHERE l.currency = ? AND t.effective_from <= ? AND (t.effective_to IS NULL OR t.effective_to > ?)
             AND t.id IN (SELECT t2.id FROM liability_terms t2 WHERE t2.liability_id = l.id AND t2.effective_from <= ? AND (t2.effective_to IS NULL OR t2.effective_to > ?) ORDER BY t2.effective_from DESC LIMIT 1)`,
        )
        .all(
          input.currency,
          input.asOf,
          input.asOf,
          input.asOf,
          input.asOf,
        ) as Array<{ accountId: string | null; balanceMinor: number }>;
      const liabilitiesByAccount = new Map<string, number>();
      const unlinkedLiabilities = liabilities
        .filter((liability) => liability.accountId === null)
        .reduce((total, liability) => total + liability.balanceMinor, 0);
      for (const liability of liabilities) {
        if (liability.accountId !== null)
          liabilitiesByAccount.set(
            liability.accountId,
            (liabilitiesByAccount.get(liability.accountId) ?? 0) +
              liability.balanceMinor,
          );
      }
      const transactions = database.sqlite
        .prepare(
          `SELECT t.id, t.amount_minor AS amountMinor, t.category_id AS categoryId, t.transaction_date AS transactionDate,
             EXISTS(SELECT 1 FROM transfer_matches m WHERE m.status = 'confirmed' AND (m.outbound_transaction_id = t.id OR m.inbound_transaction_id = t.id)) AS isConfirmedTransfer
           FROM transactions t
           WHERE t.is_current = 1 AND t.currency = ? AND t.transaction_date <= ?`,
        )
        .all(input.currency, input.asOf) as Array<{
        amountMinor: number;
        categoryId: string | null;
        id: string;
        isConfirmedTransfer: number;
        transactionDate: string;
      }>;
      const nonTransfers = transactions.filter(
        (transaction) => transaction.isConfirmedTransfer === 0,
      );
      const snapshot = calculateFinancialState(
        accounts.map((account) => {
          const balance = balancesByAccount.get(account.id);
          return {
            accountId: account.id,
            accountType: account.accountType,
            availableAmountMinor: balance?.availableAmountMinor ?? null,
            balanceAsOf: balance?.asOf ?? null,
            balanceMinor: balance?.amountMinor ?? null,
            hasHoldings: valuationByAccount.has(account.id),
            investmentValueMinor: valuationByAccount.get(account.id) ?? null,
            liabilityBalanceMinor: liabilitiesByAccount.get(account.id) ?? null,
          };
        }),
        input.asOf,
        7,
        {
          confirmedTransferCount: transactions.length - nonTransfers.length,
          currentTransactionCount: transactions.length,
          inflowMinor: nonTransfers
            .filter((transaction) => transaction.amountMinor > 0)
            .reduce((total, transaction) => total + transaction.amountMinor, 0),
          outflowMinor: nonTransfers
            .filter((transaction) => transaction.amountMinor < 0)
            .reduce((total, transaction) => total - transaction.amountMinor, 0),
        },
      );
      const budgetPeriods = database.sqlite
        .prepare(
          `SELECT p.id, p.date_from AS dateFrom, p.date_to AS dateTo FROM budget_periods p JOIN budgets b ON b.id = p.budget_id WHERE p.status = 'active' AND b.status = 'active' AND b.currency = ? AND p.date_from <= ?`,
        )
        .all(input.currency, input.asOf) as Array<{
        dateFrom: string;
        dateTo: string;
        id: string;
      }>;
      const budgetActuals = budgetPeriods.map((period) => ({
        actualAmountMinor: calculateBudget({
          currency: input.currency,
          dateFrom: period.dateFrom,
          dateTo: period.dateTo,
          lines: database.sqlite
            .prepare(
              "SELECT category_id AS categoryId, target_amount_minor AS targetAmountMinor FROM budget_lines WHERE period_id = ?",
            )
            .all(period.id) as Array<{
            categoryId: string;
            targetAmountMinor: number;
          }>,
          transactions: transactions.map((transaction) => ({
            ...transaction,
            isConfirmedTransfer: Boolean(transaction.isConfirmedTransfer),
          })),
        }).actualAmountMinor,
        periodId: period.id,
      }));
      return {
        ...snapshot,
        budgetActuals,
        liabilityBalanceMinor:
          snapshot.liabilityBalanceMinor + unlinkedLiabilities,
        netWorthMinor: snapshot.netWorthMinor - unlinkedLiabilities,
      };
    },
  };
}
