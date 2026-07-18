import type { FinancialStateRepository } from "./financial-state.js";
import type { AppDatabase } from "./index.js";
import type { PlanningInput, PlanningRepository } from "./planning.js";

type DashboardWarning = Readonly<{
  code: string;
  message: string;
  severity: "warning" | "error";
}>;
type Reconciliation = Readonly<{
  actualMinor: number;
  label: string;
  lowConfidenceMatches: number;
  plannedMinor: number;
  status: "reconciled" | "variance" | "unresolved";
  unresolvedMatches: number;
  varianceMinor: number;
}>;

export type PlanningDashboard = Readonly<{
  context: Readonly<{
    activePlanVersionId: string | null;
    currency: string;
    dataAsOf: string;
    period: Readonly<{ end: string; start: string }>;
    plan: Readonly<{
      id: string;
      label: string;
      mode: "active" | "scenario";
      scenarioId: string | null;
    }> | null;
  }>;
  currentFunds: Readonly<{
    currentBalanceMinor: number;
    netWorthMinor: number;
    spendableFundsMinor: number;
  }>;
  plan: Readonly<{
    expectedNetIncomeMinor: number;
    goalFundingMinor: number;
    grossIncomeMinor: number;
    monthlySurplusMinor: number;
    plannedInvestmentsMinor: number;
    recurringBudgetsMinor: number;
    requiredObligationsMinor: number;
  }>;
  reconciliation: Readonly<{
    balances: Reconciliation;
    budgets: Reconciliation;
    debts: Reconciliation;
    goals: Reconciliation;
    income: Reconciliation;
  }>;
  scenarioDifference: Readonly<{
    changedInputCount: number;
    monthlyNetEffectMinor: number;
  }> | null;
  warnings: readonly DashboardWarning[];
}>;

export interface PlanningDashboardRepository {
  get(
    input: Readonly<{
      asOf: string;
      currency: string;
      householdId: string;
      periodStart?: string;
      scenarioId?: string;
    }>,
  ): PlanningDashboard;
}

function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function nextMonth(value: string): string {
  const date = new Date(`${monthStart(value)}T00:00:00.000Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

function monthEnd(value: string): string {
  const date = new Date(`${nextMonth(value)}T00:00:00.000Z`);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function numberAt(
  value: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : 0;
}

function cadenceMultiplier(cadence: unknown): number {
  switch (cadence) {
    case "weekly":
      return 52 / 12;
    case "biweekly":
      return 26 / 12;
    case "semimonthly":
      return 2;
    case "quarterly":
      return 1 / 3;
    case "annual":
      return 1 / 12;
    default:
      return 1;
  }
}

function monthlyAmount(input: PlanningInput): number {
  const value = input.value;
  switch (input.inputType) {
    case "income_assumption":
      return Math.round(
        numberAt(value, "grossAmountMinor") * cadenceMultiplier(value.cadence),
      );
    case "budget":
      return numberAt(value, "targetAmountMinor");
    case "goal": {
      const months = Math.max(1, numberAt(value, "monthsToTarget") || 1);
      return Math.round(numberAt(value, "targetAmountMinor") / months);
    }
    case "obligation":
      return Math.round(
        (numberAt(value, "amountMinor") ||
          numberAt(value, "minimumPaymentMinor")) *
          cadenceMultiplier(value.cadence),
      );
    case "allocation_rule":
      return value.amountType === "fixed"
        ? Math.round(
            numberAt(value, "fixedAmountMinor") *
              cadenceMultiplier(value.cadence),
          )
        : 0;
  }
}

function expectedNetAmount(input: PlanningInput): number {
  const value = input.value;
  const gross = numberAt(value, "grossAmountMinor");
  const net = numberAt(value, "expectedNetAmountMinor");
  const monthlyMultiplier = cadenceMultiplier(value.cadence);
  if (net !== 0) return Math.round(net * monthlyMultiplier);
  return Math.round(
    (gross -
      Math.round((gross * numberAt(value, "withholdingRateBps")) / 10_000) -
      numberAt(value, "deductionAmountMinor")) *
      monthlyMultiplier,
  );
}

function reconciliation(
  label: string,
  plannedMinor: number,
  actualMinor: number,
  sourceAvailable: boolean,
  unresolvedMatches = 0,
  lowConfidenceMatches = 0,
): Reconciliation {
  const varianceMinor = actualMinor - plannedMinor;
  return {
    actualMinor,
    label,
    lowConfidenceMatches,
    plannedMinor,
    status:
      !sourceAvailable || unresolvedMatches > 0
        ? "unresolved"
        : varianceMinor === 0
          ? "reconciled"
          : "variance",
    unresolvedMatches,
    varianceMinor,
  };
}

export function createPlanningDashboardRepository(
  database: AppDatabase,
  financialState: FinancialStateRepository,
  planning: PlanningRepository,
): PlanningDashboardRepository {
  return {
    get(input) {
      const start = monthStart(input.periodStart ?? input.asOf);
      const endExclusive = nextMonth(start);
      const activeVersion = planning.activeVersion(input.householdId);
      const warnings: DashboardWarning[] = [];
      let selectedInputs: readonly PlanningInput[] =
        activeVersion === undefined
          ? []
          : planning.inputsForVersion(activeVersion.id);
      let contextPlan: PlanningDashboard["context"]["plan"] =
        activeVersion === undefined
          ? null
          : {
              id: activeVersion.id,
              label: activeVersion.label,
              mode: "active",
              scenarioId: null,
            };
      let scenarioDifference: PlanningDashboard["scenarioDifference"] = null;

      if (input.scenarioId !== undefined) {
        const scenario = planning.getScenario(input.scenarioId);
        if (
          scenario === undefined ||
          scenario.householdId !== input.householdId
        ) {
          warnings.push({
            code: "scenario_not_found",
            message:
              "The requested scenario is unavailable for this household.",
            severity: "error",
          });
        } else {
          const overrides = new Map(
            planning
              .overridesForScenario(scenario.id)
              .map((override) => [
                `${override.inputType}:${override.inputId}`,
                override.patch,
              ]),
          );
          selectedInputs = planning
            .inputsForVersion(scenario.basePlanVersionId)
            .map((entry) => ({
              ...entry,
              value: {
                ...entry.value,
                ...(overrides.get(`${entry.inputType}:${entry.inputId}`) ?? {}),
              },
            }));
          contextPlan = {
            id: scenario.basePlanVersionId,
            label: scenario.name,
            mode: "scenario",
            scenarioId: scenario.id,
          };
          const comparison = planning.compare(scenario.id);
          scenarioDifference = {
            changedInputCount: comparison.changedInputs.length,
            monthlyNetEffectMinor: comparison.downstreamMonthlyEffect.netMinor,
          };
        }
      }

      if (contextPlan === null)
        warnings.push({
          code: "missing_active_plan",
          message:
            "No active plan version exists; planned amounts cannot be reconciled.",
          severity: "warning",
        });

      const sumByType = (inputType: PlanningInput["inputType"]): number =>
        selectedInputs
          .filter((entry) => entry.inputType === inputType)
          .reduce((total, entry) => total + monthlyAmount(entry), 0);
      const incomeInputs = selectedInputs.filter(
        (entry) => entry.inputType === "income_assumption",
      );
      const allocationInputs = selectedInputs.filter(
        (entry) => entry.inputType === "allocation_rule",
      );
      const grossIncomeMinor = incomeInputs.reduce(
        (total, entry) => total + monthlyAmount(entry),
        0,
      );
      const expectedNetIncomeMinor = incomeInputs.reduce(
        (total, entry) => total + expectedNetAmount(entry),
        0,
      );
      const recurringBudgetsMinor = sumByType("budget");
      const goalFundingMinor = sumByType("goal");
      const requiredObligationsMinor = sumByType("obligation");
      const plannedInvestmentsMinor = allocationInputs
        .filter(
          (entry) => entry.value.destinationType === "investment_contribution",
        )
        .reduce((total, entry) => total + monthlyAmount(entry), 0);
      const allAllocationsMinor = allocationInputs.reduce(
        (total, entry) => total + monthlyAmount(entry),
        0,
      );
      const plan = {
        expectedNetIncomeMinor,
        goalFundingMinor,
        grossIncomeMinor,
        monthlySurplusMinor:
          expectedNetIncomeMinor -
          recurringBudgetsMinor -
          goalFundingMinor -
          requiredObligationsMinor -
          allAllocationsMinor,
        plannedInvestmentsMinor,
        recurringBudgetsMinor,
        requiredObligationsMinor,
      };

      const state = financialState.snapshot({
        asOf: input.asOf,
        currency: input.currency,
      });
      for (const warning of state.warnings)
        warnings.push({
          code: warning.code,
          message: warning.message,
          severity: "warning",
        });

      const forecastRun = database.sqlite
        .prepare(
          "SELECT id FROM income_forecast_runs WHERE household_id = ? AND data_as_of <= ? ORDER BY data_as_of DESC, created_at DESC, id DESC LIMIT 1",
        )
        .get(input.householdId, input.asOf) as { id: string } | undefined;
      const income = forecastRun
        ? (database.sqlite
            .prepare(
              `SELECT
                (SELECT COALESCE(SUM(r.expected_net_amount_minor), 0)
                 FROM income_forecast_rows r
                 WHERE r.run_id = ? AND r.currency = ? AND r.month = ?) AS expectedNetMinor,
                (SELECT COUNT(*) FROM income_forecast_rows r
                 WHERE r.run_id = ? AND r.currency = ? AND r.month = ?) AS rowCount,
                (SELECT COALESCE(SUM(t.amount_minor), 0)
                 FROM transactions t JOIN income_classifications c ON c.transaction_id = t.id
                 WHERE t.is_current = 1 AND t.currency = ? AND t.amount_minor > 0
                   AND c.kind = 'income' AND t.transaction_date >= ? AND t.transaction_date < ?) AS observedNetMinor,
                (SELECT COUNT(DISTINCT m.id)
                 FROM income_reconciliation_matches m
                 LEFT JOIN income_forecast_rows r ON r.id = m.forecast_row_id
                 LEFT JOIN income_reconciliation_match_deposits d ON d.match_id = m.id
                 LEFT JOIN transactions t ON t.id = d.transaction_id
                 WHERE m.run_id = ? AND (
                   r.month = ? OR (m.forecast_row_id IS NULL AND t.transaction_date >= ? AND t.transaction_date < ?)
                 ) AND (m.review_state IN ('needs_review', 'unexplained') OR m.match_method = 'unmatched_expected')) AS unresolvedMatches,
                (SELECT COUNT(DISTINCT m.id)
                 FROM income_reconciliation_matches m JOIN income_forecast_rows r ON r.id = m.forecast_row_id
                 WHERE m.run_id = ? AND r.month = ? AND m.confidence < 0.8) AS lowConfidenceMatches`,
            )
            .get(
              forecastRun.id,
              input.currency,
              start,
              forecastRun.id,
              input.currency,
              start,
              input.currency,
              start,
              endExclusive,
              forecastRun.id,
              start,
              start,
              endExclusive,
              forecastRun.id,
              start,
            ) as {
            expectedNetMinor: number;
            lowConfidenceMatches: number | null;
            observedNetMinor: number;
            rowCount: number;
            unresolvedMatches: number | null;
          })
        : undefined;
      if (!forecastRun)
        warnings.push({
          code: "missing_income_forecast",
          message:
            "No immutable income forecast run is available for reconciliation.",
          severity: "warning",
        });
      else if (income?.rowCount === 0)
        warnings.push({
          code: "missing_income_forecast_period",
          message:
            "The selected immutable income forecast does not cover this period.",
          severity: "warning",
        });

      const budgetActual = database.sqlite
        .prepare(
          `SELECT COALESCE(SUM(-t.amount_minor), 0) AS amountMinor
           FROM transactions t
           WHERE t.is_current = 1 AND t.currency = ? AND t.amount_minor < 0
             AND t.transaction_date >= ? AND t.transaction_date < ?
             AND t.category_id IN (
               SELECT l.category_id FROM budget_lines l
               JOIN budget_periods p ON p.id = l.period_id
               JOIN budgets b ON b.id = p.budget_id
               WHERE b.household_id = ? AND b.currency = ? AND b.status = 'active'
                 AND p.status = 'active' AND p.date_from < ? AND p.date_to >= ?
             )
             AND NOT EXISTS (
               SELECT 1 FROM transfer_matches m WHERE m.status = 'confirmed'
                 AND (m.outbound_transaction_id = t.id OR m.inbound_transaction_id = t.id)
             )`,
        )
        .get(
          input.currency,
          start,
          endExclusive,
          input.householdId,
          input.currency,
          endExclusive,
          start,
        ) as { amountMinor: number };
      const hasBudgetPeriod = database.sqlite
        .prepare(
          "SELECT 1 AS present FROM budget_periods p JOIN budgets b ON b.id = p.budget_id WHERE b.household_id = ? AND b.currency = ? AND b.status = 'active' AND p.status = 'active' AND p.date_from < ? AND p.date_to >= ? LIMIT 1",
        )
        .get(input.householdId, input.currency, endExclusive, start) as
        { present: number } | undefined;

      const goalActual = database.sqlite
        .prepare(
          `SELECT COALESCE(SUM(t.amount_minor), 0) AS amountMinor, COUNT(g.id) AS linkedGoals
           FROM financial_goals g LEFT JOIN transactions t ON t.account_id = g.account_id
             AND t.is_current = 1 AND t.currency = ? AND t.amount_minor > 0
             AND t.transaction_date >= ? AND t.transaction_date < ?
           WHERE g.household_id = ? AND g.currency = ? AND g.status = 'active'
             AND g.account_id IS NOT NULL`,
        )
        .get(
          input.currency,
          start,
          endExclusive,
          input.householdId,
          input.currency,
        ) as {
        amountMinor: number;
        linkedGoals: number;
      };
      if (goalFundingMinor > 0 && goalActual.linkedGoals === 0)
        warnings.push({
          code: "unobservable_goal_contributions",
          message:
            "Goal funding is planned, but no active goal has a linked account for observed contributions.",
          severity: "warning",
        });

      const debtActual = database.sqlite
        .prepare(
          `SELECT COALESCE(SUM(t.amount_minor), 0) AS amountMinor, COUNT(l.id) AS linkedLiabilities
           FROM liabilities l LEFT JOIN transactions t ON t.account_id = l.account_id
             AND t.is_current = 1 AND t.currency = ? AND t.amount_minor > 0
             AND t.transaction_date >= ? AND t.transaction_date < ?
           WHERE l.household_id = ? AND l.currency = ? AND l.account_id IS NOT NULL`,
        )
        .get(
          input.currency,
          start,
          endExclusive,
          input.householdId,
          input.currency,
        ) as {
        amountMinor: number;
        linkedLiabilities: number;
      };
      if (requiredObligationsMinor > 0 && debtActual.linkedLiabilities === 0)
        warnings.push({
          code: "unobservable_debt_payments",
          message:
            "Required debt payments are planned, but no liability has a linked account for observed payments.",
          severity: "warning",
        });

      const ledger = forecastRun
        ? (database.sqlite
            .prepare(
              "SELECT m.closing_balance_minor AS closingBalanceMinor FROM allocation_ledger_runs r JOIN allocation_ledger_months m ON m.run_id = r.id WHERE r.household_id = ? AND r.currency = ? AND r.income_forecast_run_id = ? AND m.month = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 1",
            )
            .get(input.householdId, input.currency, forecastRun.id, start) as
            { closingBalanceMinor: number } | undefined)
        : undefined;
      if (!ledger)
        warnings.push({
          code: "missing_allocation_ledger",
          message:
            "No allocation-ledger month is available for the selected forecast and period.",
          severity: "warning",
        });

      return {
        context: {
          activePlanVersionId: activeVersion?.id ?? null,
          currency: input.currency,
          dataAsOf: input.asOf,
          period: { end: monthEnd(start), start },
          plan: contextPlan,
        },
        currentFunds: {
          currentBalanceMinor: state.currentBalanceMinor,
          netWorthMinor: state.netWorthMinor,
          spendableFundsMinor: state.spendableFundsMinor,
        },
        plan,
        reconciliation: {
          balances: reconciliation(
            "Forecast balance vs observed balance",
            ledger?.closingBalanceMinor ?? 0,
            state.currentBalanceMinor,
            ledger !== undefined,
          ),
          budgets: reconciliation(
            "Budget spending",
            recurringBudgetsMinor,
            budgetActual.amountMinor,
            hasBudgetPeriod !== undefined,
          ),
          debts: reconciliation(
            "Debt payments",
            requiredObligationsMinor,
            debtActual.amountMinor,
            requiredObligationsMinor === 0 || debtActual.linkedLiabilities > 0,
          ),
          goals: reconciliation(
            "Goal contributions",
            goalFundingMinor,
            goalActual.amountMinor,
            goalFundingMinor === 0 || goalActual.linkedGoals > 0,
          ),
          income: reconciliation(
            "Income occurrences",
            income?.expectedNetMinor ?? expectedNetIncomeMinor,
            income?.observedNetMinor ?? 0,
            income !== undefined && income.rowCount > 0,
            income?.unresolvedMatches ?? 0,
            income?.lowConfidenceMatches ?? 0,
          ),
        },
        scenarioDifference,
        warnings,
      };
    },
  };
}
