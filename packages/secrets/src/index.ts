import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { z } from "zod";

export const secretKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,62}$/, "Secret keys use kebab-case");
export type SecretKey = z.infer<typeof secretKeySchema>;

export interface SecretStore {
  delete(key: SecretKey): void;
  get(key: SecretKey): string | undefined;
  has(key: SecretKey): boolean;
  set(key: SecretKey, value: string): void;
  diagnostics(): Readonly<{
    configuredKeys: readonly SecretKey[];
    store: string;
  }>;
}

export function environmentVariableName(key: SecretKey): string {
  return `ALMANAC_FI_SECRET_${key.replaceAll("-", "_").toUpperCase()}`;
}

export class EnvironmentSecretStore implements SecretStore {
  public constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  public get(key: SecretKey): string | undefined {
    return this.environment[
      environmentVariableName(secretKeySchema.parse(key))
    ];
  }

  public delete(key: SecretKey): void {
    delete this.environment[
      environmentVariableName(secretKeySchema.parse(key))
    ];
  }

  public has(key: SecretKey): boolean {
    return this.get(key) !== undefined;
  }

  public set(key: SecretKey, value: string): void {
    this.environment[environmentVariableName(secretKeySchema.parse(key))] =
      value;
  }

  public diagnostics(): Readonly<{
    configuredKeys: readonly SecretKey[];
    store: string;
  }> {
    const prefix = "ALMANAC_FI_SECRET_";
    const configuredKeys = Object.keys(this.environment)
      .filter(
        (name) =>
          name.startsWith(prefix) && this.environment[name] !== undefined,
      )
      .map(
        (name) =>
          name
            .slice(prefix.length)
            .toLowerCase()
            .replaceAll("_", "-") as SecretKey,
      )
      .sort();
    return Object.freeze({ configuredKeys, store: "environment" });
  }
}

export class FakeSecretStore implements SecretStore {
  private readonly values = new Map<SecretKey, string>();

  public constructor(values: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(values))
      this.values.set(secretKeySchema.parse(key), value);
  }

  public get(key: SecretKey): string | undefined {
    return this.values.get(secretKeySchema.parse(key));
  }
  public delete(key: SecretKey): void {
    this.values.delete(secretKeySchema.parse(key));
  }
  public has(key: SecretKey): boolean {
    return this.values.has(secretKeySchema.parse(key));
  }
  public set(key: SecretKey, value: string): void {
    this.values.set(secretKeySchema.parse(key), value);
  }
  public diagnostics(): Readonly<{
    configuredKeys: readonly SecretKey[];
    store: string;
  }> {
    return Object.freeze({
      configuredKeys: [...this.values.keys()].sort(),
      store: "fake",
    });
  }
}

export class FileSecretStore implements SecretStore {
  private readonly directory: string;

  public constructor(dataHome: string) {
    this.directory = join(dataHome, "secrets");
  }

  private path(key: SecretKey): string {
    return join(this.directory, secretKeySchema.parse(key));
  }

  public delete(key: SecretKey): void {
    rmSync(this.path(key), { force: true });
  }

  public get(key: SecretKey): string | undefined {
    const path = this.path(key);
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  }

  public has(key: SecretKey): boolean {
    return existsSync(this.path(key));
  }

  public set(key: SecretKey, value: string): void {
    mkdirSync(this.directory, { mode: 0o700, recursive: true });
    chmodSync(this.directory, 0o700);
    const path = this.path(key);
    writeFileSync(path, value, { encoding: "utf8", mode: 0o600 });
    chmodSync(path, 0o600);
  }

  public diagnostics(): Readonly<{
    configuredKeys: readonly SecretKey[];
    store: string;
  }> {
    const configuredKeys = existsSync(this.directory)
      ? readdirSync(this.directory)
          .filter(
            (name): name is SecretKey =>
              secretKeySchema.safeParse(name).success,
          )
          .sort()
      : [];
    return Object.freeze({ configuredKeys, store: "file" });
  }
}
