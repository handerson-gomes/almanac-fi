import { randomUUID } from "node:crypto";

import type { AppDatabase } from "./index.js";
import { now } from "./index.js";
import type {
  AccountType,
  ConnectionStatus,
  Page,
  PageRequest,
} from "./repositories.js";

export type Institution = Readonly<{
  createdAt: string;
  domain: string | null;
  id: string;
  name: string;
  updatedAt: string;
  websiteUrl: string | null;
}>;

export type ProviderConnection = Readonly<{
  createdAt: string;
  id: string;
  provider: string;
  providerNamespace: string;
  secretKey: string | null;
  status: ConnectionStatus;
  updatedAt: string;
}>;

export type ExternalInstitutionConnection = Readonly<{
  createdAt: string;
  id: string;
  institutionId: string;
  providerConnectionId: string;
  remoteConnectionId: string;
  remoteName: string;
  remoteOrganizationId: string | null;
  remoteOrganizationUrl: string | null;
  status: ConnectionStatus;
  updatedAt: string;
}>;

export type InstitutionMatchEvidence = Readonly<{
  institutionId: string;
  strategy: "domain" | "organization_id";
  value: string;
}>;

export type AccountImportReview = Readonly<{
  accountName: string;
  accountType: AccountType;
  candidateInstitutionIds: readonly string[];
  createdAt: string;
  currency: string;
  id: string;
  matchEvidence: readonly InstitutionMatchEvidence[];
  providerConnectionId: string;
  remoteAccountId: string;
  remoteConnectionId: string;
  remoteConnectionName: string;
  remoteOrganizationId: string | null;
  remoteOrganizationUrl: string | null;
  resolvedInstitutionId: string | null;
  status: "pending" | "resolved";
  updatedAt: string;
}>;

export type NormalizedProviderAccount = Readonly<{
  accountName: string;
  accountType?: AccountType | undefined;
  currency: string;
  providerConnectionId: string;
  remoteAccountId: string;
  remoteConnectionId: string;
  remoteConnectionName: string;
  remoteOrganizationId?: string | null | undefined;
  remoteOrganizationUrl?: string | null | undefined;
}>;

export interface InstitutionRepository {
  create(
    input: Pick<Institution, "domain" | "name" | "websiteUrl">,
  ): Institution;
  delete(id: string): "deleted" | "has_accounts" | "not_found";
  findById(id: string): Institution | undefined;
  list(page?: PageRequest): Page<Institution>;
  update(
    id: string,
    input: Readonly<{
      domain?: string | null | undefined;
      name?: string | undefined;
      websiteUrl?: string | null | undefined;
    }>,
  ): Institution | undefined;
}

export interface ProviderConnectionRepository {
  create(
    input: Omit<ProviderConnection, "createdAt" | "id" | "updatedAt">,
  ): ProviderConnection;
  findById(id: string): ProviderConnection | undefined;
  list(page?: PageRequest): Page<ProviderConnection>;
  revoke(id: string): ProviderConnection | undefined;
  update(
    id: string,
    input: Readonly<{
      provider?: string | undefined;
      providerNamespace?: string | undefined;
      secretKey?: string | null | undefined;
      status?: ConnectionStatus | undefined;
    }>,
  ): ProviderConnection | undefined;
}

export interface ExternalInstitutionConnectionRepository {
  findById(id: string): ExternalInstitutionConnection | undefined;
  list(page?: PageRequest): Page<ExternalInstitutionConnection>;
  upsert(
    input: Omit<
      ExternalInstitutionConnection,
      "createdAt" | "id" | "updatedAt"
    >,
  ): ExternalInstitutionConnection;
}

export interface AccountImportReviewRepository {
  list(page?: PageRequest): Page<AccountImportReview>;
  reconcile(input: NormalizedProviderAccount): Readonly<{
    accountId: string | null;
    review: AccountImportReview | null;
  }>;
  resolve(
    id: string,
    input: Readonly<{ accountType: AccountType; institutionId: string }>,
  ): AccountImportReview | undefined;
}

function pageSize(request: PageRequest = {}): number {
  return Math.min(Math.max(request.limit ?? 50, 1), 100);
}

export function normalizeInstitutionDomain(
  value: string | null,
): string | null {
  if (value === null || value.trim() === "") return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLocaleLowerCase().replace(/^www\./, "");
  } catch {
    return value
      .trim()
      .toLocaleLowerCase()
      .replace(/^www\./, "")
      .replace(/\/$/, "");
  }
}

function mapReview(row: Record<string, unknown>): AccountImportReview {
  return {
    accountName: String(row.accountName),
    accountType: row.accountType as AccountType,
    candidateInstitutionIds: JSON.parse(
      String(row.candidateInstitutionIdsJson),
    ) as string[],
    createdAt: String(row.createdAt),
    currency: String(row.currency),
    id: String(row.id),
    matchEvidence: JSON.parse(
      String(row.matchEvidenceJson),
    ) as InstitutionMatchEvidence[],
    providerConnectionId: String(row.providerConnectionId),
    remoteAccountId: String(row.remoteAccountId),
    remoteConnectionId: String(row.remoteConnectionId),
    remoteConnectionName: String(row.remoteConnectionName),
    remoteOrganizationId:
      row.remoteOrganizationId === null
        ? null
        : String(row.remoteOrganizationId),
    remoteOrganizationUrl:
      row.remoteOrganizationUrl === null
        ? null
        : String(row.remoteOrganizationUrl),
    resolvedInstitutionId:
      row.resolvedInstitutionId === null
        ? null
        : String(row.resolvedInstitutionId),
    status: row.status as AccountImportReview["status"],
    updatedAt: String(row.updatedAt),
  };
}

const reviewSelect = `SELECT id, provider_connection_id AS providerConnectionId,
  remote_connection_id AS remoteConnectionId, remote_connection_name AS remoteConnectionName,
  remote_organization_id AS remoteOrganizationId, remote_organization_url AS remoteOrganizationUrl,
  remote_account_id AS remoteAccountId, account_name AS accountName, currency, account_type AS accountType,
  candidate_institution_ids_json AS candidateInstitutionIdsJson, match_evidence_json AS matchEvidenceJson,
  resolved_institution_id AS resolvedInstitutionId, status, created_at AS createdAt, updated_at AS updatedAt
  FROM account_import_reviews`;

export function createInstitutionServices(database: AppDatabase): Readonly<{
  accountImportReviews: AccountImportReviewRepository;
  externalInstitutionConnections: ExternalInstitutionConnectionRepository;
  institutions: InstitutionRepository;
  providerConnections: ProviderConnectionRepository;
}> {
  const institutions: InstitutionRepository = {
    create(input) {
      const timestamp = now();
      const record: Institution = {
        ...input,
        domain: normalizeInstitutionDomain(input.domain ?? input.websiteUrl),
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO institutions (id, name, website_url, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.name,
          record.websiteUrl,
          record.domain,
          record.createdAt,
          record.updatedAt,
        );
      return record;
    },
    delete(id) {
      if (!institutions.findById(id)) return "not_found";
      const account = database.sqlite
        .prepare("SELECT 1 FROM accounts WHERE institution_id = ? LIMIT 1")
        .get(id);
      if (account) return "has_accounts";
      database.sqlite.prepare("DELETE FROM institutions WHERE id = ?").run(id);
      return "deleted";
    },
    findById(id) {
      return database.sqlite
        .prepare(
          "SELECT id, name, website_url AS websiteUrl, domain, created_at AS createdAt, updated_at AS updatedAt FROM institutions WHERE id = ?",
        )
        .get(id) as Institution | undefined;
    },
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, name, website_url AS websiteUrl, domain, created_at AS createdAt, updated_at AS updatedAt FROM institutions WHERE id > ? ORDER BY id LIMIT ?",
        )
        .all(request?.cursor ?? "", limit + 1) as Institution[];
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    update(id, input) {
      const current = institutions.findById(id);
      if (!current) return undefined;
      const record: Institution = {
        ...current,
        domain:
          input.domain === undefined
            ? input.websiteUrl === undefined
              ? current.domain
              : normalizeInstitutionDomain(input.websiteUrl)
            : normalizeInstitutionDomain(input.domain),
        name: input.name ?? current.name,
        updatedAt: now(),
        websiteUrl:
          input.websiteUrl === undefined
            ? current.websiteUrl
            : input.websiteUrl,
      };
      database.sqlite
        .prepare(
          "UPDATE institutions SET name = ?, website_url = ?, domain = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          record.name,
          record.websiteUrl,
          record.domain,
          record.updatedAt,
          id,
        );
      return record;
    },
  };

  const providerConnections: ProviderConnectionRepository = {
    create(input) {
      const timestamp = now();
      const record: ProviderConnection = {
        ...input,
        createdAt: timestamp,
        id: randomUUID(),
        updatedAt: timestamp,
      };
      database.sqlite
        .prepare(
          "INSERT INTO provider_connections (id, provider, provider_namespace, status, secret_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.provider,
          record.providerNamespace,
          record.status,
          record.secretKey,
          record.createdAt,
          record.updatedAt,
        );
      return record;
    },
    findById(id) {
      return database.sqlite
        .prepare(
          "SELECT id, provider, provider_namespace AS providerNamespace, status, secret_key AS secretKey, created_at AS createdAt, updated_at AS updatedAt FROM provider_connections WHERE id = ?",
        )
        .get(id) as ProviderConnection | undefined;
    },
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          "SELECT id, provider, provider_namespace AS providerNamespace, status, secret_key AS secretKey, created_at AS createdAt, updated_at AS updatedAt FROM provider_connections WHERE id > ? ORDER BY id LIMIT ?",
        )
        .all(request?.cursor ?? "", limit + 1) as ProviderConnection[];
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    revoke(id) {
      const connection = providerConnections.update(id, {
        secretKey: null,
        status: "disconnected",
      });
      if (!connection) return undefined;
      database.sqlite
        .prepare(
          "UPDATE external_institution_connections SET status = 'disconnected', updated_at = ? WHERE provider_connection_id = ?",
        )
        .run(now(), id);
      return connection;
    },
    update(id, input) {
      const current = providerConnections.findById(id);
      if (!current) return undefined;
      const record: ProviderConnection = {
        ...current,
        provider: input.provider ?? current.provider,
        providerNamespace: input.providerNamespace ?? current.providerNamespace,
        secretKey:
          input.secretKey === undefined ? current.secretKey : input.secretKey,
        status: input.status ?? current.status,
        updatedAt: now(),
      };
      database.sqlite
        .prepare(
          "UPDATE provider_connections SET provider = ?, provider_namespace = ?, status = ?, secret_key = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          record.provider,
          record.providerNamespace,
          record.status,
          record.secretKey,
          record.updatedAt,
          id,
        );
      return record;
    },
  };

  const externalInstitutionConnections: ExternalInstitutionConnectionRepository =
    {
      findById(id) {
        return database.sqlite
          .prepare(
            "SELECT id, provider_connection_id AS providerConnectionId, institution_id AS institutionId, remote_connection_id AS remoteConnectionId, remote_name AS remoteName, remote_organization_id AS remoteOrganizationId, remote_organization_url AS remoteOrganizationUrl, status, created_at AS createdAt, updated_at AS updatedAt FROM external_institution_connections WHERE id = ?",
          )
          .get(id) as ExternalInstitutionConnection | undefined;
      },
      list(request) {
        const limit = pageSize(request);
        const rows = database.sqlite
          .prepare(
            "SELECT id, provider_connection_id AS providerConnectionId, institution_id AS institutionId, remote_connection_id AS remoteConnectionId, remote_name AS remoteName, remote_organization_id AS remoteOrganizationId, remote_organization_url AS remoteOrganizationUrl, status, created_at AS createdAt, updated_at AS updatedAt FROM external_institution_connections WHERE id > ? ORDER BY id LIMIT ?",
          )
          .all(
            request?.cursor ?? "",
            limit + 1,
          ) as ExternalInstitutionConnection[];
        const items = rows.slice(0, limit);
        const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
        return nextCursor ? { items, nextCursor } : { items };
      },
      upsert(input) {
        const existing = database.sqlite
          .prepare(
            "SELECT id FROM external_institution_connections WHERE provider_connection_id = ? AND remote_connection_id = ?",
          )
          .get(input.providerConnectionId, input.remoteConnectionId) as
          { id: string } | undefined;
        const current = existing
          ? externalInstitutionConnections.findById(existing.id)
          : undefined;
        const timestamp = now();
        const record: ExternalInstitutionConnection = {
          ...input,
          createdAt: current?.createdAt ?? timestamp,
          id: current?.id ?? randomUUID(),
          updatedAt: timestamp,
        };
        database.sqlite
          .prepare(
            `INSERT INTO external_institution_connections
            (id, provider_connection_id, institution_id, remote_connection_id, remote_name,
             remote_organization_id, remote_organization_url, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(provider_connection_id, remote_connection_id) DO UPDATE SET
             institution_id = excluded.institution_id, remote_name = excluded.remote_name,
             remote_organization_id = excluded.remote_organization_id,
             remote_organization_url = excluded.remote_organization_url,
             status = excluded.status, updated_at = excluded.updated_at`,
          )
          .run(
            record.id,
            record.providerConnectionId,
            record.institutionId,
            record.remoteConnectionId,
            record.remoteName,
            record.remoteOrganizationId,
            record.remoteOrganizationUrl,
            record.status,
            record.createdAt,
            record.updatedAt,
          );
        return record;
      },
    };

  function upsertImportedAccount(
    input: NormalizedProviderAccount,
    institutionId: string,
    accountType: AccountType,
  ): string {
    const externalConnection = externalInstitutionConnections.upsert({
      institutionId,
      providerConnectionId: input.providerConnectionId,
      remoteConnectionId: input.remoteConnectionId,
      remoteName: input.remoteConnectionName,
      remoteOrganizationId: input.remoteOrganizationId ?? null,
      remoteOrganizationUrl: input.remoteOrganizationUrl ?? null,
      status: "connected",
    });
    const existing = database.sqlite
      .prepare(
        "SELECT id FROM accounts WHERE external_connection_id = ? AND external_id = ?",
      )
      .get(externalConnection.id, input.remoteAccountId) as
      { id: string } | undefined;
    const timestamp = now();
    const accountId = existing?.id ?? randomUUID();
    database.sqlite
      .prepare(
        `INSERT INTO accounts
          (id, name, account_type, currency, status, institution_id, external_connection_id, external_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
         ON CONFLICT(external_connection_id, external_id) DO UPDATE SET
           name = excluded.name, account_type = excluded.account_type,
           currency = excluded.currency, institution_id = excluded.institution_id,
           status = 'active', updated_at = excluded.updated_at`,
      )
      .run(
        accountId,
        input.accountName,
        accountType,
        input.currency,
        institutionId,
        externalConnection.id,
        input.remoteAccountId,
        timestamp,
        timestamp,
      );
    return accountId;
  }

  function findReview(id: string): AccountImportReview | undefined {
    const row = database.sqlite
      .prepare(`${reviewSelect} WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapReview(row) : undefined;
  }

  function stageReview(
    input: NormalizedProviderAccount,
    accountType: AccountType,
    candidates: readonly Institution[],
    evidence: readonly InstitutionMatchEvidence[],
  ): AccountImportReview {
    const existing = database.sqlite
      .prepare(
        "SELECT id FROM account_import_reviews WHERE provider_connection_id = ? AND remote_connection_id = ? AND remote_account_id = ?",
      )
      .get(
        input.providerConnectionId,
        input.remoteConnectionId,
        input.remoteAccountId,
      ) as { id: string } | undefined;
    const timestamp = now();
    const id = existing?.id ?? randomUUID();
    database.sqlite
      .prepare(
        `INSERT INTO account_import_reviews
          (id, provider_connection_id, remote_connection_id, remote_connection_name,
           remote_organization_id, remote_organization_url, remote_account_id, account_name,
           currency, account_type, candidate_institution_ids_json, match_evidence_json,
           resolved_institution_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?)
         ON CONFLICT(provider_connection_id, remote_connection_id, remote_account_id) DO UPDATE SET
           remote_connection_name = excluded.remote_connection_name,
           remote_organization_id = excluded.remote_organization_id,
           remote_organization_url = excluded.remote_organization_url,
           account_name = excluded.account_name, currency = excluded.currency,
           account_type = excluded.account_type,
           candidate_institution_ids_json = excluded.candidate_institution_ids_json,
           match_evidence_json = excluded.match_evidence_json,
           resolved_institution_id = NULL, status = 'pending', updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.providerConnectionId,
        input.remoteConnectionId,
        input.remoteConnectionName,
        input.remoteOrganizationId ?? null,
        input.remoteOrganizationUrl ?? null,
        input.remoteAccountId,
        input.accountName,
        input.currency,
        accountType,
        JSON.stringify(candidates.map((candidate) => candidate.id)),
        JSON.stringify(evidence),
        timestamp,
        timestamp,
      );
    const review = findReview(id);
    if (!review) throw new Error("Failed to stage account import review.");
    return review;
  }

  const accountImportReviews: AccountImportReviewRepository = {
    list(request) {
      const limit = pageSize(request);
      const rows = database.sqlite
        .prepare(
          `${reviewSelect} WHERE status = 'pending' AND id > ? ORDER BY id LIMIT ?`,
        )
        .all(request?.cursor ?? "", limit + 1) as Record<string, unknown>[];
      const items = rows.slice(0, limit).map(mapReview);
      const nextCursor = rows.length > limit ? items.at(-1)?.id : undefined;
      return nextCursor ? { items, nextCursor } : { items };
    },
    reconcile(input) {
      const providerConnection = providerConnections.findById(
        input.providerConnectionId,
      );
      if (!providerConnection)
        throw new Error("Provider connection not found.");
      const evidence: InstitutionMatchEvidence[] = [];
      const candidates = new Map<string, Institution>();
      if (input.remoteOrganizationId) {
        const matches = database.sqlite
          .prepare(
            `SELECT DISTINCT i.id, i.name, i.website_url AS websiteUrl, i.domain,
               i.created_at AS createdAt, i.updated_at AS updatedAt
             FROM external_institution_connections e
             JOIN provider_connections p ON p.id = e.provider_connection_id
             JOIN institutions i ON i.id = e.institution_id
             WHERE p.provider = ? AND p.provider_namespace = ?
               AND e.remote_organization_id = ?`,
          )
          .all(
            providerConnection.provider,
            providerConnection.providerNamespace,
            input.remoteOrganizationId,
          ) as Institution[];
        for (const match of matches) {
          candidates.set(match.id, match);
          evidence.push({
            institutionId: match.id,
            strategy: "organization_id",
            value: input.remoteOrganizationId,
          });
        }
      }
      const domain = normalizeInstitutionDomain(
        input.remoteOrganizationUrl ?? null,
      );
      if (domain) {
        const matches = database.sqlite
          .prepare(
            "SELECT id, name, website_url AS websiteUrl, domain, created_at AS createdAt, updated_at AS updatedAt FROM institutions WHERE lower(domain) = lower(?)",
          )
          .all(domain) as Institution[];
        for (const match of matches) {
          candidates.set(match.id, match);
          evidence.push({
            institutionId: match.id,
            strategy: "domain",
            value: domain,
          });
        }
      }
      const matchedInstitutions = [...candidates.values()];
      const institution =
        matchedInstitutions.length === 1 ? matchedInstitutions[0] : undefined;
      const existingAccount = database.sqlite
        .prepare(
          `SELECT a.account_type AS accountType
           FROM accounts a
           JOIN external_institution_connections e ON e.id = a.external_connection_id
           WHERE e.provider_connection_id = ? AND e.remote_connection_id = ?
             AND a.external_id = ?`,
        )
        .get(
          input.providerConnectionId,
          input.remoteConnectionId,
          input.remoteAccountId,
        ) as { accountType: AccountType } | undefined;
      const accountType =
        input.accountType ?? existingAccount?.accountType ?? "unclassified";
      const accountId = institution
        ? upsertImportedAccount(input, institution.id, accountType)
        : null;
      if (!institution || accountType === "unclassified") {
        return {
          accountId,
          review: stageReview(
            input,
            accountType,
            matchedInstitutions,
            evidence,
          ),
        };
      }
      return { accountId, review: null };
    },
    resolve(id, input) {
      if (input.accountType === "unclassified") {
        throw new Error("Select a specific account type.");
      }
      if (!institutions.findById(input.institutionId)) {
        throw new Error("Institution not found.");
      }
      const review = findReview(id);
      if (!review) return undefined;
      upsertImportedAccount(
        {
          accountName: review.accountName,
          accountType: input.accountType,
          currency: review.currency,
          providerConnectionId: review.providerConnectionId,
          remoteAccountId: review.remoteAccountId,
          remoteConnectionId: review.remoteConnectionId,
          remoteConnectionName: review.remoteConnectionName,
          remoteOrganizationId: review.remoteOrganizationId,
          remoteOrganizationUrl: review.remoteOrganizationUrl,
        },
        input.institutionId,
        input.accountType,
      );
      database.sqlite
        .prepare(
          "UPDATE account_import_reviews SET account_type = ?, resolved_institution_id = ?, status = 'resolved', updated_at = ? WHERE id = ?",
        )
        .run(input.accountType, input.institutionId, now(), id);
      return findReview(id);
    },
  };

  return {
    accountImportReviews,
    externalInstitutionConnections,
    institutions,
    providerConnections,
  };
}
