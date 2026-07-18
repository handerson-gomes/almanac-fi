import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { createDatabase } from "@almanac-fi/db";
import { createUnitOfWork } from "@almanac-fi/db/repositories";

import { createServer } from "./index.js";

test("health, readiness, and OpenAPI are deterministic", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });

  await expect(
    app.inject({ method: "GET", url: "/health" }),
  ).resolves.toMatchObject({ statusCode: 200 });
  await expect(
    app.inject({ method: "GET", url: "/ready" }),
  ).resolves.toMatchObject({ statusCode: 200 });
  const openApi = await app.inject({ method: "GET", url: "/openapi.json" });
  expect(openApi.json()).toMatchObject({ openapi: "3.1.0" });

  await app.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("errors are problem documents without stack traces", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });

  const response = await app.inject({ method: "GET", url: "/missing" });
  expect(response.statusCode).toBe(404);
  expect(response.headers["content-type"]).toContain(
    "application/problem+json",
  );
  expect(response.body).not.toContain("stack");

  await app.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("serves a read-only planning dashboard with explicit reconciliation context", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const database = createDatabase();
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
    database,
  });
  const unitOfWork = createUnitOfWork(database);
  const household = unitOfWork.households.create({
    currency: "USD",
    name: "Dashboard household",
  });
  unitOfWork.goals.create({
    accountId: null,
    constraintLevel: "soft",
    currency: "USD",
    dependentId: null,
    fundingStrategy: "cash",
    householdId: household.id,
    name: "Emergency reserve",
    priorityTier: "important",
    status: "active",
    targetAmountMinor: 120_000,
    targetDate: "2027-07-01",
  });
  const active = unitOfWork.planning.ensureActiveVersion(household.id);

  const response = await app.inject({
    method: "GET",
    url: `/households/${household.id}/planning-dashboard?currency=USD&periodStart=2026-07-01&asOf=2026-07-18T00%3A00%3A00.000Z`,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    context: {
      activePlanVersionId: active.id,
      currency: "USD",
      dataAsOf: "2026-07-18T00:00:00.000Z",
      period: { end: "2026-07-31", start: "2026-07-01" },
      plan: { id: active.id, mode: "active" },
    },
    reconciliation: {
      income: expect.objectContaining({ status: "unresolved" }),
    },
    warnings: expect.arrayContaining([
      expect.objectContaining({ code: "missing_income_forecast" }),
    ]),
  });

  await app.close();
  database.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("supports institution, account, balance, and provider connection CRUD", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });
  const institutionResponse = await app.inject({
    method: "POST",
    payload: {
      name: "Example Bank",
      websiteUrl: "https://example.test",
    },
    url: "/institutions",
  });
  expect(institutionResponse.statusCode).toBe(201);
  const institution = institutionResponse.json();
  expect(institution).toMatchObject({ domain: "example.test" });
  const providerResponse = await app.inject({
    method: "POST",
    payload: {
      provider: "simplefin",
      providerNamespace: "https://bridge.simplefin.org",
      secretKey: "simplefin-example",
    },
    url: "/provider-connections",
  });
  expect(providerResponse.statusCode).toBe(201);
  const providerConnection = providerResponse.json();

  const created = await app.inject({
    method: "POST",
    payload: {
      accountType: "checking",
      currency: "USD",
      institutionId: institution.id,
      name: "Household checking",
    },
    url: "/accounts",
  });
  expect(created.statusCode).toBe(201);
  const account = created.json();
  expect(account).toMatchObject({
    accountType: "checking",
    currency: "USD",
    status: "active",
  });

  const balance = await app.inject({
    method: "POST",
    payload: {
      amountMinor: 123_45,
      asOf: "2026-07-13T12:00:00.000Z",
      availableAmountMinor: 100_00,
    },
    url: `/accounts/${account.id}/balances`,
  });
  expect(balance.statusCode).toBe(201);
  expect(balance.json()).toMatchObject({ amountMinor: 123_45 });

  const updated = await app.inject({
    method: "PATCH",
    payload: { status: "hidden" },
    url: `/accounts/${account.id}`,
  });
  expect(updated.json()).toMatchObject({ status: "hidden" });
  expect(
    (
      await app.inject({
        method: "GET",
        url: `/accounts/${account.id}/balances`,
      })
    ).json(),
  ).toMatchObject({
    items: [expect.objectContaining({ asOf: "2026-07-13T12:00:00.000Z" })],
  });
  expect(
    (await app.inject({ method: "GET", url: "/accounts" })).json(),
  ).toMatchObject({
    items: [expect.objectContaining({ id: account.id })],
  });
  expect(
    (
      await app.inject({
        method: "POST",
        payload: {
          accountType: "checking",
          currency: "usd",
          institutionId: institution.id,
          name: "Invalid",
        },
        url: "/accounts",
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "POST",
        payload: {
          accountType: "checking",
          currency: "USD",
          name: "Missing institution",
        },
        url: "/accounts",
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "POST",
        payload: {
          accountType: "checking",
          currency: "USD",
          institutionId: "99999999-9999-4999-8999-999999999999",
          name: "Unknown institution",
        },
        url: "/accounts",
      })
    ).statusCode,
  ).toBe(404);
  expect(
    (
      await app.inject({
        method: "DELETE",
        url: `/institutions/${institution.id}`,
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await app.inject({
        method: "DELETE",
        url: `/provider-connections/${providerConnection.id}`,
      })
    ).statusCode,
  ).toBe(204);
  expect(
    (
      await app.inject({
        method: "GET",
        url: `/provider-connections/${providerConnection.id}`,
      })
    ).json(),
  ).toMatchObject({ secretKey: null, status: "disconnected" });
  expect(
    (await app.inject({ method: "DELETE", url: `/accounts/${account.id}` }))
      .statusCode,
  ).toBe(204);
  expect(
    (
      await app.inject({
        method: "DELETE",
        url: `/institutions/${institution.id}`,
      })
    ).statusCode,
  ).toBe(204);

  await app.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("previews and imports CSV rows idempotently with category rules", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });
  const institution = (
    await app.inject({
      method: "POST",
      payload: { name: "CSV Bank" },
      url: "/institutions",
    })
  ).json();
  const account = (
    await app.inject({
      method: "POST",
      payload: {
        accountType: "checking",
        currency: "USD",
        institutionId: institution.id,
        name: "Import account",
      },
      url: "/accounts",
    })
  ).json();
  const category = (
    await app.inject({
      method: "POST",
      payload: { name: "Coffee" },
      url: "/categories",
    })
  ).json();
  await app.inject({
    method: "POST",
    payload: {
      categoryId: category.id,
      matchField: "merchant",
      matchValue: "Coffee Shop",
      name: "Coffee merchant",
      precedence: 1,
    },
    url: "/categorization-rules",
  });
  const payload = {
    accountId: account.id,
    content:
      "Date,Description,Amount,Category\n2026-07-13,Coffee Shop,-4.50,Food",
    currency: "USD",
    mapping: {
      amountColumn: "Amount",
      amountSign: "debit-negative",
      categoryColumn: "Category",
      dateColumn: "Date",
      dateFormat: "YYYY-MM-DD",
      descriptionColumn: "Description",
      payeeColumn: null,
    },
  };
  const preview = await app.inject({
    method: "POST",
    payload,
    url: "/csv-imports/preview",
  });
  expect(preview.json()).toMatchObject({ valid: true, totalAmountMinor: -450 });
  const first = await app.inject({
    method: "POST",
    payload,
    url: "/csv-imports/commit",
  });
  expect(first.json()).toMatchObject({
    created: 1,
    corrected: 0,
    duplicate: 0,
  });
  const second = await app.inject({
    method: "POST",
    payload,
    url: "/csv-imports/commit",
  });
  expect(second.json()).toMatchObject({ created: 0, duplicate: 1 });
  const corrected = await app.inject({
    method: "POST",
    payload: {
      ...payload,
      content:
        "Date,Description,Amount,Category\n2026-07-13,Coffee Shop,-5.00,Food",
    },
    url: "/csv-imports/commit",
  });
  expect(corrected.json()).toMatchObject({ corrected: 1 });
  const transactions = await app.inject({
    method: "GET",
    url: "/transactions",
  });
  expect(transactions.json()).toMatchObject({
    items: [
      expect.objectContaining({ amountMinor: -500, categoryId: category.id }),
    ],
  });
  expect(
    (await app.inject({ method: "GET", url: "/categories" })).json(),
  ).toMatchObject({
    items: expect.arrayContaining([expect.objectContaining({ name: "Food" })]),
  });
  const invalid = await app.inject({
    method: "POST",
    payload: {
      ...payload,
      content: "Date,Description,Amount\ninvalid,Coffee,4.567",
    },
    url: "/csv-imports/commit",
  });
  expect(invalid.statusCode).toBe(400);

  await app.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("records and corrects manual actuals with retained provenance", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const database = createDatabase();
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
    database,
  });
  const institution = (
    await app.inject({
      method: "POST",
      payload: { name: "Manual Bank" },
      url: "/institutions",
    })
  ).json();
  const account = (
    await app.inject({
      method: "POST",
      payload: {
        accountType: "checking",
        currency: "USD",
        institutionId: institution.id,
        name: "Manual checking",
      },
      url: "/accounts",
    })
  ).json();
  const dining = (
    await app.inject({
      method: "POST",
      payload: { name: "Dining" },
      url: "/categories",
    })
  ).json();
  const groceries = (
    await app.inject({
      method: "POST",
      payload: { name: "Groceries" },
      url: "/categories",
    })
  ).json();
  const balance = (
    await app.inject({
      method: "POST",
      payload: {
        amountMinor: 50_000,
        asOf: "2026-07-01T00:00:00.000Z",
        availableAmountMinor: 45_000,
      },
      url: `/accounts/${account.id}/balances`,
    })
  ).json();
  const correctedBalance = await app.inject({
    method: "PATCH",
    payload: { amountMinor: 51_000 },
    url: `/accounts/${account.id}/balances/${balance.id}`,
  });
  expect(correctedBalance.statusCode).toBe(200);
  expect(correctedBalance.json()).toMatchObject({
    amountMinor: 51_000,
    replacesBalanceId: balance.id,
  });
  expect(
    (
      await app.inject({
        method: "GET",
        url: `/accounts/${account.id}/balances`,
      })
    ).json().items,
  ).toEqual([
    expect.objectContaining({ amountMinor: 51_000, isCurrent: true }),
  ]);

  const transaction = (
    await app.inject({
      method: "POST",
      payload: {
        accountId: account.id,
        amountMinor: -1_000,
        categoryId: null,
        currency: "USD",
        merchant: "Market",
        payee: null,
        postedAt: null,
        sourceCategory: null,
        splits: [
          { amountMinor: -600, categoryId: dining.id, memo: "Lunch" },
          { amountMinor: -400, categoryId: groceries.id, memo: "Staples" },
        ],
        status: "posted",
        transactionDate: "2026-07-02T00:00:00.000Z",
      },
      url: "/transactions",
    })
  ).json();
  expect(transaction.splits).toHaveLength(2);
  const correctedTransaction = await app.inject({
    method: "PATCH",
    payload: { amountMinor: -1_100, splits: [] },
    url: `/transactions/${transaction.transaction.id}`,
  });
  expect(correctedTransaction.statusCode).toBe(200);
  expect(correctedTransaction.json()).toMatchObject({
    transaction: {
      amountMinor: -1_100,
      replacesTransactionId: transaction.transaction.id,
    },
  });
  expect(
    (await app.inject({ method: "GET", url: "/transactions" })).json().items,
  ).toEqual([
    expect.objectContaining({ amountMinor: -1_100, isCurrent: true }),
  ]);
  expect(
    database.sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM audit_events a JOIN source_records s ON s.id = a.source_record_id JOIN import_batches b ON b.id = s.batch_id WHERE b.source = 'manual'",
      )
      .get(),
  ).toMatchObject({ count: 8 });

  await app.close();
  database.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("reports a currency-scoped current state without treating CDs as spendable", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });
  const institution = (
    await app.inject({
      method: "POST",
      payload: { name: "Snapshot Bank" },
      url: "/institutions",
    })
  ).json();
  const createAccount = async (name: string, accountType: string) =>
    (
      await app.inject({
        method: "POST",
        payload: {
          accountType,
          currency: "USD",
          institutionId: institution.id,
          name,
        },
        url: "/accounts",
      })
    ).json();
  const checking = await createAccount("Checking", "checking");
  const certificate = await createAccount("CD", "certificate_of_deposit");
  for (const [account, amountMinor, availableAmountMinor] of [
    [checking, 10_000, 8_000],
    [certificate, 50_000, null],
  ] as const) {
    await app.inject({
      method: "POST",
      payload: {
        amountMinor,
        asOf: "2026-07-17T00:00:00.000Z",
        availableAmountMinor,
      },
      url: `/accounts/${account.id}/balances`,
    });
  }
  const response = await app.inject({
    method: "GET",
    url: "/financial-state?asOf=2026-07-17T00:00:00.000Z&currency=USD",
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    availableBalanceMinor: 8_000,
    calculationVersion: "financial-state-v1",
    currentBalanceMinor: 60_000,
    currency: "USD",
    spendableFundsMinor: 8_000,
  });
  await app.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("manages person-linked income schedules and their monthly forecast", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });
  const household = (
    await app.inject({
      method: "POST",
      payload: { currency: "USD", name: "Income API" },
      url: "/households",
    })
  ).json();
  const person = (
    await app.inject({
      method: "POST",
      payload: { name: "Avery", relationship: "self" },
      url: `/households/${household.id}/people`,
    })
  ).json();
  const sourceResponse = await app.inject({
    method: "POST",
    payload: { kind: "w2", name: "Example Co.", personId: person.id },
    url: `/households/${household.id}/income-sources`,
  });
  expect(sourceResponse.statusCode).toBe(201);
  const source = sourceResponse.json();
  const scheduleResponse = await app.inject({
    method: "POST",
    payload: {
      behavior: "fixed",
      cadence: "monthly",
      confidence: 1,
      currency: "USD",
      effectiveFrom: "2026-07-01",
      expectedNetAmountMinor: 80_000,
      grossAmountMinor: 100_000,
      source: "paystub",
    },
    url: `/income-sources/${source.id}/schedules`,
  });
  expect(scheduleResponse.statusCode).toBe(201);
  const forecast = await app.inject({
    method: "GET",
    url: `/households/${household.id}/income-forecast?startMonth=2026-07-01&months=12`,
  });
  expect(forecast.statusCode).toBe(200);
  expect(forecast.json()).toMatchObject({
    annual: expect.arrayContaining([
      expect.objectContaining({
        expectedNetAmountMinor: 480_000,
        year: 2026,
      }),
      expect.objectContaining({
        expectedNetAmountMinor: 480_000,
        year: 2027,
      }),
    ]),
    monthly: expect.arrayContaining([
      expect.objectContaining({
        expectedNetAmountMinor: 80_000,
        month: "2026-07-01",
      }),
    ]),
  });
  const runResponse = await app.inject({
    method: "POST",
    payload: {
      dataAsOf: "2026-12-31",
      months: 12,
      startMonth: "2026-07-01",
    },
    url: `/households/${household.id}/income-forecast-runs`,
  });
  expect(runResponse.statusCode).toBe(201);
  const run = runResponse.json();
  expect(run).toMatchObject({
    matches: expect.arrayContaining([
      expect.objectContaining({
        matchMethod: "unmatched_expected",
        reviewState: "needs_review",
      }),
    ]),
    rows: expect.arrayContaining([
      expect.objectContaining({
        expectedGrossAmountMinor: 100_000,
        expectedNetAmountMinor: 80_000,
      }),
    ]),
  });
  const nextMonth = await app.inject({
    method: "GET",
    url: `/income-forecast-runs/${run.run.id}?horizon=next_month`,
  });
  expect(nextMonth.json().rows).toHaveLength(1);
  const ledgerResponse = await app.inject({
    method: "POST",
    payload: {
      currency: "USD",
      incomeForecastRunId: run.run.id,
      openingAsOf: "2026-06-30T00:00:00.000Z",
    },
    url: `/households/${household.id}/allocation-ledger-runs`,
  });
  expect(ledgerResponse.statusCode).toBe(201);
  const ledger = ledgerResponse.json();
  expect(ledger.months).toHaveLength(12);
  expect(
    (
      await app.inject({
        method: "GET",
        url: `/allocation-ledger-runs/${ledger.run.id}?horizon=next_month`,
      })
    ).json().months,
  ).toHaveLength(1);
  await app.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("manages typed funding buckets and residual allocation rules", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });
  const household = (
    await app.inject({
      method: "POST",
      payload: { currency: "USD", name: "Funding API" },
      url: "/households",
    })
  ).json();
  const bucketResponse = await app.inject({
    method: "POST",
    payload: {
      currency: "USD",
      destinationType: "unallocated_buffer",
      name: "Unallocated",
    },
    url: `/households/${household.id}/funding-buckets`,
  });
  expect(bucketResponse.statusCode).toBe(201);
  const bucket = bucketResponse.json();
  const ruleResponse = await app.inject({
    method: "POST",
    payload: {
      amountType: "percentage",
      cadence: "monthly",
      constraintLevel: "residual",
      currencyPolicy: "household_currency",
      effectiveFrom: "2026-01-01",
      percentageBasis: "remaining_cash",
      percentageBps: 10_000,
      priority: 99,
    },
    url: `/funding-buckets/${bucket.id}/rules`,
  });
  expect(ruleResponse.statusCode).toBe(201);
  expect(ruleResponse.json()).toMatchObject({
    constraintLevel: "residual",
    percentageBasis: "remaining_cash",
  });
  expect(
    (
      await app.inject({
        method: "GET",
        url: `/households/${household.id}/funding-buckets`,
      })
    ).json(),
  ).toMatchObject({ items: [expect.objectContaining({ id: bucket.id })] });
  expect(
    (
      await app.inject({
        method: "POST",
        payload: {
          amountType: "percentage",
          cadence: "monthly",
          constraintLevel: "hard",
          currencyPolicy: "household_currency",
          effectiveFrom: "2027-01-01",
          percentageBasis: "expected_net_income",
          percentageBps: 1_000,
          priority: 1,
        },
        url: `/funding-buckets/${bucket.id}/rules`,
      })
    ).statusCode,
  ).toBe(400);
  await app.close();
  await rm(dataHome, { force: true, recursive: true });
});
