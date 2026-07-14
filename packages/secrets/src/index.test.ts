import { expect, test } from "vitest";

import { schema } from "@almanac-fi/db";
import {
  EnvironmentSecretStore,
  FakeSecretStore,
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
