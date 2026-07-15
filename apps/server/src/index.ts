import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import {
  databasePath,
  ensureDataHome,
  loadConfig,
  type AppConfig,
} from "@almanac-fi/config";
import {
  accountBalanceListSchema,
  accountBalanceSchema,
  accountImportReviewListSchema,
  accountImportReviewSchema,
  accountListSchema,
  accountSchema,
  budgetCalculationRequestSchema,
  budgetCalculationSchema,
  budgetDrilldownQuerySchema,
  budgetLineSchema,
  budgetListSchema,
  budgetPeriodDetailsSchema,
  budgetPeriodListSchema,
  budgetPeriodSchema,
  budgetSchema,
  categorizationRuleListSchema,
  categorizationRuleSchema,
  categorizationBatchRequestSchema,
  categorizationReviewListSchema,
  categorizationReviewSchema,
  categorizationReviewStatusSchema,
  categorizationSuggestionRequestSchema,
  categoryListSchema,
  categorySchema,
  createAccountBalanceSchema,
  createAccountSchema,
  createBudgetPeriodSchema,
  createBudgetSchema,
  createCategorizationRuleSchema,
  createCategorySchema,
  createCsvMappingRecordSchema,
  createInstitutionSchema,
  createProviderConnectionSchema,
  createFinancialGoalSchema,
  createHoldingSchema,
  createInvestmentTransactionSchema,
  createLiabilitySchema,
  createLiabilityTermsSchema,
  createRecurringObligationSchema,
  createSecuritySchema,
  createScenarioAssumptionSchema,
  csvImportResultSchema,
  csvMappingListSchema,
  csvMappingRecordSchema,
  csvPreviewRequestSchema,
  csvPreviewSchema,
  financialGoalListSchema,
  financialGoalSchema,
  forecastObligationListSchema,
  entityIdSchema,
  externalInstitutionConnectionListSchema,
  healthResponseSchema,
  holdingListSchema,
  holdingSchema,
  householdFactListSchema,
  householdFactSchema,
  householdAsOfQuerySchema,
  householdListSchema,
  householdSchema,
  createHouseholdFactSchema,
  createHouseholdSchema,
  createPersonSchema,
  institutionListSchema,
  institutionSchema,
  incomeClassificationListSchema,
  incomeClassificationSchema,
  incomeClassificationStatusSchema,
  incomeConfirmationSchema,
  incomeSummarySchema,
  investmentTransactionListSchema,
  investmentTransactionSchema,
  investmentValuationSchema,
  liabilityListSchema,
  liabilityScenarioOverrideSchema,
  liabilitySchema,
  liabilityTermsSchema,
  openApiDocument,
  paginationQuerySchema,
  personListSchema,
  personSchema,
  problem,
  providerConnectionListSchema,
  providerConnectionSchema,
  readinessResponseSchema,
  recurringObligationListSchema,
  recurringObligationSchema,
  resolveAccountImportReviewSchema,
  scenarioAssumptionListSchema,
  scenarioAssumptionSchema,
  securityListSchema,
  securitySchema,
  setBudgetLineSchema,
  transactionDetailsSchema,
  transactionFilterSchema,
  transactionListSchema,
  manualTransactionInputSchema,
  updateAccountBalanceSchema,
  updateManualTransactionSchema,
  transferMatchDecisionSchema,
  transferMatchListSchema,
  transferMatchSchema,
  transferMatchStatusSchema,
  transferReportingSummarySchema,
  updateAccountSchema,
  updateCategorizationRuleSchema,
  updateCategorySchema,
  updateInstitutionSchema,
  updateProviderConnectionSchema,
  updateHouseholdSchema,
  updateHoldingSchema,
} from "@almanac-fi/api-contracts";
import { calculateBudget } from "@almanac-fi/core";
import { createDatabase, now, type AppDatabase } from "@almanac-fi/db";
import { createUnitOfWork, inUnitOfWork } from "@almanac-fi/db/repositories";
import { initializeTelemetry } from "@almanac-fi/telemetry";
import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
} from "fastify";

import { previewCsv } from "./csv.js";

export type ServerOptions = Readonly<{
  config?: AppConfig;
  database?: AppDatabase;
}>;

function parseRequest<Output>(
  schema: Readonly<{ parse: (value: unknown) => Output }>,
  value: unknown,
): Output {
  try {
    return schema.parse(value);
  } catch (error) {
    const requestError = new Error(
      error instanceof Error ? error.message : "Invalid request.",
    );
    Object.assign(requestError, { statusCode: 400 });
    throw requestError;
  }
}

function notFound(message: string): never {
  const error = new Error(message);
  Object.assign(error, { statusCode: 404 });
  throw error;
}

function badRequest(message: string): never {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  throw error;
}

function conflict(message: string): never {
  const error = new Error(message);
  Object.assign(error, { statusCode: 409 });
  throw error;
}

function checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createServer(
  options: ServerOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  await ensureDataHome(config);
  const database = options.database ?? createDatabase(databasePath(config));
  database.migrate();
  const app = Fastify({ logger: false });
  const requestIds = new WeakMap<object, string>();

  app.addHook("onRequest", async (request, reply) => {
    const requestId = randomUUID();
    requestIds.set(request, requestId);
    reply.header("x-request-id", requestId);
  });
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
    const status =
      statusCode !== undefined && statusCode >= 400 ? statusCode : 500;
    reply
      .status(status)
      .type("application/problem+json")
      .send(
        problem({
          detail:
            status === 500
              ? "An unexpected error occurred."
              : error instanceof Error
                ? error.message
                : "Request failed.",
          instance: request.url,
          requestId: requestIds.get(request) ?? randomUUID(),
          status,
          title: status === 500 ? "Internal Server Error" : "Request Error",
          type: `https://almanac-fi.local/problems/${status}`,
        }),
      );
  });
  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .type("application/problem+json")
      .send(
        problem({
          detail: "The requested route does not exist.",
          instance: request.url,
          requestId: requestIds.get(request) ?? randomUUID(),
          status: 404,
          title: "Not Found",
          type: "https://almanac-fi.local/problems/not-found",
        }),
      );
  });
  app.get("/health", async () => healthResponseSchema.parse({ status: "ok" }));
  app.get("/ready", async () => {
    try {
      database.sqlite.prepare("SELECT 1").get();
      return readinessResponseSchema.parse({ status: "ready" });
    } catch {
      return readinessResponseSchema.parse({ status: "not_ready" });
    }
  });
  app.get("/openapi.json", async () => openApiDocument);
  const unitOfWork = createUnitOfWork(database);
  unitOfWork.transactions.assignUncategorizedSourceCategories();
  const manualProvenance = (
    work: ReturnType<typeof createUnitOfWork>,
    entityType: string,
    operation: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): void => {
    const payload = JSON.stringify(after);
    const batch = work.importBatches.create({
      actor: "user",
      checksum: checksum(`manual:${randomUUID()}`),
      source: "manual",
      status: "completed",
    });
    const source = work.sourceRecords.create({
      batchId: batch.id,
      checksum: checksum(`manual:${entityType}:${entityId}:${randomUUID()}`),
      rawPayload: payload,
      sourceType: "manual-entry",
    });
    work.auditEvents.append({
      actor: "user",
      afterJson: payload,
      beforeJson: before === null ? null : JSON.stringify(before),
      entityId,
      entityType,
      operation,
      sourceRecordId: source.id,
    });
  };
  const assertManualTransactionReferences = (
    work: ReturnType<typeof createUnitOfWork>,
    input: {
      accountId: string;
      categoryId: string | null;
      currency: string;
      splits: readonly { categoryId: string | null }[];
    },
  ): void => {
    const account = work.accounts.findById(input.accountId);
    if (!account) notFound("The account does not exist.");
    if (account.currency !== input.currency)
      badRequest("Transaction currency must match the account currency.");
    for (const categoryId of [
      input.categoryId,
      ...input.splits.map((split) => split.categoryId),
    ]) {
      if (categoryId === null) continue;
      const category = work.categories.findById(categoryId);
      if (!category) notFound("The category does not exist.");
      if (category.status === "archived")
        badRequest("Transactions cannot use archived categories.");
    }
  };
  app.get("/accounts", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return accountListSchema.parse(unitOfWork.accounts.list(page));
  });
  app.post(
    "/accounts",
    { config: { statusCode: 201 } },
    async (request, reply) => {
      const input = parseRequest(createAccountSchema, request.body);
      if (Boolean(input.externalConnectionId) !== Boolean(input.externalId)) {
        badRequest(
          "External connection and external account ID must be provided together.",
        );
      }
      if (input.accountType === "unclassified" && !input.externalConnectionId) {
        badRequest("Manual accounts require a specific account type.");
      }
      if (!unitOfWork.institutions.findById(input.institutionId)) {
        notFound("The institution does not exist.");
      }
      const externalConnection = input.externalConnectionId
        ? unitOfWork.externalInstitutionConnections.findById(
            input.externalConnectionId,
          )
        : undefined;
      if (input.externalConnectionId && !externalConnection) {
        notFound("The external institution connection does not exist.");
      }
      if (
        externalConnection &&
        externalConnection.institutionId !== input.institutionId
      ) {
        badRequest("The external connection belongs to another institution.");
      }
      const account = inUnitOfWork(database, (work) => {
        const created = work.accounts.create({
          ...input,
          externalConnectionId: input.externalConnectionId ?? null,
          externalId: input.externalId ?? null,
        });
        if (!created.externalConnectionId)
          manualProvenance(
            work,
            "account",
            "create",
            created.id,
            null,
            created,
          );
        return created;
      });
      return reply.status(201).send(accountSchema.parse(account));
    },
  );
  app.get("/accounts/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const account = unitOfWork.accounts.findById(id);
    if (!account) notFound("The account does not exist.");
    return accountSchema.parse(account);
  });
  app.patch("/accounts/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(updateAccountSchema, request.body);
    const current = unitOfWork.accounts.findById(id);
    if (!current) notFound("The account does not exist.");
    const institutionId = input.institutionId ?? current.institutionId;
    if (!unitOfWork.institutions.findById(institutionId)) {
      notFound("The institution does not exist.");
    }
    const externalConnectionId =
      input.externalConnectionId === undefined
        ? current.externalConnectionId
        : input.externalConnectionId;
    const externalId =
      input.externalId === undefined ? current.externalId : input.externalId;
    if (Boolean(externalConnectionId) !== Boolean(externalId)) {
      badRequest(
        "External connection and external account ID must be provided together.",
      );
    }
    if (
      (input.accountType ?? current.accountType) === "unclassified" &&
      !externalConnectionId
    ) {
      badRequest("Manual accounts require a specific account type.");
    }
    const externalConnection = externalConnectionId
      ? unitOfWork.externalInstitutionConnections.findById(externalConnectionId)
      : undefined;
    if (externalConnectionId && !externalConnection) {
      notFound("The external institution connection does not exist.");
    }
    if (
      externalConnection &&
      externalConnection.institutionId !== institutionId
    ) {
      badRequest("The external connection belongs to another institution.");
    }
    const account = inUnitOfWork(database, (work) => {
      const updated = work.accounts.update(id, input);
      if (updated && !updated.externalConnectionId)
        manualProvenance(
          work,
          "account",
          "update",
          updated.id,
          current,
          updated,
        );
      return updated;
    });
    if (!account) notFound("The account does not exist.");
    return accountSchema.parse(account);
  });
  app.delete("/accounts/:id", async (request, reply) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.accounts.delete(id))
      notFound("The account does not exist.");
    return reply.status(204).send();
  });
  app.get("/accounts/:id/balances", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.accounts.findById(id))
      notFound("The account does not exist.");
    const page = parseRequest(paginationQuerySchema, request.query);
    return accountBalanceListSchema.parse(
      unitOfWork.accounts.listBalances(id, page),
    );
  });
  app.post("/accounts/:id/balances", async (request, reply) => {
    const accountId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.accounts.findById(accountId))
      notFound("The account does not exist.");
    const input = parseRequest(createAccountBalanceSchema, request.body);
    const balance = inUnitOfWork(database, (work) => {
      const created = work.accounts.addBalance({ accountId, ...input });
      manualProvenance(
        work,
        "account_balance",
        "create",
        created.id,
        null,
        created,
      );
      return created;
    });
    return reply.status(201).send(accountBalanceSchema.parse(balance));
  });
  app.patch("/accounts/:accountId/balances/:balanceId", async (request) => {
    const accountId = parseRequest(
      entityIdSchema,
      (request.params as { accountId?: unknown }).accountId,
    );
    const balanceId = parseRequest(
      entityIdSchema,
      (request.params as { balanceId?: unknown }).balanceId,
    );
    const input = parseRequest(updateAccountBalanceSchema, request.body);
    const current = database.sqlite
      .prepare(
        "SELECT id, account_id AS accountId, amount_minor AS amountMinor, available_amount_minor AS availableAmountMinor, as_of AS asOf, is_current AS isCurrent, replaces_balance_id AS replacesBalanceId, created_at AS createdAt FROM account_balances WHERE id = ? AND account_id = ? AND is_current = 1",
      )
      .get(balanceId, accountId) as
      | {
          amountMinor: number;
          asOf: string;
          availableAmountMinor: number | null;
        }
      | undefined;
    if (!current) notFound("The current account balance does not exist.");
    const balance = inUnitOfWork(database, (work) => {
      const replacement = work.accounts.replaceBalance(balanceId, {
        amountMinor: input.amountMinor ?? current.amountMinor,
        asOf: input.asOf ?? current.asOf,
        availableAmountMinor:
          input.availableAmountMinor === undefined
            ? current.availableAmountMinor
            : input.availableAmountMinor,
      });
      if (!replacement) notFound("The current account balance does not exist.");
      manualProvenance(
        work,
        "account_balance",
        "correct",
        replacement.id,
        current,
        replacement,
      );
      return replacement;
    });
    return accountBalanceSchema.parse(balance);
  });
  app.get("/institutions", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return institutionListSchema.parse(unitOfWork.institutions.list(page));
  });
  app.post("/institutions", async (request, reply) => {
    const input = parseRequest(createInstitutionSchema, request.body);
    const institution = inUnitOfWork(database, (work) => {
      const created = work.institutions.create({
        domain: input.domain ?? null,
        name: input.name,
        websiteUrl: input.websiteUrl ?? null,
      });
      manualProvenance(
        work,
        "institution",
        "create",
        created.id,
        null,
        created,
      );
      return created;
    });
    return reply.status(201).send(institutionSchema.parse(institution));
  });
  app.get("/institutions/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const institution = unitOfWork.institutions.findById(id);
    if (!institution) notFound("The institution does not exist.");
    return institutionSchema.parse(institution);
  });
  app.patch("/institutions/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(updateInstitutionSchema, request.body);
    const previous = unitOfWork.institutions.findById(id);
    const institution = inUnitOfWork(database, (work) => {
      const updated = work.institutions.update(id, input);
      if (updated)
        manualProvenance(
          work,
          "institution",
          "update",
          updated.id,
          previous,
          updated,
        );
      return updated;
    });
    if (!institution) notFound("The institution does not exist.");
    return institutionSchema.parse(institution);
  });
  app.delete("/institutions/:id", async (request, reply) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const result = unitOfWork.institutions.delete(id);
    if (result === "not_found") notFound("The institution does not exist.");
    if (result === "has_accounts") {
      conflict("Reassign or delete the institution's accounts first.");
    }
    return reply.status(204).send();
  });
  app.get("/provider-connections", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return providerConnectionListSchema.parse(
      unitOfWork.providerConnections.list(page),
    );
  });
  app.post("/provider-connections", async (request, reply) => {
    const input = parseRequest(createProviderConnectionSchema, request.body);
    const connection = unitOfWork.providerConnections.create({
      ...input,
      secretKey: input.secretKey ?? null,
    });
    return reply.status(201).send(providerConnectionSchema.parse(connection));
  });
  app.get("/provider-connections/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const connection = unitOfWork.providerConnections.findById(id);
    if (!connection) notFound("The provider connection does not exist.");
    return providerConnectionSchema.parse(connection);
  });
  app.patch("/provider-connections/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(updateProviderConnectionSchema, request.body);
    const connection = unitOfWork.providerConnections.update(id, input);
    if (!connection) notFound("The provider connection does not exist.");
    return providerConnectionSchema.parse(connection);
  });
  app.delete("/provider-connections/:id", async (request, reply) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.providerConnections.revoke(id)) {
      notFound("The provider connection does not exist.");
    }
    return reply.status(204).send();
  });
  app.get("/external-institution-connections", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return externalInstitutionConnectionListSchema.parse(
      unitOfWork.externalInstitutionConnections.list(page),
    );
  });
  app.get("/account-import-reviews", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return accountImportReviewListSchema.parse(
      unitOfWork.accountImportReviews.list(page),
    );
  });
  app.post("/account-import-reviews/:id/resolve", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(resolveAccountImportReviewSchema, request.body);
    if (!unitOfWork.institutions.findById(input.institutionId)) {
      notFound("The institution does not exist.");
    }
    const review = unitOfWork.accountImportReviews.resolve(id, input);
    if (!review) notFound("The import review does not exist.");
    return accountImportReviewSchema.parse(review);
  });
  app.get("/categories", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return categoryListSchema.parse(unitOfWork.categories.list(page));
  });
  app.post("/categories", async (request, reply) => {
    const input = parseRequest(createCategorySchema, request.body);
    const parentId = input.parentId ?? null;
    if (parentId !== null && !unitOfWork.categories.findById(parentId)) {
      notFound("The parent category does not exist.");
    }
    return reply.status(201).send(
      categorySchema.parse(
        inUnitOfWork(database, (work) => {
          const created = work.categories.create({ ...input, parentId });
          manualProvenance(
            work,
            "category",
            "create",
            created.id,
            null,
            created,
          );
          return created;
        }),
      ),
    );
  });
  app.patch("/categories/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(updateCategorySchema, request.body);
    if (
      input.parentId !== undefined &&
      input.parentId !== null &&
      !unitOfWork.categories.findById(input.parentId)
    ) {
      notFound("The parent category does not exist.");
    }
    try {
      const previous = unitOfWork.categories.findById(id);
      const category = inUnitOfWork(database, (work) => {
        const updated = work.categories.update(id, input);
        if (updated)
          manualProvenance(
            work,
            "category",
            "update",
            updated.id,
            previous,
            updated,
          );
        return updated;
      });
      if (!category) notFound("The category does not exist.");
      return categorySchema.parse(category);
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/categorization-rules", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return categorizationRuleListSchema.parse(
      unitOfWork.categorizationRules.list(page),
    );
  });
  app.post("/categorization-rules", async (request, reply) => {
    const input = parseRequest(createCategorizationRuleSchema, request.body);
    const category = unitOfWork.categories.findById(input.categoryId);
    if (!category) notFound("The category does not exist.");
    if (category.status === "archived")
      badRequest("Rules cannot target archived categories.");
    return reply
      .status(201)
      .send(
        categorizationRuleSchema.parse(
          unitOfWork.categorizationRules.create(input),
        ),
      );
  });
  app.patch("/categorization-rules/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(updateCategorizationRuleSchema, request.body);
    if (input.categoryId !== undefined) {
      const category = unitOfWork.categories.findById(input.categoryId);
      if (!category) notFound("The category does not exist.");
      if (category.status === "archived")
        badRequest("Rules cannot target archived categories.");
    }
    const rule = unitOfWork.categorizationRules.update(id, input);
    if (!rule) notFound("The categorization rule does not exist.");
    return categorizationRuleSchema.parse(rule);
  });
  app.get("/categorization-reviews", async (request) => {
    const status = parseRequest(
      categorizationReviewStatusSchema.optional(),
      (request.query as { status?: unknown }).status,
    );
    return categorizationReviewListSchema.parse({
      items: unitOfWork.categorizationReviews.list(status),
    });
  });
  app.post("/categorization-reviews/suggest", async (request) => {
    const input = parseRequest(
      categorizationSuggestionRequestSchema,
      request.body,
    );
    if (
      input.aiCategoryId !== undefined &&
      !unitOfWork.categories.findById(input.aiCategoryId)
    ) {
      notFound("The AI-suggested category does not exist.");
    }
    const review = unitOfWork.categorizationReviews.suggest(input);
    if (!review) notFound("The transaction is unavailable for categorization.");
    return categorizationReviewSchema.parse(review);
  });
  app.post("/categorization-reviews/batch", async (request) => {
    const input = parseRequest(categorizationBatchRequestSchema, request.body);
    if (
      input.categoryId !== undefined &&
      !unitOfWork.categories.findById(input.categoryId)
    ) {
      notFound("The category does not exist.");
    }
    try {
      return categorizationReviewListSchema.parse({
        items: unitOfWork.categorizationReviews.applyBatch(input),
      });
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/transactions", async (request) => {
    const filter = parseRequest(transactionFilterSchema, request.query);
    return transactionListSchema.parse(
      unitOfWork.transactions.list(filter, filter),
    );
  });
  app.post(
    "/transactions",
    { config: { statusCode: 201 } },
    async (request, reply) => {
      const input = parseRequest(manualTransactionInputSchema, request.body);
      const details = inUnitOfWork(database, (work) => {
        assertManualTransactionReferences(work, input);
        const sourceIdentity = `manual:${randomUUID()}`;
        const batch = work.importBatches.create({
          actor: "user",
          checksum: checksum(`manual:${sourceIdentity}`),
          source: "manual",
          status: "completed",
        });
        const source = work.sourceRecords.create({
          batchId: batch.id,
          checksum: checksum(`manual-transaction:${sourceIdentity}`),
          rawPayload: JSON.stringify(input),
          sourceType: "manual-entry",
        });
        const created = work.transactions.create(
          {
            ...input,
            sourceIdentity,
            sourceRecordId: source.id,
          },
          input.splits,
        );
        work.auditEvents.append({
          actor: "user",
          afterJson: JSON.stringify(created),
          beforeJson: null,
          entityId: created.transaction.id,
          entityType: "transaction",
          operation: "create",
          sourceRecordId: source.id,
        });
        return created;
      });
      return reply.status(201).send(transactionDetailsSchema.parse(details));
    },
  );
  app.patch("/transactions/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(updateManualTransactionSchema, request.body);
    const current = unitOfWork.transactions.findById(id);
    if (!current || !current.isCurrent)
      notFound("The current transaction does not exist.");
    const currentDetails = unitOfWork.transactions.getDetails(id);
    const details = inUnitOfWork(database, (work) => {
      const merged = {
        accountId: input.accountId ?? current.accountId,
        amountMinor: input.amountMinor ?? current.amountMinor,
        categoryId:
          input.categoryId === undefined
            ? current.categoryId
            : input.categoryId,
        currency: input.currency ?? current.currency,
        merchant:
          input.merchant === undefined ? current.merchant : input.merchant,
        payee: input.payee === undefined ? current.payee : input.payee,
        postedAt:
          input.postedAt === undefined ? current.postedAt : input.postedAt,
        sourceCategory:
          input.sourceCategory === undefined
            ? current.sourceCategory
            : input.sourceCategory,
        splits: input.splits ?? currentDetails?.splits ?? [],
        status: input.status ?? current.status,
        transactionDate: input.transactionDate ?? current.transactionDate,
      };
      assertManualTransactionReferences(work, merged);
      if (
        merged.splits.length > 0 &&
        merged.splits.reduce((sum, split) => sum + split.amountMinor, 0) !==
          merged.amountMinor
      )
        badRequest(
          "Transaction split totals must equal the parent transaction amount.",
        );
      const batch = work.importBatches.create({
        actor: "user",
        checksum: checksum(`manual:transaction-correction:${randomUUID()}`),
        source: "manual",
        status: "completed",
      });
      const source = work.sourceRecords.create({
        batchId: batch.id,
        checksum: checksum(`manual-transaction-correction:${randomUUID()}`),
        rawPayload: JSON.stringify(merged),
        sourceType: "manual-correction",
      });
      const corrected = work.transactions.replaceCurrent(
        {
          ...merged,
          sourceIdentity: current.sourceIdentity,
          sourceRecordId: source.id,
        },
        merged.splits,
      );
      work.auditEvents.append({
        actor: "user",
        afterJson: JSON.stringify(corrected),
        beforeJson: JSON.stringify(currentDetails ?? current),
        entityId: corrected.transaction.id,
        entityType: "transaction",
        operation: "correct",
        sourceRecordId: source.id,
      });
      return corrected;
    });
    return transactionDetailsSchema.parse(details);
  });
  app.get("/transactions/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const details = unitOfWork.transactions.getDetails(id);
    if (!details) notFound("The transaction does not exist.");
    return transactionDetailsSchema.parse(details);
  });
  app.post("/transfer-matches/detect", async () =>
    transferMatchListSchema.parse({
      items: unitOfWork.transferMatches.refreshCandidates(),
    }),
  );
  app.get("/transfer-matches", async (request) => {
    const status = parseRequest(
      transferMatchStatusSchema.optional(),
      (request.query as { status?: unknown }).status,
    );
    return transferMatchListSchema.parse({
      items: unitOfWork.transferMatches.list(status),
    });
  });
  app.post("/transfer-matches/:id/decision", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(transferMatchDecisionSchema, request.body);
    try {
      const match = unitOfWork.transferMatches.decide(
        id,
        input.decision,
        input.actor,
      );
      if (!match) notFound("The transfer match does not exist.");
      return transferMatchSchema.parse(match);
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/reporting/transfer-exclusions", async () =>
    transferReportingSummarySchema.parse({
      excludedTransactionIds: [
        ...unitOfWork.transferMatches.confirmedTransactionIds(),
      ],
    }),
  );
  app.post("/income-classifications/refresh", async () =>
    incomeClassificationListSchema.parse({
      items: unitOfWork.incomeClassifications.refresh(),
    }),
  );
  app.get("/income-classifications", async (request) => {
    const status = parseRequest(
      incomeClassificationStatusSchema.optional(),
      (request.query as { status?: unknown }).status,
    );
    return incomeClassificationListSchema.parse({
      items: unitOfWork.incomeClassifications.list(status),
    });
  });
  app.post("/income-classifications/:id/confirm", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(incomeConfirmationSchema, request.body);
    try {
      const classification = unitOfWork.incomeClassifications.confirm(
        id,
        input.kind,
        input.actor,
      );
      if (!classification)
        notFound("The income classification does not exist.");
      return incomeClassificationSchema.parse(classification);
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/income-summary", async () =>
    incomeSummarySchema.parse(unitOfWork.incomeClassifications.summary()),
  );
  app.get("/households", async () =>
    householdListSchema.parse({ items: unitOfWork.households.list() }),
  );
  app.post("/households", async (request, reply) => {
    const input = parseRequest(createHouseholdSchema, request.body);
    return reply
      .status(201)
      .send(householdSchema.parse(unitOfWork.households.create(input)));
  });
  app.patch("/households/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const updated = unitOfWork.households.update(
      id,
      parseRequest(updateHouseholdSchema, request.body),
    );
    if (!updated) notFound("The household does not exist.");
    return householdSchema.parse(updated);
  });
  app.get("/households/:id/people", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.households.findById(id))
      notFound("The household does not exist.");
    return personListSchema.parse({
      items: unitOfWork.households.listPeople(id),
    });
  });
  app.post("/households/:id/people", async (request, reply) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.households.findById(householdId))
      notFound("The household does not exist.");
    const input = parseRequest(createPersonSchema, request.body);
    return reply
      .status(201)
      .send(
        personSchema.parse(
          unitOfWork.households.createPerson({ ...input, householdId }),
        ),
      );
  });
  app.get("/households/:id/facts", async (request) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const { asOf } = parseRequest(householdAsOfQuerySchema, request.query);
    return householdFactListSchema.parse({
      items: unitOfWork.households.listFacts(householdId, asOf),
    });
  });
  app.post("/households/:id/facts", async (request, reply) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(createHouseholdFactSchema, request.body);
    try {
      return reply
        .status(201)
        .send(
          householdFactSchema.parse(
            unitOfWork.households.createFact({ ...input, householdId }),
          ),
        );
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.delete("/household-facts/:id", async (request, reply) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.households.deleteFact(id))
      notFound("The household fact does not exist.");
    return reply.status(204).send();
  });
  app.get("/households/:id/goals", async (request) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    return financialGoalListSchema.parse({
      items: unitOfWork.goals.list(householdId),
    });
  });
  app.post("/households/:id/goals", async (request, reply) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(createFinancialGoalSchema, request.body);
    try {
      return reply
        .status(201)
        .send(
          financialGoalSchema.parse(
            unitOfWork.goals.create({ ...input, householdId }),
          ),
        );
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/households/:id/assumptions", async (request) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const { asOf } = parseRequest(householdAsOfQuerySchema, request.query);
    return scenarioAssumptionListSchema.parse({
      items: unitOfWork.goals.listAssumptions(householdId, asOf),
    });
  });
  app.post("/households/:id/assumptions", async (request, reply) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(createScenarioAssumptionSchema, request.body);
    try {
      return reply
        .status(201)
        .send(
          scenarioAssumptionSchema.parse(
            unitOfWork.goals.createAssumption({ ...input, householdId }),
          ),
        );
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/securities", async () =>
    securityListSchema.parse({
      items: unitOfWork.investments.listSecurities(),
    }),
  );
  app.post("/securities", async (request, reply) =>
    reply
      .status(201)
      .send(
        securitySchema.parse(
          unitOfWork.investments.createSecurity(
            parseRequest(createSecuritySchema, request.body),
          ),
        ),
      ),
  );
  app.get("/holdings", async (request) =>
    holdingListSchema.parse({
      items: unitOfWork.investments.listHoldings(
        (request.query as { accountId?: string }).accountId,
      ),
    }),
  );
  app.post("/holdings", async (request, reply) =>
    reply
      .status(201)
      .send(
        holdingSchema.parse(
          unitOfWork.investments.createHolding(
            parseRequest(createHoldingSchema, request.body),
          ),
        ),
      ),
  );
  app.patch("/holdings/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const holding = unitOfWork.investments.updateHolding(
      id,
      parseRequest(updateHoldingSchema, request.body),
    );
    if (!holding) notFound("The holding does not exist.");
    return holdingSchema.parse(holding);
  });
  app.delete("/holdings/:id", async (request, reply) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.investments.deleteHolding(id))
      notFound("The holding does not exist.");
    return reply.status(204).send();
  });
  app.get("/investment-transactions", async (request) =>
    investmentTransactionListSchema.parse({
      items: unitOfWork.investments.listTransactions(
        (request.query as { accountId?: string }).accountId,
      ),
    }),
  );
  app.post("/investment-transactions", async (request, reply) =>
    reply
      .status(201)
      .send(
        investmentTransactionSchema.parse(
          unitOfWork.investments.createTransaction(
            parseRequest(createInvestmentTransactionSchema, request.body),
          ),
        ),
      ),
  );
  app.get("/investment-valuation", async (request) =>
    investmentValuationSchema.parse(
      unitOfWork.investments.currentValuation(
        (request.query as { accountId?: string }).accountId,
      ),
    ),
  );
  app.get("/households/:id/liabilities", async (request) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    return liabilityListSchema.parse({
      items: unitOfWork.obligations.listLiabilities(householdId),
    });
  });
  app.post("/households/:id/liabilities", async (request, reply) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    return reply.status(201).send(
      liabilitySchema.parse(
        unitOfWork.obligations.createLiability({
          ...parseRequest(createLiabilitySchema, request.body),
          householdId,
        }),
      ),
    );
  });
  app.post("/liabilities/:id/terms", async (request, reply) => {
    const liabilityId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    try {
      return reply.status(201).send(
        liabilityTermsSchema.parse(
          unitOfWork.obligations.addTerms({
            ...parseRequest(createLiabilityTermsSchema, request.body),
            liabilityId,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/households/:id/obligations", async (request) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const { asOf } = parseRequest(householdAsOfQuerySchema, request.query);
    return recurringObligationListSchema.parse({
      items: unitOfWork.obligations.listObligations(householdId, asOf),
    });
  });
  app.post("/households/:id/obligations", async (request, reply) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    return reply.status(201).send(
      recurringObligationSchema.parse(
        unitOfWork.obligations.createObligation({
          ...parseRequest(createRecurringObligationSchema, request.body),
          householdId,
        }),
      ),
    );
  });
  app.get("/households/:id/forecast-obligations", async (request) => {
    const householdId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const { asOf } = parseRequest(householdAsOfQuerySchema, request.query);
    return forecastObligationListSchema.parse({
      items: unitOfWork.obligations.forecastInputs(
        householdId,
        asOf ?? new Date().toISOString().slice(0, 10),
      ),
    });
  });
  app.post("/liabilities/:id/scenario-overrides", async (request, reply) => {
    const liabilityId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(liabilityScenarioOverrideSchema, request.body);
    return reply.status(201).send(
      unitOfWork.obligations.createScenarioOverride({
        ...input,
        liabilityId,
      }),
    );
  });
  app.post("/budget-calculations", async (request) => {
    const result = calculateBudget(
      parseRequest(budgetCalculationRequestSchema, request.body),
    );
    database.sqlite
      .prepare(
        "INSERT OR IGNORE INTO calculation_runs (id, calculation_version, input_checksum, status, created_at, completed_at) VALUES (?, ?, ?, 'completed', ?, ?)",
      )
      .run(
        result.calculationId,
        result.calculationVersion,
        result.calculationId,
        now(),
        now(),
      );
    return budgetCalculationSchema.parse(result);
  });
  app.get("/budgets", async () =>
    budgetListSchema.parse({ items: unitOfWork.budgets.list() }),
  );
  app.post("/budgets", async (request, reply) =>
    reply
      .status(201)
      .send(
        budgetSchema.parse(
          unitOfWork.budgets.create(
            parseRequest(createBudgetSchema, request.body),
          ),
        ),
      ),
  );
  app.get("/budgets/:id/periods", async (request) => {
    const budgetId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    return budgetPeriodListSchema.parse({
      items: unitOfWork.budgets.listPeriods(budgetId),
    });
  });
  app.post("/budgets/:id/periods", async (request, reply) => {
    const budgetId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    try {
      return reply.status(201).send(
        budgetPeriodSchema.parse(
          unitOfWork.budgets.createPeriod({
            ...parseRequest(createBudgetPeriodSchema, request.body),
            budgetId,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/budget-periods/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const details = unitOfWork.budgets.findPeriod(id);
    if (!details) notFound("The budget period does not exist.");
    return budgetPeriodDetailsSchema.parse(details);
  });
  app.put("/budget-periods/:id/lines", async (request) => {
    const periodId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(setBudgetLineSchema, request.body);
    return budgetLineSchema.parse(
      unitOfWork.budgets.setLine(
        periodId,
        input.categoryId,
        input.targetAmountMinor,
      ),
    );
  });
  app.post("/budget-periods/:id/clone", async (request, reply) => {
    const sourcePeriodId = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    try {
      return reply
        .status(201)
        .send(
          budgetPeriodDetailsSchema.parse(
            unitOfWork.budgets.clonePeriod(
              sourcePeriodId,
              parseRequest(createBudgetPeriodSchema, request.body),
            ),
          ),
        );
    } catch (error) {
      if (error instanceof Error) badRequest(error.message);
      throw error;
    }
  });
  app.get("/budget-periods/:id/analysis", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const details = unitOfWork.budgets.findPeriod(id);
    if (!details) notFound("The budget period does not exist.");
    const confirmed = unitOfWork.transferMatches.confirmedTransactionIds();
    const result = calculateBudget({
      currency: details.budget.currency,
      dateFrom: details.period.dateFrom,
      dateTo: details.period.dateTo,
      lines: details.lines,
      transactions: unitOfWork.transactions
        .list(
          { dateFrom: details.period.dateFrom, dateTo: details.period.dateTo },
          { limit: 100 },
        )
        .items.map((transaction) => ({
          ...transaction,
          isConfirmedTransfer: confirmed.has(transaction.id),
        })),
    });
    database.sqlite
      .prepare(
        "INSERT OR IGNORE INTO calculation_runs (id, calculation_version, input_checksum, status, created_at, completed_at) VALUES (?, ?, ?, 'completed', ?, ?)",
      )
      .run(
        result.calculationId,
        result.calculationVersion,
        result.calculationId,
        now(),
        now(),
      );
    return budgetCalculationSchema.parse(result);
  });
  app.get("/budget-periods/:id/transactions", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const details = unitOfWork.budgets.findPeriod(id);
    if (!details) notFound("The budget period does not exist.");
    const query = parseRequest(budgetDrilldownQuerySchema, request.query);
    const confirmed = unitOfWork.transferMatches.confirmedTransactionIds();
    const items = unitOfWork.transactions
      .list(
        { dateFrom: details.period.dateFrom, dateTo: details.period.dateTo },
        { limit: 100 },
      )
      .items.filter((transaction) =>
        query.kind === "transfer"
          ? confirmed.has(transaction.id)
          : query.kind === "uncategorized"
            ? transaction.categoryId === null && !confirmed.has(transaction.id)
            : transaction.categoryId === query.categoryId &&
              !confirmed.has(transaction.id),
      );
    return transactionListSchema.parse({ items });
  });
  app.post("/csv-imports/preview", async (request) => {
    const input = parseRequest(csvPreviewRequestSchema, request.body);
    if (!unitOfWork.accounts.findById(input.accountId))
      notFound("The account does not exist.");
    const preview = previewCsv(input.content, input.mapping);
    return csvPreviewSchema.parse(preview);
  });
  app.post("/csv-imports/commit", async (request) => {
    const input = parseRequest(csvPreviewRequestSchema, request.body);
    if (!unitOfWork.accounts.findById(input.accountId))
      notFound("The account does not exist.");
    const preview = previewCsv(input.content, input.mapping);
    if (!preview.valid) badRequest("Correct all CSV errors before importing.");
    const batchChecksum = checksum(
      JSON.stringify({
        accountId: input.accountId,
        content: input.content,
        currency: input.currency,
        mapping: input.mapping,
      }),
    );
    const existing = unitOfWork.importBatches.findByChecksum(batchChecksum);
    if (existing) {
      return csvImportResultSchema.parse({
        batchId: existing.id,
        created: 0,
        corrected: 0,
        duplicate: preview.rows.length,
        totalAmountMinor: preview.totalAmountMinor,
      });
    }
    const result = inUnitOfWork(database, (work) => {
      const batch = work.importBatches.create({
        actor: "user",
        checksum: batchChecksum,
        source: "csv",
        status: "completed",
      });
      let created = 0;
      let corrected = 0;
      let duplicate = 0;
      for (const row of preview.rows) {
        const rawPayload = JSON.stringify(row.raw);
        const sourceChecksum = checksum(`${input.accountId}:${rawPayload}`);
        if (work.sourceRecords.findByChecksum(sourceChecksum)) {
          duplicate += 1;
          continue;
        }
        const source = work.sourceRecords.create({
          batchId: batch.id,
          checksum: sourceChecksum,
          rawPayload,
          sourceType: "csv-row",
        });
        const sourceIdentity = `csv:${checksum(`${input.accountId}:${row.transactionDate}:${row.merchant}:${row.payee ?? ""}`)}`;
        const existingTransaction =
          work.transactions.findCurrentBySourceIdentity(sourceIdentity);
        const sourceCategory =
          row.sourceCategory === null
            ? null
            : (work.categories.findByName(row.sourceCategory) ??
              work.categories.create({
                name: row.sourceCategory,
                parentId: null,
                status: "active",
              }));
        const categoryId =
          work.categorizationRules.evaluate({
            merchant: row.merchant,
            payee: row.payee,
            sourceCategory: row.sourceCategory,
          })?.categoryId ??
          sourceCategory?.id ??
          null;
        const transactionInput = {
          accountId: input.accountId,
          amountMinor: row.amountMinor,
          categoryId,
          currency: input.currency,
          merchant: row.merchant,
          payee: row.payee,
          postedAt: null,
          sourceCategory: row.sourceCategory,
          sourceIdentity,
          sourceRecordId: source.id,
          status: "posted" as const,
          transactionDate: row.transactionDate,
        };
        if (
          existingTransaction &&
          existingTransaction.amountMinor === transactionInput.amountMinor &&
          existingTransaction.merchant === transactionInput.merchant &&
          existingTransaction.transactionDate ===
            transactionInput.transactionDate
        ) {
          duplicate += 1;
          work.auditEvents.append({
            actor: "user",
            afterJson: JSON.stringify({
              decision: "duplicate",
              transactionId: existingTransaction.id,
            }),
            beforeJson: null,
            entityId: existingTransaction.id,
            entityType: "transaction",
            operation: "duplicate",
            sourceRecordId: source.id,
          });
          continue;
        }
        const persisted = work.transactions.replaceCurrent(transactionInput);
        if (existingTransaction) corrected += 1;
        else created += 1;
        work.auditEvents.append({
          actor: "user",
          afterJson: JSON.stringify(persisted.transaction),
          beforeJson: existingTransaction
            ? JSON.stringify(existingTransaction)
            : null,
          entityId: persisted.transaction.id,
          entityType: "transaction",
          operation: existingTransaction ? "correct" : "create",
          sourceRecordId: source.id,
        });
      }
      return {
        batchId: batch.id,
        created,
        corrected,
        duplicate,
        totalAmountMinor: preview.totalAmountMinor,
      };
    });
    return csvImportResultSchema.parse(result);
  });
  app.get("/csv-mappings", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    const saved = unitOfWork.csvMappings.list(page);
    return csvMappingListSchema.parse({
      ...saved,
      items: saved.items.map((mapping) => ({
        ...mapping,
        mapping: JSON.parse(mapping.mappingJson),
      })),
    });
  });
  app.post("/csv-mappings", async (request, reply) => {
    const input = parseRequest(createCsvMappingRecordSchema, request.body);
    const mapping = unitOfWork.csvMappings.create({
      mappingJson: JSON.stringify(input.mapping),
      name: input.name,
    });
    return reply
      .status(201)
      .send(
        csvMappingRecordSchema.parse({ ...mapping, mapping: input.mapping }),
      );
  });
  app.patch("/csv-mappings/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(createCsvMappingRecordSchema, request.body);
    const mapping = unitOfWork.csvMappings.update(id, {
      mappingJson: JSON.stringify(input.mapping),
      name: input.name,
    });
    if (!mapping) notFound("The CSV mapping does not exist.");
    return csvMappingRecordSchema.parse({ ...mapping, mapping: input.mapping });
  });
  app.delete("/csv-mappings/:id", async (request, reply) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.csvMappings.delete(id))
      notFound("The CSV mapping does not exist.");
    return reply.status(204).send();
  });
  app.addHook("onClose", async () => {
    database.close();
  });
  return app;
}

export async function registerFeatureRoutes(
  app: FastifyInstance,
  routes: FastifyPluginAsync,
): Promise<void> {
  await app.register(routes);
}

export async function runServer(): Promise<void> {
  initializeTelemetry();
  const config = loadConfig();
  const app = await createServer({ config });
  await app.listen({ host: config.host, port: config.port });
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void runServer();
}
