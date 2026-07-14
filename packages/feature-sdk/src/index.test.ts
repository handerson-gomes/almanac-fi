import { expect, test } from "vitest";

import { createFeatureRegistry, type FeatureModule } from "./index.js";

test("registers each supported contribution through one feature contract", () => {
  const registry = createFeatureRegistry();
  const feature: FeatureModule = {
    manifest: {
      apiVersion: "1",
      description: "A complete sample feature.",
      id: "sample-feature",
      name: "Sample Feature",
      permissions: [
        "calculation:register",
        "route:register",
        "mcp:register",
        "dashboard:register",
      ],
      version: "1.0.0",
    },
    register(context) {
      context.registerCalculation({
        id: "sample.calculate",
        run: (input) => input,
        version: "1",
      });
      context.registerRoute({
        id: "sample.route",
        method: "GET",
        path: "/sample",
      });
      context.registerMcp({
        description: "Sample MCP capability",
        id: "sample.mcp",
      });
      context.registerDashboard({
        id: "sample.dashboard",
        path: "/sample",
        title: "Sample",
      });
    },
  };

  registry.register(feature);
  expect(registry.contributions.calculations).toHaveLength(1);
  expect(registry.contributions.routes).toHaveLength(1);
  expect(registry.contributions.mcp).toHaveLength(1);
  expect(registry.contributions.dashboard).toHaveLength(1);
});

test("rejects invalid and unauthorized manifests before registration", () => {
  const registry = createFeatureRegistry(["calculation:register"]);
  expect(() =>
    registry.register({
      manifest: { id: "BAD" },
      register: () => undefined,
    } as unknown as FeatureModule),
  ).toThrow();
  expect(() =>
    registry.register({
      manifest: {
        apiVersion: "1",
        description: "x",
        id: "denied",
        name: "Denied",
        permissions: ["mcp:register"],
        version: "1.0.0",
      },
      register: () => undefined,
    }),
  ).toThrow(/unavailable permissions/);
});
