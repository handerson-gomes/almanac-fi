import { createHash, randomUUID } from "node:crypto";

import type { AppDatabase } from "./index.js";
import { now } from "./index.js";
import type { IncomeForecastOccurrence, IncomeRepository } from "./income.js";

export type IncomeForecastRun = Readonly<{
  createdAt: string;
  dataAsOf: string;
  householdId: string;
  id: string;
  inputVersion: string;
  months: number;
  startMonth: string;
}>;
export type IncomeForecastRow = Readonly<{
  currency: string;
  expectedGrossAmountMinor: number;
  expectedNetAmountMinor: number | null;
  highGrossAmountMinor: number;
  highNetAmountMinor: number | null;
  id: string;
  lowGrossAmountMinor: number;
  lowNetAmountMinor: number | null;
  month: string;
  personId: string;
  runId: string;
  scheduleId: string;
  sourceId: string;
  warnings: readonly string[];
}>;
export type IncomeReconciliationMatch = Readonly<{
  confidence: number;
  createdAt: string;
  dataAsOf: string;
  expectedGrossAmountMinor: number | null;
  expectedNetAmountMinor: number | null;
  forecastRowId: string | null;
  id: string;
  inputVersion: string;
  matchMethod:
    | "inferred"
    | "unmatched_expected"
    | "unexplained_deposit"
    | "user_confirmed";
  observedNetAmountMinor: number | null;
  reviewState: "matched" | "needs_review" | "confirmed" | "unexplained";
  runId: string;
  transactionIds: readonly string[];
  updatedAt: string;
  varianceMinor: number | null;
}>;
export type IncomeForecastRunResult = Readonly<{
  matches: readonly IncomeReconciliationMatch[];
  rows: readonly IncomeForecastRow[];
  run: IncomeForecastRun;
}>;

type Deposit = Readonly<{
  amountMinor: number;
  currency: string;
  id: string;
  month: string;
  transactionDate: string;
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

export interface IncomeReconciliationRepository {
  confirmMatch(
    id: string,
    transactionIds: readonly string[],
    actor?: string,
  ): IncomeReconciliationMatch | undefined;
  getRun(
    id: string,
    horizonMonths?: number,
  ): IncomeForecastRunResult | undefined;
  run(
    householdId: string,
    input: Readonly<{ dataAsOf: string; months: number; startMonth: string }>,
    actor?: string,
  ): IncomeForecastRunResult;
}

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function rowFromOccurrence(
  runId: string,
  occurrence: IncomeForecastOccurrence,
): IncomeForecastRow {
  return { ...occurrence, id: randomUUID(), runId };
}

function matchConfidence(expected: number, observed: number): number {
  return Math.max(0, 1 - Math.abs(observed - expected) / Math.max(1, expected));
}

export function createIncomeReconciliationRepository(
  database: AppDatabase,
  income: IncomeRepository,
  audit: Auditor,
): IncomeReconciliationRepository {
  const runById = (id: string): IncomeForecastRun | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, household_id AS householdId, start_month AS startMonth, months, input_version AS inputVersion, data_as_of AS dataAsOf, created_at AS createdAt FROM income_forecast_runs WHERE id = ?",
      )
      .get(id) as IncomeForecastRun | undefined;
  const depositsAsOf = (dataAsOf: string): readonly Deposit[] =>
    database.sqlite
      .prepare(
        "SELECT t.id, t.amount_minor AS amountMinor, t.currency, t.transaction_date AS transactionDate, substr(t.transaction_date, 1, 7) || '-01' AS month FROM transactions t JOIN income_classifications c ON c.transaction_id = t.id WHERE t.is_current = 1 AND t.amount_minor > 0 AND c.kind = 'income' AND substr(t.transaction_date, 1, 10) <= ? ORDER BY t.transaction_date, t.id",
      )
      .all(dataAsOf) as Deposit[];
  const rowsForRun = (
    runId: string,
    horizonMonths?: number,
  ): readonly IncomeForecastRow[] => {
    const rows = database.sqlite
      .prepare(
        "SELECT id, run_id AS runId, schedule_id AS scheduleId, source_id AS sourceId, person_id AS personId, month, currency, expected_gross_amount_minor AS expectedGrossAmountMinor, expected_net_amount_minor AS expectedNetAmountMinor, low_gross_amount_minor AS lowGrossAmountMinor, low_net_amount_minor AS lowNetAmountMinor, high_gross_amount_minor AS highGrossAmountMinor, high_net_amount_minor AS highNetAmountMinor, warnings_json AS warningsJson FROM income_forecast_rows WHERE run_id = ? ORDER BY month, schedule_id",
      )
      .all(runId) as Array<
      Omit<IncomeForecastRow, "warnings"> & { warningsJson: string }
    >;
    const selected =
      horizonMonths === undefined
        ? rows
        : rows.filter((row, _index, all) => {
            const earliest = all[0]?.month;
            if (earliest === undefined) return false;
            const start = new Date(`${earliest}T00:00:00.000Z`);
            const cutoff = new Date(
              Date.UTC(
                start.getUTCFullYear(),
                start.getUTCMonth() + horizonMonths,
                1,
              ),
            );
            return row.month < cutoff.toISOString().slice(0, 10);
          });
    return selected.map(({ warningsJson, ...row }) => ({
      ...row,
      warnings: JSON.parse(warningsJson) as string[],
    }));
  };
  const matchesForRun = (
    runId: string,
    rowIds?: readonly string[],
  ): readonly IncomeReconciliationMatch[] => {
    const matchRows = database.sqlite
      .prepare(
        "SELECT id, run_id AS runId, forecast_row_id AS forecastRowId, expected_gross_amount_minor AS expectedGrossAmountMinor, expected_net_amount_minor AS expectedNetAmountMinor, observed_net_amount_minor AS observedNetAmountMinor, variance_minor AS varianceMinor, match_method AS matchMethod, confidence, review_state AS reviewState, input_version AS inputVersion, data_as_of AS dataAsOf, created_at AS createdAt, updated_at AS updatedAt FROM income_reconciliation_matches WHERE run_id = ? ORDER BY created_at, id",
      )
      .all(runId) as Array<Omit<IncomeReconciliationMatch, "transactionIds">>;
    const permitted = rowIds === undefined ? undefined : new Set(rowIds);
    return matchRows
      .filter(
        (match) =>
          match.forecastRowId === null ||
          permitted?.has(match.forecastRowId) !== false,
      )
      .map((match) => ({
        ...match,
        transactionIds: database.sqlite
          .prepare(
            "SELECT transaction_id AS transactionId FROM income_reconciliation_match_deposits WHERE match_id = ? ORDER BY transaction_id",
          )
          .all(match.id)
          .map((row) => (row as { transactionId: string }).transactionId),
      }));
  };
  const resultForRun = (
    run: IncomeForecastRun,
    horizonMonths?: number,
  ): IncomeForecastRunResult => {
    const rows = rowsForRun(run.id, horizonMonths);
    return {
      matches: matchesForRun(
        run.id,
        rows.map((row) => row.id),
      ),
      rows,
      run,
    };
  };
  const createMatch = (
    input: Omit<
      IncomeReconciliationMatch,
      "id" | "transactionIds" | "createdAt" | "updatedAt"
    >,
    deposits: readonly Deposit[],
  ): IncomeReconciliationMatch => {
    const timestamp = now();
    const record: IncomeReconciliationMatch = {
      ...input,
      createdAt: timestamp,
      id: randomUUID(),
      transactionIds: deposits.map((deposit) => deposit.id),
      updatedAt: timestamp,
    };
    database.sqlite
      .prepare(
        "INSERT INTO income_reconciliation_matches (id, run_id, forecast_row_id, expected_gross_amount_minor, expected_net_amount_minor, observed_net_amount_minor, variance_minor, match_method, confidence, review_state, input_version, data_as_of, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        record.id,
        record.runId,
        record.forecastRowId,
        record.expectedGrossAmountMinor,
        record.expectedNetAmountMinor,
        record.observedNetAmountMinor,
        record.varianceMinor,
        record.matchMethod,
        record.confidence,
        record.reviewState,
        record.inputVersion,
        record.dataAsOf,
        timestamp,
        timestamp,
      );
    const insertDeposit = database.sqlite.prepare(
      "INSERT INTO income_reconciliation_match_deposits (match_id, transaction_id, observed_amount_minor) VALUES (?, ?, ?)",
    );
    for (const deposit of deposits)
      insertDeposit.run(record.id, deposit.id, deposit.amountMinor);
    return record;
  };
  return {
    confirmMatch(id, transactionIds, actor = "user") {
      const current = matchesForRun(
        (
          database.sqlite
            .prepare(
              "SELECT run_id AS runId FROM income_reconciliation_matches WHERE id = ?",
            )
            .get(id) as { runId: string } | undefined
        )?.runId ?? "",
      ).find((match) => match.id === id);
      if (current === undefined) return undefined;
      if (current.forecastRowId === null)
        throw new Error("Only an expected-income match can be confirmed.");
      if (transactionIds.length === 0)
        throw new Error("Choose at least one earned-income deposit.");
      const placeholders = transactionIds.map(() => "?").join(", ");
      const deposits = database.sqlite
        .prepare(
          `SELECT t.id, t.amount_minor AS amountMinor, t.currency, t.transaction_date AS transactionDate, substr(t.transaction_date, 1, 7) || '-01' AS month FROM transactions t JOIN income_classifications c ON c.transaction_id = t.id WHERE t.id IN (${placeholders}) AND t.is_current = 1 AND t.amount_minor > 0 AND c.kind = 'income' ORDER BY t.transaction_date, t.id`,
        )
        .all(...transactionIds) as Deposit[];
      if (deposits.length !== transactionIds.length)
        throw new Error(
          "Confirmed matches may only use current earned-income deposits.",
        );
      const row = database.sqlite
        .prepare(
          "SELECT currency, month, expected_net_amount_minor AS expectedNetAmountMinor FROM income_forecast_rows WHERE id = ?",
        )
        .get(current.forecastRowId) as
        | {
            currency: string;
            expectedNetAmountMinor: number | null;
            month: string;
          }
        | undefined;
      if (row === undefined || row.expectedNetAmountMinor === null)
        throw new Error(
          "This forecast row has no expected net amount to confirm.",
        );
      const expectedNetAmountMinor = row.expectedNetAmountMinor;
      if (deposits.some((deposit) => deposit.currency !== row.currency))
        throw new Error(
          "Confirmed deposits must use the forecast row currency.",
        );
      if (deposits.some((deposit) => deposit.month !== row.month))
        throw new Error("Confirmed deposits must fall in the forecast month.");
      const observed = deposits.reduce(
        (sum, deposit) => sum + deposit.amountMinor,
        0,
      );
      database.transaction(() => {
        for (const deposit of deposits) {
          const owner = database.sqlite
            .prepare(
              "SELECT m.id, m.match_method AS matchMethod FROM income_reconciliation_match_deposits d JOIN income_reconciliation_matches m ON m.id = d.match_id WHERE d.transaction_id = ?",
            )
            .get(deposit.id) as { id: string; matchMethod: string } | undefined;
          if (owner !== undefined && owner.id !== id) {
            if (owner.matchMethod !== "unexplained_deposit")
              throw new Error("A selected deposit is already reconciled.");
            database.sqlite
              .prepare("DELETE FROM income_reconciliation_matches WHERE id = ?")
              .run(owner.id);
          }
        }
        database.sqlite
          .prepare(
            "DELETE FROM income_reconciliation_match_deposits WHERE match_id = ?",
          )
          .run(id);
        const insert = database.sqlite.prepare(
          "INSERT INTO income_reconciliation_match_deposits (match_id, transaction_id, observed_amount_minor) VALUES (?, ?, ?)",
        );
        for (const deposit of deposits)
          insert.run(id, deposit.id, deposit.amountMinor);
        database.sqlite
          .prepare(
            "UPDATE income_reconciliation_matches SET observed_net_amount_minor = ?, variance_minor = ?, match_method = 'user_confirmed', confidence = 1, review_state = 'confirmed', updated_at = ? WHERE id = ?",
          )
          .run(observed, observed - expectedNetAmountMinor, now(), id);
      });
      const updated = matchesForRun(current.runId).find(
        (match) => match.id === id,
      );
      if (updated !== undefined)
        audit({
          actor,
          afterJson: JSON.stringify(updated),
          beforeJson: JSON.stringify(current),
          entityId: id,
          entityType: "income_reconciliation_match",
          operation: "confirm",
        });
      return updated;
    },
    getRun(id, horizonMonths) {
      const run = runById(id);
      return run === undefined ? undefined : resultForRun(run, horizonMonths);
    },
    run(householdId, input, actor = "user") {
      const forecast = income.forecast(
        householdId,
        input.startMonth,
        input.months,
      );
      const forecastMonths = new Set(
        forecast.monthly.map(
          (occurrence) => `${occurrence.currency}:${occurrence.month}`,
        ),
      );
      const deposits = depositsAsOf(input.dataAsOf).filter((deposit) =>
        forecastMonths.has(`${deposit.currency}:${deposit.month}`),
      );
      const inputVersion = checksum({ deposits, monthly: forecast.monthly });
      const timestamp = now();
      const run: IncomeForecastRun = {
        createdAt: timestamp,
        dataAsOf: input.dataAsOf,
        householdId,
        id: randomUUID(),
        inputVersion,
        months: input.months,
        startMonth: input.startMonth,
      };
      database.transaction(() => {
        database.sqlite
          .prepare(
            "INSERT INTO income_forecast_runs (id, household_id, start_month, months, input_version, data_as_of, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            run.id,
            run.householdId,
            run.startMonth,
            run.months,
            run.inputVersion,
            run.dataAsOf,
            timestamp,
          );
        const rows = forecast.monthly.map((occurrence) =>
          rowFromOccurrence(run.id, occurrence),
        );
        const insertRow = database.sqlite.prepare(
          "INSERT INTO income_forecast_rows (id, run_id, schedule_id, source_id, person_id, month, currency, expected_gross_amount_minor, expected_net_amount_minor, low_gross_amount_minor, low_net_amount_minor, high_gross_amount_minor, high_net_amount_minor, warnings_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const row of rows)
          insertRow.run(
            row.id,
            row.runId,
            row.scheduleId,
            row.sourceId,
            row.personId,
            row.month,
            row.currency,
            row.expectedGrossAmountMinor,
            row.expectedNetAmountMinor,
            row.lowGrossAmountMinor,
            row.lowNetAmountMinor,
            row.highGrossAmountMinor,
            row.highNetAmountMinor,
            JSON.stringify(row.warnings),
            timestamp,
          );
        const unused = new Map(
          deposits.map((deposit) => [deposit.id, deposit]),
        );
        for (const row of rows) {
          const expected = row.expectedNetAmountMinor;
          if (expected === null) {
            createMatch(
              {
                confidence: 0,
                dataAsOf: run.dataAsOf,
                expectedGrossAmountMinor: row.expectedGrossAmountMinor,
                expectedNetAmountMinor: null,
                forecastRowId: row.id,
                inputVersion: run.inputVersion,
                matchMethod: "unmatched_expected",
                observedNetAmountMinor: null,
                reviewState: "needs_review",
                runId: run.id,
                varianceMinor: null,
              },
              [],
            );
            continue;
          }
          const candidates = [...unused.values()].filter(
            (deposit) =>
              deposit.currency === row.currency && deposit.month === row.month,
          );
          const first = candidates.sort(
            (left, right) =>
              Math.abs(left.amountMinor - expected) -
                Math.abs(right.amountMinor - expected) ||
              left.transactionDate.localeCompare(right.transactionDate) ||
              left.id.localeCompare(right.id),
          )[0];
          const matched: Deposit[] = first === undefined ? [] : [first];
          if (first !== undefined) unused.delete(first.id);
          while (
            matched.reduce((sum, deposit) => sum + deposit.amountMinor, 0) <
            expected
          ) {
            const remaining =
              expected -
              matched.reduce((sum, deposit) => sum + deposit.amountMinor, 0);
            const next = [...unused.values()]
              .filter(
                (deposit) =>
                  deposit.currency === row.currency &&
                  deposit.month === row.month &&
                  deposit.amountMinor <= remaining,
              )
              .sort(
                (left, right) =>
                  Math.abs(left.amountMinor - remaining) -
                    Math.abs(right.amountMinor - remaining) ||
                  left.transactionDate.localeCompare(right.transactionDate) ||
                  left.id.localeCompare(right.id),
              )[0];
            if (next === undefined) break;
            matched.push(next);
            unused.delete(next.id);
          }
          const observed =
            matched.length === 0
              ? null
              : matched.reduce((sum, deposit) => sum + deposit.amountMinor, 0);
          createMatch(
            {
              confidence:
                observed === null ? 0 : matchConfidence(expected, observed),
              dataAsOf: run.dataAsOf,
              expectedGrossAmountMinor: row.expectedGrossAmountMinor,
              expectedNetAmountMinor: expected,
              forecastRowId: row.id,
              inputVersion: run.inputVersion,
              matchMethod:
                observed === null ? "unmatched_expected" : "inferred",
              observedNetAmountMinor: observed,
              reviewState: observed === null ? "needs_review" : "matched",
              runId: run.id,
              varianceMinor: observed === null ? null : observed - expected,
            },
            matched,
          );
        }
        for (const deposit of unused.values()) {
          createMatch(
            {
              confidence: 0,
              dataAsOf: run.dataAsOf,
              expectedGrossAmountMinor: null,
              expectedNetAmountMinor: null,
              forecastRowId: null,
              inputVersion: run.inputVersion,
              matchMethod: "unexplained_deposit",
              observedNetAmountMinor: deposit.amountMinor,
              reviewState: "unexplained",
              runId: run.id,
              varianceMinor: null,
            },
            [deposit],
          );
        }
      });
      const result = resultForRun(run);
      audit({
        actor,
        afterJson: JSON.stringify(result),
        beforeJson: null,
        entityId: run.id,
        entityType: "income_forecast_run",
        operation: "create",
      });
      return result;
    },
  };
}
