export type SimpleFinClaim = Readonly<{
  accessUrl: string;
  providerNamespace: string;
}>;

export interface SimpleFinClient {
  claim(setupToken: string): Promise<SimpleFinClaim>;
}

export type SimpleFinError = Readonly<{
  accountId: string | null;
  code: string;
  connectionId: string | null;
  message: string;
}>;

export type SimpleFinConnection = Readonly<{
  id: string;
  name: string;
  organizationId: string;
  organizationName: string | null;
  organizationUrl: string | null;
}>;

export type SimpleFinTransaction = Readonly<{
  amount: string;
  description: string;
  extra: Readonly<Record<string, unknown>>;
  id: string;
  pending: boolean;
  posted: number;
  transactedAt: number | null;
}>;

export type SimpleFinAccount = Readonly<{
  availableBalance: string | null;
  balance: string;
  balanceDate: number;
  connectionId: string;
  currency: string;
  id: string;
  name: string;
  transactions: readonly SimpleFinTransaction[];
}>;

export type SimpleFinAccountSet = Readonly<{
  accounts: readonly SimpleFinAccount[];
  connections: readonly SimpleFinConnection[];
  errors: readonly SimpleFinError[];
}>;

export type SimpleFinFetchRequest = Readonly<{
  endDate: number;
  includePending: boolean;
  startDate: number;
}>;

export interface SimpleFinAccountClient {
  fetchAccounts(
    accessUrl: string,
    input: SimpleFinFetchRequest,
  ): Promise<SimpleFinAccountSet>;
}

export type SimpleFinClaimErrorKind =
  "already_claimed" | "invalid_response" | "invalid_token" | "unavailable";

export class SimpleFinClaimError extends Error {
  public constructor(
    public readonly kind: SimpleFinClaimErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SimpleFinClaimError";
  }
}

export type SimpleFinFetchErrorKind =
  | "invalid_response"
  | "needs_reauth"
  | "payment_required"
  | "rate_limited"
  | "unavailable";

export class SimpleFinFetchError extends Error {
  public constructor(
    public readonly kind: SimpleFinFetchErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SimpleFinFetchError";
  }
}

function decodeClaimUrl(setupToken: string): URL {
  const token = setupToken.trim();
  if (
    token.length === 0 ||
    token.length > 8_192 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(token) ||
    token.length % 4 === 1
  ) {
    throw new SimpleFinClaimError(
      "invalid_token",
      "Enter a valid SimpleFIN setup token.",
    );
  }

  const padded = token.padEnd(
    token.length + ((4 - (token.length % 4)) % 4),
    "=",
  );
  const decoded = Buffer.from(padded, "base64").toString("utf8");
  try {
    const url = new URL(decoded);
    if (url.protocol !== "https:") throw new Error("HTTPS is required");
    return url;
  } catch {
    throw new SimpleFinClaimError(
      "invalid_token",
      "Enter a valid HTTPS SimpleFIN setup token.",
    );
  }
}

function parseAccessUrl(value: string): SimpleFinClaim {
  try {
    const accessUrl = new URL(value.trim());
    if (
      accessUrl.protocol !== "https:" ||
      accessUrl.username.length === 0 ||
      accessUrl.password.length === 0
    ) {
      throw new Error("Invalid access URL");
    }
    accessUrl.search = "";
    accessUrl.hash = "";

    const namespace = new URL(accessUrl.href);
    namespace.username = "";
    namespace.password = "";
    const providerNamespace = namespace.href.replace(/\/$/, "");
    if (providerNamespace.length > 500) throw new Error("Namespace too long");
    return {
      accessUrl: accessUrl.href.replace(/\/$/, ""),
      providerNamespace,
    };
  } catch {
    throw new SimpleFinClaimError(
      "invalid_response",
      "SimpleFIN returned an invalid access credential. No connection was saved.",
    );
  }
}

function cleanText(value: unknown, fallback: string, max = 500): string {
  if (typeof value !== "string") return fallback;
  const cleaned = [...value]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .trim();
  return cleaned.length === 0 ? fallback : cleaned.slice(0, max);
}

function requiredString(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${field}`);
  }
  return cleanText(value, field, max);
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function optionalHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (url.protocol !== "https:") throw new Error("HTTPS is required");
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.href.replace(/\/$/, "");
}

function parseAccountSet(value: unknown): SimpleFinAccountSet {
  try {
    if (typeof value !== "object" || value === null) throw new Error();
    const input = value as Record<string, unknown>;
    if (!Array.isArray(input.accounts) || !Array.isArray(input.connections)) {
      throw new Error();
    }
    const connections = input.connections.map((item) => {
      if (typeof item !== "object" || item === null) throw new Error();
      const row = item as Record<string, unknown>;
      return {
        id: requiredString(row.conn_id, "connection id"),
        name: requiredString(row.name, "connection name"),
        organizationId: requiredString(row.org_id, "organization id"),
        organizationName:
          typeof row.org_name === "string"
            ? cleanText(row.org_name, "Institution")
            : null,
        organizationUrl: optionalHttpsUrl(row.org_url),
      };
    });
    const accounts = input.accounts.map((item) => {
      if (typeof item !== "object" || item === null) throw new Error();
      const row = item as Record<string, unknown>;
      const transactions = Array.isArray(row.transactions)
        ? row.transactions.map((transaction) => {
            if (typeof transaction !== "object" || transaction === null) {
              throw new Error();
            }
            const record = transaction as Record<string, unknown>;
            return {
              amount: requiredString(record.amount, "transaction amount", 100),
              description: requiredString(
                record.description,
                "transaction description",
              ),
              extra:
                typeof record.extra === "object" && record.extra !== null
                  ? (record.extra as Record<string, unknown>)
                  : {},
              id: requiredString(record.id, "transaction id"),
              pending: record.pending === true,
              posted: requiredNumber(record.posted, "posted timestamp"),
              transactedAt:
                record.transacted_at === undefined
                  ? null
                  : requiredNumber(
                      record.transacted_at,
                      "transacted timestamp",
                    ),
            };
          })
        : [];
      return {
        availableBalance:
          row["available-balance"] === undefined
            ? null
            : requiredString(
                row["available-balance"],
                "available balance",
                100,
              ),
        balance: requiredString(row.balance, "balance", 100),
        balanceDate: requiredNumber(row["balance-date"], "balance date"),
        connectionId: requiredString(row.conn_id, "connection id"),
        currency: requiredString(row.currency, "currency", 100),
        id: requiredString(row.id, "account id"),
        name: requiredString(row.name, "account name", 200),
        transactions,
      };
    });
    const structuredErrors = Array.isArray(input.errlist)
      ? input.errlist.map((item) => {
          if (typeof item !== "object" || item === null) throw new Error();
          const row = item as Record<string, unknown>;
          return {
            accountId:
              typeof row.account_id === "string"
                ? cleanText(row.account_id, "unknown")
                : null,
            code: requiredString(row.code, "error code", 100),
            connectionId:
              typeof row.conn_id === "string"
                ? cleanText(row.conn_id, "unknown")
                : null,
            message: requiredString(row.msg, "SimpleFIN reported an error"),
          };
        })
      : [];
    const legacyErrors = Array.isArray(input.errors)
      ? input.errors
          .filter((item): item is string => typeof item === "string")
          .map((message) => ({
            accountId: null,
            code: "gen.",
            connectionId: null,
            message: cleanText(message, "SimpleFIN reported an error"),
          }))
      : [];
    return {
      accounts,
      connections,
      errors: [...structuredErrors, ...legacyErrors],
    };
  } catch {
    throw new SimpleFinFetchError(
      "invalid_response",
      "SimpleFIN returned account data in an unsupported format.",
    );
  }
}

export class HttpSimpleFinClient
  implements SimpleFinClient, SimpleFinAccountClient
{
  public constructor(private readonly request: typeof fetch = fetch) {}

  public async claim(setupToken: string): Promise<SimpleFinClaim> {
    const claimUrl = decodeClaimUrl(setupToken);
    let response: Response;
    try {
      response = await this.request(claimUrl, {
        method: "POST",
        redirect: "error",
      });
    } catch {
      throw new SimpleFinClaimError(
        "unavailable",
        "SimpleFIN could not be reached. No connection was saved.",
      );
    }

    if (response.status === 403) {
      throw new SimpleFinClaimError(
        "already_claimed",
        "The setup token could not be claimed. It may already have been used or compromised; disable it in SimpleFIN and create a new token.",
      );
    }
    if (!response.ok) {
      throw new SimpleFinClaimError(
        "unavailable",
        "SimpleFIN could not complete the connection. No connection was saved.",
      );
    }
    return parseAccessUrl(await response.text());
  }

  public async fetchAccounts(
    accessUrl: string,
    input: SimpleFinFetchRequest,
  ): Promise<SimpleFinAccountSet> {
    let requestUrl: URL;
    let authorization: string;
    try {
      const credential = new URL(accessUrl);
      if (
        credential.protocol !== "https:" ||
        credential.username === "" ||
        credential.password === ""
      ) {
        throw new Error();
      }
      authorization = `Basic ${Buffer.from(
        `${decodeURIComponent(credential.username)}:${decodeURIComponent(credential.password)}`,
      ).toString("base64")}`;
      credential.username = "";
      credential.password = "";
      credential.pathname = `${credential.pathname.replace(/\/$/, "")}/accounts`;
      credential.search = "";
      credential.searchParams.set("version", "2");
      credential.searchParams.set("start-date", String(input.startDate));
      credential.searchParams.set("end-date", String(input.endDate));
      if (input.includePending) credential.searchParams.set("pending", "1");
      requestUrl = credential;
    } catch {
      throw new SimpleFinFetchError(
        "needs_reauth",
        "The saved SimpleFIN credential is invalid. Reconnect SimpleFIN.",
      );
    }

    let response: Response;
    try {
      response = await this.request(requestUrl, {
        headers: { authorization },
        redirect: "error",
      });
    } catch {
      throw new SimpleFinFetchError(
        "unavailable",
        "SimpleFIN could not be reached. Try syncing again later.",
      );
    }
    if (response.status === 403) {
      throw new SimpleFinFetchError(
        "needs_reauth",
        "SimpleFIN access was revoked or expired. Reconnect SimpleFIN.",
      );
    }
    if (response.status === 402) {
      throw new SimpleFinFetchError(
        "payment_required",
        "SimpleFIN requires attention to the Bridge subscription.",
      );
    }
    if (response.status === 429) {
      throw new SimpleFinFetchError(
        "rate_limited",
        "SimpleFIN's daily request limit was reached. Try again later.",
      );
    }
    if (!response.ok) {
      throw new SimpleFinFetchError(
        "unavailable",
        "SimpleFIN could not complete the sync. Try again later.",
      );
    }
    return parseAccountSet(await response.json());
  }
}
