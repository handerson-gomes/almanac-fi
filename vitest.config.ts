import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/dist/**"],
      provider: "v8",
      thresholds: {
        branches: 40,
        functions: 65,
        lines: 75,
        statements: 75,
      },
    },
    include: [
      "apps/**/src/**/*.test.ts",
      "apps/**/src/**/*.test.tsx",
      "scripts/**/*.test.ts",
      "features/**/src/**/*.test.ts",
      "packages/**/src/**/*.test.ts",
      "packages/**/src/**/*.test.tsx",
    ],
    environmentMatchGlobs: [["apps/web/src/**/*.test.tsx", "jsdom"]],
  },
});
