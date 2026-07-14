import { randomUUID } from "node:crypto";
import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type Liability = Readonly<{
  accountId: string | null;
  confidence: number;
  createdAt: string;
  currency: string;
  householdId: string;
  id: string;
  name: string;
  source: string;
  updatedAt: string;
}>;
export type LiabilityTerms = Readonly<{
  annualRateBps: number | null;
  balanceMinor: number;
  createdAt: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  id: string;
  liabilityId: string;
  minimumPaymentMinor: number;
  paymentDay: number | null;
}>;
export type RecurringObligation = Readonly<{
  amountMinor: number;
  cadence: "annual" | "monthly" | "weekly";
  confidence: number;
  createdAt: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  householdId: string;
  id: string;
  liabilityId: string | null;
  name: string;
  paymentDay: number | null;
  source: string;
  updatedAt: string;
}>;
export type ForecastObligation = Readonly<{
  amountMinor: number;
  currency: string;
  id: string;
  kind: "debt_payment" | "recurring";
  name: string;
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
export interface ObligationRepository {
  addTerms(
    input: Omit<LiabilityTerms, "createdAt" | "id">,
    actor?: string,
  ): LiabilityTerms;
  createLiability(
    input: Omit<Liability, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): Liability;
  createObligation(
    input: Omit<RecurringObligation, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): RecurringObligation;
  createScenarioOverride(
    input: Readonly<{
      liabilityId: string;
      scenarioId: string;
      terms: Record<string, number | null>;
    }>,
    actor?: string,
  ): Readonly<{
    id: string;
    liabilityId: string;
    scenarioId: string;
    terms: Record<string, number | null>;
  }>;
  forecastInputs(
    householdId: string,
    asOf: string,
  ): readonly ForecastObligation[];
  listLiabilities(householdId: string): readonly Liability[];
  listObligations(
    householdId: string,
    asOf?: string,
  ): readonly RecurringObligation[];
  resolveTerms(
    liabilityId: string,
    asOf: string,
    scenarioId?: string,
  ): LiabilityTerms | (LiabilityTerms & { scenario: true });
}
export function createObligationRepository(
  database: AppDatabase,
  audit: Auditor,
): ObligationRepository {
  const termsAt = (
    liabilityId: string,
    asOf: string,
  ): LiabilityTerms | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, liability_id AS liabilityId, balance_minor AS balanceMinor, annual_rate_bps AS annualRateBps, minimum_payment_minor AS minimumPaymentMinor, payment_day AS paymentDay, effective_from AS effectiveFrom, effective_to AS effectiveTo, created_at AS createdAt FROM liability_terms WHERE liability_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?) ORDER BY effective_from DESC LIMIT 1",
      )
      .get(liabilityId, asOf, asOf) as LiabilityTerms | undefined;
  const recordAudit = (
    type: string,
    actor: string,
    value: unknown,
    id: string,
  ): void =>
    audit({
      actor,
      afterJson: JSON.stringify(value),
      beforeJson: null,
      entityId: id,
      entityType: type,
      operation: "create",
    });
  return {
    addTerms(input, actor = "user") {
      if (
        input.balanceMinor > 0 &&
        input.minimumPaymentMinor > input.balanceMinor
      )
        throw new Error(
          "Minimum payment cannot exceed the outstanding balance.",
        );
      const overlap = database.sqlite
        .prepare(
          "SELECT id FROM liability_terms WHERE liability_id = ? AND effective_from < COALESCE(?, '9999-12-31') AND COALESCE(effective_to, '9999-12-31') > ? LIMIT 1",
        )
        .get(input.liabilityId, input.effectiveTo, input.effectiveFrom);
      if (overlap)
        throw new Error("Liability term effective dates cannot overlap.");
      const record: LiabilityTerms = {
        ...input,
        createdAt: now(),
        id: randomUUID(),
      };
      database.sqlite
        .prepare(
          "INSERT INTO liability_terms (id, liability_id, balance_minor, annual_rate_bps, minimum_payment_minor, payment_day, effective_from, effective_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.liabilityId,
          record.balanceMinor,
          record.annualRateBps,
          record.minimumPaymentMinor,
          record.paymentDay,
          record.effectiveFrom,
          record.effectiveTo,
          record.createdAt,
        );
      recordAudit("liability_terms", actor, record, record.id);
      return record;
    },
    createLiability(input, actor = "user") {
      const timestamp = now();
      const record: Liability = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO liabilities (id, household_id, account_id, name, currency, source, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.householdId,
          record.accountId,
          record.name,
          record.currency,
          record.source,
          record.confidence,
          timestamp,
          timestamp,
        );
      recordAudit("liability", actor, record, record.id);
      return record;
    },
    createObligation(input, actor = "user") {
      const timestamp = now();
      const record: RecurringObligation = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO recurring_obligations (id, household_id, liability_id, name, amount_minor, currency, cadence, payment_day, effective_from, effective_to, source, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.householdId,
          record.liabilityId,
          record.name,
          record.amountMinor,
          record.currency,
          record.cadence,
          record.paymentDay,
          record.effectiveFrom,
          record.effectiveTo,
          record.source,
          record.confidence,
          timestamp,
          timestamp,
        );
      recordAudit("recurring_obligation", actor, record, record.id);
      return record;
    },
    createScenarioOverride(input, actor = "user") {
      const id = randomUUID();
      database.sqlite
        .prepare(
          "INSERT INTO liability_scenario_overrides (id, scenario_id, liability_id, terms_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(scenario_id, liability_id) DO UPDATE SET terms_json = excluded.terms_json",
        )
        .run(
          id,
          input.scenarioId,
          input.liabilityId,
          JSON.stringify(input.terms),
          now(),
        );
      const record = { ...input, id };
      recordAudit("liability_scenario_override", actor, record, id);
      return record;
    },
    forecastInputs(householdId, asOf) {
      const liabilities = database.sqlite
        .prepare(
          "SELECT id, name, currency FROM liabilities WHERE household_id = ?",
        )
        .all(householdId) as Array<Pick<Liability, "currency" | "id" | "name">>;
      const debtInputs = liabilities.flatMap((liability) => {
        const terms = termsAt(liability.id, asOf);
        return terms === undefined || terms.balanceMinor === 0
          ? []
          : [
              {
                amountMinor: terms.minimumPaymentMinor,
                currency: liability.currency,
                id: liability.id,
                kind: "debt_payment" as const,
                name: liability.name,
              },
            ];
      });
      const recurring = this.listObligations(householdId, asOf)
        .filter((item) => item.liabilityId === null)
        .map((item) => ({
          amountMinor:
            item.cadence === "monthly"
              ? item.amountMinor
              : item.cadence === "annual"
                ? Math.round(item.amountMinor / 12)
                : Math.round((item.amountMinor * 52) / 12),
          currency: item.currency,
          id: item.id,
          kind: "recurring" as const,
          name: item.name,
        }));
      return [...debtInputs, ...recurring];
    },
    listLiabilities(householdId) {
      return database.sqlite
        .prepare(
          "SELECT id, household_id AS householdId, account_id AS accountId, name, currency, source, confidence, created_at AS createdAt, updated_at AS updatedAt FROM liabilities WHERE household_id = ? ORDER BY name, id",
        )
        .all(householdId) as Liability[];
    },
    listObligations(householdId, asOf) {
      return database.sqlite
        .prepare(
          `SELECT id, household_id AS householdId, liability_id AS liabilityId, name, amount_minor AS amountMinor, currency, cadence, payment_day AS paymentDay, effective_from AS effectiveFrom, effective_to AS effectiveTo, source, confidence, created_at AS createdAt, updated_at AS updatedAt FROM recurring_obligations WHERE household_id = ? ${asOf === undefined ? "" : "AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)"} ORDER BY name, id`,
        )
        .all(
          ...(asOf === undefined ? [householdId] : [householdId, asOf, asOf]),
        ) as RecurringObligation[];
    },
    resolveTerms(liabilityId, asOf, scenarioId) {
      const active = termsAt(liabilityId, asOf);
      if (!active) throw new Error("No liability terms apply on that date.");
      if (scenarioId === undefined) return active;
      const row = database.sqlite
        .prepare(
          "SELECT terms_json AS termsJson FROM liability_scenario_overrides WHERE scenario_id = ? AND liability_id = ?",
        )
        .get(scenarioId, liabilityId) as { termsJson: string } | undefined;
      return row === undefined
        ? active
        : {
            ...active,
            ...(JSON.parse(row.termsJson) as Partial<LiabilityTerms>),
            scenario: true,
          };
    },
  };
}
