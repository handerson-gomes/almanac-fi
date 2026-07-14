import { randomUUID } from "node:crypto";
import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type Budget = Readonly<{
  createdAt: string;
  currency: string;
  householdId: string | null;
  id: string;
  name: string;
  status: "active" | "archived";
  updatedAt: string;
}>;
export type BudgetPeriod = Readonly<{
  budgetId: string;
  createdAt: string;
  dateFrom: string;
  dateTo: string;
  id: string;
  status: "active" | "draft";
  updatedAt: string;
}>;
export type BudgetLine = Readonly<{
  categoryId: string;
  createdAt: string;
  id: string;
  periodId: string;
  targetAmountMinor: number;
  updatedAt: string;
}>;
export type BudgetPeriodDetails = Readonly<{
  budget: Budget;
  lines: readonly BudgetLine[];
  period: BudgetPeriod;
}>;
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
export interface BudgetRepository {
  clonePeriod(
    sourcePeriodId: string,
    input: Readonly<{
      dateFrom: string;
      dateTo: string;
      status: "active" | "draft";
    }>,
    actor?: string,
  ): BudgetPeriodDetails;
  create(
    input: Omit<Budget, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): Budget;
  createPeriod(
    input: Omit<BudgetPeriod, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): BudgetPeriod;
  findPeriod(id: string): BudgetPeriodDetails | undefined;
  list(): readonly Budget[];
  listPeriods(budgetId: string): readonly BudgetPeriod[];
  setLine(
    periodId: string,
    categoryId: string,
    targetAmountMinor: number,
    actor?: string,
  ): BudgetLine;
}
export function createBudgetRepository(
  database: AppDatabase,
  audit: Auditor,
): BudgetRepository {
  const budgetById = (id: string): Budget | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, household_id AS householdId, name, currency, status, created_at AS createdAt, updated_at AS updatedAt FROM budgets WHERE id = ?",
      )
      .get(id) as Budget | undefined;
  const periodById = (id: string): BudgetPeriod | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, budget_id AS budgetId, date_from AS dateFrom, date_to AS dateTo, status, created_at AS createdAt, updated_at AS updatedAt FROM budget_periods WHERE id = ?",
      )
      .get(id) as BudgetPeriod | undefined;
  const linesFor = (periodId: string): BudgetLine[] =>
    database.sqlite
      .prepare(
        "SELECT id, period_id AS periodId, category_id AS categoryId, target_amount_minor AS targetAmountMinor, created_at AS createdAt, updated_at AS updatedAt FROM budget_lines WHERE period_id = ? ORDER BY category_id",
      )
      .all(periodId) as BudgetLine[];
  const recordAudit = (
    type: string,
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
      entityType: type,
      operation,
    });
  return {
    clonePeriod(sourcePeriodId, input, actor = "user") {
      const source = periodById(sourcePeriodId);
      if (!source) throw new Error("The source budget period does not exist.");
      return database.transaction(() => {
        const period = this.createPeriod(
          { ...input, budgetId: source.budgetId },
          actor,
        );
        for (const line of linesFor(source.id))
          this.setLine(
            period.id,
            line.categoryId,
            line.targetAmountMinor,
            actor,
          );
        const details = this.findPeriod(period.id);
        if (!details)
          throw new Error("Cloned budget period was not persisted.");
        return details;
      });
    },
    create(input, actor = "user") {
      const timestamp = now();
      const record: Budget = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO budgets (id, household_id, name, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.householdId,
          record.name,
          record.currency,
          record.status,
          timestamp,
          timestamp,
        );
      recordAudit("budget", "create", actor, null, record, record.id);
      return record;
    },
    createPeriod(input, actor = "user") {
      if (input.dateTo < input.dateFrom)
        throw new Error("Budget period end must not precede its start.");
      if (input.status === "active") {
        const duplicate = database.sqlite
          .prepare(
            "SELECT id FROM budget_periods WHERE budget_id = ? AND date_from = ? AND date_to = ? AND status = 'active'",
          )
          .get(input.budgetId, input.dateFrom, input.dateTo);
        if (duplicate)
          throw new Error(
            "An active budget period already exists for this range.",
          );
      }
      const timestamp = now();
      const record: BudgetPeriod = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO budget_periods (id, budget_id, date_from, date_to, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.budgetId,
          record.dateFrom,
          record.dateTo,
          record.status,
          timestamp,
          timestamp,
        );
      recordAudit("budget_period", "create", actor, null, record, record.id);
      return record;
    },
    findPeriod(id) {
      const period = periodById(id);
      if (!period) return undefined;
      const budget = budgetById(period.budgetId);
      if (!budget) return undefined;
      return { budget, lines: linesFor(id), period };
    },
    list() {
      return database.sqlite
        .prepare(
          "SELECT id, household_id AS householdId, name, currency, status, created_at AS createdAt, updated_at AS updatedAt FROM budgets ORDER BY name, id",
        )
        .all() as Budget[];
    },
    listPeriods(budgetId) {
      return database.sqlite
        .prepare(
          "SELECT id, budget_id AS budgetId, date_from AS dateFrom, date_to AS dateTo, status, created_at AS createdAt, updated_at AS updatedAt FROM budget_periods WHERE budget_id = ? ORDER BY date_from DESC, id",
        )
        .all(budgetId) as BudgetPeriod[];
    },
    setLine(periodId, categoryId, targetAmountMinor, actor = "user") {
      const before = database.sqlite
        .prepare(
          "SELECT id, period_id AS periodId, category_id AS categoryId, target_amount_minor AS targetAmountMinor, created_at AS createdAt, updated_at AS updatedAt FROM budget_lines WHERE period_id = ? AND category_id = ?",
        )
        .get(periodId, categoryId) as BudgetLine | undefined;
      const timestamp = now();
      const id = before?.id ?? randomUUID();
      database.sqlite
        .prepare(
          "INSERT INTO budget_lines (id, period_id, category_id, target_amount_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(period_id, category_id) DO UPDATE SET target_amount_minor = excluded.target_amount_minor, updated_at = excluded.updated_at",
        )
        .run(
          id,
          periodId,
          categoryId,
          targetAmountMinor,
          before?.createdAt ?? timestamp,
          timestamp,
        );
      const line = linesFor(periodId).find(
        (item) => item.categoryId === categoryId,
      );
      if (!line) throw new Error("Budget line was not persisted.");
      recordAudit(
        "budget_line",
        before ? "update" : "create",
        actor,
        before ?? null,
        line,
        id,
      );
      return line;
    },
  };
}
