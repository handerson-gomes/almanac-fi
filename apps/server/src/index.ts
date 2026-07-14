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
  accountListSchema,
  accountSchema,
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
  createCategorizationRuleSchema,
  createCategorySchema,
  createCsvMappingRecordSchema,
  createInstitutionConnectionSchema,
  createFinancialGoalSchema,
  createHoldingSchema,
  createInvestmentTransactionSchema,
  createSecuritySchema,
  createScenarioAssumptionSchema,
  csvImportResultSchema,
  csvMappingListSchema,
  csvMappingRecordSchema,
  csvPreviewRequestSchema,
  csvPreviewSchema,
  financialGoalListSchema,
  financialGoalSchema,
  entityIdSchema,
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
  institutionConnectionListSchema,
  institutionConnectionSchema,
  incomeClassificationListSchema,
  incomeClassificationSchema,
  incomeClassificationStatusSchema,
  incomeConfirmationSchema,
  incomeSummarySchema,
  investmentTransactionListSchema,
  investmentTransactionSchema,
  investmentValuationSchema,
  openApiDocument,
  paginationQuerySchema,
  personListSchema,
  personSchema,
  problem,
  readinessResponseSchema,
  scenarioAssumptionListSchema,
  scenarioAssumptionSchema,
  securityListSchema,
  securitySchema,
  transactionDetailsSchema,
  transactionFilterSchema,
  transactionListSchema,
  transferMatchDecisionSchema,
  transferMatchListSchema,
  transferMatchSchema,
  transferMatchStatusSchema,
  transferReportingSummarySchema,
  updateAccountSchema,
  updateCategorizationRuleSchema,
  updateCategorySchema,
  updateInstitutionConnectionSchema,
  updateHouseholdSchema,
  updateHoldingSchema,
} from "@almanac-fi/api-contracts";
import { createDatabase, type AppDatabase } from "@almanac-fi/db";
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
  app.get("/accounts", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return accountListSchema.parse(unitOfWork.accounts.list(page));
  });
  app.post(
    "/accounts",
    { config: { statusCode: 201 } },
    async (request, reply) => {
      const input = parseRequest(createAccountSchema, request.body);
      if (input.connectionId !== undefined && input.connectionId !== null) {
        if (!unitOfWork.institutionConnections.findById(input.connectionId)) {
          notFound("The institution connection does not exist.");
        }
      }
      const account = unitOfWork.accounts.create({
        ...input,
        connectionId: input.connectionId ?? null,
        externalId: input.externalId ?? null,
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
    if (input.connectionId !== undefined && input.connectionId !== null) {
      if (!unitOfWork.institutionConnections.findById(input.connectionId)) {
        notFound("The institution connection does not exist.");
      }
    }
    const account = unitOfWork.accounts.update(id, input);
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
    const balance = unitOfWork.accounts.addBalance({ accountId, ...input });
    return reply.status(201).send(accountBalanceSchema.parse(balance));
  });
  app.get("/institution-connections", async (request) => {
    const page = parseRequest(paginationQuerySchema, request.query);
    return institutionConnectionListSchema.parse(
      unitOfWork.institutionConnections.list(page),
    );
  });
  app.post("/institution-connections", async (request, reply) => {
    const input = parseRequest(createInstitutionConnectionSchema, request.body);
    const connection = unitOfWork.institutionConnections.create({
      ...input,
      externalId: input.externalId ?? null,
      institutionUrl: input.institutionUrl ?? null,
      secretKey: input.secretKey ?? null,
    });
    return reply
      .status(201)
      .send(institutionConnectionSchema.parse(connection));
  });
  app.get("/institution-connections/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const connection = unitOfWork.institutionConnections.findById(id);
    if (!connection) notFound("The institution connection does not exist.");
    return institutionConnectionSchema.parse(connection);
  });
  app.patch("/institution-connections/:id", async (request) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    const input = parseRequest(updateInstitutionConnectionSchema, request.body);
    const connection = unitOfWork.institutionConnections.update(id, input);
    if (!connection) notFound("The institution connection does not exist.");
    return institutionConnectionSchema.parse(connection);
  });
  app.delete("/institution-connections/:id", async (request, reply) => {
    const id = parseRequest(
      entityIdSchema,
      (request.params as { id?: unknown }).id,
    );
    if (!unitOfWork.institutionConnections.delete(id)) {
      notFound("The institution connection does not exist.");
    }
    return reply.status(204).send();
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
    return reply
      .status(201)
      .send(
        categorySchema.parse(
          unitOfWork.categories.create({ ...input, parentId }),
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
      const category = unitOfWork.categories.update(id, input);
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
