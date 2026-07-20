import { expect, test } from "vitest";

import {
  deduplicateSimpleFinAccounts,
  inferAccountType,
} from "./simplefin-sync.js";

test.each([
  ["Spend (7693)", "PNC Bank", "checking"],
  ["Reserve (7717)", "PNC Bank", "checking"],
  ["Growth (7725)", "PNC Bank", "savings"],
  ["United Explorer (6584)", "Chase Bank", "credit_card"],
  ["SEP-IRA (3865)", "Fidelity Investments", "traditional_sep_ira"],
  ["ADVANCE 401(K) PLAN (8673)", "Fidelity Investments", "traditional_401k"],
  ["Individual 401(k) ...964", "Charles Schwab US", "traditional_401k"],
  ["Individual ...535", "Charles Schwab US", "taxable_brokerage"],
  ["Account (7709)", "PNC Bank", "unclassified"],
] as const)(
  "classifies %s at %s as %s",
  (accountName, institutionName, expected) => {
    expect(inferAccountType(accountName, institutionName)).toBe(expected);
  },
);

test("prefers a descriptive typed account over an identical generic suffix duplicate", () => {
  const connection = {
    id: "pnc-connection",
    name: "PNC login",
    organizationId: "pnc",
    organizationName: "PNC Bank",
    organizationUrl: "https://pnc.example",
  };
  const transaction = {
    amount: "-12.34",
    description: "Market",
    extra: { category: "Groceries" },
    pending: false,
    posted: 1_700_000_000,
    transactedAt: 1_700_000_000,
  };
  const generic = {
    availableBalance: "0.00",
    balance: "20000.00",
    balanceDate: 1_700_000_000,
    connectionId: connection.id,
    currency: "USD",
    id: "generic-7709",
    name: "Account (7709)",
    transactions: [{ ...transaction, id: "generic-transaction" }],
  };
  const checking = {
    ...generic,
    availableBalance: "26556.35",
    balance: "26556.35",
    id: "spend-7709",
    name: "Spend (7709)",
    transactions: [{ ...transaction, id: "checking-transaction" }],
  };

  expect(
    deduplicateSimpleFinAccounts([generic, checking], [connection]),
  ).toEqual({
    accounts: [checking],
    duplicates: [{ canonical: checking, duplicate: generic }],
  });
});

test("keeps same-suffix accounts when their transaction content differs", () => {
  const connection = {
    id: "pnc-connection",
    name: "PNC login",
    organizationId: "pnc",
    organizationName: "PNC Bank",
    organizationUrl: "https://pnc.example",
  };
  const account = {
    availableBalance: "1.00",
    balance: "1.00",
    balanceDate: 1_700_000_000,
    connectionId: connection.id,
    currency: "USD",
    id: "generic-7709",
    name: "Account (7709)",
    transactions: [
      {
        amount: "-1.00",
        description: "First",
        extra: {},
        id: "first",
        pending: false,
        posted: 1_700_000_000,
        transactedAt: 1_700_000_000,
      },
    ],
  };
  const checking = {
    ...account,
    id: "spend-7709",
    name: "Spend (7709)",
    transactions: [
      {
        ...account.transactions[0]!,
        amount: "-2.00",
        id: "second",
      },
    ],
  };

  expect(
    deduplicateSimpleFinAccounts([account, checking], [connection]),
  ).toEqual({ accounts: [account, checking], duplicates: [] });
});
