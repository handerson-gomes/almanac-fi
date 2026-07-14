import { mkdtemp, rm } from "node:fs/promises";
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

  test("rejects an invalid port with an actionable error", () => {
    expect(() =>
      loadConfig({ env: { ALMANAC_FI_PORT: "not-a-port" } }),
    ).toThrow(/Invalid configuration: ALMANAC_FI_PORT/);
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
