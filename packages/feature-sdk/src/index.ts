import { z } from "zod";

export const featureApiVersion = "1" as const;
export const featurePermissionSchema = z.enum([
  "calculation:register",
  "dashboard:register",
  "mcp:register",
  "route:register",
]);
export type FeaturePermission = z.infer<typeof featurePermissionSchema>;

export const featureManifestSchema = z
  .object({
    apiVersion: z.literal(featureApiVersion),
    description: z.string().min(1).max(500),
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]{1,62}$/, "Feature IDs use kebab-case"),
    name: z.string().min(1).max(120),
    permissions: z.array(featurePermissionSchema).min(1).max(4),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, "Version must use semantic version syntax"),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (new Set(manifest.permissions).size !== manifest.permissions.length) {
      context.addIssue({
        code: "custom",
        message: "Permissions must not contain duplicates",
        path: ["permissions"],
      });
    }
  });
export type FeatureManifest = z.infer<typeof featureManifestSchema>;

export type CalculationContribution = Readonly<{
  id: string;
  version: string;
  run: (
    input: Readonly<Record<string, unknown>>,
  ) => Readonly<Record<string, unknown>>;
}>;
export type RouteContribution = Readonly<{
  id: string;
  method: "GET" | "POST";
  path: string;
}>;
export type McpContribution = Readonly<{ description: string; id: string }>;
export type DashboardContribution = Readonly<{
  id: string;
  path: string;
  title: string;
}>;

export type ContributionRegistries = Readonly<{
  calculations: Map<string, CalculationContribution>;
  dashboard: Map<string, DashboardContribution>;
  mcp: Map<string, McpContribution>;
  routes: Map<string, RouteContribution>;
}>;

export type FeatureRegistrationContext = Readonly<{
  registerCalculation: (contribution: CalculationContribution) => void;
  registerDashboard: (contribution: DashboardContribution) => void;
  registerMcp: (contribution: McpContribution) => void;
  registerRoute: (contribution: RouteContribution) => void;
}>;

export type FeatureModule = Readonly<{
  manifest: FeatureManifest;
  register: (context: FeatureRegistrationContext) => void;
}>;

export type FeatureRegistry = Readonly<{
  contributions: ContributionRegistries;
  register: (feature: FeatureModule) => void;
}>;

function addContribution<T extends { id: string }>(
  registry: Map<string, T>,
  contribution: T,
  kind: string,
): void {
  if (registry.has(contribution.id)) {
    throw new Error(`Duplicate ${kind} contribution: ${contribution.id}`);
  }
  registry.set(contribution.id, contribution);
}

export function createFeatureRegistry(
  availablePermissions: readonly FeaturePermission[] = featurePermissionSchema.options,
): FeatureRegistry {
  const contributions: ContributionRegistries = {
    calculations: new Map(),
    dashboard: new Map(),
    mcp: new Map(),
    routes: new Map(),
  };

  return Object.freeze({
    contributions,
    register(feature) {
      const manifest = featureManifestSchema.parse(feature.manifest);
      const denied = manifest.permissions.filter(
        (permission) => !availablePermissions.includes(permission),
      );
      if (denied.length > 0) {
        throw new Error(
          `Feature ${manifest.id} requests unavailable permissions: ${denied.join(", ")}`,
        );
      }
      const requested = new Set(manifest.permissions);
      feature.register({
        registerCalculation(contribution) {
          if (!requested.has("calculation:register"))
            throw new Error(`${manifest.id} lacks calculation permission`);
          addContribution(
            contributions.calculations,
            contribution,
            "calculation",
          );
        },
        registerDashboard(contribution) {
          if (!requested.has("dashboard:register"))
            throw new Error(`${manifest.id} lacks dashboard permission`);
          addContribution(contributions.dashboard, contribution, "dashboard");
        },
        registerMcp(contribution) {
          if (!requested.has("mcp:register"))
            throw new Error(`${manifest.id} lacks MCP permission`);
          addContribution(contributions.mcp, contribution, "MCP");
        },
        registerRoute(contribution) {
          if (!requested.has("route:register"))
            throw new Error(`${manifest.id} lacks route permission`);
          addContribution(contributions.routes, contribution, "route");
        },
      });
    },
  });
}
