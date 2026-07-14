import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const featureIdPattern = /^[a-z][a-z0-9-]{1,62}$/;

export type CreateFeatureOptions = Readonly<{ id: string; root?: string }>;

function featureTitle(id: string): string {
  return id
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function packageJson(id: string): string {
  return (
    JSON.stringify(
      {
        name: `@almanac-fi/${id}`,
        private: true,
        scripts: { build: "tsc --build", typecheck: "tsc --noEmit" },
        type: "module",
        version: "0.0.0",
        dependencies: { "@almanac-fi/feature-sdk": "workspace:*" },
      },
      null,
      2,
    ) + "\n"
  );
}

export async function createFeature(
  options: CreateFeatureOptions,
): Promise<string> {
  if (!featureIdPattern.test(options.id)) {
    throw new Error(
      "Feature ID must use kebab-case and be 2–63 characters long.",
    );
  }
  const root = resolve(options.root ?? process.cwd());
  const target = join(root, "features", options.id);
  if (existsSync(target)) throw new Error(`Feature already exists: ${target}`);

  const title = featureTitle(options.id);
  const files: Readonly<Record<string, string>> = {
    "README.md": `# ${title}\n\nGenerated feature scaffold. Replace each placeholder with reviewed, deterministic feature behavior.\n`,
    "evaluation/cases.json": "[]\n",
    "fixtures/README.md":
      "# Fixture notes\n\nAdd synthetic-only feature fixtures here.\n",
    "src/api.ts":
      'export const apiContribution = { id: "REPLACE.api", method: "GET" as const, path: "/replace" };\n',
    "src/calculation.ts":
      "export function calculate(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> { return input; }\n",
    "src/index.test.ts": `import { expect, test } from "vitest";\nimport { feature } from "./index.js";\ntest("registers ${options.id}", () => expect(feature.manifest.id).toBe("${options.id}"));\n`,
    "src/index.ts": `import type { FeatureModule } from "@almanac-fi/feature-sdk";\nimport { calculate } from "./calculation.js";\n\nexport const feature: FeatureModule = {\n  manifest: { apiVersion: "1", description: "${title} feature.", id: "${options.id}", name: "${title}", permissions: ["calculation:register", "dashboard:register", "mcp:register", "route:register"], version: "0.0.0" },\n  register(context) {\n    context.registerCalculation({ id: "${options.id}.calculate", run: calculate, version: "1" });\n    context.registerRoute({ id: "${options.id}.route", method: "GET", path: "/${options.id}" });\n    context.registerMcp({ description: "${title} capability", id: "${options.id}.mcp" });\n    context.registerDashboard({ id: "${options.id}.dashboard", path: "/${options.id}", title: "${title}" });\n  },\n};\n`,
    "src/mcp.ts":
      'export const mcpContribution = { description: "REPLACE capability", id: "REPLACE.mcp" };\n',
    "src/ui.ts":
      'export const dashboardContribution = { id: "REPLACE.dashboard", path: "/replace", title: "Replace" };\n',
    "src/workflow.ts":
      'export const workflow = { id: "REPLACE.workflow", version: "1" };\n',
    "tsconfig.json":
      JSON.stringify(
        {
          extends: "../../tsconfig.base.json",
          compilerOptions: {
            baseUrl: "../..",
            composite: true,
            declaration: true,
            declarationMap: true,
            outDir: "./dist",
            paths: {
              "@almanac-fi/feature-sdk": ["packages/feature-sdk/src/index.ts"],
            },
            rootDir: "../..",
            tsBuildInfoFile: "./dist/.tsbuildinfo",
          },
          exclude: ["src/**/*.test.ts"],
          include: ["src/**/*.ts", "../../packages/feature-sdk/src/**/*.ts"],
        },
        null,
        2,
      ) + "\n",
    "package.json": packageJson(options.id),
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(target, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
  return target;
}

const id = process.argv[2];
if (id !== undefined && import.meta.url.endsWith("/create-feature.ts")) {
  createFeature({ id })
    .then((target) => console.info(`Created feature scaffold: ${target}`))
    .catch((error: unknown) => {
      console.error(
        error instanceof Error ? error.message : "Unable to create feature.",
      );
      process.exitCode = 1;
    });
}
