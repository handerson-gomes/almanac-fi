import { randomUUID } from "node:crypto";

import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type Household = Readonly<{
  createdAt: string;
  currency: string;
  id: string;
  name: string;
  updatedAt: string;
}>;
export type Person = Readonly<{
  birthDate: string | null;
  createdAt: string;
  dependent: boolean;
  dependentUntil: string | null;
  householdId: string;
  id: string;
  name: string;
  relationship: string;
  updatedAt: string;
}>;
export type HouseholdFact = Readonly<{
  confidence: number;
  createdAt: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  factKey: string;
  householdId: string;
  id: string;
  personId: string | null;
  sensitivity: "sensitive" | "standard";
  source: string;
  updatedAt: string;
  value: boolean | number | string;
  valueType: "boolean" | "date" | "number" | "string";
  verifiedAt: string | null;
  verifiedBy: string | null;
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

export interface HouseholdRepository {
  create(
    input: Readonly<{ currency: string; name: string }>,
    actor?: string,
  ): Household;
  createFact(
    input: Omit<HouseholdFact, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): HouseholdFact;
  createPerson(
    input: Readonly<{
      birthDate: string | null;
      dependent: boolean;
      dependentUntil: string | null;
      householdId: string;
      name: string;
      relationship: string;
    }>,
    actor?: string,
  ): Person;
  deleteFact(id: string, actor?: string): boolean;
  findById(id: string): Household | undefined;
  list(): readonly Household[];
  listFacts(householdId: string, asOf?: string): readonly HouseholdFact[];
  listPeople(householdId: string): readonly Person[];
  update(
    id: string,
    input: Readonly<{
      currency?: string | undefined;
      name?: string | undefined;
    }>,
    actor?: string,
  ): Household | undefined;
}

export function createHouseholdRepository(
  database: AppDatabase,
  audit: Auditor,
): HouseholdRepository {
  const householdById = (id: string): Household | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, name, currency, created_at AS createdAt, updated_at AS updatedAt FROM households WHERE id = ?",
      )
      .get(id) as Household | undefined;
  const factById = (
    id: string,
  ): (Omit<HouseholdFact, "value"> & { valueJson: string }) | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, household_id AS householdId, person_id AS personId, fact_key AS factKey, value_type AS valueType, value_json AS valueJson, effective_from AS effectiveFrom, effective_to AS effectiveTo, source, confidence, sensitivity, verified_at AS verifiedAt, verified_by AS verifiedBy, created_at AS createdAt, updated_at AS updatedAt FROM household_facts WHERE id = ?",
      )
      .get(id) as
      (Omit<HouseholdFact, "value"> & { valueJson: string }) | undefined;
  const decodeFact = (
    row: Omit<HouseholdFact, "value"> & { valueJson: string },
  ): HouseholdFact => {
    const { valueJson, ...rest } = row;
    return { ...rest, value: JSON.parse(valueJson) as HouseholdFact["value"] };
  };
  return {
    create(input, actor = "user") {
      const timestamp = now();
      const record = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO households (id, name, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(record.id, record.name, record.currency, timestamp, timestamp);
      audit({
        actor,
        afterJson: JSON.stringify(record),
        beforeJson: null,
        entityId: record.id,
        entityType: "household",
        operation: "create",
      });
      return record;
    },
    createFact(input, actor = "user") {
      const overlap = database.sqlite
        .prepare(
          `SELECT id FROM household_facts WHERE household_id = ? AND person_id IS ? AND fact_key = ?
         AND effective_from < COALESCE(?, '9999-12-31') AND COALESCE(effective_to, '9999-12-31') > ? LIMIT 1`,
        )
        .get(
          input.householdId,
          input.personId,
          input.factKey,
          input.effectiveTo,
          input.effectiveFrom,
        );
      if (overlap)
        throw new Error(
          "Fact effective dates cannot overlap for the same subject and key.",
        );
      const timestamp = now();
      const record: HouseholdFact = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO household_facts (id, household_id, person_id, fact_key, value_type, value_json, effective_from, effective_to, source, confidence, sensitivity, verified_at, verified_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.householdId,
          record.personId,
          record.factKey,
          record.valueType,
          JSON.stringify(record.value),
          record.effectiveFrom,
          record.effectiveTo,
          record.source,
          record.confidence,
          record.sensitivity,
          record.verifiedAt,
          record.verifiedBy,
          timestamp,
          timestamp,
        );
      audit({
        actor,
        afterJson: JSON.stringify(record),
        beforeJson: null,
        entityId: record.id,
        entityType: "household_fact",
        operation: "create",
      });
      return record;
    },
    createPerson(input, actor = "user") {
      const timestamp = now();
      const id = randomUUID();
      database.sqlite
        .prepare(
          "INSERT INTO people (id, household_id, name, birth_date, relationship, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          input.householdId,
          input.name,
          input.birthDate,
          input.relationship,
          timestamp,
          timestamp,
        );
      if (input.dependent)
        database.sqlite
          .prepare(
            "INSERT INTO dependents (id, person_id, dependent_until, notes, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)",
          )
          .run(randomUUID(), id, input.dependentUntil, timestamp, timestamp);
      const record: Person = {
        ...input,
        createdAt: timestamp,
        id,
        updatedAt: timestamp,
      };
      audit({
        actor,
        afterJson: JSON.stringify(record),
        beforeJson: null,
        entityId: id,
        entityType: "person",
        operation: "create",
      });
      return record;
    },
    deleteFact(id, actor = "user") {
      const current = factById(id);
      if (!current) return false;
      database.sqlite
        .prepare("DELETE FROM household_facts WHERE id = ?")
        .run(id);
      audit({
        actor,
        afterJson: null,
        beforeJson: JSON.stringify(decodeFact(current)),
        entityId: id,
        entityType: "household_fact",
        operation: "delete",
      });
      return true;
    },
    findById: householdById,
    list() {
      return database.sqlite
        .prepare(
          "SELECT id, name, currency, created_at AS createdAt, updated_at AS updatedAt FROM households ORDER BY name, id",
        )
        .all() as Household[];
    },
    listFacts(householdId, asOf) {
      const rows = database.sqlite
        .prepare(
          `SELECT id, household_id AS householdId, person_id AS personId, fact_key AS factKey, value_type AS valueType, value_json AS valueJson, effective_from AS effectiveFrom, effective_to AS effectiveTo, source, confidence, sensitivity, verified_at AS verifiedAt, verified_by AS verifiedBy, created_at AS createdAt, updated_at AS updatedAt FROM household_facts
         WHERE household_id = ? ${asOf === undefined ? "" : "AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)"} ORDER BY effective_from DESC, fact_key`,
        )
        .all(
          ...(asOf === undefined ? [householdId] : [householdId, asOf, asOf]),
        ) as Array<Omit<HouseholdFact, "value"> & { valueJson: string }>;
      return rows.map(decodeFact);
    },
    listPeople(householdId) {
      return (
        database.sqlite
          .prepare(
            "SELECT p.id, p.household_id AS householdId, p.name, p.birth_date AS birthDate, p.relationship, p.created_at AS createdAt, p.updated_at AS updatedAt, CASE WHEN d.id IS NULL THEN 0 ELSE 1 END AS dependent, d.dependent_until AS dependentUntil FROM people p LEFT JOIN dependents d ON d.person_id = p.id WHERE p.household_id = ? ORDER BY p.name, p.id",
          )
          .all(householdId) as Array<
          Omit<Person, "dependent"> & { dependent: number }
        >
      ).map((person) => ({ ...person, dependent: Boolean(person.dependent) }));
    },
    update(id, input, actor = "user") {
      const current = householdById(id);
      if (!current) return undefined;
      const updated: Household = {
        ...current,
        currency: input.currency ?? current.currency,
        name: input.name ?? current.name,
        updatedAt: now(),
      };
      database.sqlite
        .prepare(
          "UPDATE households SET name = ?, currency = ?, updated_at = ? WHERE id = ?",
        )
        .run(updated.name, updated.currency, updated.updatedAt, id);
      audit({
        actor,
        afterJson: JSON.stringify(updated),
        beforeJson: JSON.stringify(current),
        entityId: id,
        entityType: "household",
        operation: "update",
      });
      return updated;
    },
  };
}
