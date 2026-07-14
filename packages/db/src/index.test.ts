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

  test("persists reversible and audited transfer decisions", () => {
    const database = createDatabase();
    database.migrate();
    const unitOfWork = createUnitOfWork(database);
    const accounts = ["Checking", "Savings"].map((name) =>
      unitOfWork.accounts.create({
        accountType: "checking",
        connectionId: null,
        currency: "USD",
        externalId: null,
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
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      connectionId: null,
      currency: "USD",
      externalId: null,
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
    const account = unitOfWork.accounts.create({
      accountType: "checking",
      connectionId: null,
      currency: "USD",
      externalId: null,
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
    const account = unitOfWork.accounts.create({
      accountType: "investment",
      connectionId: null,
      currency: "USD",
      externalId: null,
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
