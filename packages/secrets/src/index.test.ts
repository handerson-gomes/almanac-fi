import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { schema } from "@almanac-fi/db";
import {
  EnvironmentSecretStore,
  FakeSecretStore,
  FileSecretStore,
  environmentVariableName,
  secretKeySchema,
} from "./index.js";

test("environment stores derive safe names and redact diagnostics", () => {
  const key = secretKeySchema.parse("simplefin-access-token");
  const store = new EnvironmentSecretStore({
    ALMANAC_FI_SECRET_SIMPLEFIN_ACCESS_TOKEN: "secret-value",
  });
  expect(environmentVariableName(key)).toBe(
    "ALMANAC_FI_SECRET_SIMPLEFIN_ACCESS_TOKEN",
  );
  expect(store.get(key)).toBe("secret-value");
  expect(store.diagnostics()).toEqual({
    configuredKeys: ["simplefin-access-token"],
    store: "environment",
  });
  expect(JSON.stringify(store.diagnostics())).not.toContain("secret-value");
  store.set(key, "replacement");
  expect(store.get(key)).toBe("replacement");
  store.delete(key);
  expect(store.has(key)).toBe(false);
});

test("file stores persist secrets with owner-only permissions", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "almanac-fi-secrets-"));
  const store = new FileSecretStore(dataHome);

  store.set("simplefin-example", "https://user:password@example.test");
  expect(new FileSecretStore(dataHome).get("simplefin-example")).toBe(
    "https://user:password@example.test",
  );
  expect((await stat(join(dataHome, "secrets"))).mode & 0o777).toBe(0o700);
  expect(
    (await stat(join(dataHome, "secrets", "simplefin-example"))).mode & 0o777,
  ).toBe(0o600);
  expect(
    await readFile(join(dataHome, "secrets", "simplefin-example"), "utf8"),
  ).not.toBe("");
  expect(store.diagnostics()).toEqual({
    configuredKeys: ["simplefin-example"],
    store: "file",
  });
  expect(JSON.stringify(store.diagnostics())).not.toContain("password");

  store.delete("simplefin-example");
  expect(store.has("simplefin-example")).toBe(false);
  await rm(dataHome, { force: true, recursive: true });
});

test("fake stores keep secret material out of diagnostics", () => {
  const store = new FakeSecretStore({ "provider-key": "not-logged" });
  expect(store.has("provider-key")).toBe(true);
  expect(store.diagnostics()).toEqual({
    configuredKeys: ["provider-key"],
    store: "fake",
  });
});

test("database schema has no credential storage columns", () => {
  const schemaNames = Object.keys(schema).join(",").toLowerCase();
  expect(schemaNames).not.toContain("secret");
  expect(schemaNames).not.toContain("credential");
});
