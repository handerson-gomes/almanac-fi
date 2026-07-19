import {
  accountListSchema,
  accountBalanceSchema,
  accountImportReviewListSchema,
  accountImportReviewSchema,
  accountSchema,
  budgetCalculationSchema,
  budgetListSchema,
  budgetPeriodListSchema,
  categorizationRuleListSchema,
  categorizationRuleSchema,
  categoryListSchema,
  categorySchema,
  createCategorizationRuleSchema,
  createCategorySchema,
  externalInstitutionConnectionListSchema,
  csvImportResultSchema,
  csvMappingListSchema,
  csvMappingRecordSchema,
  csvPreviewSchema,
  healthResponseSchema,
  institutionListSchema,
  institutionSchema,
  householdFactListSchema,
  householdFactSchema,
  householdListSchema,
  householdSchema,
  financialGoalListSchema,
  financialGoalSchema,
  financialStateSchema,
  planningDashboardSchema,
  scenarioAssumptionListSchema,
  scenarioAssumptionSchema,
  type FinancialGoal,
  type FinancialState,
  type PlanningDashboard,
  type ScenarioAssumption,
  personListSchema,
  personSchema,
  type Household,
  type HouseholdFact,
  type Person,
  type Account,
  type AccountBalance,
  type AccountImportReview,
  type Budget,
  type BudgetCalculation,
  type BudgetPeriod,
  type CategorizationRule,
  type Category,
  type CreateAccount,
  type CreateInstitution,
  type CsvImportResult,
  type CsvMapping,
  type CsvMappingRecord,
  type CsvPreview,
  type CsvPreviewRequest,
  type ExternalInstitutionConnection,
  type Institution,
  type ProviderConnection,
  providerConnectionListSchema,
  providerConnectionSchema,
  type SimpleFinConnectRequest,
  transactionListSchema,
  transactionDetailsSchema,
  manualTransactionInputSchema,
  type ManualTransactionInput,
  type Transaction,
  type TransactionDetails,
} from "@almanac-fi/api-contracts";

export type {
  Account,
  AccountBalance,
  AccountImportReview,
  Budget,
  BudgetCalculation,
  BudgetPeriod,
  CategorizationRule,
  Category,
  CreateAccount,
  CreateInstitution,
  CsvImportResult,
  CsvMapping,
  CsvMappingRecord,
  CsvPreview,
  CsvPreviewRequest,
  ExternalInstitutionConnection,
  Institution,
  ProviderConnection,
  Transaction,
  TransactionDetails,
  ManualTransactionInput,
  Household,
  HouseholdFact,
  Person,
  FinancialGoal,
  FinancialState,
  PlanningDashboard,
  ScenarioAssumption,
};

export type TransactionPage = Readonly<{
  items: readonly Transaction[];
  nextCursor?: string | undefined;
}>;

export async function getHealth(): Promise<"ok"> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error("The local API is unavailable.");
  }

  return healthResponseSchema.parse(await response.json()).status;
}

export async function getFinancialState(
  currency = "USD",
): Promise<FinancialState> {
  return financialStateSchema.parse(
    await requestJson(`/api/financial-state?currency=${currency}`),
  );
}

export async function getPlanningDashboard(
  householdId: string,
  input: Readonly<{
    currency: string;
    periodStart: string;
    scenarioId?: string;
  }>,
): Promise<PlanningDashboard> {
  const query = new URLSearchParams({
    currency: input.currency,
    periodStart: input.periodStart,
  });
  if (input.scenarioId) query.set("scenarioId", input.scenarioId);
  return planningDashboardSchema.parse(
    await requestJson(
      `/api/households/${householdId}/planning-dashboard?${query}`,
    ),
  );
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      { detail?: unknown } | undefined;
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : "The local API could not complete the request.",
    );
  }
  return response.json();
}

export async function getAccounts(): Promise<readonly Account[]> {
  return accountListSchema.parse(await requestJson("/api/accounts")).items;
}

export async function createAccount(input: CreateAccount): Promise<Account> {
  return accountSchema.parse(
    await requestJson("/api/accounts", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function createAccountBalance(
  accountId: string,
  input: Readonly<{
    amountMinor: number;
    asOf: string;
    availableAmountMinor: number | null;
  }>,
): Promise<AccountBalance> {
  return accountBalanceSchema.parse(
    await requestJson(`/api/accounts/${accountId}/balances`, {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function getInstitutions(): Promise<readonly Institution[]> {
  return institutionListSchema.parse(await requestJson("/api/institutions"))
    .items;
}

export async function createInstitution(
  input: CreateInstitution,
): Promise<Institution> {
  return institutionSchema.parse(
    await requestJson("/api/institutions", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function deleteInstitution(id: string): Promise<void> {
  const response = await fetch(`/api/institutions/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = (await response.json()) as { detail?: string };
    throw new Error(body.detail ?? "The institution could not be deleted.");
  }
}

export async function updateInstitution(
  id: string,
  input: Partial<CreateInstitution>,
): Promise<Institution> {
  return institutionSchema.parse(
    await requestJson(`/api/institutions/${id}`, {
      body: JSON.stringify(input),
      method: "PATCH",
    }),
  );
}

export async function getProviderConnections(): Promise<
  readonly ProviderConnection[]
> {
  return providerConnectionListSchema.parse(
    await requestJson("/api/provider-connections"),
  ).items;
}

export async function connectSimpleFin(
  input: SimpleFinConnectRequest = {},
): Promise<ProviderConnection> {
  return providerConnectionSchema.parse(
    await requestJson("/api/simplefin/connections", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function getExternalInstitutionConnections(): Promise<
  readonly ExternalInstitutionConnection[]
> {
  return externalInstitutionConnectionListSchema.parse(
    await requestJson("/api/external-institution-connections"),
  ).items;
}

export async function revokeProviderConnection(id: string): Promise<void> {
  const response = await fetch(`/api/provider-connections/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("The connection could not be revoked.");
}

export async function getAccountImportReviews(): Promise<
  readonly AccountImportReview[]
> {
  return accountImportReviewListSchema.parse(
    await requestJson("/api/account-import-reviews"),
  ).items;
}

export async function resolveAccountImportReview(
  id: string,
  input: Readonly<{
    accountType: Account["accountType"];
    institutionId: string;
  }>,
): Promise<AccountImportReview> {
  return accountImportReviewSchema.parse(
    await requestJson(`/api/account-import-reviews/${id}/resolve`, {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function previewCsvImport(
  input: CsvPreviewRequest,
): Promise<CsvPreview> {
  return csvPreviewSchema.parse(
    await requestJson("/api/csv-imports/preview", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function commitCsvImport(
  input: CsvPreviewRequest,
): Promise<CsvImportResult> {
  return csvImportResultSchema.parse(
    await requestJson("/api/csv-imports/commit", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function getCsvMappings(): Promise<readonly CsvMappingRecord[]> {
  return csvMappingListSchema.parse(await requestJson("/api/csv-mappings"))
    .items;
}

export async function createCsvMapping(
  input: Readonly<{ mapping: CsvMapping; name: string }>,
): Promise<CsvMappingRecord> {
  return csvMappingRecordSchema.parse(
    await requestJson("/api/csv-mappings", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function updateCsvMapping(
  id: string,
  input: Readonly<{ mapping: CsvMapping; name: string }>,
): Promise<CsvMappingRecord> {
  return csvMappingRecordSchema.parse(
    await requestJson(`/api/csv-mappings/${id}`, {
      body: JSON.stringify(input),
      method: "PATCH",
    }),
  );
}

export async function getTransactions(
  cursor?: string,
): Promise<TransactionPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return transactionListSchema.parse(
    await requestJson(`/api/transactions${query}`),
  );
}

export async function getTransaction(id: string): Promise<TransactionDetails> {
  return transactionDetailsSchema.parse(
    await requestJson(`/api/transactions/${id}`),
  );
}

export async function createManualTransaction(
  input: ManualTransactionInput,
): Promise<TransactionDetails> {
  return transactionDetailsSchema.parse(
    await requestJson("/api/transactions", {
      body: JSON.stringify(manualTransactionInputSchema.parse(input)),
      method: "POST",
    }),
  );
}

export async function getCategories(): Promise<readonly Category[]> {
  return categoryListSchema.parse(await requestJson("/api/categories")).items;
}

export async function createCategory(name: string): Promise<Category> {
  return categorySchema.parse(
    await requestJson("/api/categories", {
      body: JSON.stringify(createCategorySchema.parse({ name })),
      method: "POST",
    }),
  );
}

export async function getCategorizationRules(): Promise<
  readonly CategorizationRule[]
> {
  return categorizationRuleListSchema.parse(
    await requestJson("/api/categorization-rules"),
  ).items;
}

export async function createCategorizationRule(
  input: Readonly<{
    categoryId: string;
    matchValue: string;
    name: string;
    precedence: number;
  }>,
): Promise<CategorizationRule> {
  return categorizationRuleSchema.parse(
    await requestJson("/api/categorization-rules", {
      body: JSON.stringify(
        createCategorizationRuleSchema.parse({
          ...input,
          matchField: "merchant",
        }),
      ),
      method: "POST",
    }),
  );
}

export async function getHouseholds(): Promise<readonly Household[]> {
  return householdListSchema.parse(await requestJson("/api/households")).items;
}
export async function createHousehold(
  input: Readonly<{ currency: string; name: string }>,
): Promise<Household> {
  return householdSchema.parse(
    await requestJson("/api/households", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}
export async function getPeople(
  householdId: string,
): Promise<readonly Person[]> {
  return personListSchema.parse(
    await requestJson(`/api/households/${householdId}/people`),
  ).items;
}
export async function createPerson(
  householdId: string,
  input: Readonly<{ dependent: boolean; name: string; relationship: string }>,
): Promise<Person> {
  return personSchema.parse(
    await requestJson(`/api/households/${householdId}/people`, {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}
export async function getHouseholdFacts(
  householdId: string,
  asOf?: string,
): Promise<readonly HouseholdFact[]> {
  const query = asOf ? `?asOf=${encodeURIComponent(asOf)}` : "";
  return householdFactListSchema.parse(
    await requestJson(`/api/households/${householdId}/facts${query}`),
  ).items;
}
export async function createHouseholdFact(
  householdId: string,
  input: Readonly<{
    confidence: number;
    effectiveFrom: string;
    factKey: string;
    sensitivity: "sensitive" | "standard";
    source: string;
    value: string;
    valueType: "string";
  }>,
): Promise<HouseholdFact> {
  return householdFactSchema.parse(
    await requestJson(`/api/households/${householdId}/facts`, {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function getFinancialGoals(
  householdId: string,
): Promise<readonly FinancialGoal[]> {
  return financialGoalListSchema.parse(
    await requestJson(`/api/households/${householdId}/goals`),
  ).items;
}
export async function createFinancialGoal(
  householdId: string,
  input: Readonly<{
    constraintLevel: "hard" | "soft";
    currency: string;
    fundingStrategy: "cash" | "investments" | "mixed";
    name: string;
    priorityTier: "aspirational" | "essential" | "important";
    targetAmountMinor: number;
    targetDate: string;
  }>,
): Promise<FinancialGoal> {
  return financialGoalSchema.parse(
    await requestJson(`/api/households/${householdId}/goals`, {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}
export async function getScenarioAssumptions(
  householdId: string,
): Promise<readonly ScenarioAssumption[]> {
  return scenarioAssumptionListSchema.parse(
    await requestJson(`/api/households/${householdId}/assumptions`),
  ).items;
}
export async function createScenarioAssumption(
  householdId: string,
  input: Readonly<{
    assumptionKey: string;
    confidence: number;
    effectiveFrom: string;
    source: string;
    value: string;
  }>,
): Promise<ScenarioAssumption> {
  return scenarioAssumptionSchema.parse(
    await requestJson(`/api/households/${householdId}/assumptions`, {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function getBudgets(): Promise<readonly Budget[]> {
  return budgetListSchema.parse(await requestJson("/api/budgets")).items;
}
export async function getBudgetPeriods(
  budgetId: string,
): Promise<readonly BudgetPeriod[]> {
  return budgetPeriodListSchema.parse(
    await requestJson(`/api/budgets/${budgetId}/periods`),
  ).items;
}
export async function getBudgetAnalysis(
  periodId: string,
): Promise<BudgetCalculation> {
  return budgetCalculationSchema.parse(
    await requestJson(`/api/budget-periods/${periodId}/analysis`),
  );
}
export async function getBudgetDrilldown(
  periodId: string,
  input: Readonly<{
    categoryId?: string;
    kind: "category" | "transfer" | "uncategorized";
  }>,
): Promise<readonly Transaction[]> {
  const search = new URLSearchParams({ kind: input.kind });
  if (input.categoryId) search.set("categoryId", input.categoryId);
  return transactionListSchema.parse(
    await requestJson(`/api/budget-periods/${periodId}/transactions?${search}`),
  ).items;
}
