import { randomUUID } from "node:crypto";

import type { AppDatabase } from "./index.js";
import { now } from "./index.js";

export type FundingBucket = Readonly<{
  budgetId: string | null;
  categoryId: string | null;
  createdAt: string;
  currency: string;
  currencyPolicy: "household_currency" | "destination_currency";
  destinationAccountId: string | null;
  destinationType:
    | "budget"
    | "goal"
    | "reserve"
    | "investment_contribution"
    | "unallocated_buffer";
  goalId: string | null;
  householdId: string;
  id: string;
  name: string;
  reserveName: string | null;
  updatedAt: string;
}>;
export type FundingAllocationRule = Readonly<{
  amountType: "fixed" | "percentage";
  bucketId: string;
  cadence:
    "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "annual";
  constraintLevel: "hard" | "minimum" | "preferred" | "flexible" | "residual";
  createdAt: string;
  currencyPolicy: "household_currency" | "destination_currency";
  effectiveFrom: string;
  effectiveTo: string | null;
  fixedAmountMinor: number | null;
  id: string;
  maximumAmountMinor: number | null;
  minimumAmountMinor: number | null;
  percentageBasis:
    "gross_income" | "expected_net_income" | "remaining_cash" | null;
  percentageBps: number | null;
  priority: number;
  sourceAccountId: string | null;
  updatedAt: string;
}>;

type Auditor = (
  input: Readonly<{
    actor: string;
    afterJson: string | null;
    beforeJson: string | null;
    entityId: string;
    entityType: string;
    operation: string;
  }>,
) => void;

export interface FundingRepository {
  createBucket(
    input: Omit<FundingBucket, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): FundingBucket;
  createRule(
    input: Omit<FundingAllocationRule, "createdAt" | "id" | "updatedAt">,
    actor?: string,
  ): FundingAllocationRule;
  listBuckets(householdId: string): readonly FundingBucket[];
  listRules(bucketId: string, asOf?: string): readonly FundingAllocationRule[];
}

function isInvestmentAccountType(accountType: string): boolean {
  return /^(taxable_brokerage|(?:traditional|roth|mixed)_(?:ira|sep_ira|simple_ira|401k|403b|457b)|pension|other_retirement)$/u.test(
    accountType,
  );
}

export function createFundingRepository(
  database: AppDatabase,
  audit: Auditor,
): FundingRepository {
  const bucketById = (id: string): FundingBucket | undefined =>
    database.sqlite
      .prepare(
        "SELECT id, household_id AS householdId, name, destination_type AS destinationType, currency, currency_policy AS currencyPolicy, budget_id AS budgetId, category_id AS categoryId, goal_id AS goalId, reserve_name AS reserveName, destination_account_id AS destinationAccountId, created_at AS createdAt, updated_at AS updatedAt FROM funding_buckets WHERE id = ?",
      )
      .get(id) as FundingBucket | undefined;
  const accountById = (
    id: string,
  ): { accountType: string; currency: string } | undefined =>
    database.sqlite
      .prepare(
        "SELECT account_type AS accountType, currency FROM accounts WHERE id = ?",
      )
      .get(id) as { accountType: string; currency: string } | undefined;
  const recordAudit = (
    entityType: string,
    actor: string,
    record: unknown,
    id: string,
  ): void =>
    audit({
      actor,
      afterJson: JSON.stringify(record),
      beforeJson: null,
      entityId: id,
      entityType,
      operation: "create",
    });
  const validateBucket = (
    input: Omit<FundingBucket, "createdAt" | "id" | "updatedAt">,
  ): void => {
    const household = database.sqlite
      .prepare("SELECT currency FROM households WHERE id = ?")
      .get(input.householdId) as { currency: string } | undefined;
    if (household === undefined) throw new Error("Household was not found.");
    if (
      input.currencyPolicy === "household_currency" &&
      input.currency !== household.currency
    ) {
      throw new Error(
        "Household-currency buckets must use the household currency.",
      );
    }
    if (input.destinationType === "budget" && input.budgetId === null) {
      throw new Error("Budget buckets require a budget destination.");
    }
    if (input.destinationType === "budget") {
      const budget = database.sqlite
        .prepare(
          "SELECT household_id AS householdId, currency FROM budgets WHERE id = ?",
        )
        .get(input.budgetId) as
        { currency: string; householdId: string | null } | undefined;
      if (
        budget === undefined ||
        (budget.householdId !== null &&
          budget.householdId !== input.householdId)
      ) {
        throw new Error("Budget destination must belong to the household.");
      }
      if (
        input.currencyPolicy === "destination_currency" &&
        budget.currency !== input.currency
      )
        throw new Error("Bucket currency must match the budget currency.");
      if (input.categoryId !== null) {
        const category = database.sqlite
          .prepare("SELECT id FROM categories WHERE id = ?")
          .get(input.categoryId);
        if (category === undefined)
          throw new Error("Budget category was not found.");
      }
    } else if (input.budgetId !== null || input.categoryId !== null) {
      throw new Error("Only budget buckets may reference a budget category.");
    }
    if (input.destinationType === "goal") {
      const goal = database.sqlite
        .prepare(
          "SELECT household_id AS householdId, currency FROM financial_goals WHERE id = ?",
        )
        .get(input.goalId) as
        { currency: string; householdId: string } | undefined;
      if (goal === undefined || goal.householdId !== input.householdId)
        throw new Error("Goal destination must belong to the household.");
      if (
        input.currencyPolicy === "destination_currency" &&
        goal.currency !== input.currency
      )
        throw new Error("Bucket currency must match the goal currency.");
    } else if (input.goalId !== null) {
      throw new Error("Only goal buckets may reference a goal.");
    }
    if (input.destinationType === "reserve") {
      if (input.reserveName === null)
        throw new Error("Reserve buckets require a reserve name.");
    } else if (input.reserveName !== null) {
      throw new Error("Only reserve buckets may name a reserve.");
    }
    if (input.destinationType === "investment_contribution") {
      const account =
        input.destinationAccountId === null
          ? undefined
          : accountById(input.destinationAccountId);
      if (
        account === undefined ||
        !isInvestmentAccountType(account.accountType)
      )
        throw new Error(
          "Investment contributions require an investment account.",
        );
      if (
        input.currencyPolicy === "destination_currency" &&
        account.currency !== input.currency
      )
        throw new Error(
          "Bucket currency must match the destination account currency.",
        );
    } else if (input.destinationAccountId !== null) {
      throw new Error(
        "Only investment buckets may have a destination account.",
      );
    }
    if (
      input.destinationType === "unallocated_buffer" &&
      (input.budgetId !== null ||
        input.categoryId !== null ||
        input.goalId !== null ||
        input.reserveName !== null ||
        input.destinationAccountId !== null)
    ) {
      throw new Error(
        "Unallocated buffers cannot reference another destination.",
      );
    }
  };
  const validateRule = (
    input: Omit<FundingAllocationRule, "createdAt" | "id" | "updatedAt">,
    bucket: FundingBucket,
  ): void => {
    if (input.effectiveTo !== null && input.effectiveTo <= input.effectiveFrom)
      throw new Error(
        "Allocation rule effective end must be after its start date.",
      );
    if (
      input.amountType === "fixed" &&
      (input.fixedAmountMinor === null ||
        input.percentageBps !== null ||
        input.percentageBasis !== null)
    ) {
      throw new Error("Fixed rules require only a fixed amount.");
    }
    if (
      input.amountType === "percentage" &&
      (input.fixedAmountMinor !== null ||
        input.percentageBps === null ||
        input.percentageBasis === null)
    ) {
      throw new Error(
        "Percentage rules require a percentage and declared basis.",
      );
    }
    if (
      input.minimumAmountMinor !== null &&
      input.maximumAmountMinor !== null &&
      input.minimumAmountMinor > input.maximumAmountMinor
    ) {
      throw new Error("Minimum amount cannot exceed maximum amount.");
    }
    if (
      input.constraintLevel === "residual" &&
      (input.amountType !== "percentage" ||
        input.percentageBasis !== "remaining_cash" ||
        input.percentageBps !== 10_000 ||
        input.minimumAmountMinor !== null ||
        input.maximumAmountMinor !== null)
    ) {
      throw new Error(
        "Residual rules allocate exactly 100% of remaining cash without bounds.",
      );
    }
    if (
      input.constraintLevel === "hard" &&
      (input.amountType !== "fixed" || input.maximumAmountMinor !== null)
    ) {
      throw new Error("Hard rules must be unbounded fixed obligations.");
    }
    if (input.currencyPolicy !== bucket.currencyPolicy)
      throw new Error(
        "Rule currency policy must match its destination bucket.",
      );
    if (input.sourceAccountId !== null) {
      const account = accountById(input.sourceAccountId);
      if (account === undefined)
        throw new Error("Source account was not found.");
      if (account.currency !== bucket.currency)
        throw new Error(
          "Source account currency must match the destination bucket.",
        );
    }
  };
  return {
    createBucket(input, actor = "user") {
      validateBucket(input);
      const timestamp = now();
      const record: FundingBucket = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO funding_buckets (id, household_id, name, destination_type, currency, currency_policy, budget_id, category_id, goal_id, reserve_name, destination_account_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.householdId,
          record.name,
          record.destinationType,
          record.currency,
          record.currencyPolicy,
          record.budgetId,
          record.categoryId,
          record.goalId,
          record.reserveName,
          record.destinationAccountId,
          timestamp,
          timestamp,
        );
      recordAudit("funding_bucket", actor, record, record.id);
      return record;
    },
    createRule(input, actor = "user") {
      const bucket = bucketById(input.bucketId);
      if (bucket === undefined)
        throw new Error("Funding bucket was not found.");
      validateRule(input, bucket);
      const overlap = database.sqlite
        .prepare(
          "SELECT id FROM funding_allocation_rules WHERE bucket_id = ? AND source_account_id IS ? AND effective_from < COALESCE(?, '9999-12-31') AND COALESCE(effective_to, '9999-12-31') > ? LIMIT 1",
        )
        .get(
          input.bucketId,
          input.sourceAccountId,
          input.effectiveTo,
          input.effectiveFrom,
        );
      if (overlap)
        throw new Error(
          "Allocation rule effective dates cannot overlap for the same bucket and source account.",
        );
      if (input.constraintLevel === "residual") {
        const residual = database.sqlite
          .prepare(
            "SELECT r.id FROM funding_allocation_rules r JOIN funding_buckets b ON b.id = r.bucket_id WHERE b.household_id = ? AND r.source_account_id IS ? AND r.constraint_level = 'residual' AND r.effective_from < COALESCE(?, '9999-12-31') AND COALESCE(r.effective_to, '9999-12-31') > ? LIMIT 1",
          )
          .get(
            bucket.householdId,
            input.sourceAccountId,
            input.effectiveTo,
            input.effectiveFrom,
          );
        if (residual)
          throw new Error(
            "Only one residual rule may apply to a household cash source at a time.",
          );
      }
      const timestamp = now();
      const record: FundingAllocationRule = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO funding_allocation_rules (id, bucket_id, amount_type, fixed_amount_minor, percentage_bps, percentage_basis, cadence, effective_from, effective_to, priority, constraint_level, minimum_amount_minor, maximum_amount_minor, currency_policy, source_account_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.bucketId,
          record.amountType,
          record.fixedAmountMinor,
          record.percentageBps,
          record.percentageBasis,
          record.cadence,
          record.effectiveFrom,
          record.effectiveTo,
          record.priority,
          record.constraintLevel,
          record.minimumAmountMinor,
          record.maximumAmountMinor,
          record.currencyPolicy,
          record.sourceAccountId,
          timestamp,
          timestamp,
        );
      recordAudit("funding_allocation_rule", actor, record, record.id);
      return record;
    },
    listBuckets(householdId) {
      return database.sqlite
        .prepare(
          "SELECT id, household_id AS householdId, name, destination_type AS destinationType, currency, currency_policy AS currencyPolicy, budget_id AS budgetId, category_id AS categoryId, goal_id AS goalId, reserve_name AS reserveName, destination_account_id AS destinationAccountId, created_at AS createdAt, updated_at AS updatedAt FROM funding_buckets WHERE household_id = ? ORDER BY destination_type, name, id",
        )
        .all(householdId) as FundingBucket[];
    },
    listRules(bucketId, asOf) {
      return database.sqlite
        .prepare(
          `SELECT id, bucket_id AS bucketId, amount_type AS amountType, fixed_amount_minor AS fixedAmountMinor, percentage_bps AS percentageBps, percentage_basis AS percentageBasis, cadence, effective_from AS effectiveFrom, effective_to AS effectiveTo, priority, constraint_level AS constraintLevel, minimum_amount_minor AS minimumAmountMinor, maximum_amount_minor AS maximumAmountMinor, currency_policy AS currencyPolicy, source_account_id AS sourceAccountId, created_at AS createdAt, updated_at AS updatedAt FROM funding_allocation_rules WHERE bucket_id = ? ${asOf === undefined ? "" : "AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)"} ORDER BY priority, effective_from, id`,
        )
        .all(
          ...(asOf === undefined ? [bucketId] : [bucketId, asOf, asOf]),
        ) as FundingAllocationRule[];
    },
  };
}
