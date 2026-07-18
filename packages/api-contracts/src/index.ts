import { z } from "zod";

export const requestIdSchema = z.string().uuid();
export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const entityIdSchema = z.uuid();
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO 4217 code");
export const accountTypeSchema = z.enum([
  "cash",
  "checking",
  "savings",
  "money_market",
  "certificate_of_deposit",
  "credit_card",
  "mortgage",
  "auto_loan",
  "student_loan",
  "personal_loan",
  "other_loan",
  "taxable_brokerage",
  "traditional_ira",
  "roth_ira",
  "traditional_sep_ira",
  "roth_sep_ira",
  "traditional_simple_ira",
  "roth_simple_ira",
  "traditional_401k",
  "roth_401k",
  "mixed_401k",
  "traditional_403b",
  "roth_403b",
  "mixed_403b",
  "traditional_457b",
  "roth_457b",
  "mixed_457b",
  "pension",
  "other_retirement",
  "hsa",
  "529",
  "other",
  "unclassified",
]);
export const accountStatusSchema = z.enum(["active", "closed", "hidden"]);
export const connectionStatusSchema = z.enum([
  "connected",
  "disconnected",
  "error",
  "needs_reauth",
]);
export const secretKeyReferenceSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,62}$/, "Secret keys use kebab-case");

const nullableString = z.string().nullable();
export const institutionSchema = z.object({
  createdAt: z.iso.datetime(),
  domain: nullableString,
  id: entityIdSchema,
  name: z.string().trim().min(1).max(200),
  websiteUrl: z.url().nullable(),
  updatedAt: z.iso.datetime(),
});
export const createInstitutionSchema = institutionSchema
  .pick({ domain: true, name: true, websiteUrl: true })
  .partial({ domain: true, websiteUrl: true });
export const updateInstitutionSchema = createInstitutionSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );

export const providerConnectionSchema = z.object({
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  provider: z.string().trim().min(1).max(100),
  providerNamespace: z.string().trim().min(1).max(500),
  secretKey: secretKeyReferenceSchema.nullable(),
  status: connectionStatusSchema,
  updatedAt: z.iso.datetime(),
});
export const createProviderConnectionSchema = providerConnectionSchema
  .pick({
    provider: true,
    providerNamespace: true,
    secretKey: true,
    status: true,
  })
  .partial({
    secretKey: true,
    status: true,
  })
  .extend({ status: connectionStatusSchema.default("connected") });
export const updateProviderConnectionSchema = createProviderConnectionSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );

export const externalInstitutionConnectionSchema = z.object({
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  institutionId: entityIdSchema,
  providerConnectionId: entityIdSchema,
  remoteConnectionId: z.string().trim().min(1).max(500),
  remoteName: z.string().trim().min(1).max(500),
  remoteOrganizationId: nullableString,
  remoteOrganizationUrl: z.url().nullable(),
  status: connectionStatusSchema,
  updatedAt: z.iso.datetime(),
});

export const accountSchema = z.object({
  accountType: accountTypeSchema,
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  externalConnectionId: entityIdSchema.nullable(),
  externalId: nullableString,
  id: entityIdSchema,
  institutionId: entityIdSchema,
  name: z.string().trim().min(1).max(200),
  status: accountStatusSchema,
  updatedAt: z.iso.datetime(),
});
export const createAccountSchema = accountSchema
  .pick({
    accountType: true,
    currency: true,
    externalConnectionId: true,
    externalId: true,
    institutionId: true,
    name: true,
    status: true,
  })
  .partial({ externalConnectionId: true, externalId: true, status: true })
  .extend({ status: accountStatusSchema.default("active") });
export const updateAccountSchema = createAccountSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );

export const accountBalanceSchema = z.object({
  accountId: entityIdSchema,
  amountMinor: z.number().int().safe(),
  asOf: z.iso.datetime(),
  availableAmountMinor: z.number().int().safe().nullable(),
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  isCurrent: z.boolean(),
  replacesBalanceId: entityIdSchema.nullable(),
});
export const createAccountBalanceSchema = accountBalanceSchema.pick({
  amountMinor: true,
  asOf: true,
  availableAmountMinor: true,
});
export const updateAccountBalanceSchema = createAccountBalanceSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );
export const accountListSchema = z.object({
  items: z.array(accountSchema),
  nextCursor: entityIdSchema.optional(),
});
export const institutionListSchema = z.object({
  items: z.array(institutionSchema),
  nextCursor: entityIdSchema.optional(),
});
export const providerConnectionListSchema = z.object({
  items: z.array(providerConnectionSchema),
  nextCursor: entityIdSchema.optional(),
});
export const externalInstitutionConnectionListSchema = z.object({
  items: z.array(externalInstitutionConnectionSchema),
  nextCursor: entityIdSchema.optional(),
});
export const accountBalanceListSchema = z.object({
  items: z.array(accountBalanceSchema),
  nextCursor: entityIdSchema.optional(),
});
export type Account = z.infer<typeof accountSchema>;
export type AccountBalance = z.infer<typeof accountBalanceSchema>;
export type CreateAccount = z.input<typeof createAccountSchema>;
export type Institution = z.infer<typeof institutionSchema>;
export type CreateInstitution = z.input<typeof createInstitutionSchema>;
export type ProviderConnection = z.infer<typeof providerConnectionSchema>;
export type ExternalInstitutionConnection = z.infer<
  typeof externalInstitutionConnectionSchema
>;

export const institutionMatchEvidenceSchema = z.object({
  institutionId: entityIdSchema,
  strategy: z.enum(["domain", "organization_id"]),
  value: z.string(),
});
export const accountImportReviewSchema = z.object({
  accountName: z.string().trim().min(1).max(200),
  accountType: accountTypeSchema,
  candidateInstitutionIds: z.array(entityIdSchema),
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  id: entityIdSchema,
  matchEvidence: z.array(institutionMatchEvidenceSchema),
  providerConnectionId: entityIdSchema,
  remoteAccountId: z.string().trim().min(1).max(500),
  remoteConnectionId: z.string().trim().min(1).max(500),
  remoteConnectionName: z.string().trim().min(1).max(500),
  remoteOrganizationId: nullableString,
  remoteOrganizationUrl: z.url().nullable(),
  resolvedInstitutionId: entityIdSchema.nullable(),
  status: z.enum(["pending", "resolved"]),
  updatedAt: z.iso.datetime(),
});
export const accountImportReviewListSchema = z.object({
  items: z.array(accountImportReviewSchema),
  nextCursor: entityIdSchema.optional(),
});
export const resolveAccountImportReviewSchema = z
  .object({ institutionId: entityIdSchema, accountType: accountTypeSchema })
  .refine(
    (value) => value.accountType !== "unclassified",
    "Select a specific account type",
  );
export type AccountImportReview = z.infer<typeof accountImportReviewSchema>;

export const categoryStatusSchema = z.enum(["active", "archived"]);
export const categorySchema = z.object({
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  name: z.string().trim().min(1).max(100),
  parentId: entityIdSchema.nullable(),
  status: categoryStatusSchema,
  updatedAt: z.iso.datetime(),
});
export const createCategorySchema = categorySchema
  .pick({ name: true, parentId: true, status: true })
  .partial({ parentId: true, status: true })
  .extend({ status: categoryStatusSchema.default("active") });
export const updateCategorySchema = createCategorySchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );
export const categoryListSchema = z.object({
  items: z.array(categorySchema),
  nextCursor: entityIdSchema.optional(),
});

export const categorizationMatchFieldSchema = z.enum([
  "merchant",
  "payee",
  "source_category",
]);
export const categorizationRuleSchema = z.object({
  active: z.boolean(),
  categoryId: entityIdSchema,
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  matchField: categorizationMatchFieldSchema,
  matchValue: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(100),
  precedence: z.number().int().min(0).max(10_000),
  updatedAt: z.iso.datetime(),
});
export const createCategorizationRuleSchema = categorizationRuleSchema
  .pick({
    active: true,
    categoryId: true,
    matchField: true,
    matchValue: true,
    name: true,
    precedence: true,
  })
  .partial({ active: true })
  .extend({ active: z.boolean().default(true) });
export const updateCategorizationRuleSchema = createCategorizationRuleSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );
export const categorizationRuleListSchema = z.object({
  items: z.array(categorizationRuleSchema),
  nextCursor: entityIdSchema.optional(),
});

export const transactionStatusSchema = z.enum(["pending", "posted"]);
export const transactionSplitSchema = z.object({
  amountMinor: z.number().int().safe(),
  categoryId: entityIdSchema.nullable(),
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  memo: z.string().max(500).nullable(),
  transactionId: entityIdSchema,
});
export const createTransactionSplitSchema = transactionSplitSchema.pick({
  amountMinor: true,
  categoryId: true,
  memo: true,
});
export const transactionSchema = z.object({
  accountId: entityIdSchema,
  amountMinor: z.number().int().safe(),
  categoryId: entityIdSchema.nullable(),
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  id: entityIdSchema,
  isCurrent: z.boolean(),
  merchant: z.string().max(500).nullable(),
  payee: z.string().max(500).nullable(),
  postedAt: z.iso.datetime().nullable(),
  replacesTransactionId: entityIdSchema.nullable(),
  sourceCategory: z.string().max(200).nullable(),
  sourceIdentity: z.string().min(1).max(500),
  sourceRecordId: entityIdSchema,
  status: transactionStatusSchema,
  transactionDate: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const transactionDetailsSchema = z.object({
  splits: z.array(transactionSplitSchema),
  transaction: transactionSchema,
});
export const transactionListSchema = z.object({
  items: z.array(transactionSchema),
  nextCursor: z.string().min(1).max(500).optional(),
});
export const transactionFilterSchema = z.object({
  accountId: entityIdSchema.optional(),
  categoryId: entityIdSchema.optional(),
  cursor: z.string().min(1).max(500).optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: transactionStatusSchema.optional(),
});
const manualTransactionFieldsSchema = z.object({
  accountId: entityIdSchema,
  amountMinor: z.number().int().safe(),
  categoryId: entityIdSchema.nullable().default(null),
  currency: currencySchema,
  merchant: z.string().trim().min(1).max(500).nullable().default(null),
  payee: z.string().trim().min(1).max(500).nullable().default(null),
  postedAt: z.iso.datetime().nullable().default(null),
  sourceCategory: z.string().trim().min(1).max(200).nullable().default(null),
  splits: z.array(createTransactionSplitSchema).default([]),
  status: transactionStatusSchema.default("posted"),
  transactionDate: z.iso.datetime(),
});
export const manualTransactionInputSchema =
  manualTransactionFieldsSchema.refine(
    (value) =>
      value.splits.length === 0 ||
      value.splits.reduce((sum, split) => sum + split.amountMinor, 0) ===
        value.amountMinor,
    "Transaction split totals must equal the parent transaction amount.",
  );
export const updateManualTransactionSchema = manualTransactionFieldsSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );
export type ManualTransactionInput = z.input<
  typeof manualTransactionInputSchema
>;

export const csvDateFormatSchema = z.enum([
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
]);
export const csvAmountSignSchema = z.enum(["debit-negative", "debit-positive"]);
export const csvMappingSchema = z.object({
  amountColumn: z.string().trim().min(1).max(100),
  amountSign: csvAmountSignSchema.default("debit-negative"),
  categoryColumn: z.string().trim().min(1).max(100).nullable().default(null),
  dateColumn: z.string().trim().min(1).max(100),
  dateFormat: csvDateFormatSchema.default("YYYY-MM-DD"),
  descriptionColumn: z.string().trim().min(1).max(100),
  payeeColumn: z.string().trim().min(1).max(100).nullable().default(null),
});
export const csvPreviewRequestSchema = z.object({
  accountId: entityIdSchema,
  content: z.string().min(1).max(2_000_000),
  currency: currencySchema,
  mapping: csvMappingSchema,
});
export const csvPreviewRowSchema = z.object({
  amountMinor: z.number().int().safe(),
  merchant: z.string(),
  row: z.number().int().positive(),
  sourceCategory: z.string().nullable(),
  transactionDate: z.iso.datetime(),
});
export const csvPreviewErrorSchema = z.object({
  message: z.string(),
  row: z.number().int().positive(),
});
export const csvPreviewSchema = z.object({
  errors: z.array(csvPreviewErrorSchema),
  rows: z.array(csvPreviewRowSchema),
  totalAmountMinor: z.number().int().safe(),
  valid: z.boolean(),
});
export const csvImportResultSchema = z.object({
  batchId: entityIdSchema,
  created: z.number().int().nonnegative(),
  corrected: z.number().int().nonnegative(),
  duplicate: z.number().int().nonnegative(),
  totalAmountMinor: z.number().int().safe(),
});
export const csvMappingRecordSchema = z.object({
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  mapping: csvMappingSchema,
  name: z.string().trim().min(1).max(100),
  updatedAt: z.iso.datetime(),
});
export const createCsvMappingRecordSchema = z.object({
  mapping: csvMappingSchema,
  name: z.string().trim().min(1).max(100),
});
export const csvMappingListSchema = z.object({
  items: z.array(csvMappingRecordSchema),
  nextCursor: entityIdSchema.optional(),
});
export type Category = z.infer<typeof categorySchema>;
export type CategorizationRule = z.infer<typeof categorizationRuleSchema>;
export type CsvMapping = z.infer<typeof csvMappingSchema>;
export type CsvPreviewRequest = z.input<typeof csvPreviewRequestSchema>;
export type CsvPreview = z.infer<typeof csvPreviewSchema>;
export type CsvImportResult = z.infer<typeof csvImportResultSchema>;
export type CsvMappingRecord = z.infer<typeof csvMappingRecordSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionDetails = z.infer<typeof transactionDetailsSchema>;

export const transferMatchStatusSchema = z.enum([
  "candidate",
  "confirmed",
  "rejected",
]);
export const transferMatchSchema = z.object({
  confidence: z.number().min(0).max(1),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  decidedBy: z.string().nullable(),
  id: entityIdSchema,
  inboundTransactionId: entityIdSchema,
  outboundTransactionId: entityIdSchema,
  reason: z.enum(["ambiguous", "exact", "partial"]),
  status: transferMatchStatusSchema,
  updatedAt: z.iso.datetime(),
});
export const transferMatchListSchema = z.object({
  items: z.array(transferMatchSchema),
});
export const transferMatchDecisionSchema = z.object({
  actor: z.string().trim().min(1).max(100).default("user"),
  decision: z.enum(["confirm", "reject", "unmatch"]),
});
export const transferReportingSummarySchema = z.object({
  excludedTransactionIds: z.array(entityIdSchema),
});
export type TransferMatch = z.infer<typeof transferMatchSchema>;

export const categorizationMethodSchema = z.enum([
  "ai",
  "confirmed_history",
  "merchant_rule",
  "statistical",
  "source_category",
  "user_rule",
]);
export const categorizationReviewStatusSchema = z.enum([
  "pending",
  "confirmed",
  "dismissed",
]);
export const categorizationReviewSchema = z.object({
  confidence: z.number().min(0).max(1).nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  confirmedBy: z.string().nullable(),
  confirmedCategoryId: entityIdSchema.nullable(),
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  method: categorizationMethodSchema.nullable(),
  normalizedMerchant: z.string().nullable(),
  ruleId: entityIdSchema.nullable(),
  status: categorizationReviewStatusSchema,
  suggestedCategoryId: entityIdSchema.nullable(),
  transactionId: entityIdSchema,
  updatedAt: z.iso.datetime(),
});
export const categorizationReviewListSchema = z.object({
  items: z.array(categorizationReviewSchema),
});
export const categorizationSuggestionRequestSchema = z
  .object({
    aiCategoryId: entityIdSchema.optional(),
    enableAi: z.boolean().default(false),
    transactionId: entityIdSchema,
  })
  .refine(
    (value) => value.enableAi || value.aiCategoryId === undefined,
    "AI must be explicitly enabled",
  );
export const categorizationBatchRequestSchema = z.object({
  actor: z.string().trim().min(1).max(100).default("user"),
  categoryId: entityIdSchema.optional(),
  createMerchantRule: z.boolean().default(false),
  decision: z.enum(["confirm", "dismiss"]),
  ids: z.array(entityIdSchema).min(1).max(100),
});

export const incomeKindSchema = z.enum([
  "ambiguous",
  "income",
  "not_income",
  "refund",
  "transfer",
]);
export const incomeClassificationStatusSchema = z.enum([
  "confirmed",
  "inferred",
  "pending",
]);
export const incomeClassificationSchema = z.object({
  confidence: z.number().min(0).max(1),
  confirmedAt: z.iso.datetime().nullable(),
  confirmedBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  kind: incomeKindSchema,
  method: z.enum([
    "account_context",
    "category_rule",
    "transfer_match",
    "user_confirmation",
  ]),
  recurringGroup: z.string().nullable(),
  status: incomeClassificationStatusSchema,
  transactionId: entityIdSchema,
  updatedAt: z.iso.datetime(),
});
export const incomeClassificationListSchema = z.object({
  items: z.array(incomeClassificationSchema),
});
export const incomeConfirmationSchema = z.object({
  actor: z.string().trim().min(1).max(100).default("user"),
  kind: incomeKindSchema,
});
export const incomeSummarySchema = z.object({
  incomeAmountMinor: z.number().int().safe(),
  recurringGroups: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
});

export const householdSchema = z.object({
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  id: entityIdSchema,
  name: z.string().trim().min(1).max(200),
  updatedAt: z.iso.datetime(),
});
export const createHouseholdSchema = householdSchema.pick({
  currency: true,
  name: true,
});
export const updateHouseholdSchema = createHouseholdSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );
export const householdListSchema = z.object({
  items: z.array(householdSchema),
});
export const personSchema = z.object({
  birthDate: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
  dependent: z.boolean(),
  dependentUntil: z.iso.date().nullable(),
  householdId: entityIdSchema,
  id: entityIdSchema,
  name: z.string().trim().min(1).max(200),
  relationship: z.string().trim().min(1).max(100),
  updatedAt: z.iso.datetime(),
});
export const createPersonSchema = personSchema
  .pick({
    birthDate: true,
    dependent: true,
    dependentUntil: true,
    name: true,
    relationship: true,
  })
  .partial({ birthDate: true, dependentUntil: true })
  .extend({
    birthDate: z.iso.date().nullable().default(null),
    dependent: z.boolean().default(false),
    dependentUntil: z.iso.date().nullable().default(null),
  });
export const personListSchema = z.object({ items: z.array(personSchema) });
export const householdFactSchema = z.object({
  confidence: z.number().min(0).max(1),
  createdAt: z.iso.datetime(),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
  factKey: z.string().trim().min(1).max(100),
  householdId: entityIdSchema,
  id: entityIdSchema,
  personId: entityIdSchema.nullable(),
  sensitivity: z.enum(["sensitive", "standard"]),
  source: z.string().trim().min(1).max(200),
  updatedAt: z.iso.datetime(),
  value: z.union([z.boolean(), z.number(), z.string()]),
  valueType: z.enum(["boolean", "date", "number", "string"]),
  verifiedAt: z.iso.datetime().nullable(),
  verifiedBy: z.string().nullable(),
});
export const createHouseholdFactSchema = householdFactSchema
  .pick({
    confidence: true,
    effectiveFrom: true,
    effectiveTo: true,
    factKey: true,
    personId: true,
    sensitivity: true,
    source: true,
    value: true,
    valueType: true,
    verifiedAt: true,
    verifiedBy: true,
  })
  .partial({
    effectiveTo: true,
    personId: true,
    sensitivity: true,
    verifiedAt: true,
    verifiedBy: true,
  })
  .extend({
    effectiveTo: z.iso.date().nullable().default(null),
    personId: entityIdSchema.nullable().default(null),
    sensitivity: z.enum(["sensitive", "standard"]).default("standard"),
    verifiedAt: z.iso.datetime().nullable().default(null),
    verifiedBy: z.string().nullable().default(null),
  });
export const householdFactListSchema = z.object({
  items: z.array(householdFactSchema),
});
export const householdAsOfQuerySchema = z.object({
  asOf: z.iso.date().optional(),
});
export type Household = z.infer<typeof householdSchema>;
export type Person = z.infer<typeof personSchema>;
export type HouseholdFact = z.infer<typeof householdFactSchema>;
export type CreateHouseholdFact = z.input<typeof createHouseholdFactSchema>;

export const incomeSourceKindSchema = z.enum([
  "w2",
  "contractor",
  "self_employment",
  "bonus",
  "investment",
  "other",
]);
export const incomeScheduleBehaviorSchema = z.enum(["fixed", "variable"]);
export const incomeCadenceSchema = z.enum([
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "quarterly",
  "annual",
]);
export const incomeSourceSchema = z.object({
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  kind: incomeSourceKindSchema,
  name: z.string().trim().min(1).max(200),
  personId: entityIdSchema,
  updatedAt: z.iso.datetime(),
});
export const createIncomeSourceSchema = incomeSourceSchema.pick({
  kind: true,
  name: true,
  personId: true,
});
export const incomeSourceListSchema = z.object({
  items: z.array(incomeSourceSchema),
});
export const incomeScheduleSchema = z.object({
  annualGrowthBps: z.number().int().min(-10_000).max(100_000),
  behavior: incomeScheduleBehaviorSchema,
  cadence: incomeCadenceSchema,
  confidence: z.number().min(0).max(1),
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  deductionAmountMinor: z.number().int().nonnegative().nullable(),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
  expectedNetAmountMinor: z.number().int().nonnegative().nullable(),
  grossAmountMinor: z.number().int().nonnegative(),
  grossIncomeBasis: z.literal("gross"),
  highGrossAmountMinor: z.number().int().nonnegative().nullable(),
  id: entityIdSchema,
  lowGrossAmountMinor: z.number().int().nonnegative().nullable(),
  personId: entityIdSchema,
  source: z.string().trim().min(1).max(200),
  sourceId: entityIdSchema,
  updatedAt: z.iso.datetime(),
  verifiedAt: z.iso.datetime().nullable(),
  verifiedBy: z.string().trim().min(1).max(200).nullable(),
  withholdingRateBps: z.number().int().min(0).max(10_000).nullable(),
});
const incomeScheduleInputFields = {
  annualGrowthBps: true,
  behavior: true,
  cadence: true,
  confidence: true,
  currency: true,
  deductionAmountMinor: true,
  effectiveFrom: true,
  effectiveTo: true,
  expectedNetAmountMinor: true,
  grossAmountMinor: true,
  grossIncomeBasis: true,
  highGrossAmountMinor: true,
  lowGrossAmountMinor: true,
  source: true,
  verifiedAt: true,
  verifiedBy: true,
  withholdingRateBps: true,
} as const;
const incomeScheduleInputSchema = incomeScheduleSchema
  .pick(incomeScheduleInputFields)
  .partial({
    deductionAmountMinor: true,
    effectiveTo: true,
    expectedNetAmountMinor: true,
    highGrossAmountMinor: true,
    lowGrossAmountMinor: true,
    verifiedAt: true,
    verifiedBy: true,
    withholdingRateBps: true,
  })
  .extend({
    annualGrowthBps: z.number().int().min(-10_000).max(100_000).default(0),
    deductionAmountMinor: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .default(null),
    effectiveTo: z.iso.date().nullable().default(null),
    expectedNetAmountMinor: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .default(null),
    grossIncomeBasis: z.literal("gross").default("gross"),
    highGrossAmountMinor: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .default(null),
    lowGrossAmountMinor: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .default(null),
    verifiedAt: z.iso.datetime().nullable().default(null),
    verifiedBy: z.string().trim().min(1).max(200).nullable().default(null),
    withholdingRateBps: z
      .number()
      .int()
      .min(0)
      .max(10_000)
      .nullable()
      .default(null),
  });
export const createIncomeScheduleSchema = incomeScheduleInputSchema.superRefine(
  (value, context) => {
    if (
      value.effectiveTo !== null &&
      value.effectiveTo <= value.effectiveFrom
    ) {
      context.addIssue({
        code: "custom",
        message: "Effective end must be after the start date.",
      });
    }
    const hasDerivedNet =
      value.withholdingRateBps !== null || value.deductionAmountMinor !== null;
    if (value.behavior === "variable") {
      if (
        value.lowGrossAmountMinor === null ||
        value.highGrossAmountMinor === null
      ) {
        context.addIssue({
          code: "custom",
          message: "Variable income requires low and high gross amounts.",
        });
      }
      if (value.expectedNetAmountMinor !== null) {
        context.addIssue({
          code: "custom",
          message:
            "Variable income must use withholding or deduction assumptions so all bounds can be derived.",
        });
      }
    } else if (
      value.lowGrossAmountMinor !== null ||
      value.highGrossAmountMinor !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "Fixed income cannot include variability bounds.",
      });
    }
    if (value.expectedNetAmountMinor === null && !hasDerivedNet) return;
  },
);
export const updateIncomeScheduleSchema = incomeScheduleInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  );
export const incomeScheduleListSchema = z.object({
  items: z.array(incomeScheduleSchema),
});
export const incomeForecastQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(600).default(60),
  startMonth: z.iso.date(),
});
export const incomeForecastOccurrenceSchema = z.object({
  currency: currencySchema,
  expectedGrossAmountMinor: z.number().int().safe(),
  expectedNetAmountMinor: z.number().int().safe().nullable(),
  highGrossAmountMinor: z.number().int().safe(),
  highNetAmountMinor: z.number().int().safe().nullable(),
  lowGrossAmountMinor: z.number().int().safe(),
  lowNetAmountMinor: z.number().int().safe().nullable(),
  month: z.iso.date(),
  personId: entityIdSchema,
  scheduleId: entityIdSchema,
  sourceId: entityIdSchema,
  warnings: z.array(z.string()),
});
export const incomeForecastAnnualTotalSchema = z.object({
  currency: currencySchema,
  expectedNetAmountMinor: z.number().int().safe().nullable(),
  highNetAmountMinor: z.number().int().safe().nullable(),
  lowNetAmountMinor: z.number().int().safe().nullable(),
  year: z.number().int(),
});
export const incomeForecastSchema = z.object({
  annual: z.array(incomeForecastAnnualTotalSchema),
  monthly: z.array(incomeForecastOccurrenceSchema),
});
export const incomeForecastRunSchema = z.object({
  createdAt: z.iso.datetime(),
  dataAsOf: z.iso.date(),
  householdId: entityIdSchema,
  id: entityIdSchema,
  inputVersion: z.string().regex(/^[a-f0-9]{64}$/),
  months: z.number().int().min(1).max(600),
  startMonth: z.iso.date(),
});
export const createIncomeForecastRunSchema = z.object({
  dataAsOf: z.iso.date(),
  months: z.number().int().min(1).max(60).default(60),
  startMonth: z.iso.date(),
});
export const incomeForecastRowSchema = z.object({
  currency: currencySchema,
  expectedGrossAmountMinor: z.number().int().safe(),
  expectedNetAmountMinor: z.number().int().safe().nullable(),
  highGrossAmountMinor: z.number().int().safe(),
  highNetAmountMinor: z.number().int().safe().nullable(),
  id: entityIdSchema,
  lowGrossAmountMinor: z.number().int().safe(),
  lowNetAmountMinor: z.number().int().safe().nullable(),
  month: z.iso.date(),
  personId: entityIdSchema,
  runId: entityIdSchema,
  scheduleId: entityIdSchema,
  sourceId: entityIdSchema,
  warnings: z.array(z.string()),
});
export const incomeReconciliationMatchSchema = z.object({
  confidence: z.number().min(0).max(1),
  createdAt: z.iso.datetime(),
  dataAsOf: z.iso.date(),
  expectedGrossAmountMinor: z.number().int().safe().nullable(),
  expectedNetAmountMinor: z.number().int().safe().nullable(),
  forecastRowId: entityIdSchema.nullable(),
  id: entityIdSchema,
  inputVersion: z.string().regex(/^[a-f0-9]{64}$/),
  matchMethod: z.enum([
    "inferred",
    "unmatched_expected",
    "unexplained_deposit",
    "user_confirmed",
  ]),
  observedNetAmountMinor: z.number().int().safe().nullable(),
  reviewState: z.enum(["matched", "needs_review", "confirmed", "unexplained"]),
  runId: entityIdSchema,
  transactionIds: z.array(entityIdSchema),
  updatedAt: z.iso.datetime(),
  varianceMinor: z.number().int().safe().nullable(),
});
export const incomeForecastRunResultSchema = z.object({
  matches: z.array(incomeReconciliationMatchSchema),
  rows: z.array(incomeForecastRowSchema),
  run: incomeForecastRunSchema,
});
export const incomeForecastHorizonQuerySchema = z.object({
  horizon: z
    .enum(["next_month", "six_month", "one_year", "five_year"])
    .optional(),
});
export const confirmIncomeReconciliationMatchSchema = z.object({
  actor: z.string().trim().min(1).max(100).default("user"),
  transactionIds: z.array(entityIdSchema).min(1),
});
export type IncomeSource = z.infer<typeof incomeSourceSchema>;
export type IncomeSchedule = z.infer<typeof incomeScheduleSchema>;

export const financialGoalSchema = z.object({
  accountId: entityIdSchema.nullable(),
  constraintLevel: z.enum(["hard", "soft"]),
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  dependentId: entityIdSchema.nullable(),
  fundingStrategy: z.enum(["cash", "investments", "mixed"]),
  householdId: entityIdSchema,
  id: entityIdSchema,
  name: z.string().trim().min(1).max(200),
  priorityTier: z.enum(["aspirational", "essential", "important"]),
  status: z.enum(["active", "completed", "paused"]),
  targetAmountMinor: z.number().int().nonnegative(),
  targetDate: z.iso.date(),
  updatedAt: z.iso.datetime(),
});
export const createFinancialGoalSchema = financialGoalSchema
  .pick({
    accountId: true,
    constraintLevel: true,
    currency: true,
    dependentId: true,
    fundingStrategy: true,
    name: true,
    priorityTier: true,
    status: true,
    targetAmountMinor: true,
    targetDate: true,
  })
  .partial({ accountId: true, dependentId: true, status: true })
  .extend({
    accountId: entityIdSchema.nullable().default(null),
    dependentId: entityIdSchema.nullable().default(null),
    status: z.enum(["active", "completed", "paused"]).default("active"),
  })
  .refine(
    (goal) =>
      !(
        goal.priorityTier === "aspirational" && goal.constraintLevel === "hard"
      ),
    "Aspirational goals cannot be hard constraints",
  );
export const financialGoalListSchema = z.object({
  items: z.array(financialGoalSchema),
});
export const scenarioAssumptionSchema = z.object({
  assumptionKey: z.string().trim().min(1).max(100),
  confidence: z.number().min(0).max(1),
  createdAt: z.iso.datetime(),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
  householdId: entityIdSchema,
  id: entityIdSchema,
  source: z.string().trim().min(1).max(200),
  updatedAt: z.iso.datetime(),
  value: z.union([z.boolean(), z.number(), z.string()]),
});
export const createScenarioAssumptionSchema = scenarioAssumptionSchema
  .pick({
    assumptionKey: true,
    confidence: true,
    effectiveFrom: true,
    effectiveTo: true,
    source: true,
    value: true,
  })
  .partial({ effectiveTo: true })
  .extend({ effectiveTo: z.iso.date().nullable().default(null) });
export const scenarioAssumptionListSchema = z.object({
  items: z.array(scenarioAssumptionSchema),
});
export type FinancialGoal = z.infer<typeof financialGoalSchema>;
export type ScenarioAssumption = z.infer<typeof scenarioAssumptionSchema>;

export const securitySchema = z.object({
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  id: entityIdSchema,
  name: z.string().min(1),
  securityType: z.enum(["cash", "etf", "fund", "other", "stock"]),
  symbol: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export const createSecuritySchema = securitySchema
  .pick({ currency: true, name: true, securityType: true, symbol: true })
  .partial({ symbol: true })
  .extend({ symbol: z.string().nullable().default(null) });
export const securityListSchema = z.object({ items: z.array(securitySchema) });
export const holdingSchema = z.object({
  accountId: entityIdSchema,
  asOf: z.iso.datetime(),
  costBasisMinor: z.number().int().nonnegative().nullable(),
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  marketValueMinor: z.number().int().nonnegative().nullable(),
  priceMinor: z.number().int().nonnegative().nullable(),
  quantity: z.number().nonnegative().nullable(),
  securityId: entityIdSchema,
  source: z.string().min(1),
  sourceRecordId: entityIdSchema.nullable(),
  updatedAt: z.iso.datetime(),
});
export const createHoldingSchema = holdingSchema
  .pick({
    accountId: true,
    asOf: true,
    costBasisMinor: true,
    marketValueMinor: true,
    priceMinor: true,
    quantity: true,
    securityId: true,
    source: true,
    sourceRecordId: true,
  })
  .partial({
    costBasisMinor: true,
    marketValueMinor: true,
    priceMinor: true,
    quantity: true,
    sourceRecordId: true,
  })
  .extend({
    costBasisMinor: z.number().int().nonnegative().nullable().default(null),
    marketValueMinor: z.number().int().nonnegative().nullable().default(null),
    priceMinor: z.number().int().nonnegative().nullable().default(null),
    quantity: z.number().nonnegative().nullable().default(null),
    sourceRecordId: entityIdSchema.nullable().default(null),
  });
export const updateHoldingSchema = createHoldingSchema
  .pick({
    asOf: true,
    costBasisMinor: true,
    marketValueMinor: true,
    priceMinor: true,
    quantity: true,
  })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide a field to update",
  );
export const holdingListSchema = z.object({ items: z.array(holdingSchema) });
export const investmentTransactionSchema = z.object({
  accountId: entityIdSchema,
  cashAmountMinor: z.number().int().nullable(),
  costBasisMinor: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  priceMinor: z.number().int().nonnegative().nullable(),
  quantity: z.number().nullable(),
  securityId: entityIdSchema.nullable(),
  source: z.string().min(1),
  sourceRecordId: entityIdSchema.nullable(),
  transactionDate: z.iso.datetime(),
  transactionType: z.enum([
    "buy",
    "contribution",
    "dividend",
    "fee",
    "sell",
    "withdrawal",
  ]),
});
export const createInvestmentTransactionSchema = investmentTransactionSchema
  .omit({ createdAt: true, id: true })
  .partial({
    cashAmountMinor: true,
    costBasisMinor: true,
    priceMinor: true,
    quantity: true,
    securityId: true,
    sourceRecordId: true,
  })
  .extend({
    cashAmountMinor: z.number().int().nullable().default(null),
    costBasisMinor: z.number().int().nullable().default(null),
    priceMinor: z.number().int().nonnegative().nullable().default(null),
    quantity: z.number().nullable().default(null),
    securityId: entityIdSchema.nullable().default(null),
    sourceRecordId: entityIdSchema.nullable().default(null),
  });
export const investmentTransactionListSchema = z.object({
  items: z.array(investmentTransactionSchema),
});
export const investmentValuationSchema = z.object({
  asOf: z.iso.datetime().nullable(),
  missing: z.array(z.object({ holdingId: entityIdSchema, reason: z.string() })),
  totalValueMinor: z.number().int().safe(),
});

export const liabilitySchema = z.object({
  accountId: entityIdSchema.nullable(),
  confidence: z.number().min(0).max(1),
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  householdId: entityIdSchema,
  id: entityIdSchema,
  name: z.string().min(1),
  source: z.string().min(1),
  updatedAt: z.iso.datetime(),
});
export const createLiabilitySchema = liabilitySchema
  .pick({
    accountId: true,
    confidence: true,
    currency: true,
    name: true,
    source: true,
  })
  .partial({ accountId: true })
  .extend({ accountId: entityIdSchema.nullable().default(null) });
export const liabilityListSchema = z.object({
  items: z.array(liabilitySchema),
});
export const liabilityTermsSchema = z.object({
  annualRateBps: z.number().int().nonnegative().nullable(),
  balanceMinor: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
  id: entityIdSchema,
  liabilityId: entityIdSchema,
  minimumPaymentMinor: z.number().int().nonnegative(),
  paymentDay: z.number().int().min(1).max(31).nullable(),
});
export const createLiabilityTermsSchema = liabilityTermsSchema
  .omit({ createdAt: true, id: true, liabilityId: true })
  .partial({ annualRateBps: true, effectiveTo: true, paymentDay: true })
  .extend({
    annualRateBps: z.number().int().nonnegative().nullable().default(null),
    effectiveTo: z.iso.date().nullable().default(null),
    paymentDay: z.number().int().min(1).max(31).nullable().default(null),
  });
export const recurringObligationSchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  cadence: z.enum(["annual", "monthly", "weekly"]),
  confidence: z.number().min(0).max(1),
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
  householdId: entityIdSchema,
  id: entityIdSchema,
  liabilityId: entityIdSchema.nullable(),
  name: z.string().min(1),
  paymentDay: z.number().int().min(1).max(31).nullable(),
  source: z.string().min(1),
  updatedAt: z.iso.datetime(),
});
export const createRecurringObligationSchema = recurringObligationSchema
  .omit({ createdAt: true, householdId: true, id: true, updatedAt: true })
  .partial({ effectiveTo: true, liabilityId: true, paymentDay: true })
  .extend({
    effectiveTo: z.iso.date().nullable().default(null),
    liabilityId: entityIdSchema.nullable().default(null),
    paymentDay: z.number().int().min(1).max(31).nullable().default(null),
  });
export const recurringObligationListSchema = z.object({
  items: z.array(recurringObligationSchema),
});
export const fundingDestinationTypeSchema = z.enum([
  "budget",
  "goal",
  "reserve",
  "investment_contribution",
  "unallocated_buffer",
]);
export const fundingCurrencyPolicySchema = z.enum([
  "household_currency",
  "destination_currency",
]);
export const allocationAmountTypeSchema = z.enum(["fixed", "percentage"]);
export const allocationPercentageBasisSchema = z.enum([
  "gross_income",
  "expected_net_income",
  "remaining_cash",
]);
export const allocationCadenceSchema = z.enum([
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "quarterly",
  "annual",
]);
export const allocationConstraintLevelSchema = z.enum([
  "hard",
  "minimum",
  "preferred",
  "flexible",
  "residual",
]);
export const fundingBucketSchema = z.object({
  budgetId: entityIdSchema.nullable(),
  categoryId: entityIdSchema.nullable(),
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  currencyPolicy: fundingCurrencyPolicySchema,
  destinationAccountId: entityIdSchema.nullable(),
  destinationType: fundingDestinationTypeSchema,
  goalId: entityIdSchema.nullable(),
  householdId: entityIdSchema,
  id: entityIdSchema,
  name: z.string().trim().min(1).max(200),
  reserveName: z.string().trim().min(1).max(200).nullable(),
  updatedAt: z.iso.datetime(),
});
export const createFundingBucketSchema = fundingBucketSchema
  .pick({
    budgetId: true,
    categoryId: true,
    currency: true,
    currencyPolicy: true,
    destinationAccountId: true,
    destinationType: true,
    goalId: true,
    name: true,
    reserveName: true,
  })
  .partial({
    budgetId: true,
    categoryId: true,
    destinationAccountId: true,
    goalId: true,
    reserveName: true,
  })
  .extend({
    budgetId: entityIdSchema.nullable().default(null),
    categoryId: entityIdSchema.nullable().default(null),
    currencyPolicy: fundingCurrencyPolicySchema.default("household_currency"),
    destinationAccountId: entityIdSchema.nullable().default(null),
    goalId: entityIdSchema.nullable().default(null),
    reserveName: z.string().trim().min(1).max(200).nullable().default(null),
  });
export const fundingBucketListSchema = z.object({
  items: z.array(fundingBucketSchema),
});
export const fundingAllocationRuleSchema = z.object({
  amountType: allocationAmountTypeSchema,
  bucketId: entityIdSchema,
  cadence: allocationCadenceSchema,
  constraintLevel: allocationConstraintLevelSchema,
  createdAt: z.iso.datetime(),
  currencyPolicy: fundingCurrencyPolicySchema,
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
  fixedAmountMinor: z.number().int().nonnegative().nullable(),
  id: entityIdSchema,
  maximumAmountMinor: z.number().int().nonnegative().nullable(),
  minimumAmountMinor: z.number().int().nonnegative().nullable(),
  percentageBasis: allocationPercentageBasisSchema.nullable(),
  percentageBps: z.number().int().min(1).max(10_000).nullable(),
  priority: z.number().int().min(0).max(10_000),
  sourceAccountId: entityIdSchema.nullable(),
  updatedAt: z.iso.datetime(),
});
const fundingAllocationRuleInputSchema = fundingAllocationRuleSchema
  .omit({ bucketId: true, createdAt: true, id: true, updatedAt: true })
  .partial({
    effectiveTo: true,
    fixedAmountMinor: true,
    maximumAmountMinor: true,
    minimumAmountMinor: true,
    percentageBasis: true,
    percentageBps: true,
    sourceAccountId: true,
  })
  .extend({
    effectiveTo: z.iso.date().nullable().default(null),
    fixedAmountMinor: z.number().int().nonnegative().nullable().default(null),
    maximumAmountMinor: z.number().int().nonnegative().nullable().default(null),
    minimumAmountMinor: z.number().int().nonnegative().nullable().default(null),
    percentageBasis: allocationPercentageBasisSchema.nullable().default(null),
    percentageBps: z.number().int().min(1).max(10_000).nullable().default(null),
    sourceAccountId: entityIdSchema.nullable().default(null),
  });
export const createFundingAllocationRuleSchema =
  fundingAllocationRuleInputSchema.superRefine((value, context) => {
    if (
      value.effectiveTo !== null &&
      value.effectiveTo <= value.effectiveFrom
    ) {
      context.addIssue({
        code: "custom",
        message: "Effective end must be after the start date.",
      });
    }
    if (
      value.amountType === "fixed" &&
      (value.fixedAmountMinor === null ||
        value.percentageBps !== null ||
        value.percentageBasis !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Fixed rules require only a fixed amount.",
      });
    }
    if (
      value.amountType === "percentage" &&
      (value.fixedAmountMinor !== null ||
        value.percentageBps === null ||
        value.percentageBasis === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Percentage rules require a percentage and declared basis.",
      });
    }
    if (
      value.minimumAmountMinor !== null &&
      value.maximumAmountMinor !== null &&
      value.minimumAmountMinor > value.maximumAmountMinor
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum amount cannot exceed maximum amount.",
      });
    }
    if (
      value.constraintLevel === "residual" &&
      (value.amountType !== "percentage" ||
        value.percentageBasis !== "remaining_cash" ||
        value.percentageBps !== 10_000 ||
        value.minimumAmountMinor !== null ||
        value.maximumAmountMinor !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Residual rules must allocate 100% of remaining cash without bounds.",
      });
    }
    if (
      value.constraintLevel === "hard" &&
      (value.amountType !== "fixed" || value.maximumAmountMinor !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Hard rules must be unbounded fixed obligations.",
      });
    }
  });
export const fundingAllocationRuleListSchema = z.object({
  items: z.array(fundingAllocationRuleSchema),
});
export const allocationLedgerRunSchema = z.object({
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  dataAsOf: z.iso.date(),
  householdId: entityIdSchema,
  id: entityIdSchema,
  incomeForecastRunId: entityIdSchema,
  inputVersion: z.string().regex(/^[a-f0-9]{64}$/),
  openingAsOf: z.iso.datetime(),
});
export const createAllocationLedgerRunSchema = z.object({
  currency: currencySchema,
  incomeForecastRunId: entityIdSchema,
  openingAsOf: z.iso.datetime(),
});
export const allocationLedgerMonthSchema = z.object({
  allocationAllocatedMinor: z.number().int().safe(),
  allocationRequestedMinor: z.number().int().safe(),
  closingBalanceMinor: z.number().int().safe(),
  createdAt: z.iso.datetime(),
  dataAsOf: z.iso.date(),
  expectedNetIncomeMinor: z.number().int().safe(),
  grossIncomeMinor: z.number().int().safe(),
  id: entityIdSchema,
  inputVersion: z.string().regex(/^[a-f0-9]{64}$/),
  ledgerRunId: entityIdSchema,
  missingIncomeCount: z.number().int().nonnegative(),
  month: z.iso.date(),
  obligationAllocatedMinor: z.number().int().safe(),
  obligationRequestedMinor: z.number().int().safe(),
  openingBalanceMinor: z.number().int().safe(),
  shortfallMinor: z.number().int().nonnegative(),
  surplusMinor: z.number().int().nonnegative(),
});
export const allocationLedgerEntrySchema = z.object({
  allocatedAmountMinor: z.number().int().safe(),
  allocationBasis: allocationPercentageBasisSchema.nullable(),
  closingBalanceMinor: z.number().int().safe(),
  constraintLevel: allocationConstraintLevelSchema.nullable(),
  createdAt: z.iso.datetime(),
  dataAsOf: z.iso.date(),
  destinationId: z.string().nullable(),
  destinationType: z.string().nullable(),
  entryType: z.enum([
    "income",
    "obligation",
    "allocation",
    "shortfall",
    "closing_balance",
  ]),
  expectedNetAmountMinor: z.number().int().safe().nullable(),
  fundingStatus: z.enum([
    "funded",
    "partial",
    "unfunded",
    "surplus",
    "shortfall",
    "missing_input",
  ]),
  grossAmountMinor: z.number().int().safe().nullable(),
  id: entityIdSchema,
  inputVersion: z.string().regex(/^[a-f0-9]{64}$/),
  ledgerMonthId: entityIdSchema,
  openingBalanceMinor: z.number().int().safe(),
  priority: z.number().int().nullable(),
  requestedAmountMinor: z.number().int().safe(),
  sourceId: z.string().nullable(),
  sourceRuleId: entityIdSchema.nullable(),
});
export const allocationLedgerResultSchema = z.object({
  entries: z.array(allocationLedgerEntrySchema),
  months: z.array(allocationLedgerMonthSchema),
  run: allocationLedgerRunSchema,
});
export const allocationLedgerHorizonQuerySchema = z.object({
  horizon: z
    .enum(["next_month", "six_month", "one_year", "five_year"])
    .optional(),
});
export const forecastObligationListSchema = z.object({
  items: z.array(
    z.object({
      amountMinor: z.number().int().nonnegative(),
      currency: currencySchema,
      id: entityIdSchema,
      kind: z.enum(["debt_payment", "recurring"]),
      name: z.string(),
    }),
  ),
});
export const liabilityScenarioOverrideSchema = z.object({
  scenarioId: z.string().min(1),
  terms: z.record(z.string(), z.number().nullable()),
});

export const budgetCalculationRequestSchema = z.object({
  currency: currencySchema,
  dateFrom: z.iso.datetime(),
  dateTo: z.iso.datetime(),
  lines: z.array(
    z.object({
      categoryId: entityIdSchema,
      targetAmountMinor: z.number().int().nonnegative(),
    }),
  ),
  transactions: z.array(
    z.object({
      amountMinor: z.number().int().safe(),
      categoryId: entityIdSchema.nullable(),
      id: entityIdSchema,
      isConfirmedTransfer: z.boolean(),
      transactionDate: z.iso.datetime(),
    }),
  ),
});
export const budgetCalculationSchema = z.object({
  actualAmountMinor: z.number().int().nonnegative(),
  calculationId: z.string().startsWith("budget-v1:"),
  calculationVersion: z.literal("budget-v1"),
  currency: currencySchema,
  lines: z.array(
    z.object({
      actualAmountMinor: z.number().int().nonnegative(),
      categoryId: entityIdSchema,
      remainingAmountMinor: z.number().int().safe(),
      targetAmountMinor: z.number().int().nonnegative(),
      varianceAmountMinor: z.number().int().safe(),
    }),
  ),
  remainingAmountMinor: z.number().int().safe(),
  targetAmountMinor: z.number().int().nonnegative(),
  transferExcludedAmountMinor: z.number().int().nonnegative(),
  uncategorizedAmountMinor: z.number().int().nonnegative(),
  varianceAmountMinor: z.number().int().safe(),
});
export type BudgetCalculation = z.infer<typeof budgetCalculationSchema>;

export const financialStateQuerySchema = z.object({
  asOf: z.iso.datetime().optional(),
  currency: currencySchema.default("USD"),
});
export const financialStateWarningSchema = z.object({
  code: z.enum(["missing_balance", "missing_valuation", "stale_balance"]),
  entityId: entityIdSchema,
  message: z.string(),
});
export const financialStateSchema = z.object({
  accountIds: z.array(entityIdSchema),
  activity: z.object({
    confirmedTransferCount: z.number().int().nonnegative(),
    currentTransactionCount: z.number().int().nonnegative(),
    inflowMinor: z.number().int().safe(),
    outflowMinor: z.number().int().safe(),
  }),
  asOf: z.iso.datetime(),
  availableBalanceMinor: z.number().int().safe(),
  budgetActuals: z.array(
    z.object({
      actualAmountMinor: z.number().int().safe(),
      periodId: entityIdSchema,
    }),
  ),
  calculationVersion: z.literal("financial-state-v1"),
  currency: currencySchema,
  currentBalanceMinor: z.number().int().safe(),
  investmentValueMinor: z.number().int().safe(),
  liabilityBalanceMinor: z.number().int().safe(),
  netWorthMinor: z.number().int().safe(),
  spendableFundsMinor: z.number().int().safe(),
  warnings: z.array(financialStateWarningSchema),
});
export type FinancialState = z.infer<typeof financialStateSchema>;

export const budgetSchema = z.object({
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  householdId: entityIdSchema.nullable(),
  id: entityIdSchema,
  name: z.string().min(1),
  status: z.enum(["active", "archived"]),
  updatedAt: z.iso.datetime(),
});
export const createBudgetSchema = budgetSchema
  .pick({ currency: true, householdId: true, name: true, status: true })
  .partial({ householdId: true, status: true })
  .extend({
    householdId: entityIdSchema.nullable().default(null),
    status: z.enum(["active", "archived"]).default("active"),
  });
export const budgetListSchema = z.object({ items: z.array(budgetSchema) });
export const budgetPeriodSchema = z.object({
  budgetId: entityIdSchema,
  createdAt: z.iso.datetime(),
  dateFrom: z.iso.datetime(),
  dateTo: z.iso.datetime(),
  id: entityIdSchema,
  status: z.enum(["active", "draft"]),
  updatedAt: z.iso.datetime(),
});
export const createBudgetPeriodSchema = budgetPeriodSchema
  .pick({ dateFrom: true, dateTo: true, status: true })
  .partial({ status: true })
  .extend({ status: z.enum(["active", "draft"]).default("draft") });
export const budgetPeriodListSchema = z.object({
  items: z.array(budgetPeriodSchema),
});
export const budgetLineSchema = z.object({
  categoryId: entityIdSchema,
  createdAt: z.iso.datetime(),
  id: entityIdSchema,
  periodId: entityIdSchema,
  targetAmountMinor: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
});
export const setBudgetLineSchema = budgetLineSchema.pick({
  categoryId: true,
  targetAmountMinor: true,
});
export const budgetPeriodDetailsSchema = z.object({
  budget: budgetSchema,
  lines: z.array(budgetLineSchema),
  period: budgetPeriodSchema,
});
export const budgetDrilldownQuerySchema = z.object({
  categoryId: entityIdSchema.optional(),
  kind: z.enum(["category", "transfer", "uncategorized"]).default("category"),
});
export type Budget = z.infer<typeof budgetSchema>;
export type BudgetPeriod = z.infer<typeof budgetPeriodSchema>;

export const problemSchema = z.object({
  detail: z.string(),
  instance: z.string().optional(),
  requestId: requestIdSchema,
  status: z.number().int().min(400).max(599),
  title: z.string(),
  type: z.string().url(),
});

export type Problem = z.infer<typeof problemSchema>;

export function problem(
  input: Omit<Problem, "requestId"> & { requestId: string },
): Problem {
  return problemSchema.parse(input);
}

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const readinessResponseSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
});

export const openApiDocument = Object.freeze({
  info: { title: "Almanac FI API", version: "0.0.0" },
  openapi: "3.1.0",
  paths: {
    "/financial-state": {
      get: {
        operationId: "getFinancialState",
        responses: { "200": { description: "Authoritative financial state" } },
      },
    },
    "/accounts": {
      get: {
        operationId: "listAccounts",
        responses: { "200": { description: "Accounts" } },
      },
      post: {
        operationId: "createAccount",
        responses: { "201": { description: "Account created" } },
      },
    },
    "/accounts/{id}": {
      delete: {
        operationId: "deleteAccount",
        responses: { "204": { description: "Account deleted" } },
      },
      get: {
        operationId: "getAccount",
        responses: { "200": { description: "Account" } },
      },
      patch: {
        operationId: "updateAccount",
        responses: { "200": { description: "Account updated" } },
      },
    },
    "/accounts/{id}/balances": {
      get: {
        operationId: "listAccountBalances",
        responses: { "200": { description: "Account balance history" } },
      },
      post: {
        operationId: "createAccountBalance",
        responses: { "201": { description: "Balance recorded" } },
      },
    },
    "/households/{id}/income-sources": {
      get: {
        operationId: "listIncomeSources",
        responses: { "200": { description: "Income sources for a household" } },
      },
      post: {
        operationId: "createIncomeSource",
        responses: { "201": { description: "Income source created" } },
      },
    },
    "/income-sources/{id}/schedules": {
      get: {
        operationId: "listIncomeSchedules",
        responses: {
          "200": { description: "Effective-dated income schedules" },
        },
      },
      post: {
        operationId: "createIncomeSchedule",
        responses: { "201": { description: "Income schedule created" } },
      },
    },
    "/income-schedules/{id}": {
      patch: {
        operationId: "updateIncomeSchedule",
        responses: { "200": { description: "Income schedule updated" } },
      },
    },
    "/households/{id}/income-forecast": {
      get: {
        operationId: "getIncomeForecast",
        responses: {
          "200": { description: "Monthly occurrences with annual rollups" },
        },
      },
    },
    "/households/{id}/income-forecast-runs": {
      post: {
        operationId: "createIncomeForecastRun",
        responses: {
          "201": {
            description: "Immutable income forecast and reconciliation",
          },
        },
      },
    },
    "/income-forecast-runs/{id}": {
      get: {
        operationId: "getIncomeForecastRun",
        responses: {
          "200": { description: "Income forecast rows for a selected horizon" },
        },
      },
    },
    "/income-reconciliation-matches/{id}/confirm": {
      post: {
        operationId: "confirmIncomeReconciliationMatch",
        responses: { "200": { description: "User-confirmed income match" } },
      },
    },
    "/households/{id}/funding-buckets": {
      get: {
        operationId: "listFundingBuckets",
        responses: { "200": { description: "Typed funding destinations" } },
      },
      post: {
        operationId: "createFundingBucket",
        responses: { "201": { description: "Funding destination created" } },
      },
    },
    "/funding-buckets/{id}/rules": {
      get: {
        operationId: "listFundingAllocationRules",
        responses: {
          "200": { description: "Effective-dated allocation rules" },
        },
      },
      post: {
        operationId: "createFundingAllocationRule",
        responses: { "201": { description: "Allocation rule created" } },
      },
    },
    "/households/{id}/allocation-ledger-runs": {
      post: {
        operationId: "createAllocationLedgerRun",
        responses: {
          "201": {
            description: "Immutable monthly cash-flow allocation ledger",
          },
        },
      },
    },
    "/allocation-ledger-runs/{id}": {
      get: {
        operationId: "getAllocationLedgerRun",
        responses: {
          "200": { description: "Allocation ledger for a horizon" },
        },
      },
    },
    "/institutions": {
      get: {
        operationId: "listInstitutions",
        responses: { "200": { description: "Institutions" } },
      },
      post: {
        operationId: "createInstitution",
        responses: { "201": { description: "Institution created" } },
      },
    },
    "/institutions/{id}": {
      delete: {
        operationId: "deleteInstitution",
        responses: {
          "204": { description: "Institution deleted" },
          "409": { description: "Institution still owns accounts" },
        },
      },
      get: {
        operationId: "getInstitution",
        responses: { "200": { description: "Institution" } },
      },
      patch: {
        operationId: "updateInstitution",
        responses: { "200": { description: "Institution updated" } },
      },
    },
    "/provider-connections": {
      get: {
        operationId: "listProviderConnections",
        responses: { "200": { description: "Provider connections" } },
      },
      post: {
        operationId: "createProviderConnection",
        responses: { "201": { description: "Provider connection created" } },
      },
    },
    "/provider-connections/{id}": {
      delete: {
        operationId: "revokeProviderConnection",
        responses: { "204": { description: "Credentials revoked" } },
      },
      get: {
        operationId: "getProviderConnection",
        responses: { "200": { description: "Provider connection" } },
      },
      patch: {
        operationId: "updateProviderConnection",
        responses: { "200": { description: "Provider connection updated" } },
      },
    },
    "/external-institution-connections": {
      get: {
        operationId: "listExternalInstitutionConnections",
        responses: {
          "200": { description: "External institution connections" },
        },
      },
    },
    "/account-import-reviews": {
      get: {
        operationId: "listAccountImportReviews",
        responses: { "200": { description: "Pending import reviews" } },
      },
    },
    "/account-import-reviews/{id}/resolve": {
      post: {
        operationId: "resolveAccountImportReview",
        responses: { "200": { description: "Import review resolved" } },
      },
    },
    "/health": {
      get: {
        operationId: "getHealth",
        responses: { "200": { description: "Server is alive" } },
      },
    },
  },
});
