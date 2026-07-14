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
  "credit_card",
  "investment",
  "loan",
  "other",
  "savings",
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
export const institutionConnectionSchema = z.object({
  createdAt: z.iso.datetime(),
  externalId: nullableString,
  id: entityIdSchema,
  institutionName: z.string().trim().min(1).max(200),
  institutionUrl: z.url().nullable(),
  provider: z.string().trim().min(1).max(100),
  secretKey: secretKeyReferenceSchema.nullable(),
  status: connectionStatusSchema,
  updatedAt: z.iso.datetime(),
});
export const createInstitutionConnectionSchema = institutionConnectionSchema
  .pick({
    externalId: true,
    institutionName: true,
    institutionUrl: true,
    provider: true,
    secretKey: true,
    status: true,
  })
  .partial({
    externalId: true,
    institutionUrl: true,
    secretKey: true,
    status: true,
  })
  .extend({ status: connectionStatusSchema.default("connected") });
export const updateInstitutionConnectionSchema =
  createInstitutionConnectionSchema
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      "Provide at least one field to update",
    );

export const accountSchema = z.object({
  accountType: accountTypeSchema,
  connectionId: entityIdSchema.nullable(),
  createdAt: z.iso.datetime(),
  currency: currencySchema,
  externalId: nullableString,
  id: entityIdSchema,
  name: z.string().trim().min(1).max(200),
  status: accountStatusSchema,
  updatedAt: z.iso.datetime(),
});
export const createAccountSchema = accountSchema
  .pick({
    accountType: true,
    connectionId: true,
    currency: true,
    externalId: true,
    name: true,
    status: true,
  })
  .partial({ connectionId: true, externalId: true, status: true })
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
});
export const createAccountBalanceSchema = accountBalanceSchema.pick({
  amountMinor: true,
  asOf: true,
  availableAmountMinor: true,
});
export const accountListSchema = z.object({
  items: z.array(accountSchema),
  nextCursor: entityIdSchema.optional(),
});
export const institutionConnectionListSchema = z.object({
  items: z.array(institutionConnectionSchema),
  nextCursor: entityIdSchema.optional(),
});
export const accountBalanceListSchema = z.object({
  items: z.array(accountBalanceSchema),
  nextCursor: entityIdSchema.optional(),
});
export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.input<typeof createAccountSchema>;

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
    "/institution-connections": {
      get: {
        operationId: "listInstitutionConnections",
        responses: { "200": { description: "Institution connections" } },
      },
      post: {
        operationId: "createInstitutionConnection",
        responses: { "201": { description: "Connection created" } },
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
