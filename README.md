# Almanac FI

> Track your money. Forecast your future. Build your FI.

Almanac FI is a local-first workbench for tracking, forecasting, and (eventually) automating your path to FI. It is a strict TypeScript, ESM-first pnpm workspace organized as a modular monolith: financial behavior belongs in reusable packages, while server, dashboard, CLI, and MCP delivery surfaces stay separate.

Before changing financial-domain models or planning behavior, read [System Structure](./doc/system-structure.md). It defines which records are authoritative, how actuals, income forecasts, budgets, goals, and allocations relate, and the boundaries future extensions must preserve.

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

To connect SimpleFIN, open the dashboard's Connections screen and paste a one-time setup token. For local development, you can instead set `SIMPLE_FIN_TOKEN` in `.env` and submit the blank form. The claimed Access URL is never returned by the API or written to SQLite; it is stored under the configured data home with owner-only directory and file permissions. From the same screen, run an initial 90-day sync, a rolling 60-day refresh, a two-year deep sync, or enter a custom range. Sync creates provider-backed institutions and accounts, refreshes balances, imports transactions idempotently, and displays coverage, errors, and affected-account counts. Disconnecting removes the secret while retaining local institutions, accounts, balances, and transaction history.

### Resetting pre-016a local data

Work item 016a intentionally replaces the pre-release account schema without a data migration. Existing databases that contain the old `institution_connections` model are not compatible.

To reset, stop every Almanac FI process, back up anything you may need, and then explicitly delete `almanac-fi.sqlite` from the configured `ALMANAC_FI_DATA_HOME`. The default data home is `~/Library/Application Support/almanac-fi` on macOS, `%APPDATA%/almanac-fi` on Windows, and `${XDG_DATA_HOME:-~/.local/share}/almanac-fi` on Linux. Starting the server creates the new database. This permanently removes local accounts, transactions, imports, balances, holdings, obligations, and audit history; recreate institutions and accounts before rerunning CSV imports.

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
