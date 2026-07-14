import { createHash } from "node:crypto";

import type { AppDatabase } from "@almanac-fi/db";
import { inUnitOfWork } from "@almanac-fi/db/repositories";

export type SyntheticRecord = Readonly<{
  id: string;
  kind: string;
  value: Readonly<Record<string, unknown>>;
}>;
export type SyntheticHousehold = Readonly<{
  description: string;
  id: string;
  records: readonly SyntheticRecord[];
}>;

const fixtures: readonly SyntheticHousehold[] = [
  {
    description:
      "Complete planning household with a deliberately unknown risk-tolerance fact.",
    id: "complete-household",
    records: [
      {
        id: "income-1",
        kind: "income",
        value: { monthlyMinor: 850_000, source: "synthetic-salary" },
      },
      {
        id: "transfer-1",
        kind: "transfer",
        value: { from: "checking", to: "savings", minor: 125_000 },
      },
      {
        id: "budget-1",
        kind: "budget",
        value: { category: "housing", monthlyMinor: 260_000 },
      },
      {
        id: "dependent-1",
        kind: "dependent",
        value: { birthDate: "2018-05-10", label: "Synthetic Dependent" },
      },
      {
        id: "goal-1",
        kind: "goal",
        value: { targetMinor: 1_500_000, type: "emergency-fund" },
      },
      {
        id: "debt-1",
        kind: "debt",
        value: { balanceMinor: 2_400_000, type: "student-loan" },
      },
      {
        id: "investment-1",
        kind: "investment",
        value: { balanceMinor: 5_200_000, symbol: "SYNX" },
      },
      {
        id: "missing-1",
        kind: "missing-data",
        value: { field: "riskTolerance", status: "unknown" },
      },
    ],
  },
  {
    description:
      "Household with missing account balances and an undated savings goal.",
    id: "missing-data",
    records: [
      {
        id: "account-unknown",
        kind: "account",
        value: { balanceMinor: null, label: "Synthetic Cash" },
      },
      {
        id: "goal-unknown",
        kind: "goal",
        value: { targetDate: null, type: "college" },
      },
    ],
  },
  {
    description:
      "Original and corrected import rows for reconciliation and audit tests.",
    id: "import-correction",
    records: [
      {
        id: "import-original",
        kind: "transaction",
        value: { merchant: "Synthetic Market", minor: -12_500, revision: 1 },
      },
      {
        id: "import-corrected",
        kind: "transaction",
        value: {
          merchant: "Synthetic Market",
          minor: -13_000,
          revision: 2,
          replaces: "import-original",
        },
      },
    ],
  },
];

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function listFixtures(): readonly SyntheticHousehold[] {
  return fixtures;
}

export function loadFixture(id: string): SyntheticHousehold {
  const fixture = fixtures.find((candidate) => candidate.id === id);
  if (fixture === undefined)
    throw new Error(`Unknown synthetic fixture: ${id}`);
  return fixture;
}

export function seedFixture(
  database: AppDatabase,
  id: string,
): Readonly<{ batchId: string; sourceRecordIds: readonly string[] }> {
  const fixture = loadFixture(id);
  return inUnitOfWork(database, (unitOfWork) => {
    const batch = unitOfWork.importBatches.create({
      actor: "fixture-loader",
      checksum: checksum(fixture),
      source: `synthetic:${fixture.id}`,
    });
    const sourceRecordIds = fixture.records.map((record) => {
      const source = unitOfWork.sourceRecords.create({
        batchId: batch.id,
        checksum: checksum(record),
        rawPayload: JSON.stringify(record),
        sourceType: record.kind,
      });
      unitOfWork.auditEvents.append({
        actor: "fixture-loader",
        afterJson: JSON.stringify({ sourceRecordId: source.id }),
        beforeJson: null,
        entityId: record.id,
        entityType: record.kind,
        operation: "seed",
        sourceRecordId: source.id,
      });
      return source.id;
    });
    return { batchId: batch.id, sourceRecordIds };
  });
}
