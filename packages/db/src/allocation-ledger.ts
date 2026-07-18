import { createHash, randomUUID } from "node:crypto";

import type { FinancialStateRepository } from "./financial-state.js";
import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type AllocationLedgerRun = Readonly<{
  createdAt: string;
  currency: string;
  dataAsOf: string;
  householdId: string;
  id: string;
  incomeForecastRunId: string;
  inputVersion: string;
  openingAsOf: string;
}>;
export type AllocationLedgerMonth = Readonly<{
  allocationAllocatedMinor: number;
  allocationRequestedMinor: number;
  closingBalanceMinor: number;
  createdAt: string;
  dataAsOf: string;
  expectedNetIncomeMinor: number;
  grossIncomeMinor: number;
  id: string;
  inputVersion: string;
  ledgerRunId: string;
  missingIncomeCount: number;
  month: string;
  obligationAllocatedMinor: number;
  obligationRequestedMinor: number;
  openingBalanceMinor: number;
  shortfallMinor: number;
  surplusMinor: number;
}>;
export type AllocationLedgerEntry = Readonly<{
  allocatedAmountMinor: number;
  allocationBasis:
    "gross_income" | "expected_net_income" | "remaining_cash" | null;
  closingBalanceMinor: number;
  constraintLevel:
    "hard" | "minimum" | "preferred" | "flexible" | "residual" | null;
  createdAt: string;
  dataAsOf: string;
  destinationId: string | null;
  destinationType: string | null;
  entryType:
    "income" | "obligation" | "allocation" | "shortfall" | "closing_balance";
  expectedNetAmountMinor: number | null;
  fundingStatus:
    | "funded"
    | "partial"
    | "unfunded"
    | "surplus"
    | "shortfall"
    | "missing_input";
  grossAmountMinor: number | null;
  id: string;
  inputVersion: string;
  ledgerMonthId: string;
  openingBalanceMinor: number;
  priority: number | null;
  requestedAmountMinor: number;
  sourceId: string | null;
  sourceRuleId: string | null;
}>;
export type AllocationLedgerResult = Readonly<{
  entries: readonly AllocationLedgerEntry[];
  months: readonly AllocationLedgerMonth[];
  run: AllocationLedgerRun;
}>;

type IncomeRow = Readonly<{
  currency: string;
  expectedGrossAmountMinor: number;
  expectedNetAmountMinor: number | null;
  id: string;
  month: string;
}>;
type Obligation = Readonly<{
  amountMinor: number;
  id: string;
  name: string;
}>;
type Rule = Readonly<{
  amountType: "fixed" | "percentage";
  bucketId: string;
  cadence:
    "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "annual";
  constraintLevel: "hard" | "minimum" | "preferred" | "flexible" | "residual";
  destinationType: string;
  effectiveFrom: string;
  fixedAmountMinor: number | null;
  goalId: string | null;
  id: string;
  maximumAmountMinor: number | null;
  minimumAmountMinor: number | null;
  percentageBasis:
    "gross_income" | "expected_net_income" | "remaining_cash" | null;
  percentageBps: number | null;
  priority: number;
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

export interface AllocationLedgerRepository {
  create(
    householdId: string,
    input: Readonly<{
      currency: string;
      incomeForecastRunId: string;
      openingAsOf: string;
    }>,
    actor?: string,
  ): AllocationLedgerResult;
  get(id: string, horizonMonths?: number): AllocationLedgerResult | undefined;
}

const constraintOrder = {
  hard: 0,
  minimum: 1,
  preferred: 2,
  flexible: 3,
  residual: 4,
} as const;

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function cadenceMultiplier(cadence: Rule["cadence"]): number {
  switch (cadence) {
    case "weekly":
      return 52 / 12;
    case "biweekly":
      return 26 / 12;
    case "semimonthly":
      return 2;
    case "monthly":
      return 1;
    case "quarterly":
      return 1 / 3;
    case "annual":
      return 1 / 12;
  }
}

function monthLimit(month: string, count: number): string {
  const date = new Date(`${month}T00:00:00.000Z`);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1),
  )
    .toISOString()
    .slice(0, 10);
}

function fundingStatus(
  requestedAmountMinor: number,
  allocatedAmountMinor: number,
): "funded" | "partial" | "unfunded" {
  if (
    requestedAmountMinor === 0 ||
    allocatedAmountMinor === requestedAmountMinor
  )
    return "funded";
  return allocatedAmountMinor === 0 ? "unfunded" : "partial";
}

export function createAllocationLedgerRepository(
  database: AppDatabase,
  financialState: FinancialStateRepository,
  audit: Auditor,
): AllocationLedgerRepository {
  const runById = (id: string): AllocationLedgerRun | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, household_id AS householdId, income_forecast_run_id AS incomeForecastRunId, currency, opening_as_of AS openingAsOf, data_as_of AS dataAsOf, input_version AS inputVersion, created_at AS createdAt FROM allocation_ledger_runs WHERE id = ?",
      )
      .get(id) as AllocationLedgerRun | undefined;
  const monthsFor = (
    runId: string,
    horizonMonths?: number,
  ): readonly AllocationLedgerMonth[] => {
    const rows = database.sqlite
      .prepare(
        "SELECT id, run_id AS ledgerRunId, month, opening_balance_minor AS openingBalanceMinor, gross_income_minor AS grossIncomeMinor, expected_net_income_minor AS expectedNetIncomeMinor, missing_income_count AS missingIncomeCount, obligation_requested_minor AS obligationRequestedMinor, obligation_allocated_minor AS obligationAllocatedMinor, allocation_requested_minor AS allocationRequestedMinor, allocation_allocated_minor AS allocationAllocatedMinor, closing_balance_minor AS closingBalanceMinor, surplus_minor AS surplusMinor, shortfall_minor AS shortfallMinor, input_version AS inputVersion, data_as_of AS dataAsOf, created_at AS createdAt FROM allocation_ledger_months WHERE run_id = ? ORDER BY month",
      )
      .all(runId) as AllocationLedgerMonth[];
    if (horizonMonths === undefined || rows.length === 0) return rows;
    const cutoff = monthLimit(rows[0]?.month ?? "", horizonMonths);
    return rows.filter((row) => row.month < cutoff);
  };
  const entriesFor = (
    monthIds: readonly string[],
  ): readonly AllocationLedgerEntry[] => {
    if (monthIds.length === 0) return [];
    const placeholders = monthIds.map(() => "?").join(", ");
    return database.sqlite
      .prepare(
        `SELECT e.id, e.ledger_month_id AS ledgerMonthId, e.entry_type AS entryType, e.source_id AS sourceId, e.source_rule_id AS sourceRuleId, e.destination_type AS destinationType, e.destination_id AS destinationId, e.allocation_basis AS allocationBasis, e.requested_amount_minor AS requestedAmountMinor, e.allocated_amount_minor AS allocatedAmountMinor, e.gross_amount_minor AS grossAmountMinor, e.expected_net_amount_minor AS expectedNetAmountMinor, e.priority, e.constraint_level AS constraintLevel, e.funding_status AS fundingStatus, e.opening_balance_minor AS openingBalanceMinor, e.closing_balance_minor AS closingBalanceMinor, e.input_version AS inputVersion, e.data_as_of AS dataAsOf, e.created_at AS createdAt FROM allocation_ledger_entries e JOIN allocation_ledger_months m ON m.id = e.ledger_month_id WHERE e.ledger_month_id IN (${placeholders}) ORDER BY m.month, e.priority, e.id`,
      )
      .all(...monthIds) as AllocationLedgerEntry[];
  };
  const resultFor = (
    run: AllocationLedgerRun,
    horizonMonths?: number,
  ): AllocationLedgerResult => {
    const months = monthsFor(run.id, horizonMonths);
    return {
      entries: entriesFor(months.map((month) => month.id)),
      months,
      run,
    };
  };
  const obligationsFor = (
    householdId: string,
    currency: string,
    month: string,
  ): readonly Obligation[] => {
    const debt = database.sqlite
      .prepare(
        "SELECT l.id, l.name, t.minimum_payment_minor AS amountMinor FROM liabilities l JOIN liability_terms t ON t.liability_id = l.id WHERE l.household_id = ? AND l.currency = ? AND t.effective_from <= ? AND (t.effective_to IS NULL OR t.effective_to > ?) AND t.id IN (SELECT t2.id FROM liability_terms t2 WHERE t2.liability_id = l.id AND t2.effective_from <= ? AND (t2.effective_to IS NULL OR t2.effective_to > ?) ORDER BY t2.effective_from DESC LIMIT 1) AND t.balance_minor > 0 ORDER BY l.id",
      )
      .all(householdId, currency, month, month, month, month) as Obligation[];
    const recurring = database.sqlite
      .prepare(
        "SELECT id, name, amount_minor AS amountMinor, cadence FROM recurring_obligations WHERE household_id = ? AND currency = ? AND liability_id IS NULL AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?) ORDER BY id",
      )
      .all(householdId, currency, month, month) as Array<
      Obligation & { cadence: "annual" | "monthly" | "weekly" }
    >;
    return [
      ...debt,
      ...recurring.map((item) => ({
        id: item.id,
        name: item.name,
        amountMinor:
          item.cadence === "monthly"
            ? item.amountMinor
            : item.cadence === "annual"
              ? Math.round(item.amountMinor / 12)
              : Math.round((item.amountMinor * 52) / 12),
      })),
    ];
  };
  const rulesFor = (
    householdId: string,
    currency: string,
    month: string,
  ): readonly Rule[] =>
    database.sqlite
      .prepare(
        "SELECT r.id, r.bucket_id AS bucketId, r.amount_type AS amountType, r.fixed_amount_minor AS fixedAmountMinor, r.percentage_bps AS percentageBps, r.percentage_basis AS percentageBasis, r.cadence, r.effective_from AS effectiveFrom, r.priority, r.constraint_level AS constraintLevel, r.minimum_amount_minor AS minimumAmountMinor, r.maximum_amount_minor AS maximumAmountMinor, b.destination_type AS destinationType, b.goal_id AS goalId FROM funding_allocation_rules r JOIN funding_buckets b ON b.id = r.bucket_id WHERE b.household_id = ? AND b.currency = ? AND r.effective_from <= ? AND (r.effective_to IS NULL OR r.effective_to > ?) ORDER BY r.priority, r.id",
      )
      .all(householdId, currency, month, month) as Rule[];
  const targetAmount = (
    rule: Rule,
    grossIncomeMinor: number,
    expectedNetIncomeMinor: number,
    availableMinor: number,
  ): number | null => {
    if (rule.amountType === "fixed") {
      return Math.round(
        (rule.fixedAmountMinor ?? 0) * cadenceMultiplier(rule.cadence),
      );
    }
    const basis =
      rule.percentageBasis === "gross_income"
        ? grossIncomeMinor
        : rule.percentageBasis === "expected_net_income"
          ? expectedNetIncomeMinor
          : availableMinor;
    let target = Math.round(
      (basis * (rule.percentageBps ?? 0) * cadenceMultiplier(rule.cadence)) /
        10_000,
    );
    if (rule.minimumAmountMinor !== null)
      target = Math.max(target, rule.minimumAmountMinor);
    if (rule.maximumAmountMinor !== null)
      target = Math.min(target, rule.maximumAmountMinor);
    return target;
  };
  return {
    create(householdId, input, actor = "user") {
      const incomeRun = database.sqlite
        .prepare(
          "SELECT id, household_id AS householdId, data_as_of AS dataAsOf, input_version AS inputVersion FROM income_forecast_runs WHERE id = ?",
        )
        .get(input.incomeForecastRunId) as
        | {
            dataAsOf: string;
            householdId: string;
            id: string;
            inputVersion: string;
          }
        | undefined;
      if (incomeRun === undefined || incomeRun.householdId !== householdId)
        throw new Error("Income forecast run must belong to the household.");
      const incomeRows = database.sqlite
        .prepare(
          "SELECT id, month, currency, expected_gross_amount_minor AS expectedGrossAmountMinor, expected_net_amount_minor AS expectedNetAmountMinor FROM income_forecast_rows WHERE run_id = ? AND currency = ? ORDER BY month, id",
        )
        .all(input.incomeForecastRunId, input.currency) as IncomeRow[];
      if (incomeRows.length === 0)
        throw new Error(
          "Income forecast run has no monthly rows for this currency.",
        );
      const openingState = financialState.snapshot({
        asOf: input.openingAsOf,
        currency: input.currency,
      });
      const activeMonths = [...new Set(incomeRows.map((row) => row.month))];
      const obligations = activeMonths.map((month) => ({
        month,
        items: obligationsFor(householdId, input.currency, month),
      }));
      const rules = activeMonths.map((month) => ({
        month,
        items: rulesFor(householdId, input.currency, month),
      }));
      const inputVersion = checksum({
        incomeRunInputVersion: incomeRun.inputVersion,
        incomeRows,
        openingState,
        obligations,
        rules,
      });
      const timestamp = now();
      const run: AllocationLedgerRun = {
        createdAt: timestamp,
        currency: input.currency,
        dataAsOf: incomeRun.dataAsOf,
        householdId,
        id: randomUUID(),
        incomeForecastRunId: incomeRun.id,
        inputVersion,
        openingAsOf: input.openingAsOf,
      };
      database.transaction(() => {
        database.sqlite
          .prepare(
            "INSERT INTO allocation_ledger_runs (id, household_id, income_forecast_run_id, currency, opening_as_of, data_as_of, input_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            run.id,
            run.householdId,
            run.incomeForecastRunId,
            run.currency,
            run.openingAsOf,
            run.dataAsOf,
            run.inputVersion,
            timestamp,
          );
        let openingBalanceMinor = openingState.spendableFundsMinor;
        const insertMonth = database.sqlite.prepare(
          "INSERT INTO allocation_ledger_months (id, run_id, month, opening_balance_minor, gross_income_minor, expected_net_income_minor, missing_income_count, obligation_requested_minor, obligation_allocated_minor, allocation_requested_minor, allocation_allocated_minor, closing_balance_minor, surplus_minor, shortfall_minor, input_version, data_as_of, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        const insertEntry = database.sqlite.prepare(
          "INSERT INTO allocation_ledger_entries (id, ledger_month_id, entry_type, source_id, source_rule_id, destination_type, destination_id, allocation_basis, requested_amount_minor, allocated_amount_minor, gross_amount_minor, expected_net_amount_minor, priority, constraint_level, funding_status, opening_balance_minor, closing_balance_minor, input_version, data_as_of, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const month of activeMonths) {
          const income = incomeRows.filter((row) => row.month === month);
          const grossIncomeMinor = income.reduce(
            (sum, row) => sum + row.expectedGrossAmountMinor,
            0,
          );
          const missingIncome = income.filter(
            (row) => row.expectedNetAmountMinor === null,
          );
          const expectedNetIncomeMinor = income.reduce(
            (sum, row) => sum + (row.expectedNetAmountMinor ?? 0),
            0,
          );
          let availableMinor = Math.max(
            0,
            openingBalanceMinor + expectedNetIncomeMinor,
          );
          let shortfallMinor = Math.max(
            0,
            -(openingBalanceMinor + expectedNetIncomeMinor),
          );
          const plannedEntries: Array<
            Omit<AllocationLedgerEntry, "createdAt" | "id" | "ledgerMonthId">
          > = [];
          for (const row of income) {
            plannedEntries.push({
              allocatedAmountMinor: row.expectedNetAmountMinor ?? 0,
              allocationBasis: null,
              closingBalanceMinor: 0,
              constraintLevel: null,
              dataAsOf: run.dataAsOf,
              destinationId: null,
              destinationType: null,
              entryType: "income",
              expectedNetAmountMinor: row.expectedNetAmountMinor,
              fundingStatus:
                row.expectedNetAmountMinor === null
                  ? "missing_input"
                  : "funded",
              grossAmountMinor: row.expectedGrossAmountMinor,
              inputVersion: run.inputVersion,
              openingBalanceMinor,
              priority: null,
              requestedAmountMinor: row.expectedNetAmountMinor ?? 0,
              sourceId: row.id,
              sourceRuleId: null,
            });
          }
          const monthlyObligations =
            obligations.find((item) => item.month === month)?.items ?? [];
          let obligationRequestedMinor = 0;
          let obligationAllocatedMinor = 0;
          for (const obligation of monthlyObligations) {
            const allocatedAmountMinor = Math.min(
              availableMinor,
              obligation.amountMinor,
            );
            availableMinor -= allocatedAmountMinor;
            obligationRequestedMinor += obligation.amountMinor;
            obligationAllocatedMinor += allocatedAmountMinor;
            const status = fundingStatus(
              obligation.amountMinor,
              allocatedAmountMinor,
            );
            plannedEntries.push({
              allocatedAmountMinor,
              allocationBasis: null,
              closingBalanceMinor: 0,
              constraintLevel: "hard",
              dataAsOf: run.dataAsOf,
              destinationId: obligation.id,
              destinationType: "obligation",
              entryType: "obligation",
              expectedNetAmountMinor: null,
              fundingStatus: status,
              grossAmountMinor: null,
              inputVersion: run.inputVersion,
              openingBalanceMinor,
              priority: -1,
              requestedAmountMinor: obligation.amountMinor,
              sourceId: obligation.id,
              sourceRuleId: null,
            });
            if (allocatedAmountMinor < obligation.amountMinor) {
              const shortage = obligation.amountMinor - allocatedAmountMinor;
              shortfallMinor += shortage;
              plannedEntries.push({
                allocatedAmountMinor: 0,
                allocationBasis: null,
                closingBalanceMinor: 0,
                constraintLevel: "hard",
                dataAsOf: run.dataAsOf,
                destinationId: obligation.id,
                destinationType: "obligation",
                entryType: "shortfall",
                expectedNetAmountMinor: null,
                fundingStatus: "shortfall",
                grossAmountMinor: null,
                inputVersion: run.inputVersion,
                openingBalanceMinor,
                priority: -1,
                requestedAmountMinor: shortage,
                sourceId: `shortfall:${obligation.id}`,
                sourceRuleId: null,
              });
            }
          }
          let allocationRequestedMinor = 0;
          let allocationAllocatedMinor = 0;
          const monthlyRules =
            rules.find((item) => item.month === month)?.items ?? [];
          const orderedRules = [...monthlyRules].sort(
            (left, right) =>
              constraintOrder[left.constraintLevel] -
                constraintOrder[right.constraintLevel] ||
              left.priority - right.priority ||
              left.id.localeCompare(right.id),
          );
          for (const rule of orderedRules) {
            const requestedAmountMinor = targetAmount(
              rule,
              grossIncomeMinor,
              expectedNetIncomeMinor,
              availableMinor,
            );
            const dependsOnMissingNet =
              rule.percentageBasis === "expected_net_income" &&
              missingIncome.length > 0;
            if (dependsOnMissingNet || requestedAmountMinor === null) {
              plannedEntries.push({
                allocatedAmountMinor: 0,
                allocationBasis: rule.percentageBasis,
                closingBalanceMinor: 0,
                constraintLevel: rule.constraintLevel,
                dataAsOf: run.dataAsOf,
                destinationId: rule.bucketId,
                destinationType: rule.destinationType,
                entryType: "allocation",
                expectedNetAmountMinor: null,
                fundingStatus: "missing_input",
                grossAmountMinor: null,
                inputVersion: run.inputVersion,
                openingBalanceMinor,
                priority: rule.priority,
                requestedAmountMinor: 0,
                sourceId: rule.id,
                sourceRuleId: rule.id,
              });
              continue;
            }
            const allocatedAmountMinor = Math.min(
              availableMinor,
              Math.max(0, requestedAmountMinor),
            );
            availableMinor -= allocatedAmountMinor;
            allocationRequestedMinor += requestedAmountMinor;
            allocationAllocatedMinor += allocatedAmountMinor;
            const status = fundingStatus(
              requestedAmountMinor,
              allocatedAmountMinor,
            );
            plannedEntries.push({
              allocatedAmountMinor,
              allocationBasis: rule.percentageBasis,
              closingBalanceMinor: 0,
              constraintLevel: rule.constraintLevel,
              dataAsOf: run.dataAsOf,
              destinationId: rule.bucketId,
              destinationType: rule.destinationType,
              entryType: "allocation",
              expectedNetAmountMinor: null,
              fundingStatus:
                rule.constraintLevel === "residual" ? "surplus" : status,
              grossAmountMinor: null,
              inputVersion: run.inputVersion,
              openingBalanceMinor,
              priority: rule.priority,
              requestedAmountMinor,
              sourceId: rule.id,
              sourceRuleId: rule.id,
            });
            if (
              rule.constraintLevel === "hard" &&
              allocatedAmountMinor < requestedAmountMinor
            ) {
              const shortage = requestedAmountMinor - allocatedAmountMinor;
              shortfallMinor += shortage;
              plannedEntries.push({
                allocatedAmountMinor: 0,
                allocationBasis: rule.percentageBasis,
                closingBalanceMinor: 0,
                constraintLevel: "hard",
                dataAsOf: run.dataAsOf,
                destinationId: rule.bucketId,
                destinationType: rule.destinationType,
                entryType: "shortfall",
                expectedNetAmountMinor: null,
                fundingStatus: "shortfall",
                grossAmountMinor: null,
                inputVersion: run.inputVersion,
                openingBalanceMinor,
                priority: rule.priority,
                requestedAmountMinor: shortage,
                sourceId: `shortfall:${rule.id}`,
                sourceRuleId: null,
              });
            }
          }
          const closingBalanceMinor = availableMinor;
          const surplusMinor = closingBalanceMinor;
          const ledgerMonth: AllocationLedgerMonth = {
            allocationAllocatedMinor,
            allocationRequestedMinor,
            closingBalanceMinor,
            createdAt: timestamp,
            dataAsOf: run.dataAsOf,
            expectedNetIncomeMinor,
            grossIncomeMinor,
            id: randomUUID(),
            inputVersion: run.inputVersion,
            ledgerRunId: run.id,
            missingIncomeCount: missingIncome.length,
            month,
            obligationAllocatedMinor,
            obligationRequestedMinor,
            openingBalanceMinor,
            shortfallMinor,
            surplusMinor,
          };
          insertMonth.run(
            ledgerMonth.id,
            ledgerMonth.ledgerRunId,
            ledgerMonth.month,
            ledgerMonth.openingBalanceMinor,
            ledgerMonth.grossIncomeMinor,
            ledgerMonth.expectedNetIncomeMinor,
            ledgerMonth.missingIncomeCount,
            ledgerMonth.obligationRequestedMinor,
            ledgerMonth.obligationAllocatedMinor,
            ledgerMonth.allocationRequestedMinor,
            ledgerMonth.allocationAllocatedMinor,
            ledgerMonth.closingBalanceMinor,
            ledgerMonth.surplusMinor,
            ledgerMonth.shortfallMinor,
            ledgerMonth.inputVersion,
            ledgerMonth.dataAsOf,
            timestamp,
          );
          plannedEntries.push({
            allocatedAmountMinor: closingBalanceMinor,
            allocationBasis: null,
            closingBalanceMinor,
            constraintLevel: null,
            dataAsOf: run.dataAsOf,
            destinationId: null,
            destinationType: null,
            entryType: "closing_balance",
            expectedNetAmountMinor: null,
            fundingStatus: surplusMinor > 0 ? "surplus" : "funded",
            grossAmountMinor: null,
            inputVersion: run.inputVersion,
            openingBalanceMinor,
            priority: null,
            requestedAmountMinor: closingBalanceMinor,
            sourceId: `closing:${month}`,
            sourceRuleId: null,
          });
          for (const entry of plannedEntries) {
            insertEntry.run(
              randomUUID(),
              ledgerMonth.id,
              entry.entryType,
              entry.sourceId,
              entry.sourceRuleId,
              entry.destinationType,
              entry.destinationId,
              entry.allocationBasis,
              entry.requestedAmountMinor,
              entry.allocatedAmountMinor,
              entry.grossAmountMinor,
              entry.expectedNetAmountMinor,
              entry.priority,
              entry.constraintLevel,
              entry.fundingStatus,
              openingBalanceMinor,
              closingBalanceMinor,
              entry.inputVersion,
              entry.dataAsOf,
              timestamp,
            );
          }
          openingBalanceMinor = closingBalanceMinor;
        }
      });
      const result = resultFor(run);
      audit({
        actor,
        afterJson: JSON.stringify(result),
        beforeJson: null,
        entityId: run.id,
        entityType: "allocation_ledger_run",
        operation: "create",
      });
      return result;
    },
    get(id, horizonMonths) {
      const run = runById(id);
      return run === undefined ? undefined : resultFor(run, horizonMonths);
    },
  };
}
