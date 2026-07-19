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
