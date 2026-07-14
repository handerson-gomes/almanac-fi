import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

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

test("supports account, balance, and institution connection CRUD", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });
  const connectionResponse = await app.inject({
    method: "POST",
    payload: {
      institutionName: "Example Bank",
      provider: "simplefin",
      secretKey: "simplefin-example",
    },
    url: "/institution-connections",
  });
  expect(connectionResponse.statusCode).toBe(201);
  const connection = connectionResponse.json();
  expect(connection).toMatchObject({ secretKey: "simplefin-example" });

  const created = await app.inject({
    method: "POST",
    payload: {
      accountType: "checking",
      connectionId: connection.id,
      currency: "USD",
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
        payload: { accountType: "checking", currency: "usd", name: "Invalid" },
        url: "/accounts",
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await app.inject({ method: "DELETE", url: `/accounts/${account.id}` }))
      .statusCode,
  ).toBe(204);

  await app.close();
  await rm(dataHome, { force: true, recursive: true });
});

test("previews and imports CSV rows idempotently with category rules", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-server-"));
  const app = await createServer({
    config: { dataHome, host: "127.0.0.1", logLevel: "error", port: 0 },
  });
  const account = (
    await app.inject({
      method: "POST",
      payload: {
        accountType: "checking",
        currency: "USD",
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
