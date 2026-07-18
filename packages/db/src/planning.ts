import { createHash, randomUUID } from "node:crypto";

import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export const planningInputTypes = [
  "income_assumption",
  "budget",
  "goal",
  "obligation",
  "allocation_rule",
] as const;
export type PlanningInputType = (typeof planningInputTypes)[number];
export type PlanningInput = Readonly<{
  id: string;
  inputId: string;
  inputType: PlanningInputType;
  value: Readonly<Record<string, unknown>>;
}>;
export type PlanVersion = Readonly<{
  createdAt: string;
  createdBy: string;
  householdId: string;
  id: string;
  isActive: boolean;
  label: string;
  parentVersionId: string | null;
  source: "initial" | "scenario_apply" | "rollback";
}>;
export type PlanningScenario = Readonly<{
  appliedPlanVersionId: string | null;
  basePlanVersionId: string;
  createdAt: string;
  createdBy: string;
  householdId: string;
  id: string;
  name: string;
  status: "draft" | "applied";
}>;
export type ScenarioOverride = Readonly<{
  inputId: string;
  inputType: PlanningInputType;
  patch: Readonly<Record<string, unknown>>;
  scenarioId: string;
}>;
export type PlanProjection = Readonly<{
  allocationMinor: number;
  budgetMinor: number;
  incomeMinor: number;
  months: ReadonlyArray<
    Readonly<{
      allocationMinor: number;
      budgetMinor: number;
      incomeMinor: number;
      netMinor: number;
      obligationMinor: number;
    }>
  >;
  netMinor: number;
  obligationMinor: number;
}>;
export type ScenarioComparison = Readonly<{
  basePlanVersionId: string;
  changedInputs: ReadonlyArray<
    Readonly<{
      after: Readonly<Record<string, unknown>>;
      before: Readonly<Record<string, unknown>>;
      changedFields: readonly string[];
      inputId: string;
      inputType: PlanningInputType;
    }>
  >;
  downstreamMonthlyEffect: Readonly<{
    allocationMinor: number;
    budgetMinor: number;
    incomeMinor: number;
    netMinor: number;
    obligationMinor: number;
  }>;
  scenarioId: string;
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

export interface PlanningRepository {
  activeVersion(householdId: string): PlanVersion | undefined;
  applyScenario(
    scenarioId: string,
    expectedBaseVersionId: string,
    input?: Readonly<{ actor?: string; label?: string }>,
  ): PlanVersion;
  compare(scenarioId: string): ScenarioComparison;
  createScenario(
    householdId: string,
    input: Readonly<{ baseVersionId?: string; name: string }>,
    actor?: string,
  ): PlanningScenario;
  deleteScenario(scenarioId: string, actor?: string): boolean;
  ensureActiveVersion(
    householdId: string,
    input?: Readonly<{ actor?: string; label?: string }>,
  ): PlanVersion;
  getScenario(scenarioId: string): PlanningScenario | undefined;
  inputsForVersion(versionId: string): readonly PlanningInput[];
  overridesForScenario(scenarioId: string): readonly ScenarioOverride[];
  projectScenario(scenarioId: string): PlanProjection;
  projectVersion(versionId: string): PlanProjection;
  rollbackToVersion(
    householdId: string,
    targetVersionId: string,
    expectedActiveVersionId: string,
    input?: Readonly<{ actor?: string; label?: string }>,
  ): PlanVersion;
  setOverride(
    scenarioId: string,
    input: Readonly<{
      inputId: string;
      inputType: PlanningInputType;
      patch: Readonly<Record<string, unknown>>;
    }>,
    actor?: string,
  ): ScenarioOverride;
}

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isInputType(value: string): value is PlanningInputType {
  return (planningInputTypes as readonly string[]).includes(value);
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

function numberAt(
  value: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : 0;
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

function projection(inputs: readonly PlanningInput[]): PlanProjection {
  const byType = (inputType: PlanningInputType): number =>
    inputs
      .filter((input) => input.inputType === inputType)
      .reduce((total, input) => total + monthlyAmount(input), 0);
  const incomeMinor = byType("income_assumption");
  const budgetMinor = byType("budget") + byType("goal");
  const obligationMinor = byType("obligation");
  const allocationMinor = byType("allocation_rule");
  const netMinor =
    incomeMinor - budgetMinor - obligationMinor - allocationMinor;
  const month = {
    allocationMinor,
    budgetMinor,
    incomeMinor,
    netMinor,
    obligationMinor,
  };
  return { ...month, months: Array.from({ length: 12 }, () => ({ ...month })) };
}

function changedFields(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): readonly string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort();
}

export function createPlanningRepository(
  database: AppDatabase,
  audit: Auditor,
): PlanningRepository {
  const versionById = (id: string): PlanVersion | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, household_id AS householdId, parent_version_id AS parentVersionId, label, source, is_active AS isActive, created_at AS createdAt, created_by AS createdBy FROM plan_versions WHERE id = ?",
      )
      .get(id) as PlanVersion | undefined;
  const scenarioById = (id: string): PlanningScenario | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, household_id AS householdId, base_plan_version_id AS basePlanVersionId, name, status, created_at AS createdAt, created_by AS createdBy, applied_plan_version_id AS appliedPlanVersionId FROM planning_scenarios WHERE id = ?",
      )
      .get(id) as PlanningScenario | undefined;
  const inputsForVersion = (versionId: string): readonly PlanningInput[] =>
    (
      database.sqlite
        .prepare(
          "SELECT id, input_type AS inputType, input_id AS inputId, value_json AS valueJson FROM plan_version_inputs WHERE plan_version_id = ? ORDER BY input_type, input_id",
        )
        .all(versionId) as Array<{
        id: string;
        inputType: string;
        inputId: string;
        valueJson: string;
      }>
    ).map((row) => ({
      id: row.id,
      inputId: row.inputId,
      inputType: row.inputType as PlanningInputType,
      value: JSON.parse(row.valueJson) as Record<string, unknown>,
    }));
  const overridesForScenario = (
    scenarioId: string,
  ): readonly ScenarioOverride[] =>
    (
      database.sqlite
        .prepare(
          "SELECT scenario_id AS scenarioId, input_type AS inputType, input_id AS inputId, patch_json AS patchJson FROM planning_scenario_overrides WHERE scenario_id = ? ORDER BY input_type, input_id",
        )
        .all(scenarioId) as Array<{
        scenarioId: string;
        inputType: string;
        inputId: string;
        patchJson: string;
      }>
    ).map((row) => ({
      scenarioId: row.scenarioId,
      inputId: row.inputId,
      inputType: row.inputType as PlanningInputType,
      patch: JSON.parse(row.patchJson) as Record<string, unknown>,
    }));
  const scenarioInputs = (
    scenario: PlanningScenario,
  ): readonly PlanningInput[] => {
    const overrides = new Map(
      overridesForScenario(scenario.id).map((override) => [
        `${override.inputType}:${override.inputId}`,
        override,
      ]),
    );
    return inputsForVersion(scenario.basePlanVersionId).map((input) => ({
      ...input,
      value: {
        ...input.value,
        ...(overrides.get(`${input.inputType}:${input.inputId}`)?.patch ?? {}),
      },
    }));
  };
  const persistInputs = (
    versionId: string,
    inputs: readonly PlanningInput[],
  ): void => {
    const insert = database.sqlite.prepare(
      "INSERT INTO plan_version_inputs (id, plan_version_id, input_type, input_id, value_json) VALUES (?, ?, ?, ?, ?)",
    );
    for (const input of inputs) {
      insert.run(
        randomUUID(),
        versionId,
        input.inputType,
        input.inputId,
        JSON.stringify(input.value),
      );
    }
  };
  const persistProjection = (
    versionId: string,
    inputs: readonly PlanningInput[],
  ): void => {
    const result = projection(inputs);
    const inputChecksum = checksum(
      inputs.map(({ inputId, inputType, value }) => ({
        inputId,
        inputType,
        value,
      })),
    );
    const timestamp = now();
    database.sqlite
      .prepare(
        "INSERT INTO plan_forecast_versions (id, plan_version_id, input_checksum, forecast_json, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        versionId,
        inputChecksum,
        JSON.stringify(result),
        timestamp,
      );
    database.sqlite
      .prepare(
        "INSERT INTO plan_ledger_versions (id, plan_version_id, input_checksum, ledger_json, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        versionId,
        inputChecksum,
        JSON.stringify(result),
        timestamp,
      );
  };
  const liveInputs = (householdId: string): readonly PlanningInput[] => {
    const rows: PlanningInput[] = [];
    const add = (
      inputType: PlanningInputType,
      inputId: string,
      value: Record<string, unknown>,
    ): void => {
      const snapshot = Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "id"),
      );
      rows.push({
        id: `${inputType}:${inputId}`,
        inputId,
        inputType,
        value: snapshot,
      });
    };
    for (const row of database.sqlite
      .prepare(
        "SELECT s.id, s.gross_amount_minor AS grossAmountMinor, s.expected_net_amount_minor AS expectedNetAmountMinor, s.withholding_rate_bps AS withholdingRateBps, s.deduction_amount_minor AS deductionAmountMinor, s.cadence, s.effective_from AS effectiveFrom, s.effective_to AS effectiveTo, s.annual_growth_bps AS annualGrowthBps FROM income_schedules s JOIN people p ON p.id = s.person_id WHERE p.household_id = ? ORDER BY s.id",
      )
      .all(householdId) as Array<Record<string, unknown> & { id: string }>)
      add("income_assumption", row.id, row);
    for (const row of database.sqlite
      .prepare(
        "SELECT l.id, l.target_amount_minor AS targetAmountMinor, p.date_from AS dateFrom, p.date_to AS dateTo, b.name AS budgetName FROM budget_lines l JOIN budget_periods p ON p.id = l.period_id JOIN budgets b ON b.id = p.budget_id WHERE b.household_id = ? ORDER BY l.id",
      )
      .all(householdId) as Array<Record<string, unknown> & { id: string }>)
      add("budget", row.id, row);
    for (const row of database.sqlite
      .prepare(
        "SELECT id, target_amount_minor AS targetAmountMinor, target_date AS targetDate, status, priority_tier AS priorityTier, constraint_level AS constraintLevel, CAST(MAX(1, (julianday(target_date) - julianday('now')) / 30.4375) AS INTEGER) AS monthsToTarget FROM financial_goals WHERE household_id = ? ORDER BY id",
      )
      .all(householdId) as Array<Record<string, unknown> & { id: string }>)
      add("goal", row.id, row);
    for (const row of database.sqlite
      .prepare(
        "SELECT t.id, t.minimum_payment_minor AS minimumPaymentMinor, t.effective_from AS effectiveFrom, t.effective_to AS effectiveTo, 'monthly' AS cadence, l.name FROM liability_terms t JOIN liabilities l ON l.id = t.liability_id WHERE l.household_id = ? ORDER BY t.id",
      )
      .all(householdId) as Array<Record<string, unknown> & { id: string }>)
      add("obligation", row.id, row);
    for (const row of database.sqlite
      .prepare(
        "SELECT id, amount_minor AS amountMinor, cadence, effective_from AS effectiveFrom, effective_to AS effectiveTo, name FROM recurring_obligations WHERE household_id = ? ORDER BY id",
      )
      .all(householdId) as Array<Record<string, unknown> & { id: string }>)
      add("obligation", row.id, row);
    for (const row of database.sqlite
      .prepare(
        "SELECT r.id, r.amount_type AS amountType, r.fixed_amount_minor AS fixedAmountMinor, r.percentage_bps AS percentageBps, r.percentage_basis AS percentageBasis, r.cadence, r.priority, r.constraint_level AS constraintLevel, r.minimum_amount_minor AS minimumAmountMinor, r.maximum_amount_minor AS maximumAmountMinor FROM funding_allocation_rules r JOIN funding_buckets b ON b.id = r.bucket_id WHERE b.household_id = ? ORDER BY r.id",
      )
      .all(householdId) as Array<Record<string, unknown> & { id: string }>)
      add("allocation_rule", row.id, row);
    return rows;
  };
  const createVersion = (
    householdId: string,
    label: string,
    source: PlanVersion["source"],
    actor: string,
    parentVersionId: string | null,
    inputs: readonly PlanningInput[],
  ): PlanVersion => {
    const timestamp = now();
    const version: PlanVersion = {
      createdAt: timestamp,
      createdBy: actor,
      householdId,
      id: randomUUID(),
      isActive: true,
      label,
      parentVersionId,
      source,
    };
    database.sqlite
      .prepare(
        "UPDATE plan_versions SET is_active = 0 WHERE household_id = ? AND is_active = 1",
      )
      .run(householdId);
    database.sqlite
      .prepare(
        "INSERT INTO plan_versions (id, household_id, parent_version_id, label, source, is_active, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        version.id,
        householdId,
        parentVersionId,
        label,
        source,
        1,
        timestamp,
        actor,
      );
    persistInputs(version.id, inputs);
    persistProjection(version.id, inputs);
    audit({
      actor,
      afterJson: JSON.stringify(version),
      beforeJson: null,
      entityId: version.id,
      entityType: "plan_version",
      operation: "create",
    });
    return version;
  };
  return {
    activeVersion(householdId) {
      return database.sqlite
        .prepare(
          "SELECT id, household_id AS householdId, parent_version_id AS parentVersionId, label, source, is_active AS isActive, created_at AS createdAt, created_by AS createdBy FROM plan_versions WHERE household_id = ? AND is_active = 1",
        )
        .get(householdId) as PlanVersion | undefined;
    },
    ensureActiveVersion(householdId, input = {}) {
      return (
        this.activeVersion(householdId) ??
        database.transaction(() =>
          createVersion(
            householdId,
            input.label ?? "Initial active plan",
            "initial",
            input.actor ?? "user",
            null,
            liveInputs(householdId),
          ),
        )
      );
    },
    createScenario(householdId, input, actor = "user") {
      const base =
        input.baseVersionId === undefined
          ? this.ensureActiveVersion(householdId, { actor })
          : versionById(input.baseVersionId);
      if (base === undefined || base.householdId !== householdId)
        throw new Error(
          "Scenario base version was not found for this household.",
        );
      const scenario: PlanningScenario = {
        appliedPlanVersionId: null,
        basePlanVersionId: base.id,
        createdAt: now(),
        createdBy: actor,
        householdId,
        id: randomUUID(),
        name: input.name,
        status: "draft",
      };
      database.sqlite
        .prepare(
          "INSERT INTO planning_scenarios (id, household_id, base_plan_version_id, name, status, created_at, created_by, applied_plan_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          scenario.id,
          householdId,
          base.id,
          scenario.name,
          scenario.status,
          scenario.createdAt,
          actor,
          null,
        );
      audit({
        actor,
        afterJson: JSON.stringify(scenario),
        beforeJson: null,
        entityId: scenario.id,
        entityType: "planning_scenario",
        operation: "create",
      });
      return scenario;
    },
    getScenario: scenarioById,
    inputsForVersion,
    overridesForScenario,
    setOverride(scenarioId, input, actor = "user") {
      if (!isInputType(input.inputType))
        throw new Error("Unsupported scenario input type.");
      const scenario = scenarioById(scenarioId);
      if (scenario === undefined || scenario.status !== "draft")
        throw new Error("Only draft scenarios can be changed.");
      const base = inputsForVersion(scenario.basePlanVersionId).find(
        (item) =>
          item.inputType === input.inputType && item.inputId === input.inputId,
      );
      if (base === undefined)
        throw new Error(
          "Scenario overrides must target an input in the base plan.",
        );
      if (
        Object.keys(input.patch).length === 0 ||
        Object.keys(input.patch).some((key) => !(key in base.value))
      ) {
        throw new Error(
          "Scenario overrides may change only typed fields on the base input.",
        );
      }
      const override: ScenarioOverride = { ...input, scenarioId };
      database.sqlite
        .prepare(
          "INSERT INTO planning_scenario_overrides (id, scenario_id, input_type, input_id, patch_json) VALUES (?, ?, ?, ?, ?) ON CONFLICT(scenario_id, input_type, input_id) DO UPDATE SET patch_json = excluded.patch_json",
        )
        .run(
          randomUUID(),
          scenarioId,
          input.inputType,
          input.inputId,
          JSON.stringify(input.patch),
        );
      audit({
        actor,
        afterJson: JSON.stringify(override),
        beforeJson: null,
        entityId: `${scenarioId}:${input.inputType}:${input.inputId}`,
        entityType: "planning_scenario_override",
        operation: "upsert",
      });
      return override;
    },
    compare(scenarioId) {
      const scenario = scenarioById(scenarioId);
      if (scenario === undefined) throw new Error("Scenario was not found.");
      const base = inputsForVersion(scenario.basePlanVersionId);
      const after = scenarioInputs(scenario);
      const changedInputs = after.flatMap((item) => {
        const before = base.find(
          (candidate) =>
            candidate.inputType === item.inputType &&
            candidate.inputId === item.inputId,
        );
        const fields =
          before === undefined ? [] : changedFields(before.value, item.value);
        return fields.length === 0 || before === undefined
          ? []
          : [
              {
                after: item.value,
                before: before.value,
                changedFields: fields,
                inputId: item.inputId,
                inputType: item.inputType,
              },
            ];
      });
      const beforeProjection = projection(base);
      const afterProjection = projection(after);
      return {
        basePlanVersionId: scenario.basePlanVersionId,
        changedInputs,
        downstreamMonthlyEffect: {
          allocationMinor:
            afterProjection.allocationMinor - beforeProjection.allocationMinor,
          budgetMinor:
            afterProjection.budgetMinor - beforeProjection.budgetMinor,
          incomeMinor:
            afterProjection.incomeMinor - beforeProjection.incomeMinor,
          netMinor: afterProjection.netMinor - beforeProjection.netMinor,
          obligationMinor:
            afterProjection.obligationMinor - beforeProjection.obligationMinor,
        },
        scenarioId,
      };
    },
    projectVersion(versionId) {
      return projection(inputsForVersion(versionId));
    },
    projectScenario(scenarioId) {
      const scenario = scenarioById(scenarioId);
      if (scenario === undefined) throw new Error("Scenario was not found.");
      return projection(scenarioInputs(scenario));
    },
    applyScenario(scenarioId, expectedBaseVersionId, input = {}) {
      return database.transaction(() => {
        const scenario = scenarioById(scenarioId);
        if (scenario === undefined || scenario.status !== "draft")
          throw new Error("Only a draft scenario can be applied.");
        if (scenario.basePlanVersionId !== expectedBaseVersionId)
          throw new Error(
            "Scenario base version does not match the expected version.",
          );
        const active = this.activeVersion(scenario.householdId);
        if (active?.id !== expectedBaseVersionId)
          throw new Error(
            "Scenario is stale: the active plan version has changed.",
          );
        const version = createVersion(
          scenario.householdId,
          input.label ?? scenario.name,
          "scenario_apply",
          input.actor ?? "user",
          active.id,
          scenarioInputs(scenario),
        );
        database.sqlite
          .prepare(
            "UPDATE planning_scenarios SET status = 'applied', applied_plan_version_id = ? WHERE id = ?",
          )
          .run(version.id, scenario.id);
        audit({
          actor: input.actor ?? "user",
          afterJson: JSON.stringify({ scenarioId, versionId: version.id }),
          beforeJson: null,
          entityId: scenarioId,
          entityType: "planning_scenario",
          operation: "apply",
        });
        return version;
      });
    },
    rollbackToVersion(
      householdId,
      targetVersionId,
      expectedActiveVersionId,
      input = {},
    ) {
      return database.transaction(() => {
        const target = versionById(targetVersionId);
        const active = this.activeVersion(householdId);
        if (target === undefined || target.householdId !== householdId)
          throw new Error("Rollback target was not found for this household.");
        if (active?.id !== expectedActiveVersionId)
          throw new Error(
            "Active plan version has changed; rollback was rejected.",
          );
        return createVersion(
          householdId,
          input.label ?? `Rollback to ${target.label}`,
          "rollback",
          input.actor ?? "user",
          active.id,
          inputsForVersion(target.id),
        );
      });
    },
    deleteScenario(scenarioId, actor = "user") {
      const scenario = scenarioById(scenarioId);
      if (scenario === undefined) return false;
      database.sqlite
        .prepare("DELETE FROM planning_scenarios WHERE id = ?")
        .run(scenarioId);
      audit({
        actor,
        afterJson: null,
        beforeJson: JSON.stringify(scenario),
        entityId: scenarioId,
        entityType: "planning_scenario",
        operation: "delete",
      });
      return true;
    },
  };
}
