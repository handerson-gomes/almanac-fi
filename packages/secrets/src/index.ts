import { z } from "zod";

export const secretKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,62}$/, "Secret keys use kebab-case");
export type SecretKey = z.infer<typeof secretKeySchema>;

export interface SecretStore {
  get(key: SecretKey): string | undefined;
  has(key: SecretKey): boolean;
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

  public has(key: SecretKey): boolean {
    return this.get(key) !== undefined;
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
  public has(key: SecretKey): boolean {
    return this.values.has(secretKeySchema.parse(key));
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
