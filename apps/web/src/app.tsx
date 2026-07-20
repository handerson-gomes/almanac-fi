import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";

import {
  commitCsvImport,
  connectSimpleFin,
  createCategorizationRule,
  createCategory,
  createHousehold,
  createHouseholdFact,
  createFinancialGoal,
  createScenarioAssumption,
  createPerson,
  createCsvMapping,
  createAccount,
  createAccountBalance,
  createInstitution,
  createManualTransaction,
  deleteInstitution,
  getCsvMappings,
  getAccounts,
  getAccountImportReviews,
  getBudgetAnalysis,
  getBudgetDrilldown,
  getBudgetPeriods,
  getBudgets,
  getCategories,
  getCategorizationRules,
  getHealth,
  getInstitutions,
  getExternalInstitutionConnections,
  getProviderConnections,
  getHouseholdFacts,
  getHouseholds,
  getFinancialGoals,
  getFinancialState,
  getPlanningDashboard,
  getScenarioAssumptions,
  getSimpleFinSyncHealth,
  getPeople,
  getTransaction,
  getTransactions,
  previewCsvImport,
  resolveAccountImportReview,
  revokeProviderConnection,
  syncSimpleFin,
  updateCsvMapping,
  updateInstitution,
  type Account,
  type AccountImportReview,
  type CreateAccount,
  type CsvMapping,
  type FinancialState,
  type TransactionPage,
  type ProviderConnection,
} from "./api.js";

function Layout(): React.JSX.Element {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <h1>Almanac FI</h1>
        <nav aria-label="Primary navigation" className="primary-nav">
          <Link to="/">Overview</Link>
          <Link to="/institutions">Institutions</Link>
          <Link to="/accounts">Accounts</Link>
          <Link to="/connections">Connections</Link>
          <Link to="/transactions">Transactions</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/profile">Household</Link>
          <Link to="/planning">Planning</Link>
          <Link to="/budgets">Budgets</Link>
          <Link to="/import">Import CSV</Link>
          <Link to="/import-review">Import review</Link>
        </nav>
      </header>
      <main className="app-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}

const defaultMapping: CsvMapping = {
  amountColumn: "Amount",
  amountSign: "debit-negative",
  categoryColumn: "Category",
  dateColumn: "Date",
  dateFormat: "YYYY-MM-DD",
  descriptionColumn: "Description",
  payeeColumn: null,
};

function csvHeaders(content: string): readonly string[] {
  const header = content.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const columns: string[] = [];
  let quoted = false;
  let value = "";
  for (let index = 0; index < header.length; index += 1) {
    const character = header[index] ?? "";
    if (character === '"') {
      if (quoted && header[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      columns.push(value.trim());
      value = "";
    } else value += character;
  }
  if (value.trim() || columns.length > 0) columns.push(value.trim());
  return columns.filter((column) => column.length > 0);
}

function matchingHeader(
  headers: readonly string[],
  candidates: readonly string[],
): string | null {
  const normalize = (value: string): string =>
    value.toLocaleLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return (
    headers.find((header) => {
      const normalized = normalize(header);
      return candidates.some(
        (candidate) =>
          normalized === candidate || normalized.includes(candidate),
      );
    }) ?? null
  );
}

function formatMinorUnits(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const major = Math.floor(absolute / 100).toLocaleString();
  const minor = String(absolute % 100).padStart(2, "0");
  return `${sign}${major}.${minor}`;
}

function formatCurrencyMinorUnits(
  amountMinor: number,
  currency: string,
): string {
  return new Intl.NumberFormat(undefined, {
    currency,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }).format(amountMinor / 100);
}

function accountDisplayName(
  account: Account,
  institutionNames: ReadonlyMap<string, string>,
): string {
  const institution =
    institutionNames.get(account.institutionId) ?? "Unknown institution";
  return `${institution} — ${account.name}`;
}

function formatDateTime(value: string | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function parseMoneyInput(value: string): number {
  const normalized = value.trim().replaceAll(",", "").replaceAll("$", "");
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match)
    throw new Error("Enter an amount with at most two decimal places.");
  const major = Number(match[2]);
  const minor = Number((match[3] ?? "").padEnd(2, "0"));
  const amount = major * 100 + minor;
  if (!Number.isSafeInteger(amount))
    throw new Error("Amount is outside the supported range.");
  return match[1] === "-" ? -amount : amount;
}

function CsvImport(): React.JSX.Element {
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryFn: getAccounts, queryKey: ["accounts"] });
  const institutions = useQuery({
    queryFn: getInstitutions,
    queryKey: ["institutions"],
  });
  const institutionNames = new Map(
    institutions.data?.map((institution) => [institution.id, institution.name]),
  );
  const savedMappings = useQuery({
    queryFn: getCsvMappings,
    queryKey: ["csv-mappings"],
  });
  const [accountId, setAccountId] = useState("");
  const [content, setContent] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [mapping, setMapping] = useState<CsvMapping>(defaultMapping);
  const [mappingName, setMappingName] = useState("");
  const [savedMappingId, setSavedMappingId] = useState("");
  const preview = useMutation({ mutationFn: previewCsvImport });
  const commit = useMutation({
    mutationFn: commitCsvImport,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
  const saveMapping = useMutation({
    mutationFn: createCsvMapping,
    onSuccess: async () => {
      setMappingName("");
      await queryClient.invalidateQueries({ queryKey: ["csv-mappings"] });
    },
  });
  const updateMapping = useMutation({
    mutationFn: ({ id, name }: Readonly<{ id: string; name: string }>) =>
      updateCsvMapping(id, { mapping, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["csv-mappings"] });
    },
  });
  const headers = csvHeaders(content);
  const setCsvContent = (nextContent: string): void => {
    setContent(nextContent);
    const nextHeaders = csvHeaders(nextContent);
    if (nextHeaders.length === 0) return;
    setMapping({
      amountColumn:
        matchingHeader(nextHeaders, ["amount", "transactionamount"]) ??
        nextHeaders[0] ??
        "",
      amountSign: mapping.amountSign,
      categoryColumn: matchingHeader(nextHeaders, ["category"]),
      dateColumn:
        matchingHeader(nextHeaders, ["transdate", "transactiondate", "date"]) ??
        nextHeaders[0] ??
        "",
      dateFormat: mapping.dateFormat,
      descriptionColumn:
        matchingHeader(nextHeaders, ["description", "merchant", "memo"]) ??
        nextHeaders[0] ??
        "",
      payeeColumn: matchingHeader(nextHeaders, ["payee"]),
    });
  };
  const request = { accountId, content, currency, mapping };
  return (
    <section aria-labelledby="csv-import-heading" className="page import-page">
      <h2 id="csv-import-heading">Import CSV</h2>
      <label htmlFor="csv-account">Account</label>
      <select
        id="csv-account"
        onChange={(event) => setAccountId(event.target.value)}
        required
        value={accountId}
      >
        <option value="">Select an account</option>
        {accounts.data?.map((account) => (
          <option key={account.id} value={account.id}>
            {accountDisplayName(account, institutionNames)} ({account.currency})
          </option>
        ))}
      </select>
      <label htmlFor="csv-file">CSV file</label>
      <input
        accept=".csv,text/csv"
        id="csv-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void file.text().then(setCsvContent);
        }}
        type="file"
      />
      <label htmlFor="csv-content">CSV content</label>
      <textarea
        id="csv-content"
        onChange={(event) => setCsvContent(event.target.value)}
        placeholder="Date,Description,Amount"
        rows={6}
        value={content}
      />
      <fieldset>
        <legend>Column mapping</legend>
        <label htmlFor="csv-date-column">Date column</label>
        <select
          disabled={headers.length === 0}
          id="csv-date-column"
          onChange={(event) =>
            setMapping({ ...mapping, dateColumn: event.target.value })
          }
          value={mapping.dateColumn}
        >
          {headers.map((header) => (
            <option key={header} value={header}>
              {header}
            </option>
          ))}
        </select>
        <label htmlFor="csv-description-column">Description column</label>
        <select
          disabled={headers.length === 0}
          id="csv-description-column"
          onChange={(event) =>
            setMapping({ ...mapping, descriptionColumn: event.target.value })
          }
          value={mapping.descriptionColumn}
        >
          {headers.map((header) => (
            <option key={header} value={header}>
              {header}
            </option>
          ))}
        </select>
        <label htmlFor="csv-amount-column">Amount column</label>
        <select
          disabled={headers.length === 0}
          id="csv-amount-column"
          onChange={(event) =>
            setMapping({ ...mapping, amountColumn: event.target.value })
          }
          value={mapping.amountColumn}
        >
          {headers.map((header) => (
            <option key={header} value={header}>
              {header}
            </option>
          ))}
        </select>
        <label htmlFor="csv-category-column">Category column (optional)</label>
        <select
          disabled={headers.length === 0}
          id="csv-category-column"
          onChange={(event) =>
            setMapping({
              ...mapping,
              categoryColumn: event.target.value || null,
            })
          }
          value={mapping.categoryColumn ?? ""}
        >
          <option value="">No category column</option>
          {headers.map((header) => (
            <option key={header} value={header}>
              {header}
            </option>
          ))}
        </select>
        <label htmlFor="csv-date-format">Date format</label>
        <select
          id="csv-date-format"
          onChange={(event) =>
            setMapping({
              ...mapping,
              dateFormat: event.target.value as CsvMapping["dateFormat"],
            })
          }
          value={mapping.dateFormat}
        >
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
        </select>
        <label htmlFor="csv-amount-sign">Amount signs</label>
        <select
          id="csv-amount-sign"
          onChange={(event) =>
            setMapping({
              ...mapping,
              amountSign: event.target.value as CsvMapping["amountSign"],
            })
          }
          value={mapping.amountSign}
        >
          <option value="debit-negative">Debits are negative</option>
          <option value="debit-positive">Debits are positive</option>
        </select>
      </fieldset>
      <label htmlFor="csv-currency">Currency</label>
      <input
        id="csv-currency"
        maxLength={3}
        onChange={(event) => setCurrency(event.target.value.toUpperCase())}
        pattern="[A-Z]{3}"
        value={currency}
      />
      <button
        disabled={!accountId || !content || preview.isPending}
        onClick={() => preview.mutate(request)}
        type="button"
      >
        Preview import
      </button>
      {preview.isError ? <p role="alert">{preview.error.message}</p> : null}
      {preview.data ? (
        <section aria-labelledby="csv-preview-heading">
          <h3 id="csv-preview-heading">Import preview</h3>
          <p>
            {preview.data.rows.length} valid rows; total{" "}
            {formatMinorUnits(preview.data.totalAmountMinor)}.
          </p>
          {preview.data.errors.map((error) => (
            <p key={`${error.row}-${error.message}`} role="alert">
              Row {error.row}: {error.message}
            </p>
          ))}
          <ul aria-label="CSV preview rows">
            {preview.data.rows.slice(0, 5).map((row) => (
              <li key={row.row}>
                {row.transactionDate.slice(0, 10)} — {row.merchant} —{" "}
                {formatMinorUnits(row.amountMinor)}
              </li>
            ))}
          </ul>
          <button
            disabled={!preview.data.valid || commit.isPending}
            onClick={() => commit.mutate(request)}
            type="button"
          >
            Commit import
          </button>
        </section>
      ) : null}
      {commit.data ? (
        <p role="status">
          Imported {commit.data.created}; corrected {commit.data.corrected};
          skipped {commit.data.duplicate} duplicates.
        </p>
      ) : null}
      <fieldset>
        <legend>Saved mappings</legend>
        <label htmlFor="saved-csv-mapping">Use saved mapping</label>
        <select
          id="saved-csv-mapping"
          onChange={(event) => {
            const saved = savedMappings.data?.find(
              (item) => item.id === event.target.value,
            );
            setSavedMappingId(event.target.value);
            if (saved) {
              setMapping(saved.mapping);
              setMappingName(saved.name);
            }
          }}
          defaultValue=""
        >
          <option value="">Select a mapping</option>
          {savedMappings.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <label htmlFor="csv-mapping-name">Save current mapping as</label>
        <input
          id="csv-mapping-name"
          onChange={(event) => setMappingName(event.target.value)}
          value={mappingName}
        />
        <button
          disabled={!mappingName || saveMapping.isPending}
          onClick={() => saveMapping.mutate({ mapping, name: mappingName })}
          type="button"
        >
          Save mapping
        </button>
        <button
          disabled={!savedMappingId || !mappingName || updateMapping.isPending}
          onClick={() =>
            updateMapping.mutate({ id: savedMappingId, name: mappingName })
          }
          type="button"
        >
          Update selected mapping
        </button>
      </fieldset>
    </section>
  );
}

function Transactions(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [accountFilter, setAccountFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | TransactionPage["items"][number]["status"]
  >("");
  const transactions = useInfiniteQuery<
    TransactionPage,
    Error,
    InfiniteData<TransactionPage>,
    ["transactions", string, string],
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getTransactions(pageParam, {
        ...(accountFilter ? { accountId: accountFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    queryKey: ["transactions", accountFilter, statusFilter],
  });
  const accounts = useQuery({
    queryFn: getAccounts,
    queryKey: ["accounts"],
  });
  const institutions = useQuery({
    queryFn: getInstitutions,
    queryKey: ["institutions"],
  });
  const institutionNames = new Map(
    institutions.data?.map((institution) => [institution.id, institution.name]),
  );
  const categories = useQuery({
    queryFn: getCategories,
    queryKey: ["categories"],
  });
  const [selectedId, setSelectedId] = useState<string>();
  const [manualAccountId, setManualAccountId] = useState("");
  const [manualAmountMinor, setManualAmountMinor] = useState("");
  const [manualCategoryId, setManualCategoryId] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualSplits, setManualSplits] = useState<
    readonly { amountMinor: string; categoryId: string; memo: string }[]
  >([]);
  const [manualDate, setManualDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const details = useQuery({
    enabled: selectedId !== undefined,
    queryFn: () => getTransaction(selectedId ?? ""),
    queryKey: ["transaction", selectedId],
  });
  const accountDetails = new Map(
    accounts.data?.map((account) => [
      account.id,
      {
        account,
        institutionName:
          institutionNames.get(account.institutionId) ?? "Unknown institution",
      },
    ]),
  );
  const manualAccount = accounts.data?.find(
    (account) => account.id === manualAccountId,
  );
  const createManual = useMutation({
    mutationFn: () => {
      const account = accounts.data?.find(
        (candidate) => candidate.id === manualAccountId,
      );
      if (!account) throw new Error("Select an account.");
      return createManualTransaction({
        accountId: account.id,
        amountMinor: parseMoneyInput(manualAmountMinor),
        categoryId: manualCategoryId || null,
        currency: account.currency,
        merchant: manualDescription,
        payee: null,
        postedAt: null,
        sourceCategory: null,
        splits: manualSplits.map((split) => ({
          amountMinor: parseMoneyInput(split.amountMinor),
          categoryId: split.categoryId || null,
          memo: split.memo || null,
        })),
        status: "posted",
        transactionDate: new Date(`${manualDate}T00:00:00.000Z`).toISOString(),
      });
    },
    onSuccess: async () => {
      setManualAmountMinor("");
      setManualDescription("");
      setManualSplits([]);
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
  const categoryNames = new Map(
    categories.data?.map((category) => [category.id, category.name]),
  );
  const transactionItems = transactions.data?.pages.flatMap(
    (page) => page.items,
  );
  const contextIsPending =
    accounts.isPending || institutions.isPending || categories.isPending;
  const contextError =
    accounts.error ?? institutions.error ?? categories.error ?? null;
  useEffect(() => {
    const loadMore = loadMoreRef.current;
    if (
      !loadMore ||
      !transactions.hasNextPage ||
      transactions.isFetchingNextPage ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void transactions.fetchNextPage();
      },
      { rootMargin: "320px" },
    );
    observer.observe(loadMore);
    return () => observer.disconnect();
  }, [
    transactions.fetchNextPage,
    transactions.hasNextPage,
    transactions.isFetchingNextPage,
  ]);
  return (
    <section aria-labelledby="transactions-heading" className="page">
      <h2 id="transactions-heading">Transactions</h2>
      <details className="manual-entry-panel">
        <summary>Record a transaction manually</summary>
        <form
          className="stacked-form"
          onSubmit={(event) => {
            event.preventDefault();
            createManual.mutate();
          }}
        >
          <h3>Record a transaction</h3>
          <label htmlFor="manual-transaction-account">Account</label>
          <select
            id="manual-transaction-account"
            onChange={(event) => setManualAccountId(event.target.value)}
            required
            value={manualAccountId}
          >
            <option value="">Select an account</option>
            {accounts.data?.map((account) => (
              <option key={account.id} value={account.id}>
                {accountDisplayName(account, institutionNames)} (
                {account.currency})
              </option>
            ))}
          </select>
          <label htmlFor="manual-transaction-date">Transaction date</label>
          <input
            id="manual-transaction-date"
            onChange={(event) => setManualDate(event.target.value)}
            required
            type="date"
            value={manualDate}
          />
          <label htmlFor="manual-transaction-description">Description</label>
          <input
            id="manual-transaction-description"
            onChange={(event) => setManualDescription(event.target.value)}
            required
            value={manualDescription}
          />
          <label htmlFor="manual-transaction-amount">
            Amount ({manualAccount?.currency ?? "currency"}; use - for an
            expense)
          </label>
          <input
            id="manual-transaction-amount"
            onChange={(event) => setManualAmountMinor(event.target.value)}
            required
            inputMode="decimal"
            placeholder="0.00"
            step="0.01"
            type="number"
            value={manualAmountMinor}
          />
          <label htmlFor="manual-transaction-category">Category</label>
          <select
            id="manual-transaction-category"
            onChange={(event) => setManualCategoryId(event.target.value)}
            value={manualCategoryId}
          >
            <option value="">Uncategorized</option>
            {categories.data
              ?.filter((category) => category.status === "active")
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
          <fieldset>
            <legend>Splits (optional)</legend>
            {manualSplits.map((split, index) => (
              <div key={index}>
                <label htmlFor={`manual-split-amount-${index}`}>
                  Amount ({manualAccount?.currency ?? "currency"})
                </label>
                <input
                  id={`manual-split-amount-${index}`}
                  onChange={(event) =>
                    setManualSplits((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, amountMinor: event.target.value }
                          : item,
                      ),
                    )
                  }
                  required
                  inputMode="decimal"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={split.amountMinor}
                />
                <label htmlFor={`manual-split-category-${index}`}>
                  Category
                </label>
                <select
                  id={`manual-split-category-${index}`}
                  onChange={(event) =>
                    setManualSplits((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, categoryId: event.target.value }
                          : item,
                      ),
                    )
                  }
                  value={split.categoryId}
                >
                  <option value="">Uncategorized</option>
                  {categories.data
                    ?.filter((category) => category.status === "active")
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
                <label htmlFor={`manual-split-memo-${index}`}>Memo</label>
                <input
                  id={`manual-split-memo-${index}`}
                  maxLength={500}
                  onChange={(event) =>
                    setManualSplits((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, memo: event.target.value }
                          : item,
                      ),
                    )
                  }
                  value={split.memo}
                />
                <button
                  onClick={() =>
                    setManualSplits((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  Remove split
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setManualSplits((current) => [
                  ...current,
                  { amountMinor: "", categoryId: "", memo: "" },
                ])
              }
              type="button"
            >
              Add split
            </button>
          </fieldset>
          <button disabled={createManual.isPending} type="submit">
            Record transaction
          </button>
          {createManual.isError ? (
            <p role="alert">{createManual.error.message}</p>
          ) : null}
        </form>
      </details>
      <div
        aria-label="Transaction filters"
        className="transaction-toolbar"
        role="group"
      >
        <label htmlFor="transaction-account-filter">Account</label>
        <select
          id="transaction-account-filter"
          onChange={(event) => setAccountFilter(event.target.value)}
          value={accountFilter}
        >
          <option value="">All accounts</option>
          {accounts.data?.map((account) => (
            <option key={account.id} value={account.id}>
              {accountDisplayName(account, institutionNames)}
            </option>
          ))}
        </select>
        <label htmlFor="transaction-status-filter">Status</label>
        <select
          id="transaction-status-filter"
          onChange={(event) =>
            setStatusFilter(event.target.value as "" | "pending" | "posted")
          }
          value={statusFilter}
        >
          <option value="">All statuses</option>
          <option value="posted">Posted</option>
          <option value="pending">Pending</option>
        </select>
        {accountFilter || statusFilter ? (
          <button
            className="secondary-button"
            onClick={() => {
              setAccountFilter("");
              setStatusFilter("");
            }}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {transactions.isPending ? (
        <p role="status">Loading transactions…</p>
      ) : null}
      {transactions.isError ? (
        <p role="alert">{transactions.error.message}</p>
      ) : null}
      {transactionItems?.length && contextIsPending ? (
        <p role="status">Loading account and category context…</p>
      ) : null}
      {contextError ? (
        <p role="alert">
          Account, institution, or category labels could not be loaded. Some
          transaction context may be incomplete. {contextError.message}
        </p>
      ) : null}
      {transactionItems?.length === 0 ? <p>No transactions yet.</p> : null}
      {transactionItems?.length && (!contextIsPending || contextError) ? (
        <>
          <p className="transaction-result-summary">
            {transactionItems.length} transactions loaded ·{" "}
            {transactionItems.at(-1)?.transactionDate.slice(0, 10)} to{" "}
            {transactionItems[0]?.transactionDate.slice(0, 10)}
          </p>
          <div className="transaction-table-wrap">
            <table aria-label="Transactions" className="transaction-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Account</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Amount</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactionItems.map((transaction) => {
                  const isExpanded = selectedId === transaction.id;
                  const detailId = `transaction-details-${transaction.id}`;
                  const description =
                    transaction.merchant ?? transaction.payee ?? "transaction";
                  return (
                    <Fragment key={transaction.id}>
                      <tr>
                        <td>{transaction.transactionDate.slice(0, 10)}</td>
                        <td>{description}</td>
                        <td
                          aria-label={`${accountDetails.get(transaction.accountId)?.account.name ?? "Unknown account"}, ${accountDetails.get(transaction.accountId)?.institutionName ?? "Unknown institution"}`}
                          className="account-cell"
                        >
                          <strong>
                            {accountDetails.get(transaction.accountId)?.account
                              .name ?? "Unknown account"}
                          </strong>
                          <span>
                            {accountDetails.get(transaction.accountId)
                              ?.institutionName ?? "Unknown institution"}
                          </span>
                        </td>
                        <td>
                          {categoryNames.get(transaction.categoryId ?? "") ??
                            transaction.sourceCategory ??
                            "Uncategorized"}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${transaction.status}`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                        <td className="transaction-amount">
                          {formatMinorUnits(transaction.amountMinor)}{" "}
                          {transaction.currency}
                        </td>
                        <td className="transaction-action">
                          <button
                            aria-controls={detailId}
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? "Hide" : "Show"} details for ${description}`}
                            onClick={() =>
                              setSelectedId(
                                isExpanded ? undefined : transaction.id,
                              )
                            }
                            type="button"
                          >
                            {isExpanded ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="transaction-detail-row">
                          <td colSpan={7}>
                            <section
                              aria-labelledby={`${detailId}-heading`}
                              className="transaction-details"
                              id={detailId}
                            >
                              <h3 id={`${detailId}-heading`}>
                                Transaction details
                              </h3>
                              {details.isPending ? (
                                <p role="status">
                                  Loading transaction details…
                                </p>
                              ) : null}
                              {details.isError ? (
                                <p role="alert">{details.error.message}</p>
                              ) : null}
                              {details.data?.transaction.id ===
                              transaction.id ? (
                                <>
                                  <dl className="transaction-detail-grid">
                                    <dt>Amount</dt>
                                    <dd className="transaction-amount">
                                      {formatMinorUnits(
                                        details.data.transaction.amountMinor,
                                      )}{" "}
                                      {details.data.transaction.currency}
                                    </dd>
                                    <dt>Transaction date</dt>
                                    <dd>
                                      {formatDateTime(
                                        details.data.transaction
                                          .transactionDate,
                                      )}
                                    </dd>
                                    <dt>Posted date</dt>
                                    <dd>
                                      {formatDateTime(
                                        details.data.transaction.postedAt,
                                      )}
                                    </dd>
                                    <dt>Description</dt>
                                    <dd>
                                      {details.data.transaction.merchant ??
                                        details.data.transaction.payee ??
                                        "—"}
                                    </dd>
                                    <dt>Account</dt>
                                    <dd>
                                      {accountDetails.get(
                                        details.data.transaction.accountId,
                                      )
                                        ? `${accountDetails.get(details.data.transaction.accountId)?.institutionName} — ${accountDetails.get(details.data.transaction.accountId)?.account.name}`
                                        : "Unknown account"}
                                    </dd>
                                    <dt>Category</dt>
                                    <dd>
                                      {categoryNames.get(
                                        details.data.transaction.categoryId ??
                                          "",
                                      ) ??
                                        details.data.transaction
                                          .sourceCategory ??
                                        "Uncategorized"}
                                    </dd>
                                    <dt>Source category</dt>
                                    <dd>
                                      {details.data.transaction
                                        .sourceCategory ?? "—"}
                                    </dd>
                                    <dt>Status</dt>
                                    <dd>
                                      <span
                                        className={`status-badge ${details.data.transaction.status}`}
                                      >
                                        {details.data.transaction.status}
                                      </span>
                                    </dd>
                                  </dl>
                                  <details className="provenance-details">
                                    <summary>Import provenance</summary>
                                    <dl className="transaction-detail-grid">
                                      <dt>Source identity</dt>
                                      <dd>
                                        {
                                          details.data.transaction
                                            .sourceIdentity
                                        }
                                      </dd>
                                      <dt>Source record ID</dt>
                                      <dd>
                                        {
                                          details.data.transaction
                                            .sourceRecordId
                                        }
                                      </dd>
                                      <dt>Current record</dt>
                                      <dd>
                                        {details.data.transaction.isCurrent
                                          ? "Yes"
                                          : "No"}
                                      </dd>
                                      <dt>Replaces transaction ID</dt>
                                      <dd>
                                        {details.data.transaction
                                          .replacesTransactionId ?? "—"}
                                      </dd>
                                      <dt>Created</dt>
                                      <dd>
                                        {formatDateTime(
                                          details.data.transaction.createdAt,
                                        )}
                                      </dd>
                                      <dt>Last updated</dt>
                                      <dd>
                                        {formatDateTime(
                                          details.data.transaction.updatedAt,
                                        )}
                                      </dd>
                                    </dl>
                                  </details>
                                  {details.data.splits.length > 0 ? (
                                    <section
                                      aria-labelledby={`${detailId}-splits`}
                                    >
                                      <h4 id={`${detailId}-splits`}>Splits</h4>
                                      <ul aria-label="Transaction splits">
                                        {details.data.splits.map((split) => (
                                          <li key={split.id}>
                                            {formatMinorUnits(
                                              split.amountMinor,
                                            )}{" "}
                                            — {split.memo ?? "No memo"}
                                          </li>
                                        ))}
                                      </ul>
                                    </section>
                                  ) : null}
                                </>
                              ) : null}
                            </section>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {transactions.hasNextPage ? (
        <div className="transaction-pagination" ref={loadMoreRef}>
          <button
            disabled={transactions.isFetchingNextPage}
            onClick={() => void transactions.fetchNextPage()}
            type="button"
          >
            {transactions.isFetchingNextPage
              ? "Loading more transactions…"
              : "Load more transactions"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Categories(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [categoryName, setCategoryName] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [matchValue, setMatchValue] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categories = useQuery({
    queryFn: getCategories,
    queryKey: ["categories"],
  });
  const rules = useQuery({
    queryFn: getCategorizationRules,
    queryKey: ["categorization-rules"],
  });
  const create = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      setCategoryName("");
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const createRule = useMutation({
    mutationFn: createCategorizationRule,
    onSuccess: async () => {
      setMatchValue("");
      setRuleName("");
      await queryClient.invalidateQueries({
        queryKey: ["categorization-rules"],
      });
    },
  });
  return (
    <section aria-labelledby="categories-heading" className="page">
      <h2 id="categories-heading">Categories and rules</h2>
      <form
        className="stacked-form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(categoryName);
        }}
      >
        <label htmlFor="category-name">Category name</label>
        <input
          id="category-name"
          onChange={(event) => setCategoryName(event.target.value)}
          required
          value={categoryName}
        />
        <button disabled={create.isPending} type="submit">
          Add category
        </button>
      </form>
      <ul aria-label="Categories" className="data-list">
        {categories.data?.map((category) => (
          <li key={category.id}>
            {category.name} ({category.status})
          </li>
        ))}
      </ul>
      <form
        className="stacked-form"
        onSubmit={(event) => {
          event.preventDefault();
          createRule.mutate({
            categoryId,
            matchValue,
            name: ruleName,
            precedence: 0,
          });
        }}
      >
        <h3>Merchant rule</h3>
        <label htmlFor="rule-name">Rule name</label>
        <input
          id="rule-name"
          onChange={(event) => setRuleName(event.target.value)}
          required
          value={ruleName}
        />
        <label htmlFor="rule-category">Category</label>
        <select
          id="rule-category"
          onChange={(event) => setCategoryId(event.target.value)}
          required
          value={categoryId}
        >
          <option value="">Select a category</option>
          {categories.data
            ?.filter((category) => category.status === "active")
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
        <label htmlFor="rule-match">Exact merchant</label>
        <input
          id="rule-match"
          onChange={(event) => setMatchValue(event.target.value)}
          required
          value={matchValue}
        />
        <button disabled={createRule.isPending} type="submit">
          Add rule
        </button>
      </form>
      <ul aria-label="Categorization rules" className="data-list">
        {rules.data?.map((rule) => (
          <li key={rule.id}>
            {rule.precedence}: {rule.name} → {rule.matchValue}
          </li>
        ))}
      </ul>
    </section>
  );
}

const accountTypeGroups: readonly Readonly<{
  label: string;
  options: readonly Readonly<{
    label: string;
    value: Account["accountType"];
  }>[];
}>[] = [
  {
    label: "Depository",
    options: [
      { label: "Cash", value: "cash" },
      { label: "Checking", value: "checking" },
      { label: "Savings", value: "savings" },
      { label: "Money market", value: "money_market" },
      { label: "Certificate of deposit", value: "certificate_of_deposit" },
    ],
  },
  {
    label: "Credit and debt",
    options: [
      { label: "Credit card", value: "credit_card" },
      { label: "Mortgage", value: "mortgage" },
      { label: "Auto loan", value: "auto_loan" },
      { label: "Student loan", value: "student_loan" },
      { label: "Personal loan", value: "personal_loan" },
      { label: "Other loan", value: "other_loan" },
    ],
  },
  {
    label: "Investing and retirement",
    options: [
      { label: "Taxable brokerage", value: "taxable_brokerage" },
      { label: "Traditional IRA", value: "traditional_ira" },
      { label: "Roth IRA", value: "roth_ira" },
      { label: "Traditional SEP IRA", value: "traditional_sep_ira" },
      { label: "Roth SEP IRA", value: "roth_sep_ira" },
      { label: "Traditional SIMPLE IRA", value: "traditional_simple_ira" },
      { label: "Roth SIMPLE IRA", value: "roth_simple_ira" },
      { label: "Traditional 401(k)", value: "traditional_401k" },
      { label: "Roth 401(k)", value: "roth_401k" },
      { label: "Mixed 401(k) — needs breakdown", value: "mixed_401k" },
      { label: "Traditional 403(b)", value: "traditional_403b" },
      { label: "Roth 403(b)", value: "roth_403b" },
      { label: "Mixed 403(b) — needs breakdown", value: "mixed_403b" },
      { label: "Traditional 457(b)", value: "traditional_457b" },
      { label: "Roth 457(b)", value: "roth_457b" },
      { label: "Mixed 457(b) — needs breakdown", value: "mixed_457b" },
      { label: "Pension", value: "pension" },
      { label: "Other retirement", value: "other_retirement" },
    ],
  },
  {
    label: "Other",
    options: [
      { label: "Health savings account", value: "hsa" },
      { label: "529 education plan", value: "529" },
      { label: "Other", value: "other" },
      { label: "Unclassified — review required", value: "unclassified" },
    ],
  },
];

function AccountTypeSelect(
  props: Readonly<{
    id: string;
    includeUnclassified?: boolean;
    onChange: (value: Account["accountType"]) => void;
    value: Account["accountType"];
  }>,
): React.JSX.Element {
  return (
    <select
      id={props.id}
      onChange={(event) =>
        props.onChange(event.target.value as Account["accountType"])
      }
      value={props.value}
    >
      {accountTypeGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options
            .filter(
              (option) =>
                props.includeUnclassified === true ||
                option.value !== "unclassified",
            )
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function Accounts(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateAccount>({
    accountType: "checking",
    currency: "USD",
    institutionId: "",
    name: "",
  });
  const [newInstitutionName, setNewInstitutionName] = useState("");
  const [balanceAccountId, setBalanceAccountId] = useState("");
  const [balanceAmountMinor, setBalanceAmountMinor] = useState("");
  const [balanceAsOf, setBalanceAsOf] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const accounts = useQuery({ queryFn: getAccounts, queryKey: ["accounts"] });
  const institutions = useQuery({
    queryFn: getInstitutions,
    queryKey: ["institutions"],
  });
  const institutionNames = new Map(
    institutions.data?.map((institution) => [institution.id, institution.name]),
  );
  const addInstitution = useMutation({
    mutationFn: () => createInstitution({ name: newInstitutionName }),
    onSuccess: async (institution) => {
      setForm((current) => ({ ...current, institutionId: institution.id }));
      setNewInstitutionName("");
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
    },
  });
  const create = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      setForm((current) => ({ ...current, name: "" }));
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  const addBalance = useMutation({
    mutationFn: () =>
      createAccountBalance(balanceAccountId, {
        amountMinor: parseMoneyInput(balanceAmountMinor),
        asOf: new Date(balanceAsOf).toISOString(),
        availableAmountMinor: null,
      }),
    onSuccess: () => setBalanceAmountMinor(""),
  });
  return (
    <section aria-labelledby="accounts-heading" className="page">
      <h2 id="accounts-heading">Accounts</h2>
      <details className="manual-entry-panel">
        <summary>Add an institution</summary>
        <section aria-labelledby="quick-institution-heading">
          <h3 id="quick-institution-heading">Add an institution</h3>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              addInstitution.mutate();
            }}
          >
            <label htmlFor="quick-institution-name">Institution name</label>
            <input
              id="quick-institution-name"
              onChange={(event) => setNewInstitutionName(event.target.value)}
              required
              value={newInstitutionName}
            />
            <button disabled={addInstitution.isPending} type="submit">
              Add institution
            </button>
          </form>
        </section>
      </details>
      <details className="manual-entry-panel">
        <summary>Add an account</summary>
        <form
          className="stacked-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate(form);
          }}
        >
          <label htmlFor="account-name">Account name</label>
          <input
            id="account-name"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            value={form.name}
          />
          <label htmlFor="account-institution">Institution</label>
          <select
            id="account-institution"
            onChange={(event) =>
              setForm({ ...form, institutionId: event.target.value })
            }
            required
            value={form.institutionId}
          >
            <option value="">Select an institution</option>
            {institutions.data?.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
          <label htmlFor="account-type">Account type</label>
          <AccountTypeSelect
            id="account-type"
            onChange={(accountType) =>
              setForm({
                ...form,
                accountType,
              })
            }
            value={form.accountType}
          />
          <label htmlFor="account-currency">Currency</label>
          <input
            id="account-currency"
            maxLength={3}
            onChange={(event) =>
              setForm({ ...form, currency: event.target.value.toUpperCase() })
            }
            pattern="[A-Z]{3}"
            required
            value={form.currency}
          />
          <button disabled={create.isPending} type="submit">
            Add account
          </button>
        </form>
      </details>
      <details className="manual-entry-panel">
        <summary>Record a dated balance</summary>
        <form
          className="stacked-form"
          onSubmit={(event) => {
            event.preventDefault();
            addBalance.mutate();
          }}
        >
          <h3>Record a dated balance</h3>
          <label htmlFor="manual-balance-account">Account</label>
          <select
            id="manual-balance-account"
            onChange={(event) => setBalanceAccountId(event.target.value)}
            required
            value={balanceAccountId}
          >
            <option value="">Select an account</option>
            {accounts.data?.map((account) => (
              <option key={account.id} value={account.id}>
                {accountDisplayName(account, institutionNames)}
              </option>
            ))}
          </select>
          <label htmlFor="manual-balance-amount">
            Balance (
            {accounts.data?.find((account) => account.id === balanceAccountId)
              ?.currency ?? "currency"}
            )
          </label>
          <input
            id="manual-balance-amount"
            onChange={(event) => setBalanceAmountMinor(event.target.value)}
            required
            inputMode="decimal"
            placeholder="0.00"
            step="0.01"
            type="number"
            value={balanceAmountMinor}
          />
          <label htmlFor="manual-balance-as-of">As of</label>
          <input
            id="manual-balance-as-of"
            onChange={(event) => setBalanceAsOf(event.target.value)}
            required
            type="datetime-local"
            value={balanceAsOf}
          />
          <button disabled={addBalance.isPending} type="submit">
            Record balance
          </button>
          {addBalance.isError ? (
            <p role="alert">{addBalance.error.message}</p>
          ) : null}
        </form>
      </details>
      {create.isError ? <p role="alert">{create.error.message}</p> : null}
      {accounts.isPending ? <p role="status">Loading accounts…</p> : null}
      {accounts.isError ? <p role="alert">{accounts.error.message}</p> : null}
      {accounts.data?.length === 0 ? <p>No accounts yet.</p> : null}
      {accounts.data?.length ? (
        <div className="data-table-wrap">
          <table aria-label="Accounts" className="data-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Institution</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Currency</th>
              </tr>
            </thead>
            <tbody>
              {accounts.data.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>
                    {institutionNames.get(account.institutionId) ??
                      "Unknown institution"}
                  </td>
                  <td>{account.accountType.replaceAll("_", " ")}</td>
                  <td>
                    <span className={`status-badge ${account.status}`}>
                      {account.status}
                    </span>
                  </td>
                  <td>{account.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function InstitutionEditor(
  props: Readonly<{
    institution: Awaited<ReturnType<typeof getInstitutions>>[number];
  }>,
): React.JSX.Element {
  const queryClient = useQueryClient();
  const [name, setName] = useState(props.institution.name);
  const [websiteUrl, setWebsiteUrl] = useState(
    props.institution.websiteUrl ?? "",
  );
  const update = useMutation({
    mutationFn: () =>
      updateInstitution(props.institution.id, {
        name,
        websiteUrl: websiteUrl || null,
      }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["institutions"] }),
  });
  const remove = useMutation({
    mutationFn: () => deleteInstitution(props.institution.id),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["institutions"] }),
  });
  return (
    <li>
      <label htmlFor={`institution-${props.institution.id}`}>Name</label>{" "}
      <input
        id={`institution-${props.institution.id}`}
        onChange={(event) => setName(event.target.value)}
        value={name}
      />{" "}
      <label htmlFor={`institution-website-${props.institution.id}`}>
        Website
      </label>{" "}
      <input
        id={`institution-website-${props.institution.id}`}
        onChange={(event) => setWebsiteUrl(event.target.value)}
        type="url"
        value={websiteUrl}
      />{" "}
      <button onClick={() => update.mutate()} type="button">
        Save
      </button>{" "}
      <button onClick={() => remove.mutate()} type="button">
        Delete
      </button>
      {props.institution.domain ? ` · ${props.institution.domain}` : null}
      {remove.isError ? <p role="alert">{remove.error.message}</p> : null}
    </li>
  );
}

function Institutions(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const institutions = useQuery({
    queryFn: getInstitutions,
    queryKey: ["institutions"],
  });
  const create = useMutation({
    mutationFn: () =>
      createInstitution({ name, websiteUrl: websiteUrl || undefined }),
    onSuccess: async () => {
      setName("");
      setWebsiteUrl("");
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
    },
  });
  return (
    <section aria-labelledby="institutions-heading" className="page">
      <h2 id="institutions-heading">Institutions</h2>
      <form
        className="stacked-form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label htmlFor="institution-name">Institution name</label>
        <input
          id="institution-name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
        <label htmlFor="institution-website">Website (optional)</label>
        <input
          id="institution-website"
          onChange={(event) => setWebsiteUrl(event.target.value)}
          type="url"
          value={websiteUrl}
        />
        <button type="submit">Add institution</button>
      </form>
      {institutions.data?.length === 0 ? <p>No institutions yet.</p> : null}
      <ul aria-label="Institutions" className="data-list">
        {institutions.data?.map((institution) => (
          <InstitutionEditor institution={institution} key={institution.id} />
        ))}
      </ul>
    </section>
  );
}

function SimpleFinSyncPanel(
  props: Readonly<{ provider: ProviderConnection }>,
): React.JSX.Element {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const health = useQuery({
    enabled: props.provider.provider === "simplefin",
    queryFn: () => getSimpleFinSyncHealth(props.provider.id),
    queryKey: ["simplefin-sync-health", props.provider.id],
  });
  const sync = useMutation({
    mutationFn: (mode: "deep" | "initial" | "rolling") =>
      syncSimpleFin(props.provider.id, {
        ...(endDate ? { endDate } : {}),
        mode,
        ...(startDate ? { startDate } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["institutions"] }),
        queryClient.invalidateQueries({
          queryKey: ["external-institution-connections"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["account-import-reviews"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["simplefin-sync-health", props.provider.id],
        }),
      ]);
    },
  });
  if (props.provider.provider !== "simplefin") return <></>;
  const lastRun = health.data?.lastRun;
  return (
    <section aria-label="SimpleFIN sync health" className="sync-health">
      <h4>Sync health</h4>
      {health.isPending ? <p role="status">Loading sync health…</p> : null}
      {health.isError ? <p role="alert">{health.error.message}</p> : null}
      {health.data ? (
        <>
          <p>
            Last successful sync: {health.data.lastSuccessAt ?? "Never"}
            {health.data.coverageStart && health.data.coverageEnd
              ? ` · Coverage ${health.data.coverageStart}–${health.data.coverageEnd}`
              : ""}
          </p>
          {lastRun ? (
            <p>
              Latest {lastRun.mode} sync: {lastRun.status} ·{" "}
              {lastRun.accountsAffected} accounts · {lastRun.transactionsAdded}{" "}
              added · {lastRun.transactionsUpdated} updated ·{" "}
              {lastRun.transactionsUnchanged} unchanged ·{" "}
              {lastRun.balancesUpdated} balances refreshed
            </p>
          ) : (
            <p>No sync has run yet.</p>
          )}
          {lastRun?.errors.length ? (
            <ul aria-label="Latest SimpleFIN sync errors">
              {lastRun.errors.map((error, index) => (
                <li key={`${error.code}-${index}`}>
                  {error.code}: {error.message}
                  {error.accountId ? ` (account ${error.accountId})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <div className="form-grid">
        <label htmlFor={`sync-start-${props.provider.id}`}>
          Start date (optional)
        </label>
        <input
          id={`sync-start-${props.provider.id}`}
          onChange={(event) => setStartDate(event.target.value)}
          type="date"
          value={startDate}
        />
        <label htmlFor={`sync-end-${props.provider.id}`}>
          End date (optional)
        </label>
        <input
          id={`sync-end-${props.provider.id}`}
          onChange={(event) => setEndDate(event.target.value)}
          type="date"
          value={endDate}
        />
      </div>
      <div className="button-row">
        <button
          disabled={sync.isPending || props.provider.status !== "connected"}
          onClick={() => sync.mutate("initial")}
          type="button"
        >
          Initial sync (90 days)
        </button>
        <button
          disabled={sync.isPending || props.provider.status !== "connected"}
          onClick={() => sync.mutate("rolling")}
          type="button"
        >
          Refresh (60 days)
        </button>
        <button
          disabled={sync.isPending || props.provider.status !== "connected"}
          onClick={() => sync.mutate("deep")}
          type="button"
        >
          Deep sync (2 years)
        </button>
      </div>
      {sync.isPending ? <p role="status">Syncing SimpleFIN…</p> : null}
      {sync.isError ? <p role="alert">{sync.error.message}</p> : null}
      {sync.isSuccess ? (
        <p role="status">
          SimpleFIN sync finished with status {sync.data.status}.
        </p>
      ) : null}
    </section>
  );
}

function Connections(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [setupToken, setSetupToken] = useState("");
  const providers = useQuery({
    queryFn: getProviderConnections,
    queryKey: ["provider-connections"],
  });
  const external = useQuery({
    queryFn: getExternalInstitutionConnections,
    queryKey: ["external-institution-connections"],
  });
  const institutions = useQuery({
    queryFn: getInstitutions,
    queryKey: ["institutions"],
  });
  const revoke = useMutation({
    mutationFn: revokeProviderConnection,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["provider-connections"] }),
        queryClient.invalidateQueries({
          queryKey: ["external-institution-connections"],
        }),
      ]);
    },
  });
  const connect = useMutation({
    mutationFn: () =>
      connectSimpleFin(
        setupToken.trim() === "" ? {} : { setupToken: setupToken.trim() },
      ),
    onSuccess: async () => {
      setSetupToken("");
      await queryClient.invalidateQueries({
        queryKey: ["provider-connections"],
      });
    },
  });
  return (
    <section aria-labelledby="connections-heading" className="page">
      <h2 id="connections-heading">Connections</h2>
      <section aria-labelledby="simplefin-connect-heading">
        <h3 id="simplefin-connect-heading">Connect SimpleFIN</h3>
        <p>
          <a
            href="https://bridge.simplefin.org/simplefin/create"
            rel="noreferrer"
            target="_blank"
          >
            Create a one-time setup token in SimpleFIN
          </a>
          , then paste it here. Leave this blank to use SIMPLE_FIN_TOKEN from
          your local .env file.
        </p>
        <form
          className="stacked-form"
          onSubmit={(event) => {
            event.preventDefault();
            connect.mutate();
          }}
        >
          <label htmlFor="simplefin-setup-token">SimpleFIN setup token</label>
          <textarea
            autoComplete="off"
            id="simplefin-setup-token"
            onChange={(event) => setSetupToken(event.target.value)}
            spellCheck={false}
            value={setupToken}
          />
          <button disabled={connect.isPending} type="submit">
            {connect.isPending ? "Connecting…" : "Connect SimpleFIN"}
          </button>
          {connect.isError ? <p role="alert">{connect.error.message}</p> : null}
          {connect.isSuccess ? (
            <p role="status">SimpleFIN is connected.</p>
          ) : null}
        </form>
      </section>
      <p>
        Disconnecting stops future sync. Institutions, accounts, and financial
        history remain stored locally.
      </p>
      {providers.data?.length === 0 ? (
        <p>No provider connections yet.</p>
      ) : null}
      <ul aria-label="Provider connections" className="data-list">
        {providers.data?.map((provider) => (
          <li key={provider.id}>
            {provider.provider} — {provider.status}
            <ul>
              {external.data
                ?.filter(
                  (connection) =>
                    connection.providerConnectionId === provider.id,
                )
                .map((connection) => (
                  <li key={connection.id}>
                    {institutions.data?.find(
                      (institution) =>
                        institution.id === connection.institutionId,
                    )?.name ?? "Unknown institution"}{" "}
                    — {connection.remoteName} — {connection.status}
                  </li>
                ))}
            </ul>
            <button
              disabled={provider.status === "disconnected"}
              onClick={() => revoke.mutate(provider.id)}
              type="button"
            >
              Disconnect
            </button>
            <SimpleFinSyncPanel provider={provider} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ImportReviewItem(
  props: Readonly<{
    institutions: Awaited<ReturnType<typeof getInstitutions>>;
    review: AccountImportReview;
  }>,
): React.JSX.Element {
  const queryClient = useQueryClient();
  const [institutionId, setInstitutionId] = useState(
    props.review.candidateInstitutionIds[0] ?? "",
  );
  const [accountType, setAccountType] = useState<Account["accountType"]>(
    props.review.accountType,
  );
  const resolve = useMutation({
    mutationFn: () =>
      resolveAccountImportReview(props.review.id, {
        accountType,
        institutionId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account-import-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      ]);
    },
  });
  return (
    <li>
      <h3>{props.review.accountName}</h3>
      <p>
        {props.review.remoteConnectionName} · {props.review.currency}
      </p>
      <label htmlFor={`review-institution-${props.review.id}`}>
        Institution
      </label>
      <select
        id={`review-institution-${props.review.id}`}
        onChange={(event) => setInstitutionId(event.target.value)}
        required
        value={institutionId}
      >
        <option value="">Select an institution</option>
        {props.institutions.map((institution) => (
          <option key={institution.id} value={institution.id}>
            {institution.name}
          </option>
        ))}
      </select>
      <label htmlFor={`review-type-${props.review.id}`}>Account type</label>
      <AccountTypeSelect
        id={`review-type-${props.review.id}`}
        includeUnclassified
        onChange={setAccountType}
        value={accountType}
      />
      <button
        disabled={!institutionId || accountType === "unclassified"}
        onClick={() => resolve.mutate()}
        type="button"
      >
        Complete review
      </button>
    </li>
  );
}

function ImportReviews(): React.JSX.Element {
  const reviews = useQuery({
    queryFn: getAccountImportReviews,
    queryKey: ["account-import-reviews"],
  });
  const institutions = useQuery({
    queryFn: getInstitutions,
    queryKey: ["institutions"],
  });
  return (
    <section aria-labelledby="import-review-heading" className="page">
      <h2 id="import-review-heading">Import review</h2>
      {reviews.data?.length === 0 ? <p>No imports need review.</p> : null}
      <ul aria-label="Accounts requiring import review" className="data-list">
        {reviews.data?.map((review) => (
          <ImportReviewItem
            institutions={institutions.data ?? []}
            key={review.id}
            review={review}
          />
        ))}
      </ul>
    </section>
  );
}

type OverviewAccount = FinancialState["accountBreakdown"][number];

const overviewAccountGroupDefinitions: readonly Readonly<{
  label: string;
  types: readonly Account["accountType"][];
}>[] = [
  {
    label: "Cash available",
    types: ["cash", "checking", "savings", "money_market"],
  },
  { label: "Certificates", types: ["certificate_of_deposit"] },
  { label: "Credit cards", types: ["credit_card"] },
  {
    label: "Loans and debt",
    types: [
      "mortgage",
      "auto_loan",
      "student_loan",
      "personal_loan",
      "other_loan",
    ],
  },
  { label: "Investments", types: ["taxable_brokerage"] },
  {
    label: "Retirement",
    types: [
      "traditional_ira",
      "roth_ira",
      "traditional_sep_ira",
      "roth_sep_ira",
      "traditional_simple_ira",
      "roth_simple_ira",
      "traditional_401k",
      "roth_401k",
      "mixed_401k",
      "traditional_403b",
      "roth_403b",
      "mixed_403b",
      "traditional_457b",
      "roth_457b",
      "mixed_457b",
      "pension",
      "other_retirement",
    ],
  },
  { label: "Health and education", types: ["hsa", "529"] },
  { label: "Other and needs review", types: ["other", "unclassified"] },
];

const accountTypeLabels = new Map(
  accountTypeGroups.flatMap((group) =>
    group.options.map((option) => [option.value, option.label] as const),
  ),
);

function groupedOverviewAccounts(
  accounts: readonly OverviewAccount[],
): readonly Readonly<{
  accounts: readonly OverviewAccount[];
  label: string;
  totalMinor: number;
}>[] {
  return overviewAccountGroupDefinitions.flatMap((definition) => {
    const grouped = accounts
      .filter((account) => definition.types.includes(account.accountType))
      .sort(
        (left, right) =>
          left.institutionName.localeCompare(right.institutionName) ||
          left.accountName.localeCompare(right.accountName),
      );
    if (grouped.length === 0) return [];
    return [
      {
        accounts: grouped,
        label: definition.label,
        totalMinor: grouped.reduce(
          (total, account) => total + (account.balanceMinor ?? 0),
          0,
        ),
      },
    ];
  });
}

function Overview(): React.JSX.Element {
  const health = useQuery({
    queryFn: getHealth,
    queryKey: ["health"],
    retry: false,
  });
  const financialState = useQuery({
    queryFn: () => getFinancialState(),
    queryKey: ["financial-state", "USD"],
  });
  const accountGroups = financialState.data
    ? groupedOverviewAccounts(financialState.data.accountBreakdown)
    : [];
  const investedAccountBalanceMinor = accountGroups
    .filter(
      (group) => group.label === "Investments" || group.label === "Retirement",
    )
    .reduce((total, group) => total + group.totalMinor, 0);
  return (
    <section aria-labelledby="overview-heading" className="page">
      <h2 id="overview-heading">Workspace overview</h2>
      {health.isPending ? <p role="status">Checking local API…</p> : null}
      {health.isError ? <p role="alert">{health.error.message}</p> : null}
      {health.data === "ok" ? <p role="status">Local API is ready.</p> : null}
      <section aria-labelledby="financial-state-heading">
        <h3 id="financial-state-heading">Current financial state</h3>
        {financialState.isPending ? (
          <p role="status">Calculating current balances…</p>
        ) : null}
        {financialState.isError ? (
          <p role="alert">{financialState.error.message}</p>
        ) : null}
        {financialState.data ? (
          <>
            <dl className="transaction-detail-grid">
              <dt>Spendable today</dt>
              <dd>
                {formatMinorUnits(financialState.data.spendableFundsMinor)}
              </dd>
              <dt>Investment and retirement balances</dt>
              <dd>
                {formatCurrencyMinorUnits(
                  investedAccountBalanceMinor,
                  financialState.data.currency,
                )}
              </dd>
              <dt>Liabilities</dt>
              <dd>
                {formatMinorUnits(-financialState.data.liabilityBalanceMinor)}
              </dd>
              <dt>Net worth</dt>
              <dd>{formatMinorUnits(financialState.data.netWorthMinor)}</dd>
            </dl>
            <p>
              As of {financialState.data.asOf}. CDs and investments are excluded
              from spendable funds.
            </p>
            <section
              aria-labelledby="account-balances-heading"
              className="overview-accounts"
            >
              <h3 id="account-balances-heading">Accounts and balances</h3>
              <p>
                Current balances are grouped by purpose. Available balance is
                shown separately when the institution provides it.
              </p>
              {financialState.data.accountBreakdown.length === 0 ? (
                <p>No account balances are available yet.</p>
              ) : (
                accountGroups.map((group) => (
                  <details
                    className="account-balance-group"
                    key={group.label}
                    open
                  >
                    <summary>
                      <span>{group.label}</span>
                      <strong>
                        {formatCurrencyMinorUnits(
                          group.totalMinor,
                          financialState.data.currency,
                        )}
                      </strong>
                    </summary>
                    <div className="data-table-wrap">
                      <table
                        aria-label={`${group.label} accounts`}
                        className="data-table overview-account-table"
                      >
                        <thead>
                          <tr>
                            <th scope="col">Account</th>
                            <th scope="col">Institution</th>
                            <th scope="col">Type</th>
                            <th scope="col">Balance</th>
                            <th scope="col">Available</th>
                            <th scope="col">Balance date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.accounts.map((account) => (
                            <tr key={account.accountId}>
                              <td>
                                <strong>{account.accountName}</strong>
                                {account.status !== "active" ? (
                                  <span className="account-status-note">
                                    {account.status}
                                  </span>
                                ) : null}
                              </td>
                              <td>{account.institutionName}</td>
                              <td>
                                {accountTypeLabels.get(account.accountType) ??
                                  account.accountType.replaceAll("_", " ")}
                              </td>
                              <td className="overview-account-amount">
                                {account.balanceMinor === null
                                  ? "Not available"
                                  : formatCurrencyMinorUnits(
                                      account.balanceMinor,
                                      account.currency,
                                    )}
                              </td>
                              <td className="overview-account-amount">
                                {account.availableAmountMinor === null
                                  ? "—"
                                  : formatCurrencyMinorUnits(
                                      account.availableAmountMinor,
                                      account.currency,
                                    )}
                              </td>
                              <td>{formatDateTime(account.balanceAsOf)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))
              )}
            </section>
            {financialState.data.warnings.length > 0 ? (
              <ul aria-label="Financial-state warnings">
                {financialState.data.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.entityId}`}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  );
}

function HouseholdProfile(): React.JSX.Element {
  const queryClient = useQueryClient();
  const households = useQuery({
    queryFn: getHouseholds,
    queryKey: ["households"],
  });
  const household = households.data?.[0];
  const people = useQuery({
    enabled: household !== undefined,
    queryFn: () => getPeople(household?.id ?? ""),
    queryKey: ["people", household?.id],
  });
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const facts = useQuery({
    enabled: household !== undefined,
    queryFn: () => getHouseholdFacts(household?.id ?? "", asOf),
    queryKey: ["household-facts", household?.id, asOf],
  });
  const [householdName, setHouseholdName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [factKey, setFactKey] = useState("");
  const [factValue, setFactValue] = useState("");
  const createHome = useMutation({
    mutationFn: () => createHousehold({ currency: "USD", name: householdName }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["households"] }),
  });
  const addMember = useMutation({
    mutationFn: () =>
      createPerson(household?.id ?? "", {
        dependent: false,
        name: memberName,
        relationship: "member",
      }),
    onSuccess: async () => {
      setMemberName("");
      await queryClient.invalidateQueries({
        queryKey: ["people", household?.id],
      });
    },
  });
  const addFact = useMutation({
    mutationFn: () =>
      createHouseholdFact(household?.id ?? "", {
        confidence: 1,
        effectiveFrom: asOf,
        factKey,
        sensitivity: "standard",
        source: "user",
        value: factValue,
        valueType: "string",
      }),
    onSuccess: async () => {
      setFactKey("");
      setFactValue("");
      await queryClient.invalidateQueries({
        queryKey: ["household-facts", household?.id],
      });
    },
  });
  return (
    <section aria-labelledby="profile-heading" className="page">
      <h2 id="profile-heading">Household profile</h2>
      {!household ? (
        <form
          className="stacked-form"
          onSubmit={(event) => {
            event.preventDefault();
            createHome.mutate();
          }}
        >
          <label htmlFor="household-name">Household name</label>
          <input
            id="household-name"
            required
            value={householdName}
            onChange={(event) => setHouseholdName(event.target.value)}
          />
          <button type="submit">Create household</button>
        </form>
      ) : (
        <>
          <h3>{household.name}</h3>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              addMember.mutate();
            }}
          >
            <label htmlFor="member-name">Member name</label>
            <input
              id="member-name"
              required
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
            />
            <button type="submit">Add member</button>
          </form>
          <ul aria-label="Household members">
            {people.data?.map((person) => (
              <li key={person.id}>
                {person.name}
                {person.dependent ? " — dependent" : ""}
              </li>
            ))}
          </ul>
          <label htmlFor="facts-as-of">Facts as of</label>
          <input
            id="facts-as-of"
            type="date"
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
          />
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              addFact.mutate();
            }}
          >
            <label htmlFor="fact-key">Fact name</label>
            <input
              id="fact-key"
              required
              value={factKey}
              onChange={(event) => setFactKey(event.target.value)}
            />
            <label htmlFor="fact-value">Value</label>
            <input
              id="fact-value"
              required
              value={factValue}
              onChange={(event) => setFactValue(event.target.value)}
            />
            <button type="submit">Add dated fact</button>
          </form>
          <ul aria-label="Household facts">
            {facts.data?.map((fact) => (
              <li key={fact.id}>
                {fact.factKey}: {String(fact.value)} ·{" "}
                {Math.round(fact.confidence * 100)}% confidence
                {fact.sensitivity === "sensitive" ? " · Sensitive" : ""}
                {fact.verifiedAt === null ? " · Unverified" : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Planning(): React.JSX.Element {
  const queryClient = useQueryClient();
  const households = useQuery({
    queryFn: getHouseholds,
    queryKey: ["households"],
  });
  const household = households.data?.[0];
  const goals = useQuery({
    enabled: household !== undefined,
    queryFn: () => getFinancialGoals(household?.id ?? ""),
    queryKey: ["goals", household?.id],
  });
  const assumptions = useQuery({
    enabled: household !== undefined,
    queryFn: () => getScenarioAssumptions(household?.id ?? ""),
    queryKey: ["assumptions", household?.id],
  });
  const [goalName, setGoalName] = useState("");
  const [assumptionKey, setAssumptionKey] = useState("");
  const [assumptionValue, setAssumptionValue] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(`${today.slice(0, 7)}-01`);
  const [scenarioId, setScenarioId] = useState("");
  const selectedScenarioId =
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(scenarioId)
      ? scenarioId
      : "";
  const dashboard = useQuery({
    enabled: household !== undefined,
    queryFn: () =>
      getPlanningDashboard(household?.id ?? "", {
        currency: household?.currency ?? "USD",
        periodStart,
        ...(selectedScenarioId ? { scenarioId: selectedScenarioId } : {}),
      }),
    queryKey: [
      "planning-dashboard",
      household?.id,
      household?.currency,
      periodStart,
      selectedScenarioId,
    ],
  });
  const addGoal = useMutation({
    mutationFn: () =>
      createFinancialGoal(household?.id ?? "", {
        constraintLevel: "soft",
        currency: household?.currency ?? "USD",
        fundingStrategy: "mixed",
        name: goalName,
        priorityTier: "important",
        targetAmountMinor: 100_000,
        targetDate: `${new Date().getUTCFullYear() + 1}-12-31`,
      }),
    onSuccess: async () => {
      setGoalName("");
      await queryClient.invalidateQueries({
        queryKey: ["goals", household?.id],
      });
    },
  });
  const addAssumption = useMutation({
    mutationFn: () =>
      createScenarioAssumption(household?.id ?? "", {
        assumptionKey,
        confidence: 1,
        effectiveFrom: today,
        source: "user",
        value: assumptionValue,
      }),
    onSuccess: async () => {
      setAssumptionKey("");
      setAssumptionValue("");
      await queryClient.invalidateQueries({
        queryKey: ["assumptions", household?.id],
      });
    },
  });
  if (!household)
    return (
      <section className="page">
        <h2>Planning assumptions</h2>
        <p>Create a household profile first.</p>
      </section>
    );
  return (
    <section aria-labelledby="planning-heading" className="page">
      <h2 id="planning-heading">Planning dashboard</h2>
      <p>
        Current cash is shown separately from future allocations. All amounts
        below use the selected period and the dashboard data-as-of timestamp.
      </p>
      <div className="planning-controls">
        <label htmlFor="planning-period">Reconciliation month</label>
        <input
          id="planning-period"
          onChange={(event) =>
            setPeriodStart(
              event.target.value ? `${event.target.value}-01` : periodStart,
            )
          }
          type="month"
          value={periodStart.slice(0, 7)}
        />
        <label htmlFor="planning-scenario">Scenario ID (optional)</label>
        <input
          id="planning-scenario"
          onChange={(event) => setScenarioId(event.target.value)}
          placeholder="Compare an existing hypothetical scenario"
          value={scenarioId}
        />
      </div>
      {dashboard.isPending ? (
        <p role="status">Reconciling the selected plan…</p>
      ) : null}
      {dashboard.isError ? <p role="alert">{dashboard.error.message}</p> : null}
      {dashboard.data ? (
        <>
          <section
            aria-labelledby="planning-context-heading"
            className="planning-panel"
          >
            <h3 id="planning-context-heading">Plan context</h3>
            <p>
              {dashboard.data.context.plan ? (
                <>
                  <strong>
                    {dashboard.data.context.plan.mode === "scenario"
                      ? "Hypothetical scenario"
                      : "Active plan"}
                    :
                  </strong>{" "}
                  {dashboard.data.context.plan.label}
                </>
              ) : (
                "No active plan version"
              )}
              {" · "}
              {dashboard.data.context.currency} ·{" "}
              {dashboard.data.context.period.start}
              {" – "}
              {dashboard.data.context.period.end} · data as of{" "}
              {dashboard.data.context.dataAsOf}
            </p>
            {dashboard.data.scenarioDifference ? (
              <p className="scenario-banner">
                Scenario difference:{" "}
                {dashboard.data.scenarioDifference.changedInputCount} changed
                inputs ·{" "}
                {formatMinorUnits(
                  dashboard.data.scenarioDifference.monthlyNetEffectMinor,
                )}{" "}
                monthly net effect
              </p>
            ) : null}
          </section>
          <dl
            className="planning-metrics"
            aria-label="Current and planned amounts"
          >
            <div>
              <dt>Spendable today</dt>
              <dd>
                {formatMinorUnits(
                  dashboard.data.currentFunds.spendableFundsMinor,
                )}
              </dd>
            </div>
            <div>
              <dt>Current balance</dt>
              <dd>
                {formatMinorUnits(
                  dashboard.data.currentFunds.currentBalanceMinor,
                )}
              </dd>
            </div>
            <div>
              <dt>Expected net income</dt>
              <dd>
                {formatMinorUnits(dashboard.data.plan.expectedNetIncomeMinor)}
              </dd>
            </div>
            <div>
              <dt>Monthly surplus / shortfall</dt>
              <dd>
                {formatMinorUnits(dashboard.data.plan.monthlySurplusMinor)}
              </dd>
            </div>
          </dl>
          <section aria-labelledby="planned-claims-heading">
            <h3 id="planned-claims-heading">Future cash claims</h3>
            <dl className="transaction-detail-grid">
              <dt>Gross income</dt>
              <dd>{formatMinorUnits(dashboard.data.plan.grossIncomeMinor)}</dd>
              <dt>Required obligations</dt>
              <dd>
                {formatMinorUnits(dashboard.data.plan.requiredObligationsMinor)}
              </dd>
              <dt>Recurring budgets</dt>
              <dd>
                {formatMinorUnits(dashboard.data.plan.recurringBudgetsMinor)}
              </dd>
              <dt>Goal funding</dt>
              <dd>{formatMinorUnits(dashboard.data.plan.goalFundingMinor)}</dd>
              <dt>Planned investments</dt>
              <dd>
                {formatMinorUnits(dashboard.data.plan.plannedInvestmentsMinor)}
              </dd>
            </dl>
          </section>
          <section aria-labelledby="reconciliation-heading">
            <h3 id="reconciliation-heading">Planned versus actual</h3>
            <div className="reconciliation-list">
              {Object.values(dashboard.data.reconciliation).map((item) => (
                <article
                  className={`reconciliation-item ${item.status}`}
                  key={item.label}
                >
                  <h4>{item.label}</h4>
                  <p>
                    Planned {formatMinorUnits(item.plannedMinor)} · actual{" "}
                    {formatMinorUnits(item.actualMinor)} · variance{" "}
                    {formatMinorUnits(item.varianceMinor)}
                  </p>
                  {item.unresolvedMatches > 0 ||
                  item.lowConfidenceMatches > 0 ? (
                    <p>
                      {item.unresolvedMatches} unresolved ·{" "}
                      {item.lowConfidenceMatches} low-confidence matches
                    </p>
                  ) : null}
                  <p>Status: {item.status}</p>
                </article>
              ))}
            </div>
          </section>
          {dashboard.data.warnings.length > 0 ? (
            <section
              aria-label="Planning data-quality warnings"
              className="planning-warnings"
              role="alert"
            >
              <h3>Warnings and conflicts</h3>
              <ul>
                {dashboard.data.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.message}`}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
      <h3>Planning assumptions</h3>
      <form
        className="stacked-form"
        onSubmit={(event) => {
          event.preventDefault();
          addGoal.mutate();
        }}
      >
        <label htmlFor="goal-name">Goal name</label>
        <input
          id="goal-name"
          required
          value={goalName}
          onChange={(event) => setGoalName(event.target.value)}
        />
        <button type="submit">Add goal</button>
      </form>
      <ul aria-label="Financial goals">
        {goals.data?.map((goal) => (
          <li key={goal.id}>
            {goal.name} — {formatMinorUnits(goal.targetAmountMinor)}{" "}
            {goal.currency} by {goal.targetDate}
          </li>
        ))}
      </ul>
      <form
        className="stacked-form"
        onSubmit={(event) => {
          event.preventDefault();
          addAssumption.mutate();
        }}
      >
        <label htmlFor="assumption-key">Assumption</label>
        <input
          id="assumption-key"
          required
          value={assumptionKey}
          onChange={(event) => setAssumptionKey(event.target.value)}
        />
        <label htmlFor="assumption-value">Assumed value</label>
        <input
          id="assumption-value"
          required
          value={assumptionValue}
          onChange={(event) => setAssumptionValue(event.target.value)}
        />
        <button type="submit">Add assumption</button>
      </form>
      <ul aria-label="Scenario assumptions">
        {assumptions.data?.map((assumption) => (
          <li key={assumption.id}>
            {assumption.assumptionKey}: {String(assumption.value)} · source{" "}
            {assumption.source}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BudgetDashboard(): React.JSX.Element {
  const budgets = useQuery({ queryFn: getBudgets, queryKey: ["budgets"] });
  const budget = budgets.data?.[0];
  const periods = useQuery({
    enabled: budget !== undefined,
    queryFn: () => getBudgetPeriods(budget?.id ?? ""),
    queryKey: ["budget-periods", budget?.id],
  });
  const [periodId, setPeriodId] = useState("");
  useEffect(() => {
    if (!periodId && periods.data?.[0]) setPeriodId(periods.data[0].id);
  }, [periodId, periods.data]);
  const analysis = useQuery({
    enabled: periodId !== "",
    queryFn: () => getBudgetAnalysis(periodId),
    queryKey: ["budget-analysis", periodId],
  });
  const previousPeriod = periods.data?.find((period) => period.id !== periodId);
  const comparison = useQuery({
    enabled: previousPeriod !== undefined,
    queryFn: () => getBudgetAnalysis(previousPeriod?.id ?? ""),
    queryKey: ["budget-analysis", previousPeriod?.id],
  });
  const [drilldown, setDrilldown] = useState<Readonly<{
    categoryId?: string;
    kind: "category" | "transfer" | "uncategorized";
  }> | null>(null);
  const transactions = useQuery({
    enabled: drilldown !== null && periodId !== "",
    queryFn: () =>
      getBudgetDrilldown(periodId, drilldown ?? { kind: "uncategorized" }),
    queryKey: ["budget-drilldown", periodId, drilldown],
  });
  if (budgets.isPending)
    return (
      <section className="page">
        <h2>Budget dashboard</h2>
        <p role="status">Loading budget…</p>
      </section>
    );
  if (budgets.isError)
    return (
      <section className="page">
        <h2>Budget dashboard</h2>
        <p role="alert">{budgets.error.message}</p>
      </section>
    );
  if (!budget)
    return (
      <section className="page">
        <h2>Budget dashboard</h2>
        <p>No budgets yet. Create a budget through the local API to begin.</p>
      </section>
    );
  return (
    <section aria-labelledby="budget-heading" className="page">
      <h2 id="budget-heading">Budget dashboard</h2>
      <label htmlFor="budget-period">Budget period</label>
      <select
        id="budget-period"
        value={periodId}
        onChange={(event) => {
          setPeriodId(event.target.value);
          setDrilldown(null);
        }}
      >
        {periods.data?.map((period) => (
          <option key={period.id} value={period.id}>
            {period.dateFrom.slice(0, 10)} to {period.dateTo.slice(0, 10)}
          </option>
        ))}
      </select>
      {periods.data?.length === 0 ? <p>No budget periods yet.</p> : null}
      {analysis.isPending && periodId ? (
        <p role="status">Calculating budget…</p>
      ) : null}
      {analysis.isError ? <p role="alert">{analysis.error.message}</p> : null}
      {analysis.data ? (
        <>
          <dl className="summary-grid">
            <div>
              <dt>Planned</dt>
              <dd>{formatMinorUnits(analysis.data.targetAmountMinor)}</dd>
            </div>
            <div>
              <dt>Actual</dt>
              <dd>{formatMinorUnits(analysis.data.actualAmountMinor)}</dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd>{formatMinorUnits(analysis.data.remainingAmountMinor)}</dd>
            </div>
          </dl>
          {comparison.data ? (
            <p>
              Compared with previous period:{" "}
              {formatMinorUnits(
                analysis.data.actualAmountMinor -
                  comparison.data.actualAmountMinor,
              )}{" "}
              change in actual spending.
            </p>
          ) : (
            <p>No earlier period available for comparison.</p>
          )}
          <ul aria-label="Budget category variance" className="data-list">
            {analysis.data.lines.map((line) => (
              <li key={line.categoryId}>
                <span>{line.categoryId}</span>
                <progress
                  aria-label={`Category ${line.categoryId} usage`}
                  max={Math.max(line.targetAmountMinor, 1)}
                  value={Math.min(
                    line.actualAmountMinor,
                    Math.max(line.targetAmountMinor, 1),
                  )}
                />{" "}
                <span>
                  {formatMinorUnits(line.actualAmountMinor)} of{" "}
                  {formatMinorUnits(line.targetAmountMinor)} · variance{" "}
                  {formatMinorUnits(line.varianceAmountMinor)}
                </span>{" "}
                <button
                  type="button"
                  onClick={() =>
                    setDrilldown({
                      categoryId: line.categoryId,
                      kind: "category",
                    })
                  }
                >
                  Review transactions
                </button>
              </li>
            ))}
          </ul>
          <aside aria-label="Budget data quality">
            <h3>Data quality</h3>
            <button
              type="button"
              onClick={() => setDrilldown({ kind: "uncategorized" })}
            >
              Uncategorized:{" "}
              {formatMinorUnits(analysis.data.uncategorizedAmountMinor)}
            </button>
            <button
              type="button"
              onClick={() => setDrilldown({ kind: "transfer" })}
            >
              Excluded transfers:{" "}
              {formatMinorUnits(analysis.data.transferExcludedAmountMinor)}
            </button>
          </aside>
        </>
      ) : null}
      {drilldown ? (
        <section aria-labelledby="drilldown-heading">
          <h3 id="drilldown-heading">Transaction drill-down</h3>
          {transactions.isPending ? (
            <p role="status">Loading transactions…</p>
          ) : null}
          {transactions.isError ? (
            <p role="alert">{transactions.error.message}</p>
          ) : null}
          {transactions.data?.length === 0 ? (
            <p>No transactions match this filter.</p>
          ) : null}
          <ul>
            {transactions.data?.map((transaction) => (
              <li key={transaction.id}>
                {transaction.transactionDate.slice(0, 10)} —{" "}
                {transaction.merchant ?? transaction.payee ?? "Transaction"} —{" "}
                {formatMinorUnits(transaction.amountMinor)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function NotFound(): React.JSX.Element {
  return <p role="alert">That page does not exist.</p>;
}

const rootRoute = createRootRoute({ component: Layout });
const overviewRoute = createRoute({
  component: Overview,
  getParentRoute: () => rootRoute,
  path: "/",
});
const accountsRoute = createRoute({
  component: Accounts,
  getParentRoute: () => rootRoute,
  path: "/accounts",
});
const institutionsRoute = createRoute({
  component: Institutions,
  getParentRoute: () => rootRoute,
  path: "/institutions",
});
const connectionsRoute = createRoute({
  component: Connections,
  getParentRoute: () => rootRoute,
  path: "/connections",
});
const importReviewRoute = createRoute({
  component: ImportReviews,
  getParentRoute: () => rootRoute,
  path: "/import-review",
});
const transactionsRoute = createRoute({
  component: Transactions,
  getParentRoute: () => rootRoute,
  path: "/transactions",
});
const categoriesRoute = createRoute({
  component: Categories,
  getParentRoute: () => rootRoute,
  path: "/categories",
});
const csvImportRoute = createRoute({
  component: CsvImport,
  getParentRoute: () => rootRoute,
  path: "/import",
});
const profileRoute = createRoute({
  component: HouseholdProfile,
  getParentRoute: () => rootRoute,
  path: "/profile",
});
const planningRoute = createRoute({
  component: Planning,
  getParentRoute: () => rootRoute,
  path: "/planning",
});
const budgetsRoute = createRoute({
  component: BudgetDashboard,
  getParentRoute: () => rootRoute,
  path: "/budgets",
});
export const appRouter = createRouter({
  defaultNotFoundComponent: NotFound,
  routeTree: rootRoute.addChildren([
    overviewRoute,
    institutionsRoute,
    accountsRoute,
    connectionsRoute,
    transactionsRoute,
    categoriesRoute,
    csvImportRoute,
    importReviewRoute,
    profileRoute,
    planningRoute,
    budgetsRoute,
  ]),
});
const queryClient = new QueryClient();

export function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={appRouter} />
    </QueryClientProvider>
  );
}
