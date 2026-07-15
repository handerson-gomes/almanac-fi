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

export type TransferTransaction = Readonly<{
  accountId: string;
  amountMinor: number;
  currency: string;
  id: string;
  transactionDate: string;
}>;

export type TransferCandidate = Readonly<{
  confidence: number;
  inboundTransactionId: string;
  outboundTransactionId: string;
  reason: "ambiguous" | "exact" | "partial";
}>;

const transferWindowMs = 3 * 24 * 60 * 60 * 1_000;

/** Finds possible cross-account transfers without silently confirming them. */
export function detectTransferCandidates(
  transactions: readonly TransferTransaction[],
): readonly TransferCandidate[] {
  const possible = transactions.flatMap((outbound) => {
    if (outbound.amountMinor >= 0) return [];
    return transactions.flatMap((inbound) => {
      if (
        inbound.amountMinor <= 0 ||
        inbound.accountId === outbound.accountId ||
        inbound.currency !== outbound.currency
      ) {
        return [];
      }
      const dateDistance = Math.abs(
        Date.parse(inbound.transactionDate) -
          Date.parse(outbound.transactionDate),
      );
      if (!Number.isFinite(dateDistance) || dateDistance > transferWindowMs) {
        return [];
      }
      const difference = Math.abs(
        Math.abs(outbound.amountMinor) - inbound.amountMinor,
      );
      const tolerance = Math.max(
        100,
        Math.round(Math.abs(outbound.amountMinor) * 0.01),
      );
      if (difference > tolerance) return [];
      return [
        {
          confidence: difference === 0 ? 1 : 0.7,
          inboundTransactionId: inbound.id,
          outboundTransactionId: outbound.id,
          reason: difference === 0 ? ("exact" as const) : ("partial" as const),
        },
      ];
    });
  });

  const occurrenceCount = new Map<string, number>();
  for (const candidate of possible) {
    for (const id of [
      candidate.inboundTransactionId,
      candidate.outboundTransactionId,
    ]) {
      occurrenceCount.set(id, (occurrenceCount.get(id) ?? 0) + 1);
    }
  }
  return possible
    .map((candidate) =>
      (occurrenceCount.get(candidate.inboundTransactionId) ?? 0) > 1 ||
      (occurrenceCount.get(candidate.outboundTransactionId) ?? 0) > 1
        ? { ...candidate, confidence: 0.4, reason: "ambiguous" as const }
        : candidate,
    )
    .sort(
      (left, right) =>
        left.outboundTransactionId.localeCompare(right.outboundTransactionId) ||
        left.inboundTransactionId.localeCompare(right.inboundTransactionId),
    );
}

export function excludeConfirmedTransfers<T extends Readonly<{ id: string }>>(
  transactions: readonly T[],
  confirmedTransactionIds: ReadonlySet<string>,
): readonly T[] {
  return transactions.filter(
    (transaction) => !confirmedTransactionIds.has(transaction.id),
  );
}

export type CategorizationMethod =
  | "ai"
  | "confirmed_history"
  | "merchant_rule"
  | "statistical"
  | "source_category"
  | "user_rule";
export type CategorySuggestion = Readonly<{
  categoryId: string;
  confidence: number;
  method: CategorizationMethod;
  ruleId: string | null;
}>;
export type CategorizationLayers = Readonly<{
  ai?: CategorySuggestion | undefined;
  confirmedHistory?: CategorySuggestion | undefined;
  merchantRule?: CategorySuggestion | undefined;
  sourceCategory?: CategorySuggestion | undefined;
  statistical?: CategorySuggestion | undefined;
  userRule?: CategorySuggestion | undefined;
}>;

/** Normalizes statement noise while retaining a stable local merchant identity. */
export function normalizeMerchant(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replaceAll(/\b(?:pos|debit|purchase|card)\b/giu, " ")
    .replaceAll(/[#*]\d+|\b\d{4,}\b/gu, " ")
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim()
    .replaceAll(/\s+/gu, " ");
  return normalized || null;
}

export function selectCategorySuggestion(
  layers: CategorizationLayers,
  options: Readonly<{ enableAi?: boolean }> = {},
): CategorySuggestion | undefined {
  const ordered = [
    layers.sourceCategory,
    layers.userRule,
    layers.merchantRule,
    layers.confirmedHistory,
    layers.statistical,
    options.enableAi === true ? layers.ai : undefined,
  ];
  return ordered.find((suggestion) => suggestion !== undefined);
}

export type IncomeKind =
  "ambiguous" | "income" | "not_income" | "refund" | "transfer";
export type IncomeClassification = Readonly<{
  confidence: number;
  kind: IncomeKind;
  method: "account_context" | "category_rule" | "transfer_match";
  recurringGroup: string | null;
}>;

export function classifyIncome(
  input: Readonly<{
    accountType: string;
    amountMinor: number;
    categoryName?: string | null | undefined;
    isConfirmedTransfer: boolean;
    merchant?: string | null | undefined;
    payee?: string | null | undefined;
  }>,
): IncomeClassification {
  if (input.isConfirmedTransfer) {
    return {
      confidence: 1,
      kind: "transfer",
      method: "transfer_match",
      recurringGroup: null,
    };
  }
  if (input.amountMinor <= 0) {
    return {
      confidence: 1,
      kind: "not_income",
      method: "account_context",
      recurringGroup: null,
    };
  }
  const category = input.categoryName?.toLocaleLowerCase() ?? "";
  const recurringGroup = normalizeMerchant(
    input.payee ?? input.merchant ?? null,
  );
  if (/refund|reimbursement|cashback/u.test(category)) {
    return {
      confidence: 0.95,
      kind: "refund",
      method: "category_rule",
      recurringGroup: null,
    };
  }
  if (/salary|payroll|wages|income|interest|dividend/u.test(category)) {
    return {
      confidence: 0.95,
      kind: "income",
      method: "category_rule",
      recurringGroup,
    };
  }
  if (
    /(?:brokerage|_ira|_401k|_403b|_457b|pension|other_retirement|hsa|529)$/u.test(
      input.accountType,
    )
  ) {
    return {
      confidence: 0.8,
      kind: "not_income",
      method: "account_context",
      recurringGroup: null,
    };
  }
  return {
    confidence: 0.4,
    kind: "ambiguous",
    method: "account_context",
    recurringGroup,
  };
}

export const budgetCalculationVersion = "budget-v1" as const;
export type BudgetCalculationInput = Readonly<{
  currency: string;
  dateFrom: string;
  dateTo: string;
  lines: readonly Readonly<{ categoryId: string; targetAmountMinor: number }>[];
  transactions: readonly Readonly<{
    amountMinor: number;
    categoryId: string | null;
    id: string;
    isConfirmedTransfer: boolean;
    transactionDate: string;
  }>[];
}>;
export type BudgetCalculation = Readonly<{
  actualAmountMinor: number;
  calculationId: string;
  calculationVersion: typeof budgetCalculationVersion;
  currency: string;
  lines: readonly Readonly<{
    actualAmountMinor: number;
    categoryId: string;
    remainingAmountMinor: number;
    targetAmountMinor: number;
    varianceAmountMinor: number;
  }>[];
  remainingAmountMinor: number;
  targetAmountMinor: number;
  transferExcludedAmountMinor: number;
  uncategorizedAmountMinor: number;
  varianceAmountMinor: number;
}>;

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function calculateBudget(
  input: BudgetCalculationInput,
): BudgetCalculation {
  if (input.dateTo < input.dateFrom)
    throw new Error("Budget period end must not precede its start.");
  const relevant = input.transactions.filter(
    (transaction) =>
      transaction.transactionDate >= input.dateFrom &&
      transaction.transactionDate <= input.dateTo,
  );
  const excluded = relevant.filter(
    (transaction) => transaction.isConfirmedTransfer,
  );
  const spending = relevant.filter(
    (transaction) =>
      !transaction.isConfirmedTransfer && transaction.amountMinor < 0,
  );
  const lines = [...input.lines]
    .sort((left, right) => left.categoryId.localeCompare(right.categoryId))
    .map((line) => {
      const actualAmountMinor = -spending
        .filter((transaction) => transaction.categoryId === line.categoryId)
        .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
      return {
        actualAmountMinor,
        categoryId: line.categoryId,
        remainingAmountMinor: line.targetAmountMinor - actualAmountMinor,
        targetAmountMinor: line.targetAmountMinor,
        varianceAmountMinor: actualAmountMinor - line.targetAmountMinor,
      };
    });
  const targetAmountMinor = lines.reduce(
    (sum, line) => sum + line.targetAmountMinor,
    0,
  );
  const actualAmountMinor = lines.reduce(
    (sum, line) => sum + line.actualAmountMinor,
    0,
  );
  const normalized = JSON.stringify({
    ...input,
    lines: [...input.lines].sort((a, b) =>
      a.categoryId.localeCompare(b.categoryId),
    ),
    transactions: [...input.transactions].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  });
  return {
    actualAmountMinor,
    calculationId: `${budgetCalculationVersion}:${stableHash(normalized)}`,
    calculationVersion: budgetCalculationVersion,
    currency: input.currency,
    lines,
    remainingAmountMinor: targetAmountMinor - actualAmountMinor,
    targetAmountMinor,
    transferExcludedAmountMinor: excluded.reduce(
      (sum, transaction) => sum + Math.abs(transaction.amountMinor),
      0,
    ),
    uncategorizedAmountMinor: -spending
      .filter((transaction) => transaction.categoryId === null)
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0),
    varianceAmountMinor: actualAmountMinor - targetAmountMinor,
  };
}
