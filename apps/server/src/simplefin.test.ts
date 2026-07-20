import { expect, test, vi } from "vitest";

import { HttpSimpleFinClient, SimpleFinClaimError } from "./simplefin.js";

function setupToken(url: string): string {
  return Buffer.from(url).toString("base64");
}

test("claims an HTTPS setup token and strips credentials from its namespace", async () => {
  const request = vi.fn().mockResolvedValue(
    new Response("https://user:password@bridge.example/simplefin", {
      status: 200,
    }),
  );
  const client = new HttpSimpleFinClient(request);

  await expect(
    client.claim(setupToken("https://bridge.example/simplefin/claim/once")),
  ).resolves.toEqual({
    accessUrl: "https://user:password@bridge.example/simplefin",
    providerNamespace: "https://bridge.example/simplefin",
  });
  expect(request).toHaveBeenCalledWith(
    new URL("https://bridge.example/simplefin/claim/once"),
    { method: "POST", redirect: "error" },
  );
});

test("rejects malformed and non-HTTPS setup tokens before making a request", async () => {
  const request = vi.fn();
  const client = new HttpSimpleFinClient(request);

  await expect(client.claim("not a token")).rejects.toMatchObject({
    kind: "invalid_token",
  });
  await expect(
    client.claim(setupToken("http://bridge.example/simplefin/claim/once")),
  ).rejects.toMatchObject({ kind: "invalid_token" });
  expect(request).not.toHaveBeenCalled();
});

test("reports a 403 as a possibly compromised one-time token without echoing it", async () => {
  const token = setupToken("https://bridge.example/simplefin/claim/secret");
  const client = new HttpSimpleFinClient(
    vi.fn().mockResolvedValue(new Response("", { status: 403 })),
  );

  const error = await client.claim(token).catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(SimpleFinClaimError);
  expect(error).toMatchObject({ kind: "already_claimed" });
  expect(String(error)).not.toContain(token);
  expect(String(error)).toContain("compromised");
});

test("rejects access URLs that are insecure or lack Basic Auth credentials", async () => {
  const token = setupToken("https://bridge.example/simplefin/claim/once");
  const client = new HttpSimpleFinClient(
    vi
      .fn()
      .mockResolvedValue(
        new Response("https://bridge.example/simplefin", { status: 200 }),
      ),
  );

  await expect(client.claim(token)).rejects.toMatchObject({
    kind: "invalid_response",
  });
});

test("fetches version 2 accounts with Basic Auth and normalizes structured data", async () => {
  const request = vi.fn().mockResolvedValue(
    Response.json({
      accounts: [
        {
          "available-balance": "42.00",
          balance: "50.00",
          "balance-date": 1_752_883_200,
          conn_id: "connection-1",
          currency: "USD",
          id: "account-1",
          name: "Checking",
          transactions: [
            {
              amount: "-8.00",
              description: "Coffee",
              extra: { category: "Dining" },
              id: "transaction-1",
              pending: true,
              posted: 0,
              transacted_at: 1_752_883_200,
            },
          ],
        },
      ],
      connections: [
        {
          conn_id: "connection-1",
          name: "Example Bank login",
          org_id: "institution-1",
          org_name: "Example Bank",
          org_url: "https://example.test",
        },
      ],
      errlist: [
        {
          code: "act.missingdata",
          msg: "Some history is not available.\u0000",
          account_id: "account-1",
        },
      ],
    }),
  );
  const client = new HttpSimpleFinClient(request);

  const result = await client.fetchAccounts(
    "https://simplefin-user:simplefin-password@bridge.example/simplefin",
    { endDate: 200, includePending: true, startDate: 100 },
  );

  expect(result).toMatchObject({
    accounts: [
      {
        availableBalance: "42.00",
        connectionId: "connection-1",
        transactions: [{ pending: true }],
      },
    ],
    connections: [{ organizationName: "Example Bank" }],
    errors: [
      { code: "act.missingdata", message: "Some history is not available." },
    ],
  });
  const [url, init] = request.mock.calls[0] as [URL, RequestInit];
  expect(url.href).toBe(
    "https://bridge.example/simplefin/accounts?version=2&start-date=100&end-date=200&pending=1",
  );
  expect(url.href).not.toContain("simplefin-password");
  expect(init.headers).toEqual({
    authorization: `Basic ${Buffer.from("simplefin-user:simplefin-password").toString("base64")}`,
  });
});
