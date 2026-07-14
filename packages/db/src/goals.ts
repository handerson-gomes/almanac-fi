import { randomUUID } from "node:crypto";
import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type FinancialGoal = Readonly<{
  accountId: string | null;
  constraintLevel: "hard" | "soft";
  createdAt: string;
  currency: string;
  dependentId: string | null;
  fundingStrategy: "cash" | "investments" | "mixed";
  householdId: string;
  id: string;
  name: string;
  priorityTier: "aspirational" | "essential" | "important";
  status: "active" | "completed" | "paused";
  targetAmountMinor: number;
  targetDate: string;
  updatedAt: string;
}>;
export type ScenarioAssumption = Readonly<{
  assumptionKey: string;
  confidence: number;
  createdAt: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  householdId: string;
  id: string;
  source: string;
  updatedAt: string;
  value: boolean | number | string;
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
export interface GoalRepository {
  create(
    input: Omit<FinancialGoal, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): FinancialGoal;
  createAssumption(
    input: Omit<ScenarioAssumption, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): ScenarioAssumption;
  list(householdId: string): readonly FinancialGoal[];
  listAssumptions(
    householdId: string,
    asOf?: string,
  ): readonly ScenarioAssumption[];
  update(
    id: string,
    input: Partial<
      Pick<
        FinancialGoal,
        | "constraintLevel"
        | "fundingStrategy"
        | "name"
        | "priorityTier"
        | "status"
        | "targetAmountMinor"
        | "targetDate"
      >
    >,
    actor?: string,
  ): FinancialGoal | undefined;
}
export function createGoalRepository(
  database: AppDatabase,
  audit: Auditor,
): GoalRepository {
  const goalById = (id: string): FinancialGoal | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, household_id AS householdId, name, target_amount_minor AS targetAmountMinor, currency, target_date AS targetDate, status, priority_tier AS priorityTier, constraint_level AS constraintLevel, funding_strategy AS fundingStrategy, dependent_id AS dependentId, account_id AS accountId, created_at AS createdAt, updated_at AS updatedAt FROM financial_goals WHERE id = ?",
      )
      .get(id) as FinancialGoal | undefined;
  const validate = (
    goal: Pick<FinancialGoal, "constraintLevel" | "priorityTier">,
  ): void => {
    if (goal.priorityTier === "aspirational" && goal.constraintLevel === "hard")
      throw new Error("Aspirational goals cannot be hard constraints.");
  };
  const decode = (
    row: Omit<ScenarioAssumption, "value"> & { valueJson: string },
  ): ScenarioAssumption => {
    const { valueJson, ...rest } = row;
    return {
      ...rest,
      value: JSON.parse(valueJson) as ScenarioAssumption["value"],
    };
  };
  return {
    create(input, actor = "user") {
      validate(input);
      const timestamp = now();
      const record: FinancialGoal = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO financial_goals (id, household_id, name, target_amount_minor, currency, target_date, status, priority_tier, constraint_level, funding_strategy, dependent_id, account_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.householdId,
          record.name,
          record.targetAmountMinor,
          record.currency,
          record.targetDate,
          record.status,
          record.priorityTier,
          record.constraintLevel,
          record.fundingStrategy,
          record.dependentId,
          record.accountId,
          timestamp,
          timestamp,
        );
      audit({
        actor,
        afterJson: JSON.stringify(record),
        beforeJson: null,
        entityId: record.id,
        entityType: "financial_goal",
        operation: "create",
      });
      return record;
    },
    createAssumption(input, actor = "user") {
      const overlap = database.sqlite
        .prepare(
          "SELECT id FROM scenario_assumptions WHERE household_id = ? AND assumption_key = ? AND effective_from < COALESCE(?, '9999-12-31') AND COALESCE(effective_to, '9999-12-31') > ? LIMIT 1",
        )
        .get(
          input.householdId,
          input.assumptionKey,
          input.effectiveTo,
          input.effectiveFrom,
        );
      if (overlap)
        throw new Error(
          "Assumption effective dates cannot overlap for the same key.",
        );
      const timestamp = now();
      const record: ScenarioAssumption = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO scenario_assumptions (id, household_id, assumption_key, value_json, effective_from, effective_to, source, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.householdId,
          record.assumptionKey,
          JSON.stringify(record.value),
          record.effectiveFrom,
          record.effectiveTo,
          record.source,
          record.confidence,
          timestamp,
          timestamp,
        );
      audit({
        actor,
        afterJson: JSON.stringify(record),
        beforeJson: null,
        entityId: record.id,
        entityType: "scenario_assumption",
        operation: "create",
      });
      return record;
    },
    list(householdId) {
      return database.sqlite
        .prepare(
          "SELECT id, household_id AS householdId, name, target_amount_minor AS targetAmountMinor, currency, target_date AS targetDate, status, priority_tier AS priorityTier, constraint_level AS constraintLevel, funding_strategy AS fundingStrategy, dependent_id AS dependentId, account_id AS accountId, created_at AS createdAt, updated_at AS updatedAt FROM financial_goals WHERE household_id = ? ORDER BY target_date, id",
        )
        .all(householdId) as FinancialGoal[];
    },
    listAssumptions(householdId, asOf) {
      const rows = database.sqlite
        .prepare(
          `SELECT id, household_id AS householdId, assumption_key AS assumptionKey, value_json AS valueJson, effective_from AS effectiveFrom, effective_to AS effectiveTo, source, confidence, created_at AS createdAt, updated_at AS updatedAt FROM scenario_assumptions WHERE household_id = ? ${asOf === undefined ? "" : "AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)"} ORDER BY effective_from DESC, assumption_key`,
        )
        .all(
          ...(asOf === undefined ? [householdId] : [householdId, asOf, asOf]),
        ) as Array<Omit<ScenarioAssumption, "value"> & { valueJson: string }>;
      return rows.map(decode);
    },
    update(id, input, actor = "user") {
      const current = goalById(id);
      if (!current) return undefined;
      const updated: FinancialGoal = { ...current, ...input, updatedAt: now() };
      validate(updated);
      database.sqlite
        .prepare(
          "UPDATE financial_goals SET name = ?, target_amount_minor = ?, target_date = ?, status = ?, priority_tier = ?, constraint_level = ?, funding_strategy = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          updated.name,
          updated.targetAmountMinor,
          updated.targetDate,
          updated.status,
          updated.priorityTier,
          updated.constraintLevel,
          updated.fundingStrategy,
          updated.updatedAt,
          id,
        );
      audit({
        actor,
        afterJson: JSON.stringify(updated),
        beforeJson: JSON.stringify(current),
        entityId: id,
        entityType: "financial_goal",
        operation: "update",
      });
      return updated;
    },
  };
}
