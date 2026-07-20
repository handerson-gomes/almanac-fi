import { createHash, randomUUID } from "node:crypto";

import type {
  SimpleFinSyncHealth,
  SimpleFinSyncRequest,
  SimpleFinSyncRun,
} from "@almanac-fi/api-contracts";
import { now, type AppDatabase } from "@almanac-fi/db";
import {
  createUnitOfWork,
  inUnitOfWork,
  type AccountType,
  type Transaction,
} from "@almanac-fi/db/repositories";
import { secretKeySchema, type SecretStore } from "@almanac-fi/secrets";

import {
  SimpleFinFetchError,
  type SimpleFinAccount,
  type SimpleFinAccountClient,
  type SimpleFinConnection,
  type SimpleFinError,
  type SimpleFinTransaction,
} from "./simplefin.js";

const daySeconds = 86_400;
const maximumWindowDays = 45;
const maximumRequestsPerRun = 24;

type SyncCounters = {
  balancesUpdated: number;
  transactionsAdded: number;
  transactionsUnchanged: number;
  transactionsUpdated: number;
};

type SyncWindow = Readonly<{
  end: number;
  start: number;
}>;

type SyncRunRow = Omit<SimpleFinSyncRun, "affectedAccountIds" | "errors"> & {
  affectedAccountIdsJson: string;
  errorsJson: string;
};

export class SimpleFinSyncConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SimpleFinSyncConfigurationError";
  }
}

function utcDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1_000).toISOString().slice(0, 10);
}

function epochDay(value: string): number {
  const epoch = Date.parse(`${value}T00:00:00.000Z`) / 1_000;
  if (!Number.isFinite(epoch)) {
    throw new SimpleFinSyncConfigurationError("Enter a valid sync date.");
  }
  return epoch;
}

function syncRange(
  input: SimpleFinSyncRequest,
  clock: () => Date,
): Readonly<{
  coverageEnd: string;
  coverageStart: string;
  windows: readonly SyncWindow[];
}> {
  const current = clock();
  const today =
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate(),
    ) / 1_000;
  const defaultDays =
    input.mode === "deep" ? 730 : input.mode === "initial" ? 90 : 60;
  const start = input.startDate
    ? epochDay(input.startDate)
    : today - (defaultDays - 1) * daySeconds;
  const inclusiveEnd = input.endDate ? epochDay(input.endDate) : today;
  const end = inclusiveEnd + daySeconds;
  if (start >= end) {
    throw new SimpleFinSyncConfigurationError(
      "The sync start date must be on or before the end date.",
    );
  }
  const windows: SyncWindow[] = [];
  for (let cursor = start; cursor < end;) {
    const windowEnd = Math.min(cursor + maximumWindowDays * daySeconds, end);
    windows.push({ end: windowEnd, start: cursor });
    cursor = windowEnd;
  }
  if (windows.length > maximumRequestsPerRun) {
    throw new SimpleFinSyncConfigurationError(
      `This range needs ${windows.length} SimpleFIN requests. Choose a range of ${maximumRequestsPerRun * maximumWindowDays} days or fewer to stay within the daily limit.`,
    );
  }
  return {
    coverageEnd: utcDate(end - daySeconds),
    coverageStart: utcDate(start),
    windows,
  };
}

function minorUnits(value: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Invalid money amount");
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? "").padEnd(2, "0"));
  const amount = sign * (whole * 100 + fraction);
  if (!Number.isSafeInteger(amount))
    throw new Error("Money amount is too large");
  return amount;
}

export function inferAccountType(
  name: string,
  institutionName = "",
): AccountType {
  const value = name.toLocaleLowerCase();
  const institution = institutionName.toLocaleLowerCase();
  if (/\broth[- ]?sep[- ]?ira\b/.test(value)) return "roth_sep_ira";
  if (/\bsep[- ]?ira\b/.test(value)) return "traditional_sep_ira";
  if (/\broth[- ]?ira\b/.test(value)) return "roth_ira";
  if (/401\s*\(?k\)?/.test(value)) return "traditional_401k";
  if (/403\s*\(?b\)?/.test(value)) return "traditional_403b";
  if (/457\s*\(?b\)?/.test(value)) return "traditional_457b";
  if (
    /\b(checking|current)\b/.test(value) ||
    (/\b(spend|reserve)\b/.test(value) && /\bpnc\b/.test(institution))
  ) {
    return "checking";
  }
  if (
    /\bsavings?\b/.test(value) ||
    (/\bgrowth\b/.test(value) && /\bpnc\b/.test(institution))
  ) {
    return "savings";
  }
  if (/\b(money market)\b/.test(value)) return "money_market";
  if (/\b(cd|certificate of deposit)\b/.test(value)) {
    return "certificate_of_deposit";
  }
  if (/\b(credit card|card|visa|mastercard|amex|explorer)\b/.test(value)) {
    return "credit_card";
  }
  if (/\b(mortgage)\b/.test(value)) return "mortgage";
  if (/\b(auto|vehicle|car) loan\b/.test(value)) return "auto_loan";
  if (/\b(student) loan\b/.test(value)) return "student_loan";
  if (/\b(ira)\b/.test(value)) return "traditional_ira";
  if (/\b(brokerage|investment)\b/.test(value)) return "taxable_brokerage";
  if (
    /\bindividual\b/.test(value) &&
    /\b(fidelity|schwab|brokerage|investments?)\b/.test(institution)
  ) {
    return "taxable_brokerage";
  }
  if (/\b(loan|line of credit)\b/.test(value)) return "personal_loan";
  return "unclassified";
}

function accountSuffix(name: string): string | null {
  return /\((\d{4})\)\s*$/.exec(name.trim())?.[1] ?? null;
}

function transactionContentKey(transaction: SimpleFinTransaction): string {
  return JSON.stringify([
    transaction.amount,
    transaction.description,
    transaction.pending,
    transaction.posted,
    transaction.transactedAt,
    transaction.extra,
  ]);
}

function hasSameTransactionContent(
  left: SimpleFinAccount,
  right: SimpleFinAccount,
): boolean {
  if (
    left.transactions.length === 0 ||
    left.transactions.length !== right.transactions.length
  ) {
    return false;
  }
  const leftKeys = left.transactions.map(transactionContentKey).sort();
  const rightKeys = right.transactions.map(transactionContentKey).sort();
  return leftKeys.every((key, index) => key === rightKeys[index]);
}

export function deduplicateSimpleFinAccounts(
  accounts: readonly SimpleFinAccount[],
  connections: readonly SimpleFinConnection[],
): Readonly<{
  accounts: readonly SimpleFinAccount[];
  duplicates: readonly Readonly<{
    canonical: SimpleFinAccount;
    duplicate: SimpleFinAccount;
  }>[];
}> {
  const connectionsById = new Map(
    connections.map((connection) => [connection.id, connection]),
  );
  const duplicates: Array<{
    canonical: SimpleFinAccount;
    duplicate: SimpleFinAccount;
  }> = [];
  const duplicateIds = new Set<string>();
  for (const duplicate of accounts) {
    if (!/^account\s*\(\d{4}\)\s*$/i.test(duplicate.name)) continue;
    const suffix = accountSuffix(duplicate.name);
    if (suffix === null) continue;
    const connection = connectionsById.get(duplicate.connectionId);
    const institutionName =
      connection?.organizationName ?? connection?.name ?? "";
    if (inferAccountType(duplicate.name, institutionName) !== "unclassified") {
      continue;
    }
    const candidates = accounts.filter(
      (candidate) =>
        candidate.id !== duplicate.id &&
        candidate.connectionId === duplicate.connectionId &&
        candidate.currency === duplicate.currency &&
        accountSuffix(candidate.name) === suffix &&
        inferAccountType(candidate.name, institutionName) !== "unclassified" &&
        hasSameTransactionContent(duplicate, candidate),
    );
    if (candidates.length !== 1) continue;
    duplicateIds.add(duplicate.id);
    duplicates.push({ canonical: candidates[0]!, duplicate });
  }
  return {
    accounts: accounts.filter((account) => !duplicateIds.has(account.id)),
    duplicates,
  };
}

function domain(value: string | null): string | null {
  if (value === null) return null;
  try {
    return new URL(value).hostname.toLocaleLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function mapRun(row: SyncRunRow): SimpleFinSyncRun {
  return {
    accountsAffected: row.accountsAffected,
    affectedAccountIds: JSON.parse(row.affectedAccountIdsJson) as string[],
    balancesUpdated: row.balancesUpdated,
    completedAt: row.completedAt,
    coverageEnd: row.coverageEnd,
    coverageStart: row.coverageStart,
    errors: JSON.parse(row.errorsJson) as SimpleFinError[],
    id: row.id,
    mode: row.mode,
    providerConnectionId: row.providerConnectionId,
    startedAt: row.startedAt,
    status: row.status,
    transactionsAdded: row.transactionsAdded,
    transactionsUnchanged: row.transactionsUnchanged,
    transactionsUpdated: row.transactionsUpdated,
  };
}

const runSelect = `SELECT id, provider_connection_id AS providerConnectionId,
  mode, status, coverage_start AS coverageStart, coverage_end AS coverageEnd,
  accounts_affected AS accountsAffected, transactions_added AS transactionsAdded,
  transactions_updated AS transactionsUpdated, transactions_unchanged AS transactionsUnchanged,
  balances_updated AS balancesUpdated, errors_json AS errorsJson,
  affected_account_ids_json AS affectedAccountIdsJson, started_at AS startedAt,
  completed_at AS completedAt FROM simplefin_sync_runs`;

function sameTransaction(
  current: Transaction,
  input: Omit<
    Transaction,
    "createdAt" | "id" | "isCurrent" | "replacesTransactionId" | "updatedAt"
  >,
): boolean {
  return (
    current.accountId === input.accountId &&
    current.amountMinor === input.amountMinor &&
    current.currency === input.currency &&
    current.merchant === input.merchant &&
    current.payee === input.payee &&
    current.postedAt === input.postedAt &&
    current.sourceCategory === input.sourceCategory &&
    current.status === input.status &&
    current.transactionDate === input.transactionDate
  );
}

function normalizedTransaction(
  transaction: SimpleFinTransaction,
  fallbackEpoch: number,
): Readonly<{
  amountMinor: number;
  payee: string;
  postedAt: string | null;
  sourceCategory: string | null;
  status: "pending" | "posted";
  transactionDate: string;
}> {
  const effectiveEpoch =
    transaction.transactedAt && transaction.transactedAt > 0
      ? transaction.transactedAt
      : transaction.posted > 0
        ? transaction.posted
        : fallbackEpoch;
  const category = transaction.extra.category;
  return {
    amountMinor: minorUnits(transaction.amount),
    payee: transaction.description,
    postedAt:
      transaction.pending || transaction.posted === 0
        ? null
        : new Date(transaction.posted * 1_000).toISOString(),
    sourceCategory:
      typeof category === "string" && category.trim() !== ""
        ? category.trim().slice(0, 200)
        : null,
    status: transaction.pending ? "pending" : "posted",
    transactionDate: new Date(effectiveEpoch * 1_000).toISOString(),
  };
}

export class SimpleFinSyncService {
  public constructor(
    private readonly database: AppDatabase,
    private readonly secretStore: SecretStore,
    private readonly client: SimpleFinAccountClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public health(connectionId: string): SimpleFinSyncHealth | undefined {
    const work = createUnitOfWork(this.database);
    const connection = work.providerConnections.findById(connectionId);
    if (!connection || connection.provider !== "simplefin") return undefined;
    const lastRunRow = this.database.sqlite
      .prepare(
        `${runSelect} WHERE provider_connection_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1`,
      )
      .get(connectionId) as SyncRunRow | undefined;
    const success = this.database.sqlite
      .prepare(
        `SELECT completed_at AS completedAt, coverage_start AS coverageStart,
          coverage_end AS coverageEnd FROM simplefin_sync_runs
         WHERE provider_connection_id = ? AND status = 'success'
         ORDER BY completed_at DESC, rowid DESC LIMIT 1`,
      )
      .get(connectionId) as
      | { completedAt: string; coverageEnd: string; coverageStart: string }
      | undefined;
    return {
      connectionId,
      coverageEnd: success?.coverageEnd ?? null,
      coverageStart: success?.coverageStart ?? null,
      lastRun: lastRunRow ? mapRun(lastRunRow) : null,
      lastSuccessAt: success?.completedAt ?? null,
      status: connection.status,
    };
  }

  public async sync(
    connectionId: string,
    input: SimpleFinSyncRequest,
  ): Promise<SimpleFinSyncRun> {
    const work = createUnitOfWork(this.database);
    const connection = work.providerConnections.findById(connectionId);
    if (!connection || connection.provider !== "simplefin") {
      throw new SimpleFinSyncConfigurationError(
        "The SimpleFIN connection does not exist.",
      );
    }
    if (connection.status !== "connected" || connection.secretKey === null) {
      throw new SimpleFinSyncConfigurationError(
        "Reconnect SimpleFIN before syncing.",
      );
    }
    const accessUrl = this.secretStore.get(
      secretKeySchema.parse(connection.secretKey),
    );
    if (accessUrl === undefined) {
      work.providerConnections.update(connectionId, { status: "needs_reauth" });
      throw new SimpleFinSyncConfigurationError(
        "The SimpleFIN credential is missing. Reconnect SimpleFIN.",
      );
    }
    const range = syncRange(input, this.clock);
    const runId = randomUUID();
    const startedAt = now();
    this.database.sqlite
      .prepare(
        `INSERT INTO simplefin_sync_runs
          (id, provider_connection_id, mode, status, coverage_start, coverage_end,
           accounts_affected, transactions_added, transactions_updated,
           transactions_unchanged, balances_updated, errors_json,
           affected_account_ids_json, started_at, completed_at)
         VALUES (?, ?, ?, 'processing', ?, ?, 0, 0, 0, 0, 0, '[]', '[]', ?, NULL)`,
      )
      .run(
        runId,
        connectionId,
        input.mode,
        range.coverageStart,
        range.coverageEnd,
        startedAt,
      );
    const batch = work.importBatches.create({
      actor: "simplefin",
      checksum: createHash("sha256").update(`simplefin:${runId}`).digest("hex"),
      source: "simplefin",
      status: "processing",
    });
    const counters: SyncCounters = {
      balancesUpdated: 0,
      transactionsAdded: 0,
      transactionsUnchanged: 0,
      transactionsUpdated: 0,
    };
    const affectedAccountIds = new Set<string>();
    const errors: SimpleFinError[] = [];
    let completedWindows = 0;

    for (const window of range.windows) {
      try {
        const response = await this.client.fetchAccounts(accessUrl, {
          endDate: window.end,
          includePending: true,
          startDate: window.start,
        });
        errors.push(...response.errors);
        inUnitOfWork(this.database, (unit) => {
          const connections = new Map(
            response.connections.map((item) => [item.id, item]),
          );
          for (const remoteConnection of response.connections) {
            this.ensureInstitution(unit, connectionId, remoteConnection);
          }
          const deduplicated = deduplicateSimpleFinAccounts(
            response.accounts,
            response.connections,
          );
          for (const { duplicate } of deduplicated.duplicates) {
            this.hideDuplicateAccount(connectionId, duplicate);
          }
          for (const account of deduplicated.accounts) {
            const remoteConnection = connections.get(account.connectionId);
            if (!remoteConnection) {
              errors.push({
                accountId: account.id,
                code: "act.missingdata",
                connectionId: account.connectionId,
                message:
                  "SimpleFIN omitted institution details for this account.",
              });
              continue;
            }
            try {
              const accountId = this.importAccount(
                unit,
                batch.id,
                connectionId,
                remoteConnection,
                account,
                window.end - 1,
                counters,
              );
              affectedAccountIds.add(accountId);
            } catch {
              errors.push({
                accountId: account.id,
                code: "act.invaliddata",
                connectionId: account.connectionId,
                message: `SimpleFIN returned unsupported data for ${account.name}.`,
              });
            }
          }
        });
        completedWindows += 1;
      } catch (error) {
        const failure =
          error instanceof SimpleFinFetchError
            ? error
            : new SimpleFinFetchError(
                "unavailable",
                "SimpleFIN sync failed unexpectedly. Try again later.",
              );
        errors.push({
          accountId: null,
          code: `gen.${failure.kind}`,
          connectionId: null,
          message: failure.message,
        });
        if (failure.kind === "needs_reauth") {
          work.providerConnections.update(connectionId, {
            status: "needs_reauth",
          });
        }
        break;
      }
    }

    const status: SimpleFinSyncRun["status"] =
      completedWindows === 0
        ? "failed"
        : errors.length > 0 || completedWindows < range.windows.length
          ? "partial"
          : "success";
    const completedAt = now();
    this.database.sqlite
      .prepare(
        `UPDATE simplefin_sync_runs SET status = ?, accounts_affected = ?,
          transactions_added = ?, transactions_updated = ?, transactions_unchanged = ?,
          balances_updated = ?, errors_json = ?, affected_account_ids_json = ?, completed_at = ?
         WHERE id = ?`,
      )
      .run(
        status,
        affectedAccountIds.size,
        counters.transactionsAdded,
        counters.transactionsUpdated,
        counters.transactionsUnchanged,
        counters.balancesUpdated,
        JSON.stringify(errors),
        JSON.stringify([...affectedAccountIds]),
        completedAt,
        runId,
      );
    this.database.sqlite
      .prepare("UPDATE import_batches SET status = ? WHERE id = ?")
      .run(status === "failed" ? "failed" : "completed", batch.id);
    const row = this.database.sqlite
      .prepare(`${runSelect} WHERE id = ?`)
      .get(runId) as SyncRunRow | undefined;
    if (!row) throw new Error("The sync run could not be recorded.");
    return mapRun(row);
  }

  private ensureInstitution(
    work: ReturnType<typeof createUnitOfWork>,
    providerConnectionId: string,
    connection: SimpleFinConnection,
  ): string {
    const existingConnection = this.database.sqlite
      .prepare(
        `SELECT institution_id AS institutionId FROM external_institution_connections
         WHERE provider_connection_id = ? AND remote_connection_id = ?`,
      )
      .get(providerConnectionId, connection.id) as
      { institutionId: string } | undefined;
    let institutionId = existingConnection?.institutionId;
    const institutionDomain = domain(connection.organizationUrl);
    if (!institutionId && institutionDomain) {
      institutionId = (
        this.database.sqlite
          .prepare("SELECT id FROM institutions WHERE lower(domain) = lower(?)")
          .get(institutionDomain) as { id: string } | undefined
      )?.id;
    }
    if (!institutionId) {
      institutionId = work.institutions.create({
        domain: institutionDomain,
        name: connection.organizationName ?? connection.name,
        websiteUrl: connection.organizationUrl,
      }).id;
    }
    work.externalInstitutionConnections.upsert({
      institutionId,
      providerConnectionId,
      remoteConnectionId: connection.id,
      remoteName: connection.name,
      remoteOrganizationId: connection.organizationId,
      remoteOrganizationUrl: connection.organizationUrl,
      status: "connected",
    });
    return institutionId;
  }

  private importAccount(
    work: ReturnType<typeof createUnitOfWork>,
    batchId: string,
    providerConnectionId: string,
    connection: SimpleFinConnection,
    account: SimpleFinAccount,
    fallbackEpoch: number,
    counters: SyncCounters,
  ): string {
    if (!/^[A-Z]{3}$/.test(account.currency)) {
      throw new Error("Custom currencies are not yet supported");
    }
    const result = work.accountImportReviews.reconcile({
      accountName: account.name,
      accountType: inferAccountType(
        account.name,
        connection.organizationName ?? connection.name,
      ),
      currency: account.currency,
      providerConnectionId,
      remoteAccountId: account.id,
      remoteConnectionId: connection.id,
      remoteConnectionName: connection.name,
      remoteOrganizationId: connection.organizationId,
      remoteOrganizationUrl: connection.organizationUrl,
    });
    if (result.accountId === null)
      throw new Error("Account was not reconciled");
    this.importBalance(work, result.accountId, account, counters);
    for (const transaction of account.transactions) {
      this.importTransaction(
        work,
        batchId,
        providerConnectionId,
        connection.id,
        account,
        result.accountId,
        transaction,
        fallbackEpoch,
        counters,
      );
    }
    return result.accountId;
  }

  private hideDuplicateAccount(
    providerConnectionId: string,
    account: SimpleFinAccount,
  ): void {
    const timestamp = now();
    this.database.sqlite
      .prepare(
        `UPDATE accounts SET status = 'hidden', updated_at = ?
         WHERE external_id = ? AND external_connection_id = (
           SELECT id FROM external_institution_connections
           WHERE provider_connection_id = ? AND remote_connection_id = ?
         )`,
      )
      .run(timestamp, account.id, providerConnectionId, account.connectionId);
    this.database.sqlite
      .prepare(
        `UPDATE account_import_reviews SET status = 'resolved', updated_at = ?
         WHERE provider_connection_id = ? AND remote_connection_id = ?
           AND remote_account_id = ? AND status = 'pending'`,
      )
      .run(timestamp, providerConnectionId, account.connectionId, account.id);
  }

  private importBalance(
    work: ReturnType<typeof createUnitOfWork>,
    accountId: string,
    account: SimpleFinAccount,
    counters: SyncCounters,
  ): void {
    const asOf = new Date(account.balanceDate * 1_000).toISOString();
    const amountMinor = minorUnits(account.balance);
    const availableAmountMinor =
      account.availableBalance === null
        ? null
        : minorUnits(account.availableBalance);
    const current = this.database.sqlite
      .prepare(
        `SELECT id, amount_minor AS amountMinor,
          available_amount_minor AS availableAmountMinor
         FROM account_balances WHERE account_id = ? AND as_of = ? AND is_current = 1`,
      )
      .get(accountId, asOf) as
      | { amountMinor: number; availableAmountMinor: number | null; id: string }
      | undefined;
    if (
      current?.amountMinor === amountMinor &&
      current.availableAmountMinor === availableAmountMinor
    ) {
      return;
    }
    if (current) {
      work.accounts.replaceBalance(current.id, {
        amountMinor,
        asOf,
        availableAmountMinor,
      });
    } else {
      work.accounts.addBalance({
        accountId,
        amountMinor,
        asOf,
        availableAmountMinor,
      });
    }
    counters.balancesUpdated += 1;
  }

  private importTransaction(
    work: ReturnType<typeof createUnitOfWork>,
    batchId: string,
    providerConnectionId: string,
    remoteConnectionId: string,
    account: SimpleFinAccount,
    accountId: string,
    transaction: SimpleFinTransaction,
    fallbackEpoch: number,
    counters: SyncCounters,
  ): void {
    const normalized = normalizedTransaction(transaction, fallbackEpoch);
    let sourceIdentity = this.findTransactionIdentity(
      providerConnectionId,
      remoteConnectionId,
      account.id,
      transaction.id,
    );
    if (!sourceIdentity && !transaction.pending) {
      sourceIdentity = this.matchPendingIdentity(
        accountId,
        normalized.amountMinor,
        normalized.payee,
        normalized.transactionDate,
      );
    }
    sourceIdentity ??= `simplefin:${providerConnectionId}:${remoteConnectionId}:${account.id}:${transaction.id}`;
    this.database.sqlite
      .prepare(
        `INSERT INTO simplefin_transaction_aliases
          (provider_connection_id, remote_connection_id, remote_account_id,
           remote_transaction_id, source_identity) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(provider_connection_id, remote_connection_id, remote_account_id, remote_transaction_id)
         DO UPDATE SET source_identity = excluded.source_identity`,
      )
      .run(
        providerConnectionId,
        remoteConnectionId,
        account.id,
        transaction.id,
        sourceIdentity,
      );
    const current =
      work.transactions.findCurrentBySourceIdentity(sourceIdentity);
    const sourceCategory = normalized.sourceCategory;
    const rule = work.categorizationRules.evaluate({
      merchant: null,
      payee: normalized.payee,
      sourceCategory,
    });
    const input = {
      accountId,
      amountMinor: normalized.amountMinor,
      categoryId: current?.categoryId ?? rule?.categoryId ?? null,
      currency: account.currency,
      merchant: null,
      payee: normalized.payee,
      postedAt: normalized.postedAt,
      sourceCategory,
      sourceIdentity,
      sourceRecordId: "",
      status: normalized.status,
      transactionDate: normalized.transactionDate,
    };
    if (current && sameTransaction(current, input)) {
      counters.transactionsUnchanged += 1;
      return;
    }
    const rawPayload = JSON.stringify({
      accountId: account.id,
      connectionId: remoteConnectionId,
      transaction,
    });
    const sourceChecksum = createHash("sha256")
      .update(`${providerConnectionId}:${rawPayload}`)
      .digest("hex");
    const source =
      work.sourceRecords.findByChecksum(sourceChecksum) ??
      work.sourceRecords.create({
        batchId,
        checksum: sourceChecksum,
        rawPayload,
        sourceType: "simplefin-transaction",
      });
    const recordInput = { ...input, sourceRecordId: source.id };
    const imported = current
      ? work.transactions.replaceCurrent(recordInput)
      : work.transactions.create(recordInput);
    work.auditEvents.append({
      actor: "simplefin",
      afterJson: JSON.stringify(imported.transaction),
      beforeJson: current ? JSON.stringify(current) : null,
      entityId: imported.transaction.id,
      entityType: "transaction",
      operation: current ? "replace" : "create",
      sourceRecordId: source.id,
    });
    if (current) counters.transactionsUpdated += 1;
    else counters.transactionsAdded += 1;
  }

  private findTransactionIdentity(
    providerConnectionId: string,
    remoteConnectionId: string,
    remoteAccountId: string,
    remoteTransactionId: string,
  ): string | undefined {
    return (
      this.database.sqlite
        .prepare(
          `SELECT source_identity AS sourceIdentity FROM simplefin_transaction_aliases
           WHERE provider_connection_id = ? AND remote_connection_id = ?
             AND remote_account_id = ? AND remote_transaction_id = ?`,
        )
        .get(
          providerConnectionId,
          remoteConnectionId,
          remoteAccountId,
          remoteTransactionId,
        ) as { sourceIdentity: string } | undefined
    )?.sourceIdentity;
  }

  private matchPendingIdentity(
    accountId: string,
    amountMinor: number,
    payee: string,
    transactionDate: string,
  ): string | undefined {
    const matches = this.database.sqlite
      .prepare(
        `SELECT source_identity AS sourceIdentity FROM transactions
         WHERE account_id = ? AND is_current = 1 AND status = 'pending'
           AND amount_minor = ? AND lower(coalesce(payee, '')) = lower(?)
           AND abs(julianday(transaction_date) - julianday(?)) <= 7
         LIMIT 2`,
      )
      .all(accountId, amountMinor, payee, transactionDate) as Array<{
      sourceIdentity: string;
    }>;
    return matches.length === 1 ? matches[0]?.sourceIdentity : undefined;
  }
}
