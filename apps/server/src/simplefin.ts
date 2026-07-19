export type SimpleFinClaim = Readonly<{
  accessUrl: string;
  providerNamespace: string;
}>;

export interface SimpleFinClient {
  claim(setupToken: string): Promise<SimpleFinClaim>;
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

export class HttpSimpleFinClient implements SimpleFinClient {
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
}
