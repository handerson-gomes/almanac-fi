import { describe, expect, test } from "vitest";

import {
  addMoney,
  basisPointsSchema,
  isoDateSchema,
  money,
  moneySchema,
  multiplyMoneyByBasisPoints,
  serializeMoney,
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
