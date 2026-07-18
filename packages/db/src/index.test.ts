import { describe, expect, test } from "vitest";

import { createDatabase, migrationIds } from "./index.js";
import { createUnitOfWork, inUnitOfWork } from "./repositories.js";

function createTestInstitution(
  unitOfWork: ReturnType<typeof createUnitOfWork>,
  name = "Example Bank",
) {
  return unitOfWork.institutions.create({
    domain: `${name.toLocaleLowerCase().replaceAll(" ", "-")}.test`,
    name,
    websiteUrl: null,
  });
}

describe("SQLite foundation", () => {
  test("migrates a fresh isolated database", () => {
    const database = createDatabase();
    database.migrate();
    expect(
      database.sqlite.prepare("SELECT id FROM _migrations").all(),
    ).toHaveLength(migrationIds().length);
    database.close();
  });

  test("requires an explicit reset for the legacy account schema", () => {
    const database = createDatabase();
    database.sqlite.exec(`
      CREATE TABLE _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO _migrations VALUES ('0002_accounts_and_institution_connections', '2026-07-15T00:00:00.000Z');
      CREATE TABLE institution_connections (id TEXT PRIMARY KEY);
    `);
    expect(() => database.migrate()).toThrow(/required 016a database reset/);
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
    const institution = createTestInstitution(
      unitOfWork,
      "Example Credit Union",
    );
    const providerConnection = unitOfWork.providerConnections.create({
      provider: "simplefin",
      providerNamespace: "https://bridge.simplefin.org",
      secretKey: "simplefin-example",
      status: "connected",
    });
    const externalConnection = unitOfWork.externalInstitutionConnections.upsert(
      {
        institutionId: institution.id,
        providerConnectionId: providerConnection.id,
        remoteConnectionId: "connection-1",
        remoteName: "Example Credit Union login",
        remoteOrganizationId: "organization-1",
        remoteOrganizationUrl: "https://example-credit-union.test",
        status: "connected",
      },
    );
    const secondInstitution = createTestInstitution(unitOfWork, "Second Bank");
    const secondExternalConnection =
      unitOfWork.externalInstitutionConnections.upsert({
        institutionId: secondInstitution.id,
        providerConnectionId: providerConnection.id,
        remoteConnectionId: "connection-2",
        remoteName: "Second Bank login",
        remoteOrganizationId: "organization-2",
        remoteOrganizationUrl: "https://second-bank.test",
        status: "connected",
      });
    unitOfWork.externalInstitutionConnections.upsert({
      institutionId: institution.id,
      providerConnectionId: providerConnection.id,
      remoteConnectionId: "connection-3",
      remoteName: "Example Credit Union second login",
      remoteOrganizationId: "organization-1",
      remoteOrganizationUrl: "https://example-credit-union.test",
      status: "connected",
    });
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      currency: "USD",
      externalConnectionId: externalConnection.id,
      externalId: "account-1",
      institutionId: institution.id,
      name: "Household checking",
      status: "active",
    });
    expect(() =>
      unitOfWork.accounts.create({
        accountType: "checking",
        currency: "USD",
        externalConnectionId: secondExternalConnection.id,
        externalId: "invalid-account",
        institutionId: institution.id,
        name: "Invalid ownership",
        status: "active",
      }),
    ).toThrow(/another institution/);
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
      externalConnectionId: externalConnection.id,
      institutionId: institution.id,
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
    ).toBeUndefined();

    unitOfWork.providerConnections.revoke(providerConnection.id);
    expect(unitOfWork.accounts.findById(account.id)?.institutionId).toBe(
      institution.id,
    );
    expect(
      unitOfWork.providerConnections.findById(providerConnection.id),
    ).toMatchObject({ secretKey: null, status: "disconnected" });
    expect(unitOfWork.externalInstitutionConnections.list().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          institutionId: institution.id,
          status: "disconnected",
        }),
        expect.objectContaining({
          institutionId: secondInstitution.id,
          status: "disconnected",
        }),
      ]),
    );
    expect(unitOfWork.institutions.delete(secondInstitution.id)).toBe(
      "deleted",
    );
    database.close();
  });

  test("reconciles provider accounts by scoped organization identity and domain", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const institution = unitOfWork.institutions.create({
      domain: "pnc.com",
      name: "PNC",
      websiteUrl: "https://www.pnc.com",
    });
    const provider = unitOfWork.providerConnections.create({
      provider: "simplefin",
      providerNamespace: "https://bridge.simplefin.org",
      secretKey: "simplefin-primary",
      status: "connected",
    });
    const incoming = {
      accountName: "Retirement plan",
      currency: "USD",
      providerConnectionId: provider.id,
      remoteAccountId: "account-401k",
      remoteConnectionId: "login-1",
      remoteConnectionName: "PNC login",
      remoteOrganizationId: "pnc-org",
      remoteOrganizationUrl: "https://www.pnc.com",
    } as const;

    const first = unitOfWork.accountImportReviews.reconcile(incoming);
    expect(first.accountId).not.toBeNull();
    expect(first.review).toMatchObject({
      accountType: "unclassified",
      candidateInstitutionIds: [institution.id],
      status: "pending",
    });
    const resolved = unitOfWork.accountImportReviews.resolve(
      first.review?.id ?? "",
      { accountType: "traditional_401k", institutionId: institution.id },
    );
    expect(resolved).toMatchObject({
      accountType: "traditional_401k",
      status: "resolved",
    });
    const account = unitOfWork.accounts.findById(first.accountId ?? "");
    expect(account).toMatchObject({
      accountType: "traditional_401k",
      institutionId: institution.id,
    });

    const repeated = unitOfWork.accountImportReviews.reconcile(incoming);
    expect(repeated.accountId).toBe(first.accountId);
    expect(repeated.review).toBeNull();
    expect(unitOfWork.externalInstitutionConnections.list().items).toHaveLength(
      1,
    );
    expect(unitOfWork.institutions.delete(institution.id)).toBe("has_accounts");
    database.close();
  });

  test("does not silently merge conflicting institution matches", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const first = createTestInstitution(unitOfWork, "First Bank");
    const second = createTestInstitution(unitOfWork, "Second Bank");
    const provider = unitOfWork.providerConnections.create({
      provider: "simplefin",
      providerNamespace: "https://bridge.simplefin.org",
      secretKey: null,
      status: "connected",
    });
    unitOfWork.externalInstitutionConnections.upsert({
      institutionId: first.id,
      providerConnectionId: provider.id,
      remoteConnectionId: "first-login",
      remoteName: "First login",
      remoteOrganizationId: "shared-org-id",
      remoteOrganizationUrl: "https://first-bank.test",
      status: "connected",
    });

    const result = unitOfWork.accountImportReviews.reconcile({
      accountName: "Ambiguous account",
      accountType: "checking",
      currency: "USD",
      providerConnectionId: provider.id,
      remoteAccountId: "ambiguous-account",
      remoteConnectionId: "second-login",
      remoteConnectionName: "Conflicting login",
      remoteOrganizationId: "shared-org-id",
      remoteOrganizationUrl: second.domain,
    });

    expect(result.accountId).toBeNull();
    expect(result.review?.candidateInstitutionIds).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );
    database.close();
  });

  test("enforces category trees and transaction split reconciliation", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const institution = createTestInstitution(unitOfWork);
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
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
    const institution = createTestInstitution(unitOfWork);
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
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

  test("persists reversible and audited transfer decisions", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const institution = createTestInstitution(unitOfWork);
    const accounts = ["Checking", "Savings"].map((name) =>
      unitOfWork.accounts.create({
        accountType: "checking",
        currency: "USD",
        externalConnectionId: null,
        externalId: null,
        institutionId: institution.id,
        name,
        status: "active",
      }),
    );
    const batch = unitOfWork.importBatches.create({
      actor: "user",
      checksum: "transfer-batch",
      source: "manual",
    });
    [-25_000, 25_000].forEach((amountMinor, index) => {
      const source = unitOfWork.sourceRecords.create({
        batchId: batch.id,
        checksum: `transfer-source-${index}`,
        rawPayload: "{}",
        sourceType: "manual",
      });
      unitOfWork.transactions.create({
        accountId: accounts[index]?.id ?? "",
        amountMinor,
        categoryId: null,
        currency: "USD",
        merchant: "Online transfer",
        payee: null,
        postedAt: null,
        sourceCategory: null,
        sourceIdentity: `manual:transfer-${index}`,
        sourceRecordId: source.id,
        status: "posted",
        transactionDate: `2026-07-${10 + index}T00:00:00.000Z`,
      });
    });

    const candidate = unitOfWork.transferMatches.refreshCandidates()[0];
    expect(candidate).toMatchObject({ reason: "exact", status: "candidate" });
    const confirmed = unitOfWork.transferMatches.decide(
      candidate?.id ?? "",
      "confirm",
      "user",
    );
    expect(confirmed?.status).toBe("confirmed");
    expect(unitOfWork.transferMatches.confirmedTransactionIds()).toEqual(
      new Set([
        confirmed?.outboundTransactionId,
        confirmed?.inboundTransactionId,
      ]),
    );
    expect(
      unitOfWork.auditEvents
        .list()
        .items.some(
          (event) =>
            event.entityId === confirmed?.id && event.operation === "confirm",
        ),
    ).toBe(true);
    expect(
      unitOfWork.transferMatches.decide(confirmed?.id ?? "", "unmatch", "user")
        ?.status,
    ).toBe("candidate");
    database.close();
  });

  test("queues explainable categorization suggestions and confirms them in batches", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const institution = createTestInstitution(unitOfWork);
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
      name: "Review",
      status: "active",
    });
    const category = unitOfWork.categories.create({
      name: "Coffee",
      parentId: null,
      status: "active",
    });
    const batch = unitOfWork.importBatches.create({
      actor: "user",
      checksum: "review-batch",
      source: "manual",
    });
    const source = unitOfWork.sourceRecords.create({
      batchId: batch.id,
      checksum: "review-source",
      rawPayload: "{}",
      sourceType: "manual",
    });
    const transaction = unitOfWork.transactions.create({
      accountId: account.id,
      amountMinor: -500,
      categoryId: null,
      currency: "USD",
      merchant: "POS Cafe #12345",
      payee: null,
      postedAt: null,
      sourceCategory: null,
      sourceIdentity: "review:1",
      sourceRecordId: source.id,
      status: "posted",
      transactionDate: "2026-07-13T00:00:00.000Z",
    }).transaction;

    const withoutAi = unitOfWork.categorizationReviews.suggest({
      aiCategoryId: category.id,
      transactionId: transaction.id,
    });
    expect(withoutAi).toMatchObject({ method: null, status: "pending" });
    const withAi = unitOfWork.categorizationReviews.suggest({
      aiCategoryId: category.id,
      enableAi: true,
      transactionId: transaction.id,
    });
    expect(withAi).toMatchObject({
      method: "ai",
      suggestedCategoryId: category.id,
    });
    const confirmed = unitOfWork.categorizationReviews.applyBatch({
      actor: "user",
      createMerchantRule: true,
      decision: "confirm",
      ids: [withAi?.id ?? ""],
    });
    expect(confirmed[0]).toMatchObject({
      confirmedCategoryId: category.id,
      status: "confirmed",
    });
    expect(unitOfWork.transactions.findById(transaction.id)?.categoryId).toBe(
      category.id,
    );
    expect(
      unitOfWork.categorizationRules.evaluate({
        merchant: "cafe",
        payee: null,
        sourceCategory: null,
      }),
    ).toMatchObject({ categoryId: category.id });
    database.close();
  });

  test("groups recurring income and preserves user confirmation", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const institution = createTestInstitution(unitOfWork);
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
      name: "Income",
      status: "active",
    });
    const salary = unitOfWork.categories.create({
      name: "Salary",
      parentId: null,
      status: "active",
    });
    const batch = unitOfWork.importBatches.create({
      actor: "user",
      checksum: "income-batch",
      source: "manual",
    });
    for (let index = 0; index < 2; index += 1) {
      const source = unitOfWork.sourceRecords.create({
        batchId: batch.id,
        checksum: `income-${index}`,
        rawPayload: "{}",
        sourceType: "manual",
      });
      unitOfWork.transactions.create({
        accountId: account.id,
        amountMinor: 200_000,
        categoryId: salary.id,
        currency: "USD",
        merchant: null,
        payee: "Example Employer",
        postedAt: null,
        sourceCategory: null,
        sourceIdentity: `income:${index}`,
        sourceRecordId: source.id,
        status: "posted",
        transactionDate: `2026-0${6 + index}-01T00:00:00.000Z`,
      });
    }
    const records = unitOfWork.incomeClassifications.refresh();
    expect(unitOfWork.incomeClassifications.summary()).toEqual({
      incomeAmountMinor: 400_000,
      recurringGroups: 1,
      reviewCount: 0,
    });
    unitOfWork.incomeClassifications.confirm(
      records[0]?.id ?? "",
      "not_income",
      "user",
    );
    unitOfWork.incomeClassifications.refresh();
    expect(unitOfWork.incomeClassifications.list()[0]).toMatchObject({
      kind: "not_income",
      method: "user_confirmation",
      status: "confirmed",
    });
    database.close();
  });

  test("resolves household facts as of a date and rejects overlaps", () => {
    const database = createDatabase();
    database.migrate();
    const households = createUnitOfWork(database).households;
    const household = households.create({
      currency: "USD",
      name: "Example household",
    });
    const person = households.createPerson({
      birthDate: "2015-01-01",
      dependent: true,
      dependentUntil: "2033-01-01",
      householdId: household.id,
      name: "Child",
      relationship: "child",
    });
    const base = {
      confidence: 0.9,
      factKey: "school",
      householdId: household.id,
      personId: person.id,
      sensitivity: "sensitive" as const,
      source: "user",
      value: "Elementary",
      valueType: "string" as const,
      verifiedAt: null,
      verifiedBy: null,
    };
    households.createFact({
      ...base,
      effectiveFrom: "2025-01-01",
      effectiveTo: "2026-01-01",
    });
    households.createFact({
      ...base,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      value: "Middle",
    });
    expect(households.listFacts(household.id, "2025-06-01")).toEqual([
      expect.objectContaining({ value: "Elementary" }),
    ]);
    expect(() =>
      households.createFact({
        ...base,
        effectiveFrom: "2025-06-01",
        effectiveTo: null,
      }),
    ).toThrow(/overlap/);
    expect(households.listPeople(household.id)[0]).toMatchObject({
      dependent: true,
    });
    database.close();
  });

  test("validates goals and resolves dated assumptions", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const household = unitOfWork.households.create({
      currency: "USD",
      name: "Plans",
    });
    const goal = {
      accountId: null,
      constraintLevel: "soft" as const,
      currency: "USD",
      dependentId: null,
      fundingStrategy: "mixed" as const,
      householdId: household.id,
      name: "Emergency fund",
      priorityTier: "important" as const,
      status: "active" as const,
      targetAmountMinor: 500_000,
      targetDate: "2027-01-01",
    };
    expect(unitOfWork.goals.create(goal)).toMatchObject({
      name: "Emergency fund",
    });
    expect(() =>
      unitOfWork.goals.create({
        ...goal,
        constraintLevel: "hard",
        priorityTier: "aspirational",
      }),
    ).toThrow(/Aspirational/);
    unitOfWork.goals.createAssumption({
      assumptionKey: "inflation",
      confidence: 0.8,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2027-01-01",
      householdId: household.id,
      source: "user",
      value: 0.03,
    });
    expect(
      unitOfWork.goals.listAssumptions(household.id, "2026-06-01"),
    ).toEqual([expect.objectContaining({ value: 0.03 })]);
    database.close();
  });

  test("reconciles current holding values and reports unknown valuations", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const institution = createTestInstitution(unitOfWork);
    const account = unitOfWork.accounts.create({
      accountType: "taxable_brokerage",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
      name: "Brokerage",
      status: "active",
    });
    const fund = unitOfWork.investments.createSecurity({
      currency: "USD",
      name: "Index Fund",
      securityType: "fund",
      symbol: "IDX",
    });
    unitOfWork.investments.createHolding({
      accountId: account.id,
      asOf: "2026-07-01T00:00:00.000Z",
      costBasisMinor: 90_000,
      marketValueMinor: null,
      priceMinor: 10_000,
      quantity: 10,
      securityId: fund.id,
      source: "manual",
      sourceRecordId: null,
    });
    unitOfWork.investments.createHolding({
      accountId: account.id,
      asOf: "2026-07-13T00:00:00.000Z",
      costBasisMinor: 90_000,
      marketValueMinor: null,
      priceMinor: 12_000,
      quantity: 10,
      securityId: fund.id,
      source: "manual",
      sourceRecordId: null,
    });
    const unknown = unitOfWork.investments.createSecurity({
      currency: "USD",
      name: "Private asset",
      securityType: "other",
      symbol: null,
    });
    unitOfWork.investments.createHolding({
      accountId: account.id,
      asOf: "2026-07-13T00:00:00.000Z",
      costBasisMinor: null,
      marketValueMinor: null,
      priceMinor: null,
      quantity: 1,
      securityId: unknown.id,
      source: "manual",
      sourceRecordId: null,
    });
    expect(unitOfWork.investments.currentValuation(account.id)).toMatchObject({
      totalValueMinor: 120_000,
      missing: [
        expect.objectContaining({
          reason: expect.stringContaining("required"),
        }),
      ],
    });
    unitOfWork.investments.createTransaction({
      accountId: account.id,
      cashAmountMinor: -90_000,
      costBasisMinor: 90_000,
      priceMinor: 9_000,
      quantity: 10,
      securityId: fund.id,
      source: "manual",
      sourceRecordId: null,
      transactionDate: "2025-01-01T00:00:00.000Z",
      transactionType: "buy",
    });
    expect(unitOfWork.investments.listTransactions(account.id)).toHaveLength(1);
    database.close();
  });

  test("versions debt terms, deduplicates forecast inputs, and isolates scenario overrides", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const household = unitOfWork.households.create({
      currency: "USD",
      name: "Debts",
    });
    const debt = unitOfWork.obligations.createLiability({
      accountId: null,
      confidence: 1,
      currency: "USD",
      householdId: household.id,
      name: "Student loan",
      source: "user",
    });
    unitOfWork.obligations.addTerms({
      annualRateBps: null,
      balanceMinor: 1_000_000,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2027-01-01",
      liabilityId: debt.id,
      minimumPaymentMinor: 20_000,
      paymentDay: 1,
    });
    unitOfWork.obligations.addTerms({
      annualRateBps: 500,
      balanceMinor: 900_000,
      effectiveFrom: "2027-01-01",
      effectiveTo: null,
      liabilityId: debt.id,
      minimumPaymentMinor: 20_000,
      paymentDay: 1,
    });
    unitOfWork.obligations.createObligation({
      amountMinor: 20_000,
      cadence: "monthly",
      confidence: 1,
      currency: "USD",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      householdId: household.id,
      liabilityId: debt.id,
      name: "Loan autopay",
      paymentDay: 1,
      source: "user",
    });
    unitOfWork.obligations.createObligation({
      amountMinor: 12_000,
      cadence: "annual",
      confidence: 1,
      currency: "USD",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      householdId: household.id,
      liabilityId: null,
      name: "Membership",
      paymentDay: null,
      source: "user",
    });
    expect(
      unitOfWork.obligations.forecastInputs(household.id, "2026-06-01"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amountMinor: 20_000, kind: "debt_payment" }),
        expect.objectContaining({ amountMinor: 1_000, kind: "recurring" }),
      ]),
    );
    unitOfWork.obligations.createScenarioOverride({
      liabilityId: debt.id,
      scenarioId: "payoff",
      terms: { minimumPaymentMinor: 50_000 },
    });
    expect(
      unitOfWork.obligations.resolveTerms(debt.id, "2026-06-01", "payoff"),
    ).toMatchObject({ minimumPaymentMinor: 50_000, scenario: true });
    expect(
      unitOfWork.obligations.resolveTerms(debt.id, "2026-06-01"),
    ).toMatchObject({ minimumPaymentMinor: 20_000 });
    expect(() =>
      unitOfWork.obligations.addTerms({
        annualRateBps: 100,
        balanceMinor: 100,
        effectiveFrom: "2028-01-01",
        effectiveTo: null,
        liabilityId: debt.id,
        minimumPaymentMinor: 101,
        paymentDay: 1,
      }),
    ).toThrow(/exceed/);
    database.close();
  });

  test("forecasts person-linked income from effective-dated schedules", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const household = unitOfWork.households.create({
      currency: "USD",
      name: "Income household",
    });
    const person = unitOfWork.households.createPerson({
      birthDate: null,
      dependent: false,
      dependentUntil: null,
      householdId: household.id,
      name: "Avery Example",
      relationship: "self",
    });
    const w2 = unitOfWork.income.createSource({
      kind: "w2",
      name: "Example Co. salary",
      personId: person.id,
    });
    const baseSchedule = unitOfWork.income.createSchedule({
      annualGrowthBps: 0,
      behavior: "fixed",
      cadence: "monthly",
      confidence: 1,
      currency: "USD",
      deductionAmountMinor: null,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-07-01",
      expectedNetAmountMinor: 80_000,
      grossAmountMinor: 100_000,
      grossIncomeBasis: "gross",
      highGrossAmountMinor: null,
      lowGrossAmountMinor: null,
      source: "paystub",
      sourceId: w2.id,
      verifiedAt: null,
      verifiedBy: null,
      withholdingRateBps: null,
    });
    unitOfWork.income.createSchedule({
      ...baseSchedule,
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      expectedNetAmountMinor: 88_000,
      grossAmountMinor: 110_000,
    });
    const contractor = unitOfWork.income.createSource({
      kind: "contractor",
      name: "Consulting",
      personId: person.id,
    });
    unitOfWork.income.createSchedule({
      annualGrowthBps: 0,
      behavior: "variable",
      cadence: "monthly",
      confidence: 0.7,
      currency: "USD",
      deductionAmountMinor: null,
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      expectedNetAmountMinor: null,
      grossAmountMinor: 100_000,
      grossIncomeBasis: "gross",
      highGrossAmountMinor: 150_000,
      lowGrossAmountMinor: 50_000,
      source: "contract",
      sourceId: contractor.id,
      verifiedAt: null,
      verifiedBy: null,
      withholdingRateBps: 1_000,
    });
    const bonus = unitOfWork.income.createSource({
      kind: "bonus",
      name: "Annual bonus",
      personId: person.id,
    });
    unitOfWork.income.createSchedule({
      annualGrowthBps: 0,
      behavior: "fixed",
      cadence: "annual",
      confidence: 0.8,
      currency: "USD",
      deductionAmountMinor: 25_000,
      effectiveFrom: "2026-03-15",
      effectiveTo: null,
      expectedNetAmountMinor: null,
      grossAmountMinor: 200_000,
      grossIncomeBasis: "gross",
      highGrossAmountMinor: null,
      lowGrossAmountMinor: null,
      source: "offer letter",
      sourceId: bonus.id,
      verifiedAt: null,
      verifiedBy: null,
      withholdingRateBps: 2_000,
    });
    const unknown = unitOfWork.income.createSource({
      kind: "other",
      name: "Unknown distribution",
      personId: person.id,
    });
    unitOfWork.income.createSchedule({
      annualGrowthBps: 0,
      behavior: "fixed",
      cadence: "annual",
      confidence: 0.2,
      currency: "USD",
      deductionAmountMinor: null,
      effectiveFrom: "2026-11-01",
      effectiveTo: null,
      expectedNetAmountMinor: null,
      grossAmountMinor: 10_000,
      grossIncomeBasis: "gross",
      highGrossAmountMinor: null,
      lowGrossAmountMinor: null,
      source: "user estimate",
      sourceId: unknown.id,
      verifiedAt: null,
      verifiedBy: null,
      withholdingRateBps: null,
    });

    expect(() =>
      unitOfWork.income.createSchedule({
        annualGrowthBps: 0,
        behavior: "fixed",
        cadence: "monthly",
        confidence: 1,
        currency: "USD",
        deductionAmountMinor: null,
        effectiveFrom: "2026-06-01",
        effectiveTo: null,
        expectedNetAmountMinor: 80_000,
        grossAmountMinor: 100_000,
        grossIncomeBasis: "gross",
        highGrossAmountMinor: null,
        lowGrossAmountMinor: null,
        source: "paystub",
        sourceId: w2.id,
        verifiedAt: null,
        verifiedBy: null,
        withholdingRateBps: null,
      }),
    ).toThrow(/cannot overlap/);

    const forecast = unitOfWork.income.forecast(household.id, "2026-01-01", 60);
    expect(forecast.monthly).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedNetAmountMinor: 80_000,
          month: "2026-01-01",
          scheduleId: baseSchedule.id,
        }),
        expect.objectContaining({
          expectedNetAmountMinor: 90_000,
          highNetAmountMinor: 135_000,
          lowNetAmountMinor: 45_000,
          month: "2026-07-01",
        }),
        expect.objectContaining({
          expectedNetAmountMinor: null,
          month: "2026-11-01",
          warnings: [expect.stringContaining("unknown")],
        }),
      ]),
    );
    expect(forecast.annual).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ year: 2026, currency: "USD" }),
        expect.objectContaining({ year: 2030, currency: "USD" }),
      ]),
    );
    expect(unitOfWork.income.listSchedules(w2.id)).toHaveLength(2);
    database.close();
  });

  test("snapshots monthly income and reconciles only earned-income deposits", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const household = unitOfWork.households.create({
      currency: "USD",
      name: "Reconciliation household",
    });
    const person = unitOfWork.households.createPerson({
      birthDate: null,
      dependent: false,
      dependentUntil: null,
      householdId: household.id,
      name: "Avery",
      relationship: "self",
    });
    const source = unitOfWork.income.createSource({
      kind: "w2",
      name: "Example Co. salary",
      personId: person.id,
    });
    unitOfWork.income.createSchedule({
      annualGrowthBps: 0,
      behavior: "fixed",
      cadence: "monthly",
      confidence: 1,
      currency: "USD",
      deductionAmountMinor: null,
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      expectedNetAmountMinor: 80_000,
      grossAmountMinor: 100_000,
      grossIncomeBasis: "gross",
      highGrossAmountMinor: null,
      lowGrossAmountMinor: null,
      source: "paystub",
      sourceId: source.id,
      verifiedAt: null,
      verifiedBy: null,
      withholdingRateBps: null,
    });
    const institution = createTestInstitution(unitOfWork, "Income Bank");
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
      name: "Income",
      status: "active",
    });
    const salary = unitOfWork.categories.create({
      name: "Salary",
      parentId: null,
      status: "active",
    });
    const refund = unitOfWork.categories.create({
      name: "Refund",
      parentId: null,
      status: "active",
    });
    const batch = unitOfWork.importBatches.create({
      actor: "user",
      checksum: "income-reconciliation-batch",
      source: "manual",
    });
    const deposits = [
      {
        amountMinor: 50_000,
        categoryId: salary.id,
        day: "01",
        id: "salary-part-one",
      },
      {
        amountMinor: 30_000,
        categoryId: salary.id,
        day: "15",
        id: "salary-part-two",
      },
      {
        amountMinor: 12_000,
        categoryId: salary.id,
        day: "20",
        id: "unrelated-credit",
      },
      {
        amountMinor: 10_000,
        categoryId: refund.id,
        day: "25",
        id: "refund-credit",
      },
    ];
    for (const deposit of deposits) {
      const sourceRecord = unitOfWork.sourceRecords.create({
        batchId: batch.id,
        checksum: deposit.id,
        rawPayload: "{}",
        sourceType: "manual",
      });
      unitOfWork.transactions.create({
        accountId: account.id,
        amountMinor: deposit.amountMinor,
        categoryId: deposit.categoryId,
        currency: "USD",
        merchant: null,
        payee: "Example Employer",
        postedAt: null,
        sourceCategory: null,
        sourceIdentity: deposit.id,
        sourceRecordId: sourceRecord.id,
        status: "posted",
        transactionDate: `2026-07-${deposit.day}T00:00:00.000Z`,
      });
    }
    unitOfWork.incomeClassifications.refresh();
    const run = unitOfWork.incomeReconciliation.run(household.id, {
      dataAsOf: "2026-08-31",
      months: 2,
      startMonth: "2026-07-01",
    });
    expect(run.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedGrossAmountMinor: 100_000,
          expectedNetAmountMinor: 80_000,
          month: "2026-07-01",
        }),
      ]),
    );
    expect(run.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedNetAmountMinor: 80_000,
          matchMethod: "inferred",
          observedNetAmountMinor: 80_000,
          varianceMinor: 0,
        }),
        expect.objectContaining({
          matchMethod: "unmatched_expected",
          reviewState: "needs_review",
        }),
        expect.objectContaining({
          matchMethod: "unexplained_deposit",
          observedNetAmountMinor: 12_000,
        }),
      ]),
    );
    expect(
      run.matches.some((match) => match.observedNetAmountMinor === 10_000),
    ).toBe(false);
    const inferred = run.matches.find(
      (match) => match.matchMethod === "inferred",
    );
    const confirmed = unitOfWork.incomeReconciliation.confirmMatch(
      inferred?.id ?? "",
      inferred?.transactionIds ?? [],
    );
    expect(confirmed).toMatchObject({
      confidence: 1,
      matchMethod: "user_confirmed",
      observedNetAmountMinor: 80_000,
      reviewState: "confirmed",
      varianceMinor: 0,
    });
    expect(unitOfWork.income.listSchedules(source.id)[0]).toMatchObject({
      expectedNetAmountMinor: 80_000,
    });
    const replay = unitOfWork.incomeReconciliation.getRun(run.run.id, 1);
    expect(replay?.rows).toHaveLength(1);
    expect(replay?.run.inputVersion).toBe(run.run.inputVersion);
    database.close();
  });

  test("validates typed funding buckets and effective-dated allocation rules", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const household = unitOfWork.households.create({
      currency: "USD",
      name: "Funding household",
    });
    const parentCategory = unitOfWork.categories.create({
      name: "Home",
      parentId: null,
      status: "active",
    });
    const childCategory = unitOfWork.categories.create({
      name: "Repairs",
      parentId: parentCategory.id,
      status: "active",
    });
    const budget = unitOfWork.budgets.create({
      currency: "USD",
      householdId: household.id,
      name: "Household budget",
      status: "active",
    });
    const goal = unitOfWork.goals.create({
      accountId: null,
      constraintLevel: "soft",
      currency: "USD",
      dependentId: null,
      fundingStrategy: "cash",
      householdId: household.id,
      name: "Emergency fund",
      priorityTier: "essential",
      status: "active",
      targetAmountMinor: 1_000_000,
      targetDate: "2028-01-01",
    });
    const institution = createTestInstitution(unitOfWork, "Funding Bank");
    const checking = unitOfWork.accounts.create({
      accountType: "checking",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
      name: "Checking",
      status: "active",
    });
    const brokerage = unitOfWork.accounts.create({
      accountType: "taxable_brokerage",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
      name: "Brokerage",
      status: "active",
    });
    const budgetBucket = unitOfWork.funding.createBucket({
      budgetId: budget.id,
      categoryId: childCategory.id,
      currency: "USD",
      currencyPolicy: "household_currency",
      destinationAccountId: null,
      destinationType: "budget",
      goalId: null,
      householdId: household.id,
      name: "Home repairs",
      reserveName: null,
    });
    const goalBucket = unitOfWork.funding.createBucket({
      budgetId: null,
      categoryId: null,
      currency: "USD",
      currencyPolicy: "household_currency",
      destinationAccountId: null,
      destinationType: "goal",
      goalId: goal.id,
      householdId: household.id,
      name: "Emergency fund",
      reserveName: null,
    });
    const reserveBucket = unitOfWork.funding.createBucket({
      budgetId: null,
      categoryId: null,
      currency: "USD",
      currencyPolicy: "household_currency",
      destinationAccountId: null,
      destinationType: "reserve",
      goalId: null,
      householdId: household.id,
      name: "Tax reserve",
      reserveName: "Taxes",
    });
    const investmentBucket = unitOfWork.funding.createBucket({
      budgetId: null,
      categoryId: null,
      currency: "USD",
      currencyPolicy: "destination_currency",
      destinationAccountId: brokerage.id,
      destinationType: "investment_contribution",
      goalId: null,
      householdId: household.id,
      name: "Brokerage contributions",
      reserveName: null,
    });
    const bufferBucket = unitOfWork.funding.createBucket({
      budgetId: null,
      categoryId: null,
      currency: "USD",
      currencyPolicy: "household_currency",
      destinationAccountId: null,
      destinationType: "unallocated_buffer",
      goalId: null,
      householdId: household.id,
      name: "Unallocated buffer",
      reserveName: null,
    });
    unitOfWork.funding.createRule({
      amountType: "fixed",
      bucketId: budgetBucket.id,
      cadence: "monthly",
      constraintLevel: "hard",
      currencyPolicy: "household_currency",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      fixedAmountMinor: 25_000,
      maximumAmountMinor: null,
      minimumAmountMinor: null,
      percentageBasis: null,
      percentageBps: null,
      priority: 1,
      sourceAccountId: checking.id,
    });
    const originalGoalRule = unitOfWork.funding.createRule({
      amountType: "percentage",
      bucketId: goalBucket.id,
      cadence: "monthly",
      constraintLevel: "preferred",
      currencyPolicy: "household_currency",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2027-01-01",
      fixedAmountMinor: null,
      maximumAmountMinor: 50_000,
      minimumAmountMinor: 10_000,
      percentageBasis: "gross_income",
      percentageBps: 1_000,
      priority: 2,
      sourceAccountId: checking.id,
    });
    unitOfWork.funding.createRule({
      ...originalGoalRule,
      effectiveFrom: "2027-01-01",
      effectiveTo: null,
      percentageBps: 1_500,
    });
    unitOfWork.funding.createRule({
      amountType: "percentage",
      bucketId: reserveBucket.id,
      cadence: "monthly",
      constraintLevel: "minimum",
      currencyPolicy: "household_currency",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      fixedAmountMinor: null,
      maximumAmountMinor: null,
      minimumAmountMinor: 5_000,
      percentageBasis: "expected_net_income",
      percentageBps: 500,
      priority: 3,
      sourceAccountId: checking.id,
    });
    unitOfWork.funding.createRule({
      amountType: "percentage",
      bucketId: investmentBucket.id,
      cadence: "monthly",
      constraintLevel: "flexible",
      currencyPolicy: "destination_currency",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      fixedAmountMinor: null,
      maximumAmountMinor: null,
      minimumAmountMinor: null,
      percentageBasis: "remaining_cash",
      percentageBps: 2_000,
      priority: 4,
      sourceAccountId: checking.id,
    });
    const residual = unitOfWork.funding.createRule({
      amountType: "percentage",
      bucketId: bufferBucket.id,
      cadence: "monthly",
      constraintLevel: "residual",
      currencyPolicy: "household_currency",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      fixedAmountMinor: null,
      maximumAmountMinor: null,
      minimumAmountMinor: null,
      percentageBasis: "remaining_cash",
      percentageBps: 10_000,
      priority: 99,
      sourceAccountId: checking.id,
    });
    expect(unitOfWork.funding.listBuckets(household.id)).toHaveLength(5);
    expect(unitOfWork.funding.listRules(goalBucket.id, "2026-06-01")).toEqual([
      expect.objectContaining({
        id: originalGoalRule.id,
        percentageBps: 1_000,
      }),
    ]);
    expect(unitOfWork.funding.listRules(goalBucket.id, "2027-06-01")).toEqual([
      expect.objectContaining({ percentageBps: 1_500 }),
    ]);
    expect(residual.constraintLevel).toBe("residual");
    const secondBuffer = unitOfWork.funding.createBucket({
      budgetId: null,
      categoryId: null,
      currency: "USD",
      currencyPolicy: "household_currency",
      destinationAccountId: null,
      destinationType: "unallocated_buffer",
      goalId: null,
      householdId: household.id,
      name: "Second unallocated buffer",
      reserveName: null,
    });
    expect(() =>
      unitOfWork.funding.createRule({
        ...residual,
        bucketId: secondBuffer.id,
      }),
    ).toThrow(/Only one residual/);
    expect(() =>
      unitOfWork.funding.createRule({
        ...residual,
        amountType: "fixed",
        fixedAmountMinor: 1,
        percentageBasis: null,
        percentageBps: null,
      }),
    ).toThrow(/Residual/);
    expect(() =>
      unitOfWork.funding.createRule({
        ...originalGoalRule,
        effectiveFrom: "2026-06-01",
        effectiveTo: null,
      }),
    ).toThrow(/cannot overlap/);
    expect(() =>
      unitOfWork.funding.createRule({
        ...originalGoalRule,
        effectiveFrom: "2028-01-01",
        effectiveTo: "2027-01-01",
      }),
    ).toThrow(/effective end/);
    expect(() =>
      unitOfWork.funding.createBucket({
        ...bufferBucket,
        currency: "EUR",
      }),
    ).toThrow(/Household-currency/);
    database.close();
  });

  test("materializes a deterministic shared allocation ledger with explicit shortfalls", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const household = unitOfWork.households.create({
      currency: "USD",
      name: "Ledger household",
    });
    const person = unitOfWork.households.createPerson({
      birthDate: null,
      dependent: false,
      dependentUntil: null,
      householdId: household.id,
      name: "Avery",
      relationship: "self",
    });
    const incomeSource = unitOfWork.income.createSource({
      kind: "w2",
      name: "Salary",
      personId: person.id,
    });
    unitOfWork.income.createSchedule({
      annualGrowthBps: 0,
      behavior: "fixed",
      cadence: "monthly",
      confidence: 1,
      currency: "USD",
      deductionAmountMinor: null,
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      expectedNetAmountMinor: 100_000,
      grossAmountMinor: 125_000,
      grossIncomeBasis: "gross",
      highGrossAmountMinor: null,
      lowGrossAmountMinor: null,
      source: "paystub",
      sourceId: incomeSource.id,
      verifiedAt: null,
      verifiedBy: null,
      withholdingRateBps: null,
    });
    const incomeRun = unitOfWork.incomeReconciliation.run(household.id, {
      dataAsOf: "2026-08-31",
      months: 2,
      startMonth: "2026-07-01",
    });
    const institution = createTestInstitution(unitOfWork, "Ledger Bank");
    const checking = unitOfWork.accounts.create({
      accountType: "checking",
      currency: "USD",
      externalConnectionId: null,
      externalId: null,
      institutionId: institution.id,
      name: "Checking",
      status: "active",
    });
    unitOfWork.accounts.addBalance({
      accountId: checking.id,
      amountMinor: 50_000,
      asOf: "2026-06-30T00:00:00.000Z",
      availableAmountMinor: 50_000,
    });
    unitOfWork.obligations.createObligation({
      amountMinor: 20_000,
      cadence: "monthly",
      confidence: 1,
      currency: "USD",
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      householdId: household.id,
      liabilityId: null,
      name: "Rent",
      paymentDay: 1,
      source: "lease",
    });
    const debt = unitOfWork.obligations.createLiability({
      accountId: null,
      confidence: 1,
      currency: "USD",
      householdId: household.id,
      name: "Loan",
      source: "statement",
    });
    unitOfWork.obligations.addTerms({
      annualRateBps: null,
      balanceMinor: 500_000,
      effectiveFrom: "2026-08-01",
      effectiveTo: null,
      liabilityId: debt.id,
      minimumPaymentMinor: 120_000,
      paymentDay: 1,
    });
    const goal = unitOfWork.goals.create({
      accountId: null,
      constraintLevel: "soft",
      currency: "USD",
      dependentId: null,
      fundingStrategy: "cash",
      householdId: household.id,
      name: "Emergency fund",
      priorityTier: "essential",
      status: "active",
      targetAmountMinor: 1_000_000,
      targetDate: "2028-01-01",
    });
    const goalBucket = unitOfWork.funding.createBucket({
      budgetId: null,
      categoryId: null,
      currency: "USD",
      currencyPolicy: "household_currency",
      destinationAccountId: null,
      destinationType: "goal",
      goalId: goal.id,
      householdId: household.id,
      name: "Emergency fund",
      reserveName: null,
    });
    const bufferBucket = unitOfWork.funding.createBucket({
      budgetId: null,
      categoryId: null,
      currency: "USD",
      currencyPolicy: "household_currency",
      destinationAccountId: null,
      destinationType: "unallocated_buffer",
      goalId: null,
      householdId: household.id,
      name: "Unallocated",
      reserveName: null,
    });
    unitOfWork.funding.createRule({
      amountType: "fixed",
      bucketId: goalBucket.id,
      cadence: "monthly",
      constraintLevel: "hard",
      currencyPolicy: "household_currency",
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      fixedAmountMinor: 50_000,
      maximumAmountMinor: null,
      minimumAmountMinor: null,
      percentageBasis: null,
      percentageBps: null,
      priority: 1,
      sourceAccountId: checking.id,
    });
    unitOfWork.funding.createRule({
      amountType: "percentage",
      bucketId: bufferBucket.id,
      cadence: "monthly",
      constraintLevel: "residual",
      currencyPolicy: "household_currency",
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      fixedAmountMinor: null,
      maximumAmountMinor: null,
      minimumAmountMinor: null,
      percentageBasis: "remaining_cash",
      percentageBps: 10_000,
      priority: 99,
      sourceAccountId: checking.id,
    });
    const ledger = unitOfWork.allocationLedger.create(household.id, {
      currency: "USD",
      incomeForecastRunId: incomeRun.run.id,
      openingAsOf: "2026-06-30T00:00:00.000Z",
    });
    expect(ledger.months).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allocationAllocatedMinor: 130_000,
          closingBalanceMinor: 0,
          month: "2026-07-01",
          obligationAllocatedMinor: 20_000,
          shortfallMinor: 0,
        }),
        expect.objectContaining({
          closingBalanceMinor: 0,
          month: "2026-08-01",
          obligationRequestedMinor: 140_000,
          shortfallMinor: 90_000,
        }),
      ]),
    );
    expect(ledger.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryType: "income",
          grossAmountMinor: 125_000,
          expectedNetAmountMinor: 100_000,
        }),
        expect.objectContaining({
          entryType: "shortfall",
          fundingStatus: "shortfall",
          requestedAmountMinor: 20_000,
        }),
        expect.objectContaining({
          constraintLevel: "hard",
          entryType: "allocation",
          requestedAmountMinor: 50_000,
        }),
      ]),
    );
    const nextMonth = unitOfWork.allocationLedger.get(ledger.run.id, 1);
    expect(nextMonth?.months).toHaveLength(1);
    expect(nextMonth?.run.inputVersion).toBe(ledger.run.inputVersion);
    expect(
      unitOfWork.allocationLedger.get(ledger.run.id)?.entries,
    ).toHaveLength(ledger.entries.length);
    database.close();
  });

  test("manages and deterministically clones audited budget targets", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const category = unitOfWork.categories.create({
      name: "Food",
      parentId: null,
      status: "active",
    });
    const budget = unitOfWork.budgets.create({
      currency: "USD",
      householdId: null,
      name: "Monthly",
      status: "active",
    });
    const period = unitOfWork.budgets.createPeriod({
      budgetId: budget.id,
      dateFrom: "2026-07-01T00:00:00.000Z",
      dateTo: "2026-07-31T23:59:59.999Z",
      status: "active",
    });
    unitOfWork.budgets.setLine(period.id, category.id, 50_000);
    unitOfWork.budgets.setLine(period.id, category.id, 55_000);
    expect(() =>
      unitOfWork.budgets.createPeriod({
        budgetId: budget.id,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        status: "active",
      }),
    ).toThrow(/already exists/);
    const clone = unitOfWork.budgets.clonePeriod(period.id, {
      dateFrom: "2026-08-01T00:00:00.000Z",
      dateTo: "2026-08-31T23:59:59.999Z",
      status: "draft",
    });
    expect(clone.lines).toEqual([
      expect.objectContaining({
        categoryId: category.id,
        targetAmountMinor: 55_000,
      }),
    ]);
    expect(
      unitOfWork.auditEvents
        .list({ limit: 100 })
        .items.filter((event) => event.entityType === "budget_line"),
    ).toHaveLength(3);
    database.close();
  });
});
