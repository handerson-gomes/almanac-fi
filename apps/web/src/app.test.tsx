// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { App, appRouter } from "./app.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("renders an accessible dashboard shell and API-ready state", async () => {
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      ),
  );
  await appRouter.load();
  render(<App />);

  const skipLink = screen.getByRole("link", { name: "Skip to main content" });
  expect(skipLink).toHaveClass("skip-link");
  skipLink.focus();
  expect(skipLink).toHaveFocus();
  expect(screen.getByRole("main")).toHaveClass("app-content");
  expect(
    screen.getByRole("navigation", { name: "Primary navigation" }),
  ).toHaveClass("primary-nav");
  expect(await screen.findByText("Local API is ready.")).toBeInTheDocument();
});

test("renders the accounts screen and its account creation form", async () => {
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      ),
  );
  await appRouter.navigate({ to: "/accounts" });
  await appRouter.load();
  render(<App />);

  expect(
    await screen.findByRole("heading", { name: "Accounts" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Account name")).toBeRequired();
  expect(await screen.findByText("No accounts yet.")).toBeInTheDocument();
});

test("renders transactions in aligned account and category columns", async () => {
  const accountId = "11111111-1111-4111-8111-111111111111";
  const categoryId = "22222222-2222-4222-8222-222222222222";
  const createdAt = "2026-07-13T00:00:00.000Z";
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const path = input.toString();
      if (path === "/api/transactions") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  accountId,
                  amountMinor: -6544,
                  categoryId,
                  createdAt,
                  currency: "USD",
                  id: "33333333-3333-4333-8333-333333333333",
                  isCurrent: true,
                  merchant: "Coffee Shop",
                  payee: null,
                  postedAt: null,
                  replacesTransactionId: null,
                  sourceCategory: "Food",
                  sourceIdentity: "csv:coffee-shop",
                  sourceRecordId: "44444444-4444-4444-8444-444444444444",
                  status: "posted",
                  transactionDate: createdAt,
                  updatedAt: createdAt,
                },
              ],
              nextCursor: "older-page",
            }),
            { status: 200 },
          ),
        );
      }
      if (path === "/api/transactions?cursor=older-page") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  accountId,
                  amountMinor: -1234,
                  categoryId,
                  createdAt,
                  currency: "USD",
                  id: "55555555-5555-4555-8555-555555555555",
                  isCurrent: true,
                  merchant: "Older Coffee Shop",
                  payee: null,
                  postedAt: null,
                  replacesTransactionId: null,
                  sourceCategory: "Food",
                  sourceIdentity: "csv:older-coffee-shop",
                  sourceRecordId: "66666666-6666-4666-8666-666666666666",
                  status: "posted",
                  transactionDate: "2026-07-12T00:00:00.000Z",
                  updatedAt: createdAt,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (path === "/api/transactions/33333333-3333-4333-8333-333333333333") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              splits: [],
              transaction: {
                accountId,
                amountMinor: -6544,
                categoryId,
                createdAt,
                currency: "USD",
                id: "33333333-3333-4333-8333-333333333333",
                isCurrent: true,
                merchant: "Coffee Shop",
                payee: null,
                postedAt: null,
                replacesTransactionId: null,
                sourceCategory: "Food",
                sourceIdentity: "csv:coffee-shop",
                sourceRecordId: "44444444-4444-4444-8444-444444444444",
                status: "posted",
                transactionDate: createdAt,
                updatedAt: createdAt,
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (path === "/api/accounts") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  accountType: "checking",
                  connectionId: null,
                  createdAt,
                  currency: "USD",
                  externalId: null,
                  id: accountId,
                  name: "Everyday checking",
                  status: "active",
                  updatedAt: createdAt,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              {
                createdAt,
                id: categoryId,
                name: "Food",
                parentId: null,
                status: "active",
                updatedAt: createdAt,
              },
            ],
          }),
          { status: 200 },
        ),
      );
    }),
  );
  await appRouter.navigate({ to: "/transactions" });
  await appRouter.load();
  render(<App />);

  const table = await screen.findByRole("table", { name: "Transactions" });
  expect(table).toHaveTextContent("Date");
  expect(table).toHaveTextContent("Description");
  expect(table).toHaveTextContent("Account");
  expect(table).toHaveTextContent("Category");
  expect(table).toHaveTextContent("Amount");
  expect(screen.getByRole("cell", { name: "Everyday checking" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "Food" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "-65.44" })).toBeVisible();
  expect(table).not.toHaveTextContent("USD");
  const detailsButton = screen.getByRole("button", {
    name: "Show details for Coffee Shop",
  });
  expect(detailsButton).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(detailsButton);
  expect(
    await screen.findByRole("heading", { name: "Transaction details" }),
  ).toBeVisible();
  expect(await screen.findByText("csv:coffee-shop")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Hide details for Coffee Shop" }),
  ).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(
    screen.getByRole("button", { name: "Hide details for Coffee Shop" }),
  );
  expect(
    screen.queryByRole("heading", { name: "Transaction details" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Load more transactions" }),
  );
  expect(await screen.findByRole("cell", { name: "-12.34" })).toBeVisible();
});

test("renders the CSV mapping and import wizard", async () => {
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      ),
  );
  await appRouter.navigate({ to: "/import" });
  await appRouter.load();
  render(<App />);

  expect(
    await screen.findByRole("heading", { name: "Import CSV" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("CSV file")).toHaveAttribute("type", "file");
  expect(screen.getByRole("button", { name: "Preview import" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("CSV content"), {
    target: {
      value:
        "Trans. Date,Post Date,Description,Amount,Category\n07/09/2024,07/10/2024,Coffee,65.44,Food",
    },
  });
  expect(screen.getByLabelText("Date column")).toHaveValue("Trans. Date");
  expect(screen.getByLabelText("Category column (optional)")).toHaveValue(
    "Category",
  );
  expect(screen.getByLabelText("Date column")).toHaveTextContent("Post Date");
});
