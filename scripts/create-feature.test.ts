import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { expect, test } from "vitest";

import { createFeature } from "./create-feature.js";

const execFileAsync = promisify(execFile);

test("generates a reviewed feature scaffold that typechecks", async () => {
  const id = "generated-feature-test";
  const target = join(process.cwd(), "features", id);
  await rm(target, { force: true, recursive: true });
  try {
    await expect(createFeature({ id })).resolves.toBe(target);
    expect(await import(join(target, "src", "index.ts"))).toHaveProperty(
      "feature.manifest.id",
      id,
    );
    await expect(
      execFileAsync("pnpm", ["--dir", target, "typecheck"]),
    ).resolves.toBeDefined();
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});
