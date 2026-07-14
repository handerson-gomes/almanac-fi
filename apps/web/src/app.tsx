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
  createCategorizationRule,
  createCategory,
  createHousehold,
  createHouseholdFact,
  createFinancialGoal,
  createScenarioAssumption,
  createPerson,
  createCsvMapping,
  createAccount,
  getCsvMappings,
  getAccounts,
  getBudgetAnalysis,
  getBudgetDrilldown,
  getBudgetPeriods,
  getBudgets,
  getCategories,
  getCategorizationRules,
  getHealth,
  getHouseholdFacts,
  getHouseholds,
  getFinancialGoals,
  getScenarioAssumptions,
  getPeople,
  getTransaction,
  getTransactions,
  previewCsvImport,
  updateCsvMapping,
  type CreateAccount,
  type CsvMapping,
  type TransactionPage,
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
          <Link to="/accounts">Accounts</Link>
          <Link to="/transactions">Transactions</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/profile">Household</Link>
          <Link to="/planning">Planning</Link>
          <Link to="/budgets">Budgets</Link>
          <Link to="/import">Import CSV</Link>
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

function CsvImport(): React.JSX.Element {
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryFn: getAccounts, queryKey: ["accounts"] });
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
            {account.name} ({account.currency})
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
  const transactions = useInfiniteQuery<
    TransactionPage,
    Error,
    InfiniteData<TransactionPage>,
    ["transactions"],
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getTransactions(pageParam),
    queryKey: ["transactions"],
  });
  const accounts = useQuery({
    queryFn: getAccounts,
    queryKey: ["accounts"],
  });
  const categories = useQuery({
    queryFn: getCategories,
    queryKey: ["categories"],
  });
  const [selectedId, setSelectedId] = useState<string>();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const details = useQuery({
    enabled: selectedId !== undefined,
    queryFn: () => getTransaction(selectedId ?? ""),
    queryKey: ["transaction", selectedId],
  });
  const accountNames = new Map(
    accounts.data?.map((account) => [account.id, account.name]),
  );
  const categoryNames = new Map(
    categories.data?.map((category) => [category.id, category.name]),
  );
  const transactionItems = transactions.data?.pages.flatMap(
    (page) => page.items,
  );
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
      {transactions.isPending ? (
        <p role="status">Loading transactions…</p>
      ) : null}
      {transactions.isError ? (
        <p role="alert">{transactions.error.message}</p>
      ) : null}
      {transactionItems?.length === 0 ? <p>No transactions yet.</p> : null}
      {transactionItems?.length ? (
        <div className="transaction-table-wrap">
          <table aria-label="Transactions" className="transaction-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Account</th>
                <th scope="col">Category</th>
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
                      <td>
                        {accountNames.get(transaction.accountId) ?? "Unknown"}
                      </td>
                      <td>
                        {categoryNames.get(transaction.categoryId ?? "") ??
                          transaction.sourceCategory ??
                          "Uncategorized"}
                      </td>
                      <td className="transaction-amount">
                        {formatMinorUnits(transaction.amountMinor)}
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
                        <td colSpan={6}>
                          <section
                            aria-labelledby={`${detailId}-heading`}
                            className="transaction-details"
                            id={detailId}
                          >
                            <h3 id={`${detailId}-heading`}>
                              Transaction details
                            </h3>
                            {details.isPending ? (
                              <p role="status">Loading transaction details…</p>
                            ) : null}
                            {details.isError ? (
                              <p role="alert">{details.error.message}</p>
                            ) : null}
                            {details.data?.transaction.id === transaction.id ? (
                              <>
                                <dl className="transaction-detail-grid">
                                  <dt>Amount</dt>
                                  <dd className="transaction-amount">
                                    {formatMinorUnits(
                                      details.data.transaction.amountMinor,
                                    )}
                                  </dd>
                                  <dt>Transaction date</dt>
                                  <dd>
                                    {details.data.transaction.transactionDate}
                                  </dd>
                                  <dt>Posted date</dt>
                                  <dd>
                                    {details.data.transaction.postedAt ?? "—"}
                                  </dd>
                                  <dt>Description</dt>
                                  <dd>
                                    {details.data.transaction.merchant ?? "—"}
                                  </dd>
                                  <dt>Payee</dt>
                                  <dd>
                                    {details.data.transaction.payee ?? "—"}
                                  </dd>
                                  <dt>Account</dt>
                                  <dd>
                                    {accountNames.get(
                                      details.data.transaction.accountId,
                                    ) ?? "Unknown"}
                                  </dd>
                                  <dt>Category</dt>
                                  <dd>
                                    {categoryNames.get(
                                      details.data.transaction.categoryId ?? "",
                                    ) ?? "Uncategorized"}
                                  </dd>
                                  <dt>Source category</dt>
                                  <dd>
                                    {details.data.transaction.sourceCategory ??
                                      "—"}
                                  </dd>
                                  <dt>Status</dt>
                                  <dd>{details.data.transaction.status}</dd>
                                  <dt>Source identity</dt>
                                  <dd>
                                    {details.data.transaction.sourceIdentity}
                                  </dd>
                                  <dt>Source record ID</dt>
                                  <dd>
                                    {details.data.transaction.sourceRecordId}
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
                                  <dd>{details.data.transaction.createdAt}</dd>
                                  <dt>Last updated</dt>
                                  <dd>{details.data.transaction.updatedAt}</dd>
                                </dl>
                                {details.data.splits.length > 0 ? (
                                  <section
                                    aria-labelledby={`${detailId}-splits`}
                                  >
                                    <h4 id={`${detailId}-splits`}>Splits</h4>
                                    <ul aria-label="Transaction splits">
                                      {details.data.splits.map((split) => (
                                        <li key={split.id}>
                                          {formatMinorUnits(split.amountMinor)}{" "}
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

function Accounts(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateAccount>({
    accountType: "checking",
    currency: "USD",
    name: "",
  });
  const accounts = useQuery({ queryFn: getAccounts, queryKey: ["accounts"] });
  const create = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      setForm((current) => ({ ...current, name: "" }));
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  return (
    <section aria-labelledby="accounts-heading" className="page">
      <h2 id="accounts-heading">Accounts</h2>
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
        <label htmlFor="account-type">Account type</label>
        <select
          id="account-type"
          onChange={(event) =>
            setForm({
              ...form,
              accountType: event.target.value as CreateAccount["accountType"],
            })
          }
          value={form.accountType}
        >
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="cash">Cash</option>
          <option value="credit_card">Credit card</option>
          <option value="loan">Loan</option>
          <option value="investment">Investment</option>
          <option value="other">Other</option>
        </select>
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
      {create.isError ? <p role="alert">{create.error.message}</p> : null}
      {accounts.isPending ? <p role="status">Loading accounts…</p> : null}
      {accounts.isError ? <p role="alert">{accounts.error.message}</p> : null}
      {accounts.data?.length === 0 ? <p>No accounts yet.</p> : null}
      <ul aria-label="Accounts" className="data-list">
        {accounts.data?.map((account) => (
          <li key={account.id}>
            {account.name} — {account.accountType.replaceAll("_", " ")} (
            {account.currency})
          </li>
        ))}
      </ul>
    </section>
  );
}

function Overview(): React.JSX.Element {
  const health = useQuery({
    queryFn: getHealth,
    queryKey: ["health"],
    retry: false,
  });
  return (
    <section aria-labelledby="overview-heading" className="page">
      <h2 id="overview-heading">Workspace overview</h2>
      {health.isPending ? <p role="status">Checking local API…</p> : null}
      {health.isError ? <p role="alert">{health.error.message}</p> : null}
      {health.data === "ok" ? <p role="status">Local API is ready.</p> : null}
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
      <h2 id="planning-heading">Planning assumptions</h2>
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
    accountsRoute,
    transactionsRoute,
    categoriesRoute,
    csvImportRoute,
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
