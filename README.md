# Almanac FI

> Track your money. Forecast your future. Build your FI.

Almanac FI is a local-first workbench for tracking, forecasting, and (eventually) automating your path to FI. It is a strict TypeScript, ESM-first pnpm workspace organized as a modular monolith: financial behavior belongs in reusable packages, while server, dashboard, CLI, and MCP delivery surfaces stay separate.

## Prerequisites

- Node.js 22 or newer (the checked-in `.node-version` records the development version)
- pnpm 10 or newer

## Getting started

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm dev
```

`pnpm dev` starts the Fastify API at `http://127.0.0.1:4310`; `pnpm dev:web` starts the Vite dashboard with its `/api` proxy. Use `pnpm dev:cli` or `pnpm dev:mcp` for the other boundary bootstraps. `pnpm start` runs the compiled API after `pnpm build`.

## Workspace layout

```text
apps/
  server/       HTTP application boundary
  web/          dashboard boundary
  cli/          scriptable local command boundary
  mcp/          stdio MCP boundary
packages/
  core/         deterministic, framework-independent financial logic
  config/       validated configuration and local data-home resolution
  db/           SQLite schema, migrations, provenance, and repositories
  api-contracts/ validated API request, response, and problem contracts
```

Each application declares its dependency on `@almanac-fi/core` with the pnpm `workspace:*` protocol. Add all future internal dependencies with that protocol; do not reach into another package's source directory.

## Root commands

| Command                    | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `pnpm build`               | Compile every workspace package to `dist/`.                         |
| `pnpm typecheck`           | Strictly type-check every workspace package without writing output. |
| `pnpm lint`                | Run ESLint across workspace sources and configuration.              |
| `pnpm format:check`        | Verify Prettier formatting without changing files.                  |
| `pnpm check`               | Run formatting, lint, typecheck, tests, and build in order.         |
| `pnpm create-feature <id>` | Generate a reviewed feature module scaffold using a kebab-case ID.  |
| `pnpm test`                | Run each package's Node test suite.                                 |
| `pnpm dev`                 | Run the Fastify server in watch mode.                               |
| `pnpm start`               | Run the compiled Fastify server.                                    |

All root commands return a non-zero exit code if any targeted package command fails.
