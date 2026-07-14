import { describe, expect, test } from "vitest";

import { createDatabase, migrationIds } from "./index.js";
import { createUnitOfWork, inUnitOfWork } from "./repositories.js";

describe("SQLite foundation", () => {
  test("migrates a fresh isolated database", () => {
    const database = createDatabase();
    database.migrate();
    expect(
      database.sqlite.prepare("SELECT id FROM _migrations").all(),
    ).toHaveLength(migrationIds().length);
    database.close();
  });

  test("persists provenance and keeps audit events append-only", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const batch = unitOfWork.importBatches.create({
      actor: "user",
      checksum: "batch",
      source: "csv",
    });
    const source = unitOfWork.sourceRecords.create({
      batchId: batch.id,
      checksum: "record",
      rawPayload: "{}",
      sourceType: "csv-row",
    });
    const audit = unitOfWork.auditEvents.append({
      actor: "user",
      afterJson: "{}",
      beforeJson: null,
      entityId: "normalized-1",
      entityType: "transaction",
      operation: "create",
      sourceRecordId: source.id,
    });

    expect(unitOfWork.importBatches.findByChecksum("batch")?.id).toBe(batch.id);
    expect(() =>
      database.sqlite
        .prepare("DELETE FROM audit_events WHERE id = ?")
        .run(audit.id),
    ).toThrow(/append-only/);
    database.close();
  });

  test("rolls related writes back atomically", () => {
    const database = createDatabase();
    database.migrate();
    expect(() =>
      inUnitOfWork(database, (unitOfWork) => {
        unitOfWork.importBatches.create({
          actor: "user",
          checksum: "rollback",
          source: "csv",
        });
        throw new Error("abort");
      }),
    ).toThrow("abort");
    expect(
      createUnitOfWork(database).importBatches.findByChecksum("rollback"),
    ).toBeUndefined();
    database.close();
  });

  test("stores stable accounts, non-secret connection metadata, and balance history", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const connection = unitOfWork.institutionConnections.create({
      externalId: "simplefin-1",
      institutionName: "Example Credit Union",
      institutionUrl: "https://example.test",
      provider: "simplefin",
      secretKey: "simplefin-example",
      status: "connected",
    });
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      connectionId: connection.id,
      currency: "USD",
      externalId: "account-1",
      name: "Household checking",
      status: "active",
    });
    const firstBalance = unitOfWork.accounts.addBalance({
      accountId: account.id,
      amountMinor: 100_00,
      asOf: "2026-07-01T00:00:00.000Z",
      availableAmountMinor: 90_00,
    });
    const secondBalance = unitOfWork.accounts.addBalance({
      accountId: account.id,
      amountMinor: 110_00,
      asOf: "2026-07-02T00:00:00.000Z",
      availableAmountMinor: null,
    });

    expect(unitOfWork.accounts.findById(account.id)).toMatchObject({
      id: account.id,
      connectionId: connection.id,
      currency: "USD",
    });
    expect(unitOfWork.accounts.listBalances(account.id).items).toEqual(
      expect.arrayContaining([firstBalance, secondBalance]),
    );
    expect(
      database.sqlite
        .prepare(
          "SELECT sql FROM sqlite_master WHERE name = 'institution_connections'",
        )
        .get(),
    ).not.toMatchObject({ sql: expect.stringContaining("access_url") });

    unitOfWork.institutionConnections.delete(connection.id);
    expect(unitOfWork.accounts.findById(account.id)?.connectionId).toBeNull();
    database.close();
  });

  test("enforces category trees and transaction split reconciliation", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      connectionId: null,
      currency: "USD",
      externalId: null,
      name: "Transaction account",
      status: "active",
    });
    const parent = unitOfWork.categories.create({
      name: "Food",
      parentId: null,
      status: "active",
    });
    const child = unitOfWork.categories.create({
      name: "Coffee",
      parentId: parent.id,
      status: "active",
    });
    expect(() =>
      unitOfWork.categories.update(parent.id, { parentId: child.id }),
    ).toThrow(/cycle/);
    const batch = unitOfWork.importBatches.create({
      actor: "user",
      checksum: "transaction-batch",
      source: "csv",
    });
    const source = unitOfWork.sourceRecords.create({
      batchId: batch.id,
      checksum: "transaction-source",
      rawPayload: "{}",
      sourceType: "csv-row",
    });
    const input = {
      accountId: account.id,
      amountMinor: -450,
      categoryId: parent.id,
      currency: "USD",
      merchant: "Coffee Shop",
      payee: null,
      postedAt: null,
      sourceCategory: null,
      sourceIdentity: "csv:coffee",
      sourceRecordId: source.id,
      status: "posted" as const,
      transactionDate: "2026-07-13T00:00:00.000Z",
    };
    const transaction = unitOfWork.transactions.create(input, [
      { amountMinor: -300, categoryId: parent.id, memo: "Coffee" },
      { amountMinor: -150, categoryId: child.id, memo: "Tip" },
    ]);
    expect(transaction.splits).toHaveLength(2);
    expect(() =>
      unitOfWork.transactions.create(
        { ...input, sourceIdentity: "csv:invalid" },
        [{ amountMinor: -449, categoryId: parent.id, memo: null }],
      ),
    ).toThrow(/split totals/);
    database.close();
  });

  test("paginates transactions in descending transaction-date order", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      connectionId: null,
      currency: "USD",
      externalId: null,
      name: "Pagination account",
      status: "active",
    });
    const batch = unitOfWork.importBatches.create({
      actor: "user",
      checksum: "pagination-batch",
      source: "csv",
    });
    const dates = [
      "2026-07-13T00:00:00.000Z",
      "2026-07-12T00:00:00.000Z",
      "2026-07-12T00:00:00.000Z",
      "2026-07-11T00:00:00.000Z",
    ];
    const created = dates.map((transactionDate, index) => {
      const source = unitOfWork.sourceRecords.create({
        batchId: batch.id,
        checksum: `pagination-source-${index}`,
        rawPayload: "{}",
        sourceType: "csv-row",
      });
      return unitOfWork.transactions.create({
        accountId: account.id,
        amountMinor: -(index + 1) * 100,
        categoryId: null,
        currency: "USD",
        merchant: `Transaction ${index}`,
        payee: null,
        postedAt: null,
        sourceCategory: null,
        sourceIdentity: `csv:pagination-${index}`,
        sourceRecordId: source.id,
        status: "posted",
        transactionDate,
      }).transaction;
    });

    const firstPage = unitOfWork.transactions.list({}, { limit: 2 });
    const secondPage = unitOfWork.transactions.list(
      {},
      { cursor: firstPage.nextCursor, limit: 2 },
    );

    expect(firstPage.nextCursor).toContain("|");
    expect(secondPage.nextCursor).toBeUndefined();
    expect(
      [...firstPage.items, ...secondPage.items].map((item) => item.id),
    ).toEqual(expect.arrayContaining(created.map((item) => item.id)));
    expect(
      [...firstPage.items, ...secondPage.items].map(
        (item) => item.transactionDate,
      ),
    ).toEqual([...dates]);
    database.close();
  });
});
