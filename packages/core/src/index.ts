import { z } from "zod";

declare const brand: unique symbol;
type Brand<Value, Name extends string> = Value & { readonly [brand]: Name };

export type MinorUnits = Brand<number, "MinorUnits">;
export type CurrencyCode = Brand<string, "CurrencyCode">;
export type IsoDate = Brand<string, "IsoDate">;
export type EntityId = Brand<string, "EntityId">;
export type BasisPoints = Brand<number, "BasisPoints">;

export const minorUnitsSchema = z
  .number()
  .int()
  .safe()
  .transform((value) => value as MinorUnits);
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO 4217 code")
  .transform((value) => value as CurrencyCode);
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)),
    "Date must be valid",
  )
  .transform((value) => value as IsoDate);
export const entityIdSchema = z.uuid().transform((value) => value as EntityId);
export const basisPointsSchema = z
  .number()
  .int()
  .min(-10_000)
  .max(10_000)
  .transform((value) => value as BasisPoints);

export const moneySchema = z
  .object({
    amount: minorUnitsSchema,
    currency: currencyCodeSchema,
  })
  .readonly();

export type Money = z.infer<typeof moneySchema>;

/** Account-balance convention: credits/income are positive; debits/expenses are negative. */
export const transactionAmountSchema = minorUnitsSchema;

export const TransactionSign = {
  credit: "positive",
  debit: "negative",
} as const;

export function money(amount: number, currency: string): Money {
  return moneySchema.parse({ amount, currency });
}

export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new Error(`Cannot add ${left.currency} and ${right.currency}`);
  }

  return money(left.amount + right.amount, left.currency);
}

/** Multiplies an integer-minor-unit amount by an integer basis-point rate, rounding half away from zero. */
export function multiplyMoneyByBasisPoints(
  value: Money,
  rate: BasisPoints,
): Money {
  const product = value.amount * rate;
  const rounded =
    product < 0
      ? -Math.round(Math.abs(product) / 10_000)
      : Math.round(product / 10_000);
  return money(rounded, value.currency);
}

export function serializeMoney(
  value: Money,
): Readonly<{ amount: number; currency: string }> {
  return { amount: value.amount, currency: value.currency };
}

export const corePackageName = "@almanac-fi/core" as const;
