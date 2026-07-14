import { describe, expect, test } from "vitest";

import {
  addMoney,
  basisPointsSchema,
  classifyIncome,
  detectTransferCandidates,
  excludeConfirmedTransfers,
  isoDateSchema,
  money,
  moneySchema,
  multiplyMoneyByBasisPoints,
  serializeMoney,
  normalizeMerchant,
  selectCategorySuggestion,
  transactionAmountSchema,
} from "./index.js";

describe("financial primitives", () => {
  test("accepts integer minor units including negative and zero values", () => {
    expect(money(-125, "USD")).toEqual({ amount: -125, currency: "USD" });
    expect(money(0, "JPY")).toEqual({ amount: 0, currency: "JPY" });
    expect(transactionAmountSchema.parse(-1)).toBe(-1);
  });

  test("rejects floating-point money and invalid currencies", () => {
    expect(() =>
      moneySchema.parse({ amount: 1.25, currency: "USD" }),
    ).toThrow();
    expect(() => money(100, "usd")).toThrow(/ISO 4217/);
  });

  test("preserves currency and rejects implicit conversion", () => {
    expect(addMoney(money(100, "USD"), money(50, "USD"))).toEqual({
      amount: 150,
      currency: "USD",
    });
    expect(() => addMoney(money(100, "USD"), money(100, "EUR"))).toThrow(
      /Cannot add/,
    );
  });

  test("rounds basis-point multiplication half away from zero", () => {
    expect(
      multiplyMoneyByBasisPoints(
        money(1, "USD"),
        basisPointsSchema.parse(5_000),
      ),
    ).toEqual({
      amount: 1,
      currency: "USD",
    });
    expect(
      multiplyMoneyByBasisPoints(
        money(-1, "USD"),
        basisPointsSchema.parse(5_000),
      ),
    ).toEqual({
      amount: -1,
      currency: "USD",
    });
  });

  test("serializes stable values and validates dates", () => {
    expect(serializeMoney(money(2_000, "EUR"))).toEqual({
      amount: 2_000,
      currency: "EUR",
    });
    expect(isoDateSchema.parse("2026-07-12")).toBe("2026-07-12");
  });
});

describe("transfer matching", () => {
  const transaction = (
    id: string,
    accountId: string,
    amountMinor: number,
    transactionDate = "2026-07-10T00:00:00.000Z",
  ) => ({ accountId, amountMinor, currency: "USD", id, transactionDate });

  test("distinguishes exact, partial, ambiguous, and same-account reversals", () => {
    expect(
      detectTransferCandidates([
        transaction("out", "checking", -10_000),
        transaction("in", "savings", 10_000, "2026-07-11T00:00:00.000Z"),
      ]),
    ).toEqual([expect.objectContaining({ confidence: 1, reason: "exact" })]);
    expect(
      detectTransferCandidates([
        transaction("out", "checking", -10_000),
        transaction("in", "savings", 9_950),
      ])[0],
    ).toMatchObject({ confidence: 0.7, reason: "partial" });
    expect(
      detectTransferCandidates([
        transaction("out", "checking", -10_000),
        transaction("in-1", "savings", 10_000),
        transaction("in-2", "brokerage", 10_000),
      ]),
    ).toEqual([
      expect.objectContaining({ reason: "ambiguous" }),
      expect.objectContaining({ reason: "ambiguous" }),
    ]);
    expect(
      detectTransferCandidates([
        transaction("charge", "checking", -10_000),
        transaction("reversal", "checking", 10_000),
      ]),
    ).toEqual([]);
  });

  test("excludes only explicitly confirmed transaction ids", () => {
    const items = [{ id: "transfer" }, { id: "spend" }];
    expect(excludeConfirmedTransfers(items, new Set(["transfer"]))).toEqual([
      { id: "spend" },
    ]);
  });
});

describe("categorization layers", () => {
  test("normalizes merchants and preserves deterministic precedence", () => {
    expect(normalizeMerchant("POS ACME COFFEE #123456")).toBe("acme coffee");
    const suggestion = (
      method: "ai" | "source_category",
      categoryId: string,
    ) => ({
      categoryId,
      confidence: 0.8,
      method,
      ruleId: null,
    });
    expect(
      selectCategorySuggestion({
        ai: suggestion("ai", "ai-category"),
        sourceCategory: suggestion("source_category", "source-category"),
      }),
    ).toMatchObject({ categoryId: "source-category" });
  });

  test("does not expose the AI layer unless explicitly enabled", () => {
    const ai = {
      categoryId: "ai-category",
      confidence: 0.5,
      method: "ai" as const,
      ruleId: null,
    };
    expect(selectCategorySuggestion({ ai })).toBeUndefined();
    expect(selectCategorySuggestion({ ai }, { enableAi: true })).toEqual(ai);
  });
});

describe("income classification", () => {
  test.each([
    [
      {
        accountType: "checking",
        amountMinor: 200_000,
        categoryName: "Salary",
        isConfirmedTransfer: false,
        payee: "Employer",
      },
      "income",
    ],
    [
      {
        accountType: "checking",
        amountMinor: 5_000,
        categoryName: "Refunds",
        isConfirmedTransfer: false,
      },
      "refund",
    ],
    [
      {
        accountType: "checking",
        amountMinor: 100_000,
        categoryName: "Salary",
        isConfirmedTransfer: true,
      },
      "transfer",
    ],
    [
      {
        accountType: "checking",
        amountMinor: 12_345,
        categoryName: null,
        isConfirmedTransfer: false,
      },
      "ambiguous",
    ],
  ] as const)("classifies fixture %# deterministically", (input, expected) => {
    expect(classifyIncome(input).kind).toBe(expected);
  });
});
