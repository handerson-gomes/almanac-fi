import { randomUUID } from "node:crypto";

import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type IncomeSource = Readonly<{
  createdAt: string;
  id: string;
  kind:
    "w2" | "contractor" | "self_employment" | "bonus" | "investment" | "other";
  name: string;
  personId: string;
  updatedAt: string;
}>;
export type IncomeSchedule = Readonly<{
  annualGrowthBps: number;
  behavior: "fixed" | "variable";
  cadence:
    "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "annual";
  confidence: number;
  createdAt: string;
  currency: string;
  deductionAmountMinor: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  expectedNetAmountMinor: number | null;
  grossAmountMinor: number;
  grossIncomeBasis: "gross";
  highGrossAmountMinor: number | null;
  id: string;
  lowGrossAmountMinor: number | null;
  personId: string;
  source: string;
  sourceId: string;
  updatedAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  withholdingRateBps: number | null;
}>;
export type IncomeForecastOccurrence = Readonly<{
  currency: string;
  expectedGrossAmountMinor: number;
  expectedNetAmountMinor: number | null;
  highGrossAmountMinor: number;
  highNetAmountMinor: number | null;
  lowGrossAmountMinor: number;
  lowNetAmountMinor: number | null;
  month: string;
  personId: string;
  scheduleId: string;
  sourceId: string;
  warnings: readonly string[];
}>;
export type IncomeForecastAnnualTotal = Readonly<{
  currency: string;
  expectedNetAmountMinor: number | null;
  highNetAmountMinor: number | null;
  lowNetAmountMinor: number | null;
  year: number;
}>;
export type IncomeForecast = Readonly<{
  annual: readonly IncomeForecastAnnualTotal[];
  monthly: readonly IncomeForecastOccurrence[];
}>;
type IncomeScheduleUpdate = {
  [
    Key in keyof Omit<
      IncomeSchedule,
      "createdAt" | "id" | "personId" | "sourceId" | "updatedAt"
    >
  ]?:
    | Omit<
        IncomeSchedule,
        "createdAt" | "id" | "personId" | "sourceId" | "updatedAt"
      >[Key]
    | undefined;
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

export interface IncomeRepository {
  createSchedule(
    input: Omit<IncomeSchedule, "createdAt" | "id" | "personId" | "updatedAt">,
    actor?: string,
  ): IncomeSchedule;
  createSource(
    input: Omit<IncomeSource, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): IncomeSource;
  forecast(
    householdId: string,
    startMonth: string,
    months: number,
  ): IncomeForecast;
  listSchedules(sourceId: string): readonly IncomeSchedule[];
  listSources(householdId: string): readonly IncomeSource[];
  updateSchedule(
    id: string,
    input: IncomeScheduleUpdate,
    actor?: string,
  ): IncomeSchedule | undefined;
}

const unknownNetWarning =
  "Expected net cash is unknown: add an expected net amount or withholding/deduction assumptions.";

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthStart(value: string): Date {
  const date = parseDate(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(value: Date, months: number): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + months;
  const day = value.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function paymentDates(
  schedule: IncomeSchedule,
  from: Date,
  to: Date,
): readonly Date[] {
  const effectiveFrom = parseDate(schedule.effectiveFrom);
  const effectiveTo =
    schedule.effectiveTo === null ? undefined : parseDate(schedule.effectiveTo);
  const dates: Date[] = [];
  const include = (date: Date): boolean =>
    date >= effectiveFrom &&
    date >= from &&
    date < to &&
    (effectiveTo === undefined || date < effectiveTo);
  if (schedule.cadence === "semimonthly") {
    for (
      let cursor = monthStart(schedule.effectiveFrom);
      cursor < to;
      cursor = addMonths(cursor, 1)
    ) {
      const first = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          Math.min(effectiveFrom.getUTCDate(), 15),
        ),
      );
      const second = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
      );
      if (include(first)) dates.push(first);
      if (include(second)) dates.push(second);
    }
    return dates;
  }
  const stepDays =
    schedule.cadence === "weekly"
      ? 7
      : schedule.cadence === "biweekly"
        ? 14
        : undefined;
  if (stepDays !== undefined) {
    for (
      let cursor = effectiveFrom;
      cursor < to;
      cursor = addDays(cursor, stepDays)
    ) {
      if (include(cursor)) dates.push(cursor);
    }
    return dates;
  }
  const stepMonths =
    schedule.cadence === "monthly"
      ? 1
      : schedule.cadence === "quarterly"
        ? 3
        : 12;
  for (
    let cursor = effectiveFrom;
    cursor < to;
    cursor = addMonths(cursor, stepMonths)
  ) {
    if (include(cursor)) dates.push(cursor);
  }
  return dates;
}

function grown(
  amount: number,
  schedule: IncomeSchedule,
  occurrence: Date,
): number {
  const started = parseDate(schedule.effectiveFrom);
  const fullYears = Math.max(
    0,
    Math.floor(
      occurrence.getUTCFullYear() -
        started.getUTCFullYear() -
        (occurrence.getUTCMonth() < started.getUTCMonth() ||
        (occurrence.getUTCMonth() === started.getUTCMonth() &&
          occurrence.getUTCDate() < started.getUTCDate())
          ? 1
          : 0),
    ),
  );
  return Math.round(
    amount * (1 + schedule.annualGrowthBps / 10_000) ** fullYears,
  );
}

function netAmount(
  gross: number,
  schedule: IncomeSchedule,
  occurrence: Date,
  useExplicitNet: boolean,
): number | null {
  if (useExplicitNet && schedule.expectedNetAmountMinor !== null) {
    return grown(schedule.expectedNetAmountMinor, schedule, occurrence);
  }
  if (
    schedule.withholdingRateBps === null &&
    schedule.deductionAmountMinor === null
  )
    return null;
  const grownGross = grown(gross, schedule, occurrence);
  return Math.max(
    0,
    grownGross -
      Math.round((grownGross * (schedule.withholdingRateBps ?? 0)) / 10_000) -
      (schedule.deductionAmountMinor ?? 0),
  );
}

function total(values: readonly (number | null)[]): number | null {
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function validateSchedule(
  schedule: Omit<IncomeSchedule, "createdAt" | "id" | "personId" | "updatedAt">,
): void {
  if (
    schedule.effectiveTo !== null &&
    schedule.effectiveTo <= schedule.effectiveFrom
  ) {
    throw new Error(
      "Income schedule effective end must be after its start date.",
    );
  }
  if (
    schedule.behavior === "variable" &&
    (schedule.lowGrossAmountMinor === null ||
      schedule.highGrossAmountMinor === null)
  ) {
    throw new Error("Variable income requires low and high gross amounts.");
  }
  if (
    schedule.behavior === "variable" &&
    schedule.expectedNetAmountMinor !== null
  ) {
    throw new Error(
      "Variable income must use withholding or deduction assumptions so all bounds can be derived.",
    );
  }
  if (
    schedule.behavior === "fixed" &&
    (schedule.lowGrossAmountMinor !== null ||
      schedule.highGrossAmountMinor !== null)
  ) {
    throw new Error("Fixed income cannot include variability bounds.");
  }
}

export function createIncomeRepository(
  database: AppDatabase,
  audit: Auditor,
): IncomeRepository {
  const sourceById = (id: string): IncomeSource | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, person_id AS personId, name, kind, created_at AS createdAt, updated_at AS updatedAt FROM income_sources WHERE id = ?",
      )
      .get(id) as IncomeSource | undefined;
  const scheduleById = (id: string): IncomeSchedule | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, source_id AS sourceId, person_id AS personId, behavior, gross_amount_minor AS grossAmountMinor, low_gross_amount_minor AS lowGrossAmountMinor, high_gross_amount_minor AS highGrossAmountMinor, gross_income_basis AS grossIncomeBasis, cadence, currency, expected_net_amount_minor AS expectedNetAmountMinor, withholding_rate_bps AS withholdingRateBps, deduction_amount_minor AS deductionAmountMinor, effective_from AS effectiveFrom, effective_to AS effectiveTo, annual_growth_bps AS annualGrowthBps, source, confidence, verified_at AS verifiedAt, verified_by AS verifiedBy, created_at AS createdAt, updated_at AS updatedAt FROM income_schedules WHERE id = ?",
      )
      .get(id) as IncomeSchedule | undefined;
  const recordAudit = (
    entityType: string,
    operation: string,
    actor: string,
    after: unknown,
    before: unknown,
    id: string,
  ): void =>
    audit({
      actor,
      afterJson: JSON.stringify(after),
      beforeJson: before === null ? null : JSON.stringify(before),
      entityId: id,
      entityType,
      operation,
    });
  const assertNoOverlap = (
    sourceId: string,
    effectiveFrom: string,
    effectiveTo: string | null,
    ignoredId?: string,
  ): void => {
    const overlap = database.sqlite
      .prepare(
        `SELECT id FROM income_schedules WHERE source_id = ? AND effective_from < COALESCE(?, '9999-12-31') AND COALESCE(effective_to, '9999-12-31') > ? ${ignoredId === undefined ? "" : "AND id <> ?"} LIMIT 1`,
      )
      .get(
        ...(ignoredId === undefined
          ? [sourceId, effectiveTo, effectiveFrom]
          : [sourceId, effectiveTo, effectiveFrom, ignoredId]),
      );
    if (overlap)
      throw new Error(
        "Income schedule effective dates cannot overlap for the same income source.",
      );
  };
  return {
    createSource(input, actor = "user") {
      const timestamp = now();
      const record: IncomeSource = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO income_sources (id, person_id, name, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.personId,
          record.name,
          record.kind,
          timestamp,
          timestamp,
        );
      recordAudit("income_source", "create", actor, record, null, record.id);
      return record;
    },
    createSchedule(input, actor = "user") {
      validateSchedule(input);
      const source = sourceById(input.sourceId);
      if (source === undefined) throw new Error("Income source was not found.");
      assertNoOverlap(input.sourceId, input.effectiveFrom, input.effectiveTo);
      const timestamp = now();
      const record: IncomeSchedule = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        personId: source.personId,
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO income_schedules (id, source_id, person_id, behavior, gross_amount_minor, low_gross_amount_minor, high_gross_amount_minor, gross_income_basis, cadence, currency, expected_net_amount_minor, withholding_rate_bps, deduction_amount_minor, effective_from, effective_to, annual_growth_bps, source, confidence, verified_at, verified_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.sourceId,
          record.personId,
          record.behavior,
          record.grossAmountMinor,
          record.lowGrossAmountMinor,
          record.highGrossAmountMinor,
          record.grossIncomeBasis,
          record.cadence,
          record.currency,
          record.expectedNetAmountMinor,
          record.withholdingRateBps,
          record.deductionAmountMinor,
          record.effectiveFrom,
          record.effectiveTo,
          record.annualGrowthBps,
          record.source,
          record.confidence,
          record.verifiedAt,
          record.verifiedBy,
          timestamp,
          timestamp,
        );
      recordAudit("income_schedule", "create", actor, record, null, record.id);
      return record;
    },
    forecast(householdId, start, months) {
      const startDate = monthStart(start);
      const endDate = addMonths(startDate, months);
      const schedules = database.sqlite
        .prepare(
          `SELECT s.id, s.source_id AS sourceId, s.person_id AS personId, s.behavior, s.gross_amount_minor AS grossAmountMinor, s.low_gross_amount_minor AS lowGrossAmountMinor, s.high_gross_amount_minor AS highGrossAmountMinor, s.gross_income_basis AS grossIncomeBasis, s.cadence, s.currency, s.expected_net_amount_minor AS expectedNetAmountMinor, s.withholding_rate_bps AS withholdingRateBps, s.deduction_amount_minor AS deductionAmountMinor, s.effective_from AS effectiveFrom, s.effective_to AS effectiveTo, s.annual_growth_bps AS annualGrowthBps, s.source, s.confidence, s.verified_at AS verifiedAt, s.verified_by AS verifiedBy, s.created_at AS createdAt, s.updated_at AS updatedAt FROM income_schedules s JOIN people p ON p.id = s.person_id WHERE p.household_id = ? AND s.effective_from < ? AND (s.effective_to IS NULL OR s.effective_to > ?) ORDER BY s.effective_from, s.id`,
        )
        .all(
          householdId,
          dateString(endDate),
          dateString(startDate),
        ) as IncomeSchedule[];
      const monthly = schedules
        .flatMap((schedule) => {
          const byMonth = new Map<string, Date[]>();
          for (const occurrence of paymentDates(schedule, startDate, endDate)) {
            const key = dateString(monthStart(dateString(occurrence)));
            byMonth.set(key, [...(byMonth.get(key) ?? []), occurrence]);
          }
          return [...byMonth.entries()].map(([month, occurrences]) => {
            const grossTotal = (gross: number): number =>
              occurrences.reduce(
                (sum, date) => sum + grown(gross, schedule, date),
                0,
              );
            const expectedGross = grossTotal(schedule.grossAmountMinor);
            const lowGross = grossTotal(
              schedule.lowGrossAmountMinor ?? schedule.grossAmountMinor,
            );
            const highGross = grossTotal(
              schedule.highGrossAmountMinor ?? schedule.grossAmountMinor,
            );
            const expected = total(
              occurrences.map((date) =>
                netAmount(schedule.grossAmountMinor, schedule, date, true),
              ),
            );
            const low =
              schedule.behavior === "fixed"
                ? expected
                : total(
                    occurrences.map((date) =>
                      netAmount(
                        schedule.lowGrossAmountMinor ??
                          schedule.grossAmountMinor,
                        schedule,
                        date,
                        false,
                      ),
                    ),
                  );
            const high =
              schedule.behavior === "fixed"
                ? expected
                : total(
                    occurrences.map((date) =>
                      netAmount(
                        schedule.highGrossAmountMinor ??
                          schedule.grossAmountMinor,
                        schedule,
                        date,
                        false,
                      ),
                    ),
                  );
            return {
              currency: schedule.currency,
              expectedGrossAmountMinor: expectedGross,
              expectedNetAmountMinor: expected,
              highGrossAmountMinor: highGross,
              highNetAmountMinor: high,
              lowGrossAmountMinor: lowGross,
              lowNetAmountMinor: low,
              month,
              personId: schedule.personId,
              scheduleId: schedule.id,
              sourceId: schedule.sourceId,
              warnings:
                expected === null || low === null || high === null
                  ? [unknownNetWarning]
                  : [],
            } satisfies IncomeForecastOccurrence;
          });
        })
        .sort(
          (left, right) =>
            left.month.localeCompare(right.month) ||
            left.scheduleId.localeCompare(right.scheduleId),
        );
      const annualGroups = new Map<
        string,
        IncomeForecastAnnualTotal & { occurrences: IncomeForecastOccurrence[] }
      >();
      for (const occurrence of monthly) {
        const year = Number(occurrence.month.slice(0, 4));
        const key = `${year}:${occurrence.currency}`;
        const group = annualGroups.get(key) ?? {
          currency: occurrence.currency,
          expectedNetAmountMinor: 0,
          highNetAmountMinor: 0,
          lowNetAmountMinor: 0,
          occurrences: [],
          year,
        };
        group.occurrences.push(occurrence);
        annualGroups.set(key, group);
      }
      const annual = [...annualGroups.values()]
        .map(({ occurrences, ...group }) => ({
          ...group,
          expectedNetAmountMinor: total(
            occurrences.map((item) => item.expectedNetAmountMinor),
          ),
          highNetAmountMinor: total(
            occurrences.map((item) => item.highNetAmountMinor),
          ),
          lowNetAmountMinor: total(
            occurrences.map((item) => item.lowNetAmountMinor),
          ),
        }))
        .sort(
          (left, right) =>
            left.year - right.year ||
            left.currency.localeCompare(right.currency),
        );
      return { annual, monthly };
    },
    listSchedules(sourceId) {
      return database.sqlite
        .prepare(
          "SELECT id, source_id AS sourceId, person_id AS personId, behavior, gross_amount_minor AS grossAmountMinor, low_gross_amount_minor AS lowGrossAmountMinor, high_gross_amount_minor AS highGrossAmountMinor, gross_income_basis AS grossIncomeBasis, cadence, currency, expected_net_amount_minor AS expectedNetAmountMinor, withholding_rate_bps AS withholdingRateBps, deduction_amount_minor AS deductionAmountMinor, effective_from AS effectiveFrom, effective_to AS effectiveTo, annual_growth_bps AS annualGrowthBps, source, confidence, verified_at AS verifiedAt, verified_by AS verifiedBy, created_at AS createdAt, updated_at AS updatedAt FROM income_schedules WHERE source_id = ? ORDER BY effective_from, id",
        )
        .all(sourceId) as IncomeSchedule[];
    },
    listSources(householdId) {
      return database.sqlite
        .prepare(
          "SELECT s.id, s.person_id AS personId, s.name, s.kind, s.created_at AS createdAt, s.updated_at AS updatedAt FROM income_sources s JOIN people p ON p.id = s.person_id WHERE p.household_id = ? ORDER BY s.name, s.id",
        )
        .all(householdId) as IncomeSource[];
    },
    updateSchedule(id, input, actor = "user") {
      const current = scheduleById(id);
      if (current === undefined) return undefined;
      const definedInput = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ) as Partial<IncomeSchedule>;
      const next = {
        ...current,
        ...definedInput,
        id: current.id,
        personId: current.personId,
        sourceId: current.sourceId,
        updatedAt: now(),
      };
      validateSchedule(next);
      assertNoOverlap(next.sourceId, next.effectiveFrom, next.effectiveTo, id);
      database.sqlite
        .prepare(
          "UPDATE income_schedules SET behavior = ?, gross_amount_minor = ?, low_gross_amount_minor = ?, high_gross_amount_minor = ?, gross_income_basis = ?, cadence = ?, currency = ?, expected_net_amount_minor = ?, withholding_rate_bps = ?, deduction_amount_minor = ?, effective_from = ?, effective_to = ?, annual_growth_bps = ?, source = ?, confidence = ?, verified_at = ?, verified_by = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          next.behavior,
          next.grossAmountMinor,
          next.lowGrossAmountMinor,
          next.highGrossAmountMinor,
          next.grossIncomeBasis,
          next.cadence,
          next.currency,
          next.expectedNetAmountMinor,
          next.withholdingRateBps,
          next.deductionAmountMinor,
          next.effectiveFrom,
          next.effectiveTo,
          next.annualGrowthBps,
          next.source,
          next.confidence,
          next.verifiedAt,
          next.verifiedBy,
          next.updatedAt,
          id,
        );
      recordAudit("income_schedule", "update", actor, next, current, id);
      return scheduleById(id);
    },
  };
}
