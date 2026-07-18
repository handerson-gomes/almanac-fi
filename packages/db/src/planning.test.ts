import { describe, expect, test } from "vitest";

import { createDatabase } from "./index.js";
import { createUnitOfWork } from "./repositories.js";

describe("active plan versions and scenarios", () => {
  test("isolates typed overrides, rejects stale applies, and rolls back by creating a version", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const household = unitOfWork.households.create({
      currency: "USD",
      name: "Plan household",
    });
    const goal = unitOfWork.goals.create({
      accountId: null,
      constraintLevel: "soft",
      currency: "USD",
      dependentId: null,
      fundingStrategy: "cash",
      householdId: household.id,
      name: "Home",
      priorityTier: "important",
      status: "active",
      targetAmountMinor: 120_000,
      targetDate: "2027-07-01",
    });
    const active = unitOfWork.planning.ensureActiveVersion(household.id);
    const scenario = unitOfWork.planning.createScenario(household.id, {
      name: "Faster home",
    });
    unitOfWork.planning.setOverride(scenario.id, {
      inputId: goal.id,
      inputType: "goal",
      patch: { targetAmountMinor: 240_000 },
    });
    expect(() =>
      unitOfWork.planning.setOverride(scenario.id, {
        inputId: goal.id,
        inputType: "goal",
        patch: { unsupportedValue: 1 },
      }),
    ).toThrow(/typed fields/);

    expect(unitOfWork.goals.list(household.id)[0]?.targetAmountMinor).toBe(
      120_000,
    );
    expect(unitOfWork.planning.compare(scenario.id)).toMatchObject({
      changedInputs: [
        expect.objectContaining({ changedFields: ["targetAmountMinor"] }),
      ],
      downstreamMonthlyEffect: expect.objectContaining({
        budgetMinor: expect.any(Number),
      }),
    });

    const applied = unitOfWork.planning.applyScenario(scenario.id, active.id);
    expect(applied).toMatchObject({
      isActive: true,
      parentVersionId: active.id,
      source: "scenario_apply",
    });
    expect(unitOfWork.planning.activeVersion(household.id)?.id).toBe(
      applied.id,
    );
    expect(() =>
      unitOfWork.planning.applyScenario(scenario.id, active.id),
    ).toThrow(/draft/);

    const stale = unitOfWork.planning.createScenario(household.id, {
      baseVersionId: active.id,
      name: "Stale scenario",
    });
    expect(() =>
      unitOfWork.planning.applyScenario(stale.id, active.id),
    ).toThrow(/stale/);

    const rollback = unitOfWork.planning.rollbackToVersion(
      household.id,
      active.id,
      applied.id,
    );
    expect(rollback).toMatchObject({
      isActive: true,
      parentVersionId: applied.id,
      source: "rollback",
    });
    expect(
      unitOfWork.planning
        .inputsForVersion(rollback.id)
        .map(({ inputId, inputType, value }) => ({
          inputId,
          inputType,
          value,
        })),
    ).toEqual(
      unitOfWork.planning
        .inputsForVersion(active.id)
        .map(({ inputId, inputType, value }) => ({
          inputId,
          inputType,
          value,
        })),
    );

    const disposable = unitOfWork.planning.createScenario(household.id, {
      name: "Disposable",
    });
    unitOfWork.planning.setOverride(disposable.id, {
      inputId: goal.id,
      inputType: "goal",
      patch: { targetAmountMinor: 10 },
    });
    expect(unitOfWork.planning.deleteScenario(disposable.id)).toBe(true);
    expect(unitOfWork.planning.getScenario(disposable.id)).toBeUndefined();
    expect(unitOfWork.planning.activeVersion(household.id)?.id).toBe(
      rollback.id,
    );
    expect(
      database.sqlite
        .prepare("SELECT COUNT(*) AS count FROM plan_forecast_versions")
        .get(),
    ).toMatchObject({ count: 3 });
    expect(
      database.sqlite
        .prepare("SELECT COUNT(*) AS count FROM plan_ledger_versions")
        .get(),
    ).toMatchObject({ count: 3 });
    database.close();
  });
});
