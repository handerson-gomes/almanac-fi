import { expect, test } from "vitest";

import {
  createAccountSchema,
  healthResponseSchema,
  openApiDocument,
  paginationQuerySchema,
  problemSchema,
  transactionSchema,
} from "./index.js";

test("validates stable API contracts", () => {
  expect(paginationQuerySchema.parse({ limit: "10" })).toEqual({ limit: 10 });
  expect(healthResponseSchema.parse({ status: "ok" })).toEqual({
    status: "ok",
  });
  expect(openApiDocument.paths).toHaveProperty("/health");
});

test("requires a request id in errors", () => {
  expect(() =>
    problemSchema.parse({
      detail: "bad",
      status: 400,
      title: "Bad",
      type: "https://example.test/problem",
    }),
  ).toThrow();
});

test("validates account type and ISO currency at the boundary", () => {
  expect(
    createAccountSchema.parse({
      accountType: "checking",
      currency: "USD",
      name: "Checking",
    }),
  ).toMatchObject({ status: "active" });
  expect(() =>
    createAccountSchema.parse({
      accountType: "brokerage",
      currency: "usd",
      name: "Checking",
    }),
  ).toThrow();
});

test("accepts extended bank transaction descriptions", () => {
  const timestamp = "2026-04-14T00:00:00.000Z";
  const description = "D".repeat(241);

  expect(
    transactionSchema.parse({
      accountId: "11111111-1111-4111-8111-111111111111",
      amountMinor: -5000,
      categoryId: null,
      createdAt: timestamp,
      currency: "USD",
      id: "22222222-2222-4222-8222-222222222222",
      isCurrent: true,
      merchant: description,
      payee: null,
      postedAt: null,
      replacesTransactionId: null,
      sourceCategory: null,
      sourceIdentity: "csv:extended-description",
      sourceRecordId: "33333333-3333-4333-8333-333333333333",
      status: "posted",
      transactionDate: timestamp,
      updatedAt: timestamp,
    }),
  ).toMatchObject({ merchant: description });
});
