import {
  accountListSchema,
  accountSchema,
  categorizationRuleListSchema,
  categorizationRuleSchema,
  categoryListSchema,
  categorySchema,
  createCategorizationRuleSchema,
  createCategorySchema,
  csvImportResultSchema,
  csvMappingListSchema,
  csvMappingRecordSchema,
  csvPreviewSchema,
  healthResponseSchema,
  householdFactListSchema,
  householdFactSchema,
  householdListSchema,
  householdSchema,
  personListSchema,
  personSchema,
  type Household,
  type HouseholdFact,
  type Person,
  type Account,
  type CategorizationRule,
  type Category,
  type CreateAccount,
  type CsvImportResult,
  type CsvMapping,
  type CsvMappingRecord,
  type CsvPreview,
  type CsvPreviewRequest,
  transactionListSchema,
  transactionDetailsSchema,
  type Transaction,
  type TransactionDetails,
} from "@almanac-fi/api-contracts";

export type {
  Account,
  CategorizationRule,
  Category,
  CreateAccount,
  CsvImportResult,
  CsvMapping,
  CsvMappingRecord,
  CsvPreview,
  CsvPreviewRequest,
  Transaction,
  TransactionDetails,
  Household,
  HouseholdFact,
  Person,
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

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    throw new Error("The local API could not complete the request.");
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
