import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";

import { parse } from "dotenv";
import { z } from "zod";

const environmentSchema = z.object({
  FINANCIAL_AI_DATA_HOME: z.string().trim().min(1).optional(),
  FINANCIAL_AI_HOST: z
    .string()
    .regex(/^\d{1,3}(?:\.\d{1,3}){3}$/, "Host must be an IPv4 address")
    .default("127.0.0.1"),
  FINANCIAL_AI_LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
  FINANCIAL_AI_PORT: z.coerce.number().int().min(1).max(65_535).default(4310),
});

export type AppConfig = Readonly<{
  dataHome: string;
  host: string;
  logLevel: "debug" | "info" | "warn" | "error";
  port: number;
}>;

export type ConfigOptions = Readonly<{
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  envFileContents?: string;
}>;

function defaultDataHome(env: NodeJS.ProcessEnv): string {
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "financial-ai");
  }

  if (platform() === "win32") {
    return join(
      env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
      "financial-ai",
    );
  }

  return join(
    env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    "financial-ai",
  );
}

function parseEnvironment(
  options: ConfigOptions,
): z.infer<typeof environmentSchema> {
  const env = options.env ?? process.env;
  const envFilePath = join(options.cwd ?? process.cwd(), ".env");
  const fromFile = options.envFileContents
    ? parse(options.envFileContents)
    : existsSync(envFilePath)
      ? parse(readFileSync(envFilePath))
      : {};
  const result = environmentSchema.safeParse({ ...fromFile, ...env });

  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid configuration: ${messages.join("; ")}`);
  }

  return result.data;
}

export function loadConfig(options: ConfigOptions = {}): AppConfig {
  const env = options.env ?? process.env;
  const values = parseEnvironment(options);

  return Object.freeze({
    dataHome: resolve(values.FINANCIAL_AI_DATA_HOME ?? defaultDataHome(env)),
    host: values.FINANCIAL_AI_HOST,
    logLevel: values.FINANCIAL_AI_LOG_LEVEL,
    port: values.FINANCIAL_AI_PORT,
  });
}

export async function ensureDataHome(
  config: Pick<AppConfig, "dataHome">,
): Promise<string> {
  await mkdir(config.dataHome, { recursive: true });
  return config.dataHome;
}

export function startupDiagnostics(
  config: AppConfig,
): Readonly<Record<string, string | number>> {
  return Object.freeze({
    dataHome: config.dataHome,
    host: config.host,
    logLevel: config.logLevel,
    port: config.port,
  });
}

export function databasePath(config: Pick<AppConfig, "dataHome">): string {
  return join(config.dataHome, "financial-ai.sqlite");
}

export function configDirectory(config: Pick<AppConfig, "dataHome">): string {
  return dirname(config.dataHome);
}
