import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { ensureDataHome, loadConfig, startupDiagnostics } from "./index.js";

describe("configuration", () => {
  test("environment values override .env values", () => {
    const config = loadConfig({
      env: { ALMANAC_FI_PORT: "4510" },
      envFileContents: "ALMANAC_FI_PORT=4511\nALMANAC_FI_LOG_LEVEL=debug",
    });

    expect(config.port).toBe(4510);
    expect(config.logLevel).toBe("debug");
  });

  test("treats blank optional .env values as unset", () => {
    const config = loadConfig({
      env: {},
      envFileContents: "ALMANAC_FI_DATA_HOME=\nSIMPLE_FIN_TOKEN=\n",
    });

    expect(config.dataHome).toBeTruthy();
    expect(config.simpleFinSetupToken).toBeUndefined();
  });

  test("rejects an invalid port with an actionable error", () => {
    expect(() =>
      loadConfig({ env: { ALMANAC_FI_PORT: "not-a-port" } }),
    ).toThrow(/Invalid configuration: ALMANAC_FI_PORT/);
  });

  test("loads the optional SimpleFIN setup token without exposing it in diagnostics", () => {
    const config = loadConfig({
      env: {},
      envFileContents: "SIMPLE_FIN_TOKEN=one-time-setup-token",
    });

    expect(config.simpleFinSetupToken).toBe("one-time-setup-token");
    expect(JSON.stringify(startupDiagnostics(config))).not.toContain(
      "one-time-setup-token",
    );
  });

  test("finds the workspace .env when an app runs from its package directory", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "almanac-fi-workspace-"));
    const serverDirectory = join(workspace, "apps", "server");
    await mkdir(serverDirectory, { recursive: true });
    await writeFile(join(workspace, "pnpm-workspace.yaml"), "packages: []\n");
    await writeFile(
      join(workspace, ".env"),
      "SIMPLE_FIN_TOKEN=workspace-setup-token\n",
    );

    const config = loadConfig({ cwd: serverDirectory, env: {} });

    expect(config.simpleFinSetupToken).toBe("workspace-setup-token");
    await rm(workspace, { force: true, recursive: true });
  });

  test("creates a local data directory and keeps diagnostics secret-free", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "almanac-fi-config-"));
    const dataHome = join(tempDirectory, "data");
    const config = loadConfig({ env: { ALMANAC_FI_DATA_HOME: dataHome } });

    await expect(ensureDataHome(config)).resolves.toBe(dataHome);
    expect(startupDiagnostics(config)).toEqual(
      expect.objectContaining({ dataHome }),
    );
    expect(startupDiagnostics(config)).not.toHaveProperty("apiKey");

    await rm(tempDirectory, { force: true, recursive: true });
  });
});
