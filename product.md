# Local-First AI Financial Planner

## Product Vision

This project is an open-source, local-first financial planning application and AI experimentation platform.

It is designed for technically proficient users and contributors who want to:

- Import and understand their financial data.
- Build budgets and track monthly spending.
- Categorize income, expenses, transfers, and funds.
- Define financial goals.
- Evaluate retirement, college savings, emergency funds, and major purchases.
- Ask open-ended financial questions grounded in their actual data.
- Build new financial features, AI skills, workflows, calculators, dashboards, and integrations.
- Observe how AI systems reason, call tools, use context, and produce recommendations.
- Connect the financial engine to external AI clients through MCP.

The long-term goal is not to build another closed budgeting dashboard.

The goal is to create a transparent financial operating system where deterministic financial logic, structured personal data, and AI workflows work together in a way that users can inspect, extend, and trust.

---

## Core Product Principles

### Local-first

The primary financial database runs on the user's machine.

Financial data should remain local by default, with remote access limited to explicitly configured services such as:

- SimpleFIN for financial institution aggregation.
- OpenAI, Anthropic, Google, or another LLM provider.
- Optional OpenTelemetry-compatible observability backends.

### Open source and extensible

Contributors should be able to add a feature they care about without needing to redesign the application.

A feature may contribute:

- A deterministic calculation.
- An AI skill.
- A resumable workflow.
- An MCP tool or resource.
- A dashboard page.
- A dashboard card.
- A data connector.
- A visualization.
- An evaluation dataset.
- An AI experiment.

### Deterministic financial core

Financial calculations must be implemented as deterministic TypeScript modules.

The LLM may:

- Interpret user questions.
- Select tools.
- Gather missing information.
- Coordinate workflows.
- Compare scenarios.
- Explain results.
- Generate recommendations.

The LLM should not be the authoritative source for:

- Compound growth calculations.
- Retirement projections.
- College funding projections.
- Budget totals.
- Cash-flow summaries.
- Transfer reconciliation.
- Account balances.
- Goal funding gaps.

### Transparent AI

AI behavior should be visible.

Users and contributors should be able to inspect:

- The selected provider and model.
- Prompt and skill versions.
- Context supplied to the model.
- Tool calls.
- Tool arguments.
- Tool results.
- Structured outputs.
- Token usage when available.
- Latency.
- Errors and retries.
- Approval decisions.
- Calculation versions.
- Evaluation results.

### Provider independence

Users may have access to only one model provider.

The application must support runtime model selection across providers such as:

- OpenAI.
- Anthropic.
- Google.
- OpenAI-compatible providers.
- Additional providers added later.

Features should declare capability requirements instead of hard-coding a model.

### MCP as an external interface

The financial engine should expose capabilities through MCP so users can connect it to tools such as Claude Code or other compatible AI hosts.

MCP is an adapter around the financial core, not the application core itself.

### Privacy by default

Financial data must not be sent to observability systems or model providers unnecessarily.

Remote tracing should default to metadata-only.

---

## Product Positioning

The project has three complementary identities.

### Financial application

A reliable local system for:

- Accounts.
- Transactions.
- Budgets.
- Income.
- Categories.
- Goals.
- Financial scenarios.
- Deterministic planning.

### AI experimentation platform

A place for AI enthusiasts to:

- Switch providers and models.
- Build skills.
- Build tool-using workflows.
- Compare model behavior.
- Inspect traces.
- Evaluate structured outputs.
- Study where deterministic code should replace probabilistic behavior.

### MCP financial capability server

A local MCP server that allows the user to query and operate their financial system through an AI client they already use.

---

## Target Audience

The initial target audience is:

- Developers.
- AI enthusiasts.
- Open-source contributors.
- Technically proficient personal-finance users.
- People comfortable running a local Node.js application.
- Users who may already have access to Claude Code, ChatGPT, Gemini, or an API key from one provider.

The initial product does not need to optimize for non-technical mass-market onboarding.

---

## Primary Use Cases

### Budgeting

- Create monthly budgets.
- Allocate category targets.
- Track actual usage against planned amounts.
- Identify overspending.
- Compare periods.
- Explain significant budget variance.

### Transaction categorization

- Categorize expenses.
- Categorize income.
- Identify transfers.
- Learn from confirmed user decisions.
- Suggest categories for ambiguous transactions.
- Review and approve proposed category changes.

### Financial profile

- Record household members.
- Record dependents.
- Track income sources.
- Record recurring obligations.
- Store financial goals.
- Store scenario assumptions.
- Track effective dates and source confidence.

### Emergency fund

- Calculate essential monthly spending.
- Identify liquid funds.
- Estimate months of coverage.
- Compare target ranges.
- Explain gaps and risks.

### Retirement planning

- Project retirement assets.
- Evaluate different retirement ages.
- Compare contribution strategies.
- Model conservative, baseline, and optimistic returns.
- Estimate withdrawal sustainability.
- Surface missing assumptions and risks.

### College planning

- Store children and expected enrollment dates.
- Estimate future education costs.
- Track dedicated savings.
- Calculate funding gaps.
- Compare monthly contribution scenarios.

### Major decisions

- Evaluate home purchases.
- Evaluate major purchases.
- Compare debt payoff and investment alternatives.
- Compare scenarios using explicit assumptions.

### Open-ended financial questions

Examples:

- Can I retire at 62?
- Am I saving enough for college?
- How long would my emergency fund last?
- Where did my spending increase this year?
- Can I afford a larger house?
- Which assumptions have the largest effect on my plan?
- What financial risks am I overlooking?

---

## High-Level Architecture

```text
                            Remote services
                ┌──────────────────────────────────┐
                │ SimpleFIN                        │
                │ OpenAI / Anthropic / Google      │
                │ OTLP observability destination   │
                └─────────────────┬────────────────┘
                                  │
┌──────────────────────── Local installation ─────────────────────────┐
│                                                                    │
│  ┌────────────────────── Node.js runtime ────────────────────────┐  │
│  │                                                              │  │
│  │  Data connectors                                             │  │
│  │  ├── SimpleFIN                                               │  │
│  │  ├── CSV                                                     │  │
│  │  ├── Manual entry                                            │  │
│  │  └── OFX/QFX later                                           │  │
│  │                                                              │  │
│  │  Finance core                                                │  │
│  │  ├── Accounts and transactions                               │  │
│  │  ├── Categories and budgets                                  │  │
│  │  ├── Household profile and goals                             │  │
│  │  ├── Scenario engine                                         │  │
│  │  ├── Deterministic calculations                              │  │
│  │  ├── Audit and provenance                                    │  │
│  │  └── SQLite                                                  │  │
│  │                                                              │  │
│  │  Capability and feature registry                             │  │
│  │  ├── Skills                                                  │  │
│  │  ├── Workflows                                               │  │
│  │  ├── Calculators                                             │  │
│  │  ├── API routes                                              │  │
│  │  ├── MCP tools and resources                                 │  │
│  │  └── Dashboard extensions                                    │  │
│  │                                                              │  │
│  │  AI runtime                                                  │  │
│  │  ├── Provider registry                                       │  │
│  │  ├── Model capability registry                               │  │
│  │  ├── Context builder                                         │  │
│  │  ├── Tool orchestration                                      │  │
│  │  ├── Workflow execution                                      │  │
│  │  ├── Approval handling                                       │  │
│  │  └── Evaluation                                              │  │
│  │                                                              │  │
│  │  Observability                                               │  │
│  │  ├── OpenTelemetry                                           │  │
│  │  ├── OTLP exporter                                           │  │
│  │  ├── Redaction                                               │  │
│  │  └── Trace content policy                                    │  │
│  └──────────────┬──────────────────────┬────────────────────────┘  │
│                 │                      │                           │
│                 ▼                      ▼                           │
│        React dashboard          MCP server                        │
│        Local assistant          CLI                               │
└─────────────────────────────────┬──────────────────────────────────┘
                                  │
                         External MCP host
                    Claude Code or another client
```

The application should begin as a modular monolith.

Microservices are not justified for a local, single-user application.

---

## Recommended Technology Stack

### Runtime

- Node.js LTS.
- TypeScript.
- Strict TypeScript configuration.
- ES modules.
- pnpm workspaces.

### Backend

- Fastify.
- Zod.
- OpenAPI.
- Drizzle ORM.
- SQLite.
- Repository abstractions around database access.

### Frontend

- React.
- Vite.
- TanStack Router.
- TanStack Query.
- shadcn/ui or another accessible component system.
- Recharts or Observable Plot.

### Testing

- Vitest.
- Integration tests against temporary SQLite databases.
- Synthetic household fixtures.
- AI evaluation datasets.
- Contract tests for capabilities and features.

### AI

- Internal provider abstraction.
- Optional Vercel AI SDK implementation adapter.
- Zod schemas for tool input and output.
- Structured model outputs.
- Explicit tools.
- Resumable workflows.
- User approval before financial writes.

### Observability

- OpenTelemetry.
- OTLP exporters.
- Optional Logfire, Phoenix, Langfuse, Jaeger, Honeycomb, or another compatible backend.
- Metadata-only tracing by default.

### Distribution

Initial:

```bash
git clone
pnpm install
pnpm dev
```

Later:

- npm CLI.
- Docker image.
- Prebuilt local application bundles.
- Optional Electron shell.

---

## Repository Structure

```text
financial-assistant/
├── apps/
│   ├── server/
│   ├── web/
│   ├── cli/
│   └── mcp/
│
├── packages/
│   ├── domain/
│   ├── application/
│   ├── database/
│   ├── api-contracts/
│   ├── feature-sdk/
│   ├── capabilities/
│   ├── workflow-engine/
│   ├── ai-runtime/
│   ├── telemetry/
│   ├── secrets/
│   ├── simplefin-connector/
│   ├── csv-connector/
│   ├── evaluation/
│   ├── ui-kit/
│   └── test-fixtures/
│
├── features/
│   ├── budgeting/
│   ├── categorization/
│   ├── emergency-fund/
│   ├── retirement-planner/
│   ├── college-planner/
│   └── financial-health/
│
├── examples/
│   ├── minimal-skill/
│   ├── custom-calculation/
│   └── dashboard-extension/
│
├── datasets/
│   └── synthetic-households/
│
└── docs/
    ├── architecture/
    ├── feature-development/
    ├── data-model/
    ├── privacy/
    └── ai-safety/
```

---

## Data Storage Strategy

### SQLite as the source of truth

Use SQLite for:

- Accounts.
- Transactions.
- Transaction splits.
- Categories.
- Budgets.
- Budget periods.
- Income sources.
- Holdings.
- Goals.
- Scenarios.
- Assumptions.
- Workflow runs.
- Calculation runs.
- Audit events.
- Import batches.
- Source provenance.

SQLite is preferable to Markdown for canonical financial data because it supports:

- Referential integrity.
- Transactions.
- Aggregation.
- Deduplication.
- Schema migrations.
- Date-range queries.
- Concurrent reads.
- Auditability.
- Structured filtering.

### Markdown and YAML

Use Markdown and YAML for:

- Skills.
- Workflow instructions.
- Financial methodology.
- Human-readable documentation.
- Notes.
- Generated reports.
- Contributor examples.

### Raw imports

Keep immutable raw source data for traceability.

```text
financial-vault/
├── finance.db
├── raw/
│   ├── simplefin/
│   ├── csv/
│   └── statements/
├── workflows/
├── knowledge/
├── notes/
├── exports/
└── backups/
```

---

## Core Financial Data Model

Primary entities:

```text
Household
Person
Dependent
Account
InstitutionConnection
Transaction
TransactionSplit
Category
CategorizationRule
Security
Holding
InvestmentTransaction
IncomeSource
Budget
BudgetPeriod
BudgetLine
FinancialGoal
Scenario
ScenarioAssumption
CalculationRun
Recommendation
ImportBatch
SourceRecord
WorkflowRun
AuditEvent
```

### Money representation

Store money as:

- Integer minor units.
- Currency code.
- Explicit sign convention.

Do not use binary floating-point values for authoritative financial calculations.

### Categorization fields

Transactions should preserve:

```text
source_category
suggested_category
confirmed_category
categorization_method
categorization_confidence
categorization_rule_id
confirmed_by_user
```

### Transfers

Transfers must be modeled explicitly.

They should not be counted as income or spending.

### Provenance

Every normalized record should be traceable to a source record.

```text
transaction
    └── source_record_id
            ├── import_batch_id
            ├── source_type
            ├── raw_payload
            └── checksum
```

---

## Household and Demographic Data

Financial profile data should be structured and time-aware.

Examples:

- Household members.
- Dependents.
- Birth dates.
- Income.
- Employment type.
- Retirement age.
- College start date.
- Risk assumptions.
- Expected inflation.
- Goal dates.
- Recurring obligations.

A flexible fact model may complement relational tables.

```json
{
  "fact_type": "person.target_retirement_age",
  "subject_id": "person:01J...",
  "value": {
    "age": 65
  },
  "effective_from": "2026-07-11",
  "effective_until": null,
  "source": "user",
  "confidence": 1,
  "sensitivity": "financial",
  "last_verified_at": "2026-07-11T09:00:00-04:00"
}
```

Important metadata:

- Subject.
- Fact type.
- Typed value.
- Effective dates.
- Source.
- Confidence.
- Sensitivity.
- Verification date.
- Known fact versus assumption.
- Workflow that collected it.

The AI should receive a scoped financial context object rather than unrestricted database access.

```json
{
  "household": {},
  "relevant_accounts": [],
  "goals": [],
  "assumptions": [],
  "calculated_metrics": {},
  "missing_information": [],
  "data_as_of": "2026-07-11"
}
```

---

## Information Base and Knowledge Base

### Information base

The user's actual financial landscape:

- Transactions.
- Income.
- Accounts.
- Assets.
- Liabilities.
- Budgets.
- Dependents.
- Goals.
- Scenarios.
- Assumptions.

This belongs in SQLite.

### Knowledge base

Methodology used to interpret financial information:

- Emergency-fund guidelines.
- Retirement planning concepts.
- Withdrawal strategies.
- College savings methodology.
- Risk frameworks.
- Budgeting principles.
- Tax rules.
- Jurisdiction-specific guidance.

Knowledge entries should include metadata.

```yaml
id: retirement-sequence-risk
jurisdiction: US
effective_from: 2026-01-01
reviewed_at: 2026-06-01
source_quality: authoritative
applies_to:
  - retirement
  - withdrawal-planning
```

Time-sensitive guidance should be versioned.

---

## SimpleFIN Integration

SimpleFIN is the primary financial-institution connector.

### Connection flow

1. The user creates a SimpleFIN Setup Token.
2. The user pastes the token into the local application.
3. The application exchanges it for an Access URL.
4. The application stores the Access URL securely.
5. The application retrieves accounts, balances, and transactions.
6. The user can revoke access through SimpleFIN.

The application does not receive bank credentials.

### Secret storage

The SimpleFIN Access URL contains credentials and must be treated as a secret.

Use a storage abstraction:

```ts
export interface SecretStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
```

Implementations:

- Environment variables for development.
- Encrypted local file for CLI usage.
- OS keychain for packaged applications.

Do not store the Access URL directly in ordinary database tables.

### Sync model

SimpleFIN does not use a Plaid-style cursor model.

Recommended strategy:

```text
Initial import
    Retrieve the longest practical history

Normal sync
    Retrieve the previous 60 to 90 days
    Upsert source records
    Reconcile pending and posted transactions
    Refresh current balances

Periodic deep sync
    Retrieve a longer period
    Detect corrections or missing data
```

Source identity should include:

```ts
interface SourceIdentity {
  provider: "simplefin";
  serverUrl: string;
  connectionId: string;
  accountId: string;
  transactionId: string;
}
```

The connector abstraction should remain generic.

```ts
export interface DataConnector {
  id: string;
  connect(input: unknown): Promise<ConnectionResult>;
  sync(connectionId: string, request: SyncRequest): Promise<SyncResult>;
  disconnect(connectionId: string): Promise<void>;
  capabilities: ConnectorCapabilities;
}
```

SimpleFIN should be treated as the primary bank-transaction connector, not the complete source for every financial data type.

---

## CSV Integration

CSV imports should be supported from the beginning.

CSV ingestion should include:

- Mapping wizard.
- Date parsing.
- Amount sign configuration.
- Currency handling.
- Account selection.
- Duplicate detection.
- Import preview.
- Import provenance.
- Reconciliation.
- Saved mappings for recurring exports.

CSV support is important because it:

- Allows use without any financial aggregator.
- Supports unsupported institutions.
- Gives contributors deterministic test fixtures.
- Forces a strong normalization model.

---

## Categorization Strategy

Use a layered categorization process.

```text
1. Source category
2. Exact user rule
3. Merchant normalization rule
4. Historical user decisions
5. Statistical or embedding classifier
6. LLM suggestion
7. User confirmation
```

Example rule:

```yaml
rule:
  match:
    normalized_merchant: "TRADER JOE'S"
  action:
    category: groceries
  confidence: 1
```

Do not send every transaction to a remote LLM.

Use the LLM for ambiguous batches and save confirmed rules locally.

---

## Deterministic Calculation Engine

Financial calculations must be versioned TypeScript modules.

Examples:

```text
calculate_monthly_cashflow
calculate_emergency_fund_months
project_retirement_assets
simulate_retirement_withdrawals
project_college_costs
calculate_goal_funding_gap
calculate_savings_rate
calculate_debt_payoff
calculate_budget_variance
calculate_portfolio_allocation
```

Each calculation returns structured output.

```json
{
  "calculation": "retirement_projection",
  "version": "1.2.0",
  "inputs": {},
  "assumptions": {},
  "results": {},
  "warnings": [],
  "data_as_of": "2026-07-11",
  "calculation_id": "calc_01J..."
}
```

The same inputs must produce the same output regardless of the selected LLM.

---

## Feature Extension Model

The primary extension unit is a feature module.

A feature may include:

- Tables and migrations.
- Domain services.
- Calculations.
- Skills.
- Workflows.
- API routes.
- MCP tools.
- Dashboard routes.
- Dashboard cards.
- Tests.
- Evaluations.
- Synthetic fixtures.

Example:

```text
features/
└── retirement-planner/
    ├── feature.ts
    ├── manifest.ts
    ├── schemas.ts
    ├── migrations/
    ├── calculations/
    ├── workflows/
    ├── skills/
    ├── server/
    ├── ui/
    ├── evals/
    └── README.md
```

### Feature contract

```ts
export interface FeatureModule {
  manifest: FeatureManifest;
  register(context: FeatureRegistrationContext): Promise<void>;
}

export interface FeatureManifest {
  id: string;
  name: string;
  version: string;
  description: string;

  permissions?: Permission[];

  contributes?: {
    calculations?: string[];
    workflows?: string[];
    skills?: string[];
    apiRoutes?: string[];
    mcpTools?: string[];
    dashboardRoutes?: string[];
    dashboardCards?: string[];
  };
}
```

### Registration context

```ts
interface FeatureRegistrationContext {
  calculations: CalculationRegistry;
  workflows: WorkflowRegistry;
  skills: SkillRegistry;
  api: ApiRegistry;
  mcp: McpRegistry;
  dashboard: DashboardRegistry;
  events: DomainEventBus;
  repositories: RepositoryRegistry;
}
```

Initially, features should be reviewed monorepo packages included at build time.

Do not begin with arbitrary runtime npm plugin installation.

---

## Skills, Workflows, Calculations, and Dashboards

### Skill

A skill is primarily:

- Instructions.
- Required tools.
- Reference material.
- Input schema.
- Output schema.

A skill does not add authoritative financial mathematics.

### Workflow

A workflow is:

- Executable.
- Resumable.
- Stateful.
- Approval-aware.
- Composed of calculations, skills, and tools.

### Calculation

A calculation is deterministic TypeScript.

```ts
export const emergencyFundCoverage: Calculation<
  EmergencyFundInput,
  EmergencyFundResult
> = {
  id: "emergency-fund-coverage",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  execute(input) {
    return {
      coverageMonths:
        input.liquidFundsMinor / input.monthlyEssentialExpensesMinor,
    };
  },
};
```

### Dashboard extension

A dashboard extension may add:

- A route.
- A navigation item.
- A home-screen card.
- A chart.
- A review queue.
- A workflow launcher.
- An assumption editor.

### Full feature

A full feature may combine all of these.

---

## Shared Capability Layer

A capability represents a financial operation that can be exposed through multiple interfaces.

```ts
export interface Capability<TInput, TOutput> {
  id: string;
  description: string;

  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;

  access: {
    mode: "read" | "propose-write" | "write";
    scopes: string[];
  };

  execute(input: TInput, context: CapabilityContext): Promise<TOutput>;
}
```

Adapters can expose the same capability through:

```text
Capability
├── Embedded AI tool
├── MCP tool
├── HTTP route
├── CLI command
└── Test harness
```

The project should not implement separate financial behavior for every interface.

---

## AI Runtime

### Provider registry

The AI runtime must support dynamic provider and model selection.

```ts
export type ProviderId =
  "openai" | "anthropic" | "google" | "openai-compatible";

export interface ModelProvider {
  id: ProviderId;

  isConfigured(): Promise<boolean>;
  listModels(): Promise<ModelDescriptor[]>;
  createModel(modelId: string): LanguageModel;
  validateConfiguration(): Promise<ProviderValidationResult>;
}
```

### Model capabilities

```ts
export interface ModelDescriptor {
  providerId: ProviderId;
  modelId: string;
  displayName: string;

  capabilities: {
    text: boolean;
    streaming: boolean;
    tools: boolean;
    structuredOutput: boolean;
    vision: boolean;
    reasoning: boolean;
  };

  contextWindow?: number;
  maximumOutputTokens?: number;
}
```

### Model selection precedence

```text
1. Explicit selection for the current run
2. Feature-specific preference
3. User's current application selection
4. Environment default
5. First configured compatible provider
```

### Capability-based requirements

Features should declare requirements.

```yaml
modelRequirements:
  toolCalling: true
  structuredOutput: true
  minimumContextWindow: 32000

modelPreference:
  reasoning: balanced
  cost: moderate
```

Features should not require a specific model unless unavoidable.

### Per-run model switching

The user should be able to select:

```text
Provider: Anthropic
Model: Claude Sonnet

Apply to:
- This question
- This workflow
- This feature
- Default
```

### Model comparison

The AI Workbench should support replaying a workflow against multiple models.

The deterministic calculations remain unchanged.

The comparison may include:

- Schema validity.
- Tool-call count.
- Token usage.
- Latency.
- Evaluation score.
- Recommendation quality.
- Missing-information detection.

---

## Embedded AI and MCP-Hosted AI

The system supports two AI execution modes.

### Embedded mode

The local application directly calls a provider using the user's API key.

Available observability may include:

- Prompt.
- Model request.
- Model response.
- Token usage.
- Tool calls.
- Tool results.
- Final answer.

### MCP-hosted mode

An external AI host supplies the model and calls the financial MCP server.

Examples:

- Claude Code.
- An IDE assistant.
- Another MCP-compatible client.

In this mode, the financial application can observe:

- MCP session.
- Tool requested.
- Tool arguments.
- Tool result.
- Tool duration.
- Errors.
- Approval results.

It generally cannot observe:

- The host's system prompt.
- Full conversation history.
- Token usage.
- Internal reasoning.
- Final answer.
- Other tools used by the host.

The application must represent this trace coverage honestly.

MCP does not convert a consumer subscription into a general-purpose API key.

The model usage remains inside the external host and is governed by that host's plan and policies.

---

## MCP Interface

### Transport

Initial local transport:

```bash
financial-assistant mcp
```

Use MCP over STDIO.

Streamable HTTP may be added later.

### Resources

```text
finance://household/summary
finance://accounts
finance://budgets/current
finance://goals
finance://data-quality
finance://workflows
finance://methodology/retirement
```

### Query tools

```text
query_transactions
get_budget_status
get_cashflow_summary
get_income_summary
get_goal_progress
get_financial_snapshot
compare_scenarios
```

### Planning tools

```text
calculate_emergency_fund
project_retirement
project_college_savings
calculate_goal_funding_gap
analyze_budget_variance
```

### Workflow tools

```text
start_workflow
continue_workflow
get_workflow_state
submit_workflow_answers
generate_workflow_report
```

### Write safety

Use a proposal and confirmation pattern.

```text
1. propose_transaction_categories
2. review_change_proposal
3. user approves
4. apply_change_proposal
```

Do not expose unrestricted SQL or arbitrary filesystem access.

---

## Observability

### OpenTelemetry foundation

OpenTelemetry is the internal observability API.

```text
Application instrumentation
        ↓
OpenTelemetry
        ↓ OTLP
Logfire / Phoenix / Langfuse / Jaeger / Honeycomb / other
```

Vendor-specific code should not be spread throughout the application.

### Telemetry package

```text
packages/
└── telemetry/
    ├── src/
    │   ├── initialize.ts
    │   ├── spans.ts
    │   ├── attributes.ts
    │   ├── redaction.ts
    │   └── exporters.ts
    └── package.json
```

Initialize telemetry before loading application code.

### Domain-level spans

Important spans include:

```text
workflow.run
workflow.step
skill.execute

ai.generate
ai.stream
ai.tool.select
ai.structured-output.validate

tool.execute
mcp.tool.execute

calculation.execute
scenario.compare

financial.transactions.query
financial.budget.evaluate
financial.profile.read

connector.simplefin.sync
connector.csv.import

categorization.classify
categorization.rule.match

approval.request
approval.resolve
```

### Project-specific telemetry attributes

```ts
export const TelemetryAttributes = {
  featureId: "finance.feature.id",
  workflowId: "finance.workflow.id",
  workflowVersion: "finance.workflow.version",
  skillId: "finance.skill.id",
  calculationId: "finance.calculation.id",
  calculationVersion: "finance.calculation.version",
  toolName: "finance.tool.name",
  approvalRequired: "finance.approval.required",
  dataAsOf: "finance.data.as_of",
  providerId: "finance.ai.provider",
  modelId: "finance.ai.model",
  invocationMode: "finance.ai.invocation_mode",
} as const;
```

Invocation modes:

```ts
type InvocationMode =
  "embedded" | "mcp-external-host" | "evaluation" | "deterministic-only";
```

---

## Trace Privacy

LLM traces may contain sensitive financial information.

Supported content policies:

```ts
type TraceContentPolicy = "metadata-only" | "redacted" | "full-content";
```

Default:

```env
TELEMETRY_CONTENT_POLICY=metadata-only
```

### Metadata-only

Capture:

- Model.
- Provider.
- Duration.
- Token counts.
- Tool names.
- Workflow IDs.
- Calculation IDs.
- Errors.
- Counts and aggregate sizes.

Do not capture:

- Account balances.
- Raw transaction descriptions.
- Employer names.
- Dependents.
- Goal details.
- Full prompts.
- Full model responses.

### Redacted

Capture sanitized content after applying field-level redaction.

### Full-content

Require explicit opt-in and a clear warning.

---

## Environment Configuration

Use `.env` for contributors and local development.

Commit `.env.example`.

```dotenv
# Application
APP_PORT=7432
APP_DATA_DIR=./data
DATABASE_URL=./data/finance.db
LOG_LEVEL=info

# AI provider selection
AI_PROVIDER=anthropic
AI_MODEL=
AI_FALLBACK_PROVIDER=
AI_FALLBACK_MODEL=

# Provider credentials
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# AI behavior
AI_TEMPERATURE=0.1
AI_MAX_OUTPUT_TOKENS=4000
AI_TOOL_APPROVAL_MODE=required-for-writes

# Observability
OTEL_ENABLED=false
OTEL_SERVICE_NAME=local-financial-assistant
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=development

# Optional vendor convenience
LOGFIRE_TOKEN=

# Trace privacy
TELEMETRY_CONTENT_POLICY=metadata-only
TELEMETRY_CAPTURE_PROMPTS=false
TELEMETRY_CAPTURE_RESPONSES=false
TELEMETRY_CAPTURE_TOOL_ARGUMENTS=false

# SimpleFIN
SIMPLEFIN_ACCESS_URL=
```

Repository rules:

```text
.env.example       committed
.env.test          committed with fake values
.env                ignored
.env.local          ignored
.env.*.local        ignored
```

For normal users, secrets should eventually be stored through the application's `SecretStore`, not only through `.env`.

---

## AI Workbench

The application should include an AI Workbench.

It should display:

- Provider.
- Requested model.
- Actual response model when known.
- Invocation mode.
- Prompt version.
- Skill version.
- Workflow version.
- Context summary.
- Tool calls.
- Tool arguments subject to privacy policy.
- Tool results.
- Structured output validation.
- Token usage.
- Latency.
- Trace ID.
- Calculation versions.
- Approval history.
- Errors.
- Retries.
- Evaluation scores.

Example workflow record:

```ts
interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowVersion: string;
  skillVersions: Record<string, string>;
  calculationVersions: Record<string, string>;
  modelProvider: string;
  modelId: string;
  inputSnapshotId: string;
  toolCalls: ToolCallRecord[];
  approvals: ApprovalRecord[];
  finalOutput: unknown;
  startedAt: string;
  completedAt?: string;
}
```

---

## Recommendation Output Contract

Every planning workflow should produce a consistent package.

```json
{
  "question": "Can I retire at 62?",
  "answer_summary": "...",
  "data_as_of": "2026-07-11",
  "known_facts": [],
  "assumptions": [],
  "scenarios": [],
  "calculations": [],
  "risks": [],
  "recommendations": [],
  "missing_information": [],
  "confidence": "medium",
  "methodology_versions": [],
  "workflow_run_id": "run_01J..."
}
```

A recommendation should show:

- What the system knows.
- What it assumed.
- Which calculations it ran.
- Which methodology version it used.
- Which risks remain.
- What missing information could change the answer.
- How current the data is.

---

## Contributor Experience

A contributor should be able to run:

```bash
pnpm install
pnpm dev
```

Create a feature:

```bash
pnpm create-feature retirement-tax-planning
```

The generator should create:

- Feature manifest.
- Calculation example.
- Skill example.
- Workflow example.
- API route.
- MCP tool.
- Dashboard card.
- Unit test.
- AI evaluation.
- Synthetic fixture.
- README.

Useful commands:

```bash
pnpm test
pnpm test:integration
pnpm eval
pnpm eval --feature retirement-planner
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm simplefin:sync
pnpm mcp:inspect
```

Synthetic households are required so contributors can build and test without exposing real financial data.

---

## Initial Feature Set

### Budgeting

- Monthly budgets.
- Category targets.
- Budget usage.
- Budget variance.
- Budget dashboard.

### Categorization

- Rules.
- Merchant normalization.
- Transfer matching.
- Review queue.
- AI-assisted ambiguous categorization.

### Emergency fund

- Essential spending calculation.
- Liquid asset calculation.
- Coverage months.
- Target comparison.
- Guided review.

### Retirement planning

- Current assets.
- Contributions.
- Retirement age.
- Return assumptions.
- Inflation assumptions.
- Withdrawal assumptions.
- Scenario comparison.
- Risk analysis.

### College planning

- Dependent timelines.
- Estimated future cost.
- Dedicated savings.
- Contribution plans.
- Funding-gap scenarios.

### Financial health

- Cash flow.
- Savings rate.
- Budget variance.
- Emergency reserves.
- Goal progress.
- Data-quality warnings.

---

## Implementation Plan

### Phase 1: Contributor and platform foundation

Build:

- pnpm workspace.
- TypeScript configuration.
- Fastify server.
- React shell.
- Feature registry.
- Feature generator.
- SQLite.
- Drizzle migrations.
- Core domain schemas.
- Audit model.
- Synthetic household fixtures.
- OpenTelemetry initialization.

Success criteria:

- Contributors can install and run the project.
- A generated feature can add a page and a capability.
- Telemetry can export to an OTLP endpoint.

### Phase 2: Data ingestion and budgeting

Build:

- SimpleFIN connector.
- CSV connector.
- Accounts.
- Transactions.
- Categories.
- Transfer matching.
- Monthly budgets.
- Income classification.
- Import provenance.
- Sync health dashboard.

Success criteria:

- Users can import and sync financial data.
- Users can understand monthly inflows and outflows.
- Transfers do not distort income or spending.

### Phase 3: AI runtime and workbench

Build:

- Provider registry.
- Runtime model selection.
- Secret references.
- Context builder.
- Capability-to-tool adapter.
- Structured output.
- Approval handling.
- AI traces.
- Redaction.
- AI Workbench.
- Evaluation harness.

Success criteria:

- The same workflow can run against multiple configured providers.
- Tool calls are visible.
- Sensitive trace content is excluded by default.
- Structured outputs are validated.

### Phase 4: Planning features

Build vertical feature modules for:

- Emergency fund.
- Retirement.
- College savings.
- Financial health.
- Major purchase scenarios.

Success criteria:

- Deterministic results remain identical across model providers.
- Each feature includes calculations, workflows, dashboard UI, MCP exposure, and evaluations.

### Phase 5: MCP and coding-agent integrations

Build:

- Local STDIO MCP server.
- MCP resources.
- Query tools.
- Planning tools.
- Guided workflow tools.
- Proposal-based write tools.
- Claude Code setup documentation.
- Example skills for coding agents.

Success criteria:

- A user can query their financial data through an external MCP host.
- No embedded API key is required for MCP-hosted interactions.
- MCP traces clearly indicate partial observability.

### Phase 6: Distribution and polish

Build:

- npm CLI distribution.
- Docker image.
- Backup and restore.
- Secret-store integrations.
- Prebuilt application bundles.
- Optional Electron shell.
- Contributor documentation.
- Security review.
- Plugin isolation research.

---

## Key Architectural Decisions

| Decision               | Recommendation                                 | Reason                                                     |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Runtime                | TypeScript on Node.js                          | One language across the entire system                      |
| Application shape      | Modular monolith                               | Best fit for local deployment and open-source contribution |
| Database               | SQLite                                         | Structured, transactional, portable, auditable             |
| ORM                    | Drizzle                                        | Type-safe SQL-oriented approach                            |
| Backend                | Fastify                                        | Lightweight and compatible with modular registration       |
| Frontend               | React and Vite                                 | Simple local dashboard development                         |
| Financial aggregation  | SimpleFIN                                      | Better fit for a local-first open-source system            |
| CSV                    | First-class connector                          | Broad compatibility and testability                        |
| Financial calculations | Deterministic TypeScript                       | Reproducibility and trust                                  |
| AI framework           | Internal abstraction with provider adapters    | Avoid provider lock-in                                     |
| Model selection        | Runtime and capability-based                   | Users may have only one provider                           |
| MCP                    | External adapter                               | Lets users leverage external AI hosts                      |
| Observability          | OpenTelemetry                                  | Vendor-neutral tracing and metrics                         |
| Trace destination      | Configurable OTLP backend                      | Supports Logfire and alternatives                          |
| Trace content          | Metadata-only by default                       | Protect sensitive financial data                           |
| Secrets                | `.env` for contributors, SecretStore for users | Practical development with safer production storage        |
| Feature extensibility  | Build-time feature modules initially           | Easier and safer than arbitrary runtime plugins            |
| Writes                 | Proposal and approval                          | Financial changes require user control                     |
| Vector database        | Defer                                          | SQLite and structured retrieval are sufficient initially   |

---

## Non-Goals for the First Release

The first release should not attempt to provide:

- A public plugin marketplace.
- Arbitrary runtime npm plugin installation.
- Microservices.
- Cloud account hosting.
- Automated money movement.
- Brokerage trading.
- Tax filing.
- Fully autonomous financial decisions.
- Unrestricted AI access to the database.
- A comprehensive replacement for a human financial advisor.
- A mass-market mobile application.

---

## Success Metrics

The project is successful when:

- A contributor can add a useful feature without modifying core infrastructure.
- A user can run the entire system locally.
- A user can import data through SimpleFIN or CSV.
- Financial calculations are reproducible.
- The same workflow can run across several model providers.
- Users can inspect AI tool calls and workflow execution.
- MCP clients can safely query the financial engine.
- Sensitive financial content is excluded from remote traces by default.
- Synthetic datasets make contribution and evaluation easy.
- The application provides useful financial guidance while clearly separating facts, assumptions, calculations, and recommendations.

---

## Final Product Definition

The project is:

> A local-first, open-source financial application and AI development platform where contributors can build transparent, testable features combining deterministic calculations, AI skills, workflows, MCP capabilities, and dashboards.

Its core architecture is:

```text
Node.js + TypeScript
        │
        ├── SQLite + Drizzle
        ├── Fastify local API
        ├── React and Vite dashboard
        ├── SimpleFIN and CSV connectors
        ├── Feature-module SDK
        ├── Deterministic calculation engine
        ├── Multi-provider AI runtime
        ├── OpenTelemetry observability
        └── MCP adapter
```

The product should make it obvious where trusted financial computation ends and probabilistic AI begins.
